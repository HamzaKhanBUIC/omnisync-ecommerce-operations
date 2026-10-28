import { EventEmitter } from 'node:events';
import { MasterLedgerEngine } from '../backend/ledgerEngine.ts';
import { IdempotencyGuard } from '../backend/idempotencyGuard.ts';
import { MockShopifyAdapter, MockWooCommerceAdapter, type ChannelAdapter } from '../integrations/channelAdapter.ts';
import { CircuitBreaker } from '../shared/circuitBreaker.ts';
import { isOrderId, validateOrderItems } from '../shared/validation.ts';
import type { Store, ChannelMapping, CloudEvent, NormalizedOrder, WarehouseLocation } from '../shared/types.ts';

export class EcommerceOperationsOrchestrator extends EventEmitter {
  public ledger: MasterLedgerEngine;
  public idempotency: IdempotencyGuard;
  public stores: Map<string, Store> = new Map();
  public adapters: Map<string, ChannelAdapter> = new Map();
  public channelMappings: ChannelMapping[] = [];
  public orders: NormalizedOrder[] = [];
  public circuitBreakers: Map<string, CircuitBreaker> = new Map();

  constructor(ledger?: MasterLedgerEngine, idempotency?: IdempotencyGuard) {
    super();
    this.ledger = ledger || new MasterLedgerEngine();
    this.idempotency = idempotency || new IdempotencyGuard(86400000); // 24h TTL
  }

  public registerStore(store: Store): void {
    this.stores.set(store.id, store);
    if (!this.circuitBreakers.has(store.id)) {
      this.circuitBreakers.set(store.id, new CircuitBreaker(5, 10000));
    }
  }

  public registerAdapter(adapter: ChannelAdapter): void {
    this.adapters.set(adapter.storeId, adapter);
    if (!this.circuitBreakers.has(adapter.storeId)) {
      this.circuitBreakers.set(adapter.storeId, new CircuitBreaker(5, 10000));
    }
  }

  public getAdapter(storeId: string): ChannelAdapter | undefined {
    return this.adapters.get(storeId);
  }

  public addMapping(mapping: ChannelMapping): void {
    if (!mapping.status) {
      mapping.status = 'IN_SYNC';
    }
    this.channelMappings.push(mapping);
  }

  public registerChannelMapping(mapping: ChannelMapping): void {
    this.addMapping(mapping);
  }

  public getChannelMappings(masterSku?: string): ChannelMapping[] {
    if (!masterSku) return [...this.channelMappings];
    return this.channelMappings.filter(m => m.masterSku === masterSku);
  }

  public getOrders(limit: number = 50): NormalizedOrder[] {
    return this.orders.slice(0, limit);
  }

  public getOrderById(orderId: string): NormalizedOrder | undefined {
    return this.orders.find(o => o.orderId === orderId);
  }

