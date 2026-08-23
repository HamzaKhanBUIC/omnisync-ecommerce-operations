import type { PlatformType, NormalizedOrder, SyncResult } from '../shared/types.ts';
import { TokenBucketLimiter } from '../shared/rateLimiter.ts';

export interface ChannelAdapter {
  platform: PlatformType;
  storeId: string;
  rateLimiter: TokenBucketLimiter;
  
  normalizeOrder(rawPayload: Record<string, any>): NormalizedOrder;
  updateStock(externalItemId: string, newStock: number): Promise<SyncResult>;
  fetchChannelStock(externalItemId: string): Promise<number>;
}

export interface ShopifyInventoryAdjustmentInput {
  inventoryItemId?: string;
  sku: string;
  availableDelta: number;
}

export interface ShopifyInventoryAdjustQuantitiesPayload {
  input: {
    reason: string;
    name: 'available' | 'on_hand';
    changes: ShopifyInventoryAdjustmentInput[];
  };
  idempotent?: boolean;
  idempotencyKey?: string;
}

export interface ShopifyGraphQLResponse<T = any> {
  data?: T;
  errors?: Array<{ message: string; code?: string; extensions?: Record<string, any> }>;
  extensions?: {
    cost: {
      requestedQueryCost: number;
      actualQueryCost: number;
      throttleStatus: {
        maximumAvailable: number;
        currentlyAvailable: number;
        restoreRate: number;
      };
    };
  };
}

export interface WooCommerceBatchItem {
  id?: number | string;
  sku: string;
  stock_quantity: number;
  manage_stock?: boolean;
}

export interface WooCommerceBatchResult {
  success: boolean;
  update?: Array<{
    id: string | number;
    sku: string;
    stock_quantity: number;
    status: string;
    manage_stock: boolean;
  }>;
  errors?: Array<{
    code: string;
    message: string;
    data?: Record<string, any>;
  }>;
  hposCompatible: boolean;
  storageEngine: 'HPOS_TABLES' | 'LEGACY_POSTS';
  latencyMs: number;
}

export class MockShopifyAdapter implements ChannelAdapter {
  public platform: PlatformType = 'SHOPIFY';
  public storeId: string;
  public rateLimiter: TokenBucketLimiter;
  public pointCapacity: number = 40;
  public pointRefillRate: number = 2;
  private channelStockDb: Map<string, number> = new Map();
  private lockedSkus: Set<string> = new Set();

  constructor(storeId: string, initialStockMap?: Record<string, number>, capacity: number = 40, refillRate: number = 2) {
    this.storeId = storeId;
    this.pointCapacity = capacity;
    this.pointRefillRate = refillRate;
    this.rateLimiter = new TokenBucketLimiter(capacity, refillRate);
    if (initialStockMap) {
      for (const [sku, qty] of Object.entries(initialStockMap)) {
        this.channelStockDb.set(sku, qty);
        this.channelStockDb.set(sku.toLowerCase(), qty);
        this.channelStockDb.set(`shp_${sku.toLowerCase()}`, qty);
        this.channelStockDb.set(`shp_item_${sku.toLowerCase()}`, qty);
      }
    }
  }

  public lockSkuForContention(sku: string): void {
    this.lockedSkus.add(sku);
  }

  public unlockSku(sku: string): void {
    this.lockedSkus.delete(sku);
  }

  public getAvailablePoints(): number {
    return this.rateLimiter.getAvailableTokens();
  }

  public normalizeOrder(rawPayload: Record<string, any>): NormalizedOrder {
    return {
      orderId: String(rawPayload.id || `shp_${Date.now()}`),
      storeId: this.storeId,
      platform: 'SHOPIFY',
      orderNumber: String(rawPayload.order_number || rawPayload.name || '1001'),
      items: (rawPayload.line_items || []).map((item: any) => ({
        sku: item.sku,
        quantity: item.quantity,
        price: parseFloat(item.price || '0'),
        title: item.title || 'Product'
      })),
      totalPrice: parseFloat(rawPayload.total_price || '0'),
      currency: rawPayload.currency || 'USD',
      createdAt: rawPayload.created_at || new Date().toISOString()
    };
  }

  public async updateStock(externalItemId: string, newStock: number): Promise<SyncResult> {
    const start = Date.now();
    const allowed = await this.rateLimiter.acquire(1, 2000);
    if (!allowed) {
      return {
        success: false,
        storeId: this.storeId,
        sku: externalItemId,
        updatedStock: this.channelStockDb.get(externalItemId) || 0,
        latencyMs: Date.now() - start,
        error: 'Shopify Rate Limit Exceeded (HTTP 429 simulated)'
      };
    }

    this.channelStockDb.set(externalItemId, newStock);
    this.channelStockDb.set(externalItemId.toLowerCase(), newStock);
    return {
      success: true,
      storeId: this.storeId,
      sku: externalItemId,
      updatedStock: newStock,
      latencyMs: Date.now() - start
    };
  }

