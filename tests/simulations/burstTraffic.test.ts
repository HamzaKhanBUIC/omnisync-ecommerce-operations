import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { MasterLedgerEngine } from '../../src/backend/ledgerEngine.ts';
import { EcommerceOperationsOrchestrator } from '../../src/workflows/orchestrator.ts';
import { MockShopifyAdapter, MockWooCommerceAdapter } from '../../src/integrations/channelAdapter.ts';

test('Flash Sale Burst: 1,000 Rapid Order Checkout Webhooks Across Multi-Channel Stores', async () => {
  const ledger = new MasterLedgerEngine();

  // Register high-contention flash sale SKUs with limited inventory
  const flashSkus = [
    { sku: 'FLASH-SNEAKER-001', title: 'Limited Cyber Runner Sneaker', initialStock: 100 },
    { sku: 'FLASH-WATCH-002', title: 'Limited Chronograph Obsidian', initialStock: 50 },
    { sku: 'FLASH-HOODIE-003', title: 'Limited Edition Heavyweight Hoodie', initialStock: 20 }
  ];

  const initialTotalStock = flashSkus.reduce((sum, s) => sum + s.initialStock, 0); // 170 units total

  for (const s of flashSkus) {
    ledger.registerProduct(s.sku, s.title, s.initialStock);
  }

  const orchestrator = new EcommerceOperationsOrchestrator(ledger);

  // Initialize 4 multi-channel storefronts
  const storeShopifyUs = new MockShopifyAdapter('store_shopify_us');
  const storeShopifyUk = new MockShopifyAdapter('store_shopify_uk');
  const storeWooEu = new MockWooCommerceAdapter('store_woo_eu');
  const storeWooAsia = new MockWooCommerceAdapter('store_woo_asia');

  orchestrator.registerAdapter(storeShopifyUs);
  orchestrator.registerAdapter(storeShopifyUk);
  orchestrator.registerAdapter(storeWooEu);
  orchestrator.registerAdapter(storeWooAsia);

  const stores = ['store_shopify_us', 'store_shopify_uk', 'store_woo_eu', 'store_woo_asia'];

  // Add channel mappings for all flash SKUs across all 4 stores
  for (const s of flashSkus) {
    for (const storeId of stores) {
      orchestrator.addMapping({
        storeId,
        masterSku: s.sku,
        externalItemId: `${storeId}_${s.sku}`,
        externalSku: `${s.sku}-${storeId.toUpperCase()}`,
        syncEnabled: true
      });
    }
  }

  // Generate 1,000 rapid order checkout webhooks competing for the limited 170 units
  const totalOrdersToSimulate = 1000;
  const orderTasks = Array.from({ length: totalOrdersToSimulate }).map((_, idx) => {
    const originStore = stores[idx % stores.length];
    const targetSkuObj = flashSkus[idx % flashSkus.length];
    const requestedQty = 1; // 1 unit per checkout

    const isShopify = originStore.startsWith('store_shopify');
    const orderPayload = isShopify
      ? {
          id: 100000 + idx,
          order_number: `SHP-${100000 + idx}`,
          line_items: [
            { sku: targetSkuObj.sku, quantity: requestedQty, price: '199.99', title: targetSkuObj.title }
          ],
          total_price: '199.99',
          currency: 'USD'
        }
      : {
          id: 200000 + idx,
          number: `WC-${200000 + idx}`,
          line_items: [
            { sku: targetSkuObj.sku, quantity: requestedQty, price: '199.99', name: targetSkuObj.title }
          ],
          total: '199.99',
          currency: 'EUR'
        };

    const idempotencyKey = `idemp_burst_flash_${idx}_${originStore}_${Date.now()}`;
    return orchestrator.handleInboundOrder(orderPayload, originStore, idempotencyKey);
  });

  const startTime = Date.now();
  const results = await Promise.all(orderTasks);
  const durationMs = Date.now() - startTime;

  // Analysis of results
  const successfulOrders = results.filter(r => r.success);
  const rejectedOrders = results.filter(r => !r.success);

  // Invariant 1: Exactly 170 units fulfilled (100% of available stock)
  assert.equal(
    successfulOrders.length,
    initialTotalStock,
    `Exactly ${initialTotalStock} orders must be fulfilled (got ${successfulOrders.length})`
  );

  // Invariant 2: Exactly 830 orders gracefully rejected for stockout
  assert.equal(
    rejectedOrders.length,
    totalOrdersToSimulate - initialTotalStock,
    `Remaining ${totalOrdersToSimulate - initialTotalStock} orders must be gracefully rejected`
  );

  // Invariant 3: Zero Negative Stock Balances across all SKUs
  for (const s of flashSkus) {
    const product = ledger.getProduct(s.sku);
    assert.ok(product !== undefined, `Product ${s.sku} must exist`);
    assert.equal(
      product.currentStock,
      0,
      `Final stock for exhausted SKU ${s.sku} must be exactly 0 (no negative balances)`
    );
  }

  // Invariant 4: Double-Entry Audit Trail Mathematical Exactness
  for (const s of flashSkus) {
    const auditEntries = ledger.getAuditTrail(s.sku);
    const initialEntry = auditEntries.find(e => e.reason === 'MANUAL_ADJUSTMENT');
    const orderEntries = auditEntries.filter(e => e.reason === 'ORDER_FULFILLED');

    assert.equal(initialEntry?.quantityDelta, s.initialStock);
    assert.equal(orderEntries.length, s.initialStock, `Must have exactly ${s.initialStock} fulfillment audit logs for ${s.sku}`);

    const totalDeducted = orderEntries.reduce((sum, e) => sum + e.quantityDelta, 0);
    assert.equal(totalDeducted, -s.initialStock, `Total deducted (${totalDeducted}) must match initial stock (-${s.initialStock})`);
  }

  // Invariant 5: Graceful Rejection Error Message Quality
  for (const rej of rejectedOrders) {
    assert.ok(
      rej.error?.includes('Insufficient stock'),
      `Rejected order error must state 'Insufficient stock', got: '${rej.error}'`
    );
  }

  console.log(`[PASS] 1,000 Rapid Order Burst Simulation:`);
  console.log(`  - Total Inbound Webhooks: ${totalOrdersToSimulate}`);
  console.log(`  - Successfully Fulfilled: ${successfulOrders.length} / ${initialTotalStock} units`);
  console.log(`  - Safely Rejected (Oversell Prevention): ${rejectedOrders.length}`);
  console.log(`  - Oversell Rate: 0.000%`);
  console.log(`  - Processing Duration: ${durationMs}ms (${(totalOrdersToSimulate / (durationMs / 1000)).toFixed(1)} req/sec)`);
});