  /**
   * Primary Inbound Order Webhook Handler
   */
  public async handleInboundOrder(
    rawPayload: any,
    originStoreId: string,
    idempotencyKey?: string
  ): Promise<{ success: boolean; orderId?: string; error?: string; isDuplicate?: boolean }> {
    // The platform order id is required: it is the order-level idempotency key.
    if (!rawPayload || typeof rawPayload !== 'object' || !isOrderId(rawPayload.id)) {
      return { success: false, error: 'Invalid order: id is required' };
    }
    const eventId = idempotencyKey || `evt_${rawPayload.id || Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const adapter = this.adapters.get(originStoreId);

    let normalized: NormalizedOrder;
    if (adapter) {
      normalized = adapter.normalizeOrder(rawPayload);
    } else {
      normalized = {
        orderId: String(rawPayload.id || rawPayload.order_number || rawPayload.number || Date.now()),
        storeId: originStoreId,
        platform: originStoreId.includes('woo') ? 'WOOCOMMERCE' : 'SHOPIFY',
        orderNumber: String(rawPayload.order_number || rawPayload.number || 'ORD-100'),
        customerEmail: rawPayload.email,
        items: (rawPayload.line_items || []).map((li: any) => ({
          sku: li.sku || li.masterSku,
          quantity: li.quantity,
          price: parseFloat(li.price || '0'),
          title: li.title || li.name || 'Item'
        })),
        status: 'PENDING',
        totalPrice: parseFloat(rawPayload.total_price || rawPayload.total || '0'),
        currency: rawPayload.currency || 'USD',
        createdAt: new Date().toISOString()
      };
    }

    const outcome = await this.handleOrderIngest(normalized, eventId);
    if (outcome.status === 'PROCESSED') {
      return { success: true, orderId: outcome.orderId };
    }
    if (outcome.status === 'DUPLICATE') {
      return { success: true, orderId: outcome.orderId, error: 'Duplicate webhook (idempotent skip)', isDuplicate: true };
    }
    return { success: false, error: outcome.error || 'Order rejected for stockout' };
  }

  /**
   * Ingest and process an order from any channel storefront
   */
  public async handleOrderIngest(
    order: NormalizedOrder,
    eventId: string
  ): Promise<{ status: 'PROCESSED' | 'DUPLICATE' | 'REJECTED'; error?: string; orderId?: string }> {
    // 0. Reject malformed line items (a negative quantity would add stock) before
    //    touching idempotency state or the ledger.
    const invalidItems = validateOrderItems(order.items);
    if (invalidItems) {
      return { status: 'REJECTED', error: `Invalid order: ${invalidItems}` };
    }

    // 1. Idempotency: claim the event id and the order id synchronously, before the
    //    first await, so concurrent or retried deliveries (including a different
    //    event for the same order) cannot deduct stock twice.
    const orderKey = `order:${order.storeId}:${order.orderId}`;
    const inFlight = { orderId: order.orderId, status: 'IN_FLIGHT' };
    if (!this.idempotency.reserve(eventId, inFlight)) {
      const cached = this.idempotency.getResponse(eventId);
      return { status: 'DUPLICATE', orderId: cached?.orderId || order.orderId };
    }
    if (!this.idempotency.reserve(orderKey, inFlight)) {
      this.idempotency.release(eventId);
      return { status: 'DUPLICATE', orderId: order.orderId };
    }
    const releaseKeys = () => {
      this.idempotency.release(eventId);
      this.idempotency.release(orderKey);
    };

    // 2. Pre-check stock for all line items
    for (const item of order.items) {
      const product = this.ledger.getProduct(item.sku);
      if (!product || product.currentStock < item.quantity) {
        releaseKeys(); // a rejected order may be retried after restock
        order.status = 'FAILED_DLQ';
        this.orders.unshift(order);
        this.emitCloudEvent('com.ecom.order.rejected', {
          orderId: order.orderId,
          reason: 'INSUFFICIENT_STOCK',
          sku: item.sku,
          storeId: order.storeId
        });
        return {
          status: 'REJECTED',
          error: `Insufficient stock for ${item.sku}. Available: ${product?.currentStock ?? 0}, Requested: ${item.quantity}`
        };
      }
    }

    // 3. Process Ledger Deductions atomically. If anything below throws, the keys stay
    //    claimed until the TTL expires: a lost retry is safer than a double deduction.
    const deductedItems: Array<{ sku: string; delta: number; newStock: number }> = [];
    for (const item of order.items) {
      const preferredLoc: WarehouseLocation = order.shippingCountry === 'GB' ? 'UK_FULFILLMENT' :
        (order.shippingCountry === 'DE' || order.shippingCountry === 'FR' ? 'EU_CENTRAL' : 'MAIN_US_3PL');

      const result = await this.ledger.applyDelta(
        item.sku,
        -item.quantity,
        'ORDER_FULFILLED',
        order.storeId,
        order.orderId,
        preferredLoc
      );

      if (result.success) {
        deductedItems.push({ sku: item.sku, delta: -item.quantity, newStock: result.newStock });
      }
    }

    order.status = 'SYNCED';
    this.orders.unshift(order);

    // 4. Broadcast updated stock to all mapped channel stores
    for (const item of deductedItems) {
      await this.broadcastInventoryUpdate(item.sku, item.newStock);
      this.emitCloudEvent('com.ecom.inventory.adjusted', {
        masterSku: item.sku,
        quantityDelta: item.delta,
        resultingStock: item.newStock,
        originStoreId: order.storeId,
        orderReference: order.orderId
      });
    }

    const processed = { orderId: order.orderId, status: 'PROCESSED' };
    this.idempotency.markProcessed(eventId, processed);
    this.idempotency.markProcessed(orderKey, processed);
    return { status: 'PROCESSED', orderId: order.orderId };
  }

  /**
   * Broadcast inventory update to all downstream channel stores
   */
  public async broadcastInventoryUpdate(
    masterSku: string,
    newStock: number,
    originStoreId?: string
  ): Promise<void> {
    const mappings = this.channelMappings.filter(m => m.masterSku === masterSku && m.syncEnabled);

    for (const mapping of mappings) {
      const breaker = this.circuitBreakers.get(mapping.storeId);
      if (breaker && !breaker.canExecute()) {
        this.emitCloudEvent('com.ecom.sync.circuit_open', {
          storeId: mapping.storeId,
          sku: masterSku
        });
        continue;
      }

      const adapter = this.adapters.get(mapping.storeId);
      if (adapter) {
        try {
          await adapter.updateStock(mapping.externalItemId, newStock);
          await adapter.updateStock(mapping.masterSku, newStock);
          mapping.channelStock = newStock;
          mapping.status = 'IN_SYNC';
          breaker?.recordSuccess();
        } catch (err: any) {
          mapping.status = 'DRIFT_DETECTED';
          breaker?.recordFailure();
          this.emitCloudEvent('com.ecom.sync.failed', {
            targetStoreId: mapping.storeId,
            externalSku: mapping.externalSku,
            error: err.message
          });
        }
      }
    }
  }

  /**
   * Continuous Drift Auditor
   */
  public async runDriftAudit(): Promise<{
    auditedCount: number;
    driftCount: number;
    repairedCount: number;
    discrepanciesFound: number;
    repaired: number;
    discrepancies: Array<{ sku: string; storeId: string; expected: number; actual: number }>;
  }> {
    let auditedCount = 0;
    let driftCount = 0;
    let repairedCount = 0;
    const discrepancies: Array<{ sku: string; storeId: string; expected: number; actual: number }> = [];

    for (const mapping of this.channelMappings) {
      if (!mapping.syncEnabled) continue;
      auditedCount += 1;

      const product = this.ledger.getProduct(mapping.masterSku);
      if (!product) continue;

      let channelStock = mapping.channelStock ?? product.currentStock;
      const adapter = this.adapters.get(mapping.storeId);
      if (adapter) {
        channelStock = await adapter.fetchChannelStock(mapping.masterSku);
      }

      if (channelStock !== product.currentStock) {
        driftCount += 1;
        discrepancies.push({
          sku: mapping.masterSku,
          storeId: mapping.storeId,
          expected: product.currentStock,
          actual: channelStock
        });

        // Auto-heal discrepancy
        if (adapter) {
          await adapter.updateStock(mapping.externalItemId, product.currentStock);
          await adapter.updateStock(mapping.masterSku, product.currentStock);
        }
        mapping.channelStock = product.currentStock;
        mapping.status = 'IN_SYNC';
        repairedCount += 1;

        this.emitCloudEvent('com.ecom.drift.detected', {
          masterSku: mapping.masterSku,
          storeId: mapping.storeId,
          ledgerStock: product.currentStock,
          channelStock,
          autoRepaired: true
        });
      }
    }

    return {
      auditedCount,
      driftCount,
      repairedCount,
      discrepanciesFound: driftCount,
      repaired: repairedCount,
      discrepancies
    };
  }

  public async reconcileDrift(): Promise<{
    discrepanciesFound: number;
    repaired: number;
    auditedCount: number;
  }> {
    const result = await this.runDriftAudit();
    return {
      discrepanciesFound: result.discrepanciesFound,
      repaired: result.repaired,
      auditedCount: result.auditedCount
    };
  }

  public async auditAndReconcile(): Promise<{
    discrepanciesFound: number;
    repaired: number;
    auditedCount: number;
  }> {
    return this.reconcileDrift();
  }

  public emitCloudEvent(type: string, data: any): void {
    const event: CloudEvent = {
      specversion: '1.0',
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type,
      source: '/ecommerce/orchestrator',
      time: new Date().toISOString(),
      datacontenttype: 'application/json',
      data
    };
    this.emit('cloudEvent', event);
  }
}