  public async inventoryAdjustQuantities(
    payload: ShopifyInventoryAdjustQuantitiesPayload
  ): Promise<ShopifyGraphQLResponse> {
    const changes = payload.input?.changes || [];
    const cost = 10 + changes.length;

    if (changes.length > 250) {
      return {
        errors: [{
          message: 'Input array exceeds maximum limit of 250 inventory adjustments per request',
          code: 'MAX_ARRAY_SIZE_EXCEEDED',
          extensions: { maxAllowed: 250, provided: changes.length }
        }],
        extensions: {
          cost: {
            requestedQueryCost: cost,
            actualQueryCost: 0,
            throttleStatus: {
              maximumAvailable: this.pointCapacity,
              currentlyAvailable: this.rateLimiter.getAvailableTokens(),
              restoreRate: this.pointRefillRate
            }
          }
        }
      };
    }

    const allowed = this.rateLimiter.tryConsume(cost);
    if (!allowed) {
      return {
        errors: [{
          message: 'Throttled',
          code: 'THROTTLED',
          extensions: {
            code: 'THROTTLED',
            documentation: 'https://shopify.dev/api/usage/rate-limits'
          }
        }],
        extensions: {
          cost: {
            requestedQueryCost: cost,
            actualQueryCost: 0,
            throttleStatus: {
              maximumAvailable: this.pointCapacity,
              currentlyAvailable: this.rateLimiter.getAvailableTokens(),
              restoreRate: this.pointRefillRate
            }
          }
        }
      };
    }

    for (const change of changes) {
      if (this.lockedSkus.has(change.sku)) {
        return {
          data: {
            inventoryAdjustQuantities: {
              userErrors: [{
                field: ['input', 'changes'],
                message: `quantities couldn't be adjusted due to concurrent lock contention on inventory item: ${change.sku}`
              }],
              inventoryLevels: []
            }
          },
          extensions: {
            cost: {
              requestedQueryCost: cost,
              actualQueryCost: cost,
              throttleStatus: {
                maximumAvailable: this.pointCapacity,
                currentlyAvailable: this.rateLimiter.getAvailableTokens(),
                restoreRate: this.pointRefillRate
              }
            }
          }
        };
      }
    }

    const inventoryLevels = [];
    for (const change of changes) {
      const current = this.channelStockDb.get(change.sku) ?? 0;
      const updated = current + change.availableDelta;
      this.channelStockDb.set(change.sku, updated);
      this.channelStockDb.set(change.sku.toLowerCase(), updated);
      inventoryLevels.push({
        item: {
          id: change.inventoryItemId || `gid://shopify/InventoryItem/${change.sku}`,
          sku: change.sku
        },
        quantities: [{ name: payload.input.name || 'available', quantity: updated }]
      });
    }

    return {
      data: {
        inventoryAdjustQuantities: {
          userErrors: [],
          inventoryLevels
        }
      },
      extensions: {
        cost: {
          requestedQueryCost: cost,
          actualQueryCost: cost,
          throttleStatus: {
            maximumAvailable: this.pointCapacity,
            currentlyAvailable: this.rateLimiter.getAvailableTokens(),
            restoreRate: this.pointRefillRate
          }
        }
      }
    };
  }

  public async fetchChannelStock(externalItemId: string): Promise<number> {
    return this.channelStockDb.get(externalItemId) ??
      this.channelStockDb.get(externalItemId.toLowerCase()) ??
      this.channelStockDb.get(`shp_${externalItemId.toLowerCase()}`) ??
      this.channelStockDb.get(`shp_item_${externalItemId.toLowerCase()}`) ?? 0;
  }
}

export class MockWooCommerceAdapter implements ChannelAdapter {
  public platform: PlatformType = 'WOOCOMMERCE';
  public storeId: string;
  public rateLimiter: TokenBucketLimiter;
  public hposEnabled: boolean = true;
  public simulateServerFailure: boolean = false;
  public simulateFailureCode: number = 503;
  private channelStockDb: Map<string, number> = new Map();

  constructor(storeId: string, initialStockMap?: Record<string, number>, hposEnabled: boolean = true) {
    this.storeId = storeId;
    this.hposEnabled = hposEnabled;
    this.rateLimiter = new TokenBucketLimiter(25, 5);
    if (initialStockMap) {
      for (const [sku, qty] of Object.entries(initialStockMap)) {
        this.channelStockDb.set(sku, qty);
        this.channelStockDb.set(sku.toLowerCase(), qty);
        this.channelStockDb.set(`wc_${sku.toLowerCase()}`, qty);
        this.channelStockDb.set(`wc_item_${sku.toLowerCase()}`, qty);
      }
    }
  }