test('Flash Sale Burst: Catalog-Wide 1,000 Order Wave Across 100 SKUs', async () => {
  // Load 100-SKU fixture
  const fixturePath = new URL('../fixtures/catalog_100_skus.json', import.meta.url);
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

  const ledger = new MasterLedgerEngine();
  const orchestrator = new EcommerceOperationsOrchestrator(ledger);

  // Register all 100 products
  for (const prod of fixture.products) {
    ledger.registerProduct(prod.masterSku, prod.title, prod.currentStock);
  }

  // Register stores and adapters
  const storeMap: Record<string, any> = {};
  for (const store of fixture.stores) {
    const adapter = store.platform === 'SHOPIFY'
      ? new MockShopifyAdapter(store.id)
      : new MockWooCommerceAdapter(store.id);
    orchestrator.registerAdapter(adapter);
    storeMap[store.id] = adapter;
  }

  // Register all 400 mappings
  for (const m of fixture.channelMappings) {
    orchestrator.addMapping({
      storeId: m.storeId,
      masterSku: m.masterSku,
      externalItemId: m.externalItemId,
      externalSku: m.externalSku,
      syncEnabled: m.syncEnabled
    });
  }

  // Fire 1,000 random checkout webhooks distributed across all 100 SKUs and 4 stores
  const totalWaveOrders = 1000;
  const skus = fixture.products.map((p: any) => p.masterSku);
  const storeIds = fixture.stores.map((s: any) => s.id);

  const waveTasks = Array.from({ length: totalWaveOrders }).map((_, idx) => {
    const targetSku = skus[idx % skus.length];
    const targetStore = storeIds[idx % storeIds.length];
    const qty = 1;

    const payload = {
      id: 500000 + idx,
      order_number: `ORD-WAVE-${500000 + idx}`,
      line_items: [{ sku: targetSku, quantity: qty, price: '100.00', title: targetSku }],
      total_price: '100.00'
    };

    return orchestrator.handleInboundOrder(payload, targetStore, `wave_key_${idx}`);
  });

  const waveResults = await Promise.all(waveTasks);

  // Assert Invariants across the entire 100-SKU catalog:
  for (const prod of fixture.products) {
    const finalProduct = ledger.getProduct(prod.masterSku);
    assert.ok(finalProduct !== undefined);
    assert.ok(
      finalProduct.currentStock >= 0,
      `SKU ${prod.masterSku} must not have negative stock (got ${finalProduct.currentStock})`
    );

    // Verify ledger balance formula: initialStock + sum(deltas) === currentStock
    const auditEntries = ledger.getAuditTrail(prod.masterSku);
    const orderDeltas = auditEntries
      .filter(e => e.reason === 'ORDER_FULFILLED')
      .reduce((sum, e) => sum + e.quantityDelta, 0);

    assert.equal(
      prod.initialStock + orderDeltas,
      finalProduct.currentStock,
      `Ledger balance formula must hold for ${prod.masterSku}`
    );
  }

  const fulfilledCount = waveResults.filter(r => r.success).length;
  const rejectedCount = waveResults.filter(r => !r.success).length;

  assert.equal(fulfilledCount + rejectedCount, totalWaveOrders);
  console.log(`[PASS] 100-SKU Catalog-Wide Burst Wave:`);
  console.log(`  - 1,000 Orders Processed Across 100 SKUs`);
  console.log(`  - Fulfilled: ${fulfilledCount} | Safely Rejected: ${rejectedCount}`);
  console.log(`  - Zero negative balances across all 100 catalog SKUs`);
});