  public setHposEnabled(enabled: boolean): void {
    this.hposEnabled = enabled;
  }

  public setSimulateServerFailure(enable: boolean, code: number = 503): void {
    this.simulateServerFailure = enable;
    this.simulateFailureCode = code;
  }

  public normalizeOrder(rawPayload: Record<string, any>): NormalizedOrder {
    return {
      orderId: String(rawPayload.id || `wc_${Date.now()}`),
      storeId: this.storeId,
      platform: 'WOOCOMMERCE',
      orderNumber: String(rawPayload.number || rawPayload.id || '2001'),
      items: (rawPayload.line_items || []).map((item: any) => ({
        sku: item.sku,
        quantity: item.quantity,
        price: parseFloat(item.price || '0'),
        title: item.name || 'Product'
      })),
      totalPrice: parseFloat(rawPayload.total || '0'),
      currency: rawPayload.currency || 'EUR',
      createdAt: rawPayload.date_created || new Date().toISOString()
    };
  }

  public async updateStock(externalItemId: string, newStock: number): Promise<SyncResult> {
    const start = Date.now();
    const allowed = await this.rateLimiter.acquire(1, 2000);
    if (!allowed) {
      return {
        success: false,
        storeId: this.storeId,
        sku: externalItemId,
        updatedStock: this.channelStockDb.get(externalItemId) || 0,
        latencyMs: Date.now() - start,
        error: 'WooCommerce Server Overload (HTTP 503 simulated)'
      };
    }

    this.channelStockDb.set(externalItemId, newStock);
    this.channelStockDb.set(externalItemId.toLowerCase(), newStock);
    return {
      success: true,
      storeId: this.storeId,
      sku: externalItemId,
      updatedStock: newStock,
      latencyMs: Date.now() - start
    };
  }

  public async batchUpdateStock(items: WooCommerceBatchItem[]): Promise<WooCommerceBatchResult> {
    const start = Date.now();
    const storageEngine = this.hposEnabled ? 'HPOS_TABLES' : 'LEGACY_POSTS';

    if (items.length > 100) {
      return {
        success: false,
        errors: [{
          code: 'woocommerce_rest_batch_limit_exceeded',
          message: 'Batch size exceeds 100 objects maximum limit. Recommended chunk size is 25-50 items per payload.'
        }],
        hposCompatible: this.hposEnabled,
        storageEngine,
        latencyMs: Date.now() - start
      };
    }

    if (this.simulateServerFailure) {
      return {
        success: false,
        errors: [{
          code: this.simulateFailureCode === 503 ? 'woocommerce_server_overload_503' : 'woocommerce_gateway_timeout_504',
          message: this.simulateFailureCode === 503 
            ? 'HTTP 503 Backend Fetch Failed: Action Scheduler worker pool saturated during batch cache invalidation' 
            : 'HTTP 504 Gateway Timeout: PHP execution time exceeded 30s'
        }],
        hposCompatible: this.hposEnabled,
        storageEngine,
        latencyMs: Date.now() - start
      };
    }

    const allowed = this.rateLimiter.tryConsume(1);
    if (!allowed) {
      return {
        success: false,
        errors: [{
          code: 'woocommerce_rate_limit_exhausted',
          message: 'WooCommerce rate limit exhausted (HTTP 429 Too Many Requests)'
        }],
        hposCompatible: this.hposEnabled,
        storageEngine,
        latencyMs: Date.now() - start
      };
    }

    const updated = [];
    for (const item of items) {
      if (!item.sku || typeof item.stock_quantity !== 'number' || item.stock_quantity < 0) {
        return {
          success: false,
          errors: [{
            code: 'rest_invalid_param',
            message: `Invalid product parameter: SKU '${item.sku}' with quantity ${item.stock_quantity}`
          }],
          hposCompatible: this.hposEnabled,
          storageEngine,
          latencyMs: Date.now() - start
        };
      }

      this.channelStockDb.set(item.sku, item.stock_quantity);
      this.channelStockDb.set(item.sku.toLowerCase(), item.stock_quantity);
      updated.push({
        id: item.id || `wc_prod_${item.sku}`,
        sku: item.sku,
        stock_quantity: item.stock_quantity,
        status: 'publish',
        manage_stock: item.manage_stock ?? true
      });
    }

    return {
      success: true,
      update: updated,
      hposCompatible: this.hposEnabled,
      storageEngine,
      latencyMs: Date.now() - start
    };
  }

  public async fetchChannelStock(externalItemId: string): Promise<number> {
    return this.channelStockDb.get(externalItemId) ??
      this.channelStockDb.get(externalItemId.toLowerCase()) ??
      this.channelStockDb.get(`wc_${externalItemId.toLowerCase()}`) ??
      this.channelStockDb.get(`wc_item_${externalItemId.toLowerCase()}`) ?? 0;
  }
}