test('Flash Sale Burst: Zero Initial Stock Stockout Barrier (250 Concurrent Orders)', async () => {
  const ledger = new MasterLedgerEngine();
  const zeroStockSku = 'OUT-OF-STOCK-LIMITED-EDITION';
  ledger.registerProduct(zeroStockSku, 'Out of Stock Drop', 0);

  const orchestrator = new EcommerceOperationsOrchestrator(ledger);
  const shopify = new MockShopifyAdapter('store_shopify_oos');
  orchestrator.registerAdapter(shopify);
  orchestrator.addMapping({
    storeId: 'store_shopify_oos',
    masterSku: zeroStockSku,
    externalItemId: 'shp_oos_1',
    externalSku: zeroStockSku,
    syncEnabled: true
  });

  // 250 concurrent requests competing for 0 units
  const zeroStockTasks = Array.from({ length: 250 }).map((_, idx) => {
    const payload = {
      id: 900000 + idx,
      line_items: [{ sku: zeroStockSku, quantity: 1, price: '80.00', title: 'Out of Stock Drop' }]
    };
    return orchestrator.handleInboundOrder(payload, 'store_shopify_oos', `oos_key_${idx}`);
  });

  const results = await Promise.all(zeroStockTasks);
  const successful = results.filter(r => r.success);
  const rejected = results.filter(r => !r.success);

  assert.equal(successful.length, 0, 'Zero orders should be fulfilled when initial stock is 0');
  assert.equal(rejected.length, 250, 'All 250 orders must be rejected gracefully');
  assert.equal(ledger.getProduct(zeroStockSku)?.currentStock, 0, 'Stock must remain 0');

  const auditLog = ledger.getAuditTrail(zeroStockSku);
  assert.equal(auditLog.filter(e => e.reason === 'ORDER_FULFILLED').length, 0, 'No fulfillment entries in ledger');
});

