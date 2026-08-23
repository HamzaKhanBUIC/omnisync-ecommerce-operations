import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  MockShopifyAdapter, 
  MockWooCommerceAdapter,
  type ShopifyInventoryAdjustQuantitiesPayload,
  type WooCommerceBatchItem
} from '../../src/integrations/channelAdapter.ts';

// ---------------------------------------------------------------------------
// 1. SHOPIFY GRAPHQL ADAPTER INTEGRATION TESTS
// ---------------------------------------------------------------------------

test('Shopify Adapter - Order Normalization with standard and fallback payloads', () => {
  const shopify = new MockShopifyAdapter('store_shopify_us');

  // Case A: Standard Shopify Webhook Payload
  const rawShopifyOrder = {
    id: 9988776655,
    order_number: 1042,
    name: '#1042',
    currency: 'USD',
    total_price: '249.99',
    created_at: '2026-08-24T01:00:00Z',
    line_items: [
      { id: 1, sku: 'HOODIE-BLK-L', quantity: 2, price: '89.99', title: 'Heavyweight Hoodie' },
      { id: 2, sku: 'CAP-NVY-OS', quantity: 1, price: '70.01', title: 'Embroidered Cap' }
    ]
  };

  const normalized = shopify.normalizeOrder(rawShopifyOrder);
  assert.equal(normalized.orderId, '9988776655');
  assert.equal(normalized.storeId, 'store_shopify_us');
  assert.equal(normalized.platform, 'SHOPIFY');
  assert.equal(normalized.orderNumber, '1042');
  assert.equal(normalized.currency, 'USD');
  assert.equal(normalized.totalPrice, 249.99);
  assert.equal(normalized.items.length, 2);
  assert.equal(normalized.items[0].sku, 'HOODIE-BLK-L');
  assert.equal(normalized.items[0].quantity, 2);
  assert.equal(normalized.items[0].price, 89.99);

  // Case B: Minimal / Fallback Payload
  const minimalOrder = {
    id: 112233
  };
  const normMinimal = shopify.normalizeOrder(minimalOrder);
  assert.equal(normMinimal.orderId, '112233');
  assert.equal(normMinimal.orderNumber, '1001');
  assert.equal(normMinimal.currency, 'USD');
  assert.equal(normMinimal.totalPrice, 0);
  assert.equal(normMinimal.items.length, 0);
});

test('Shopify Adapter - inventoryAdjustQuantities GraphQL Mutation execution', async () => {
  const shopify = new MockShopifyAdapter('store_shopify_us', {
    'TEE-WHT-S': 50,
    'TEE-WHT-M': 75,
    'TEE-WHT-L': 100
  });

  const mutationPayload: ShopifyInventoryAdjustQuantitiesPayload = {
    input: {
      reason: 'correction',
      name: 'available',
      changes: [
        { inventoryItemId: 'gid://shopify/InventoryItem/101', sku: 'TEE-WHT-S', availableDelta: -5 },
        { inventoryItemId: 'gid://shopify/InventoryItem/102', sku: 'TEE-WHT-M', availableDelta: 10 },
        { inventoryItemId: 'gid://shopify/InventoryItem/103', sku: 'TEE-WHT-L', availableDelta: -20 }
      ]
    },
    idempotencyKey: 'idemp_mut_001'
  };

  const response = await shopify.inventoryAdjustQuantities(mutationPayload);

  // Verify GraphQL Response Structure
  assert.ok(response.data?.inventoryAdjustQuantities);
  assert.equal(response.data.inventoryAdjustQuantities.userErrors.length, 0);
  assert.equal(response.data.inventoryAdjustQuantities.inventoryLevels.length, 3);

  // Verify resulting quantities in adapter DB
  assert.equal(await shopify.fetchChannelStock('TEE-WHT-S'), 45);
  assert.equal(await shopify.fetchChannelStock('TEE-WHT-M'), 85);
  assert.equal(await shopify.fetchChannelStock('TEE-WHT-L'), 80);

  // Verify GraphQL Cost Extension
  assert.ok(response.extensions?.cost);
  assert.equal(response.extensions.cost.requestedQueryCost, 13); // 10 base + 3 changes
  assert.equal(response.extensions.cost.actualQueryCost, 13);
  assert.ok(response.extensions.cost.throttleStatus.currentlyAvailable <= 27);
});

test('Shopify Adapter - inventoryAdjustQuantities hard limit (max 250 adjustments)', async () => {
  const shopify = new MockShopifyAdapter('store_shopify_us');

  // Generate 251 changes (exceeds Shopify limit)
  const excessiveChanges = Array.from({ length: 251 }).map((_, i) => ({
    inventoryItemId: `gid://shopify/InventoryItem/${i}`,
    sku: `SKU-EXCESS-${i}`,
    availableDelta: 1
  }));

  const payload: ShopifyInventoryAdjustQuantitiesPayload = {
    input: {
      reason: 'bulk_correction',
      name: 'available',
      changes: excessiveChanges
    }
  };

  const res = await shopify.inventoryAdjustQuantities(payload);
  assert.ok(res.errors);
  assert.equal(res.errors[0].code, 'MAX_ARRAY_SIZE_EXCEEDED');
  assert.match(res.errors[0].message, /250 inventory adjustments/);
});

test('Shopify Adapter - Concurrent Lock Contention simulation and userErrors', async () => {
  const shopify = new MockShopifyAdapter('store_shopify_us', { 'HOT-DROP-SNEAKER': 10 });

  // Simulate Shopify DB lock contention on the hot drop item
  shopify.lockSkuForContention('HOT-DROP-SNEAKER');

  const payload: ShopifyInventoryAdjustQuantitiesPayload = {
    input: {
      reason: 'order',
      name: 'available',
      changes: [{ sku: 'HOT-DROP-SNEAKER', availableDelta: -1 }]
    }
  };

  const lockedRes = await shopify.inventoryAdjustQuantities(payload);
  assert.ok(lockedRes.data?.inventoryAdjustQuantities.userErrors.length);
  assert.match(lockedRes.data.inventoryAdjustQuantities.userErrors[0].message, /concurrent lock contention/);
  // Channel stock should remain unchanged
  assert.equal(await shopify.fetchChannelStock('HOT-DROP-SNEAKER'), 10);

  // Unlock and retry mutation
  shopify.unlockSku('HOT-DROP-SNEAKER');
  const retryRes = await shopify.inventoryAdjustQuantities(payload);
  assert.equal(retryRes.data?.inventoryAdjustQuantities.userErrors.length, 0);
  assert.equal(await shopify.fetchChannelStock('HOT-DROP-SNEAKER'), 9);
});

test('Shopify Adapter - Leaky bucket point depletion and THROTTLED response', async () => {
  // Setup Shopify adapter with small bucket: 25 capacity, 10 refill/sec
  const shopify = new MockShopifyAdapter('store_shopify_small', { 'SKU-A': 100 }, 25, 10);

  // First mutation costs 11 points (10 base + 1 item) -> 14 points remain
  const mut1 = await shopify.inventoryAdjustQuantities({
    input: { reason: 'restock', name: 'available', changes: [{ sku: 'SKU-A', availableDelta: 5 }] }
  });
  assert.ok(!mut1.errors, 'First mutation should succeed');

  // Second mutation costs 11 points -> 3 points remain
  const mut2 = await shopify.inventoryAdjustQuantities({
    input: { reason: 'restock', name: 'available', changes: [{ sku: 'SKU-A', availableDelta: 5 }] }
  });
  assert.ok(!mut2.errors, 'Second mutation should succeed');

  // Third mutation costs 11 points -> Only ~3 remain -> THROTTLED
  const throttledMut = await shopify.inventoryAdjustQuantities({
    input: { reason: 'restock', name: 'available', changes: [{ sku: 'SKU-A', availableDelta: 5 }] }
  });
  assert.ok(throttledMut.errors, 'Third mutation must be throttled');
  assert.equal(throttledMut.errors[0].code, 'THROTTLED');
  assert.equal(throttledMut.extensions?.cost.actualQueryCost, 0);

  // Wait 150ms for refill (~1.5 points) -> not enough for 11 points
  await new Promise(r => setTimeout(r, 150));
  const stillThrottled = await shopify.inventoryAdjustQuantities({
    input: { reason: 'restock', name: 'available', changes: [{ sku: 'SKU-A', availableDelta: 5 }] }
  });
  assert.ok(stillThrottled.errors, 'Still throttled before full replenishment');

  // Wait 1000ms for full bucket refill (10 points added)
  await new Promise(r => setTimeout(r, 1000));
  const recoveredMut = await shopify.inventoryAdjustQuantities({
    input: { reason: 'restock', name: 'available', changes: [{ sku: 'SKU-A', availableDelta: 5 }] }
  });
  assert.ok(!recoveredMut.errors, 'Mutation should succeed after token refill');
});

// ---------------------------------------------------------------------------
// 2. WOOCOMMERCE REST V3 ADAPTER INTEGRATION TESTS
// ---------------------------------------------------------------------------

test('WooCommerce Adapter - Order Normalization with HPOS & legacy metadata', () => {
  const woo = new MockWooCommerceAdapter('store_woo_eu');

  const rawWooOrder = {
    id: 7041,
    number: 'WC-7041',
    currency: 'EUR',
    total: '180.50',
    date_created: '2026-08-24T02:30:00',
    line_items: [
      { id: 44, sku: 'JACKET-BRN-XL', quantity: 1, price: '180.50', name: 'Vintage Leather Jacket' }
    ],
    meta_data: [
      { key: '_hpos_storage_version', value: '8.2.0' },
      { key: '_billing_tax_id', value: 'DE999888777' }
    ]
  };

  const normalized = woo.normalizeOrder(rawWooOrder);
  assert.equal(normalized.orderId, '7041');
  assert.equal(normalized.storeId, 'store_woo_eu');
  assert.equal(normalized.platform, 'WOOCOMMERCE');
  assert.equal(normalized.orderNumber, 'WC-7041');
  assert.equal(normalized.currency, 'EUR');
  assert.equal(normalized.totalPrice, 180.50);
  assert.equal(normalized.items.length, 1);
  assert.equal(normalized.items[0].sku, 'JACKET-BRN-XL');
  assert.equal(normalized.items[0].quantity, 1);
  assert.equal(normalized.items[0].title, 'Vintage Leather Jacket');
});

test('WooCommerce Adapter - REST v3 Batch Stock Updates with HPOS storage', async () => {
  const woo = new MockWooCommerceAdapter('store_woo_eu', {
    'SKU-WOO-1': 10,
    'SKU-WOO-2': 20,
    'SKU-WOO-3': 30
  }, true); // HPOS enabled

  const batchPayload: WooCommerceBatchItem[] = [
    { sku: 'SKU-WOO-1', stock_quantity: 15 },
    { sku: 'SKU-WOO-2', stock_quantity: 25 },
    { sku: 'SKU-WOO-3', stock_quantity: 35 }
  ];

  const batchResult = await woo.batchUpdateStock(batchPayload);

  assert.equal(batchResult.success, true);
  assert.equal(batchResult.hposCompatible, true);
  assert.equal(batchResult.storageEngine, 'HPOS_TABLES');
  assert.equal(batchResult.update?.length, 3);
  assert.equal(batchResult.update?.[0].sku, 'SKU-WOO-1');
  assert.equal(batchResult.update?.[0].stock_quantity, 15);

  // Verify stock updated in DB
  assert.equal(await woo.fetchChannelStock('SKU-WOO-1'), 15);
  assert.equal(await woo.fetchChannelStock('SKU-WOO-2'), 25);
  assert.equal(await woo.fetchChannelStock('SKU-WOO-3'), 35);
});

test('WooCommerce Adapter - Batch size limit (100 objects) and chunking', async () => {
  const woo = new MockWooCommerceAdapter('store_woo_eu');

  // 101 items exceeds max 100 batch limit
  const oversizedBatch: WooCommerceBatchItem[] = Array.from({ length: 101 }).map((_, i) => ({
    sku: `BATCH-SKU-${i}`,
    stock_quantity: 50
  }));

  const oversizeResult = await woo.batchUpdateStock(oversizedBatch);
  assert.equal(oversizeResult.success, false);
  assert.equal(oversizeResult.errors?.[0].code, 'woocommerce_rest_batch_limit_exceeded');

  // Chunking test: 60 items split into 2 chunks of 30 items
  const sixtyItems: WooCommerceBatchItem[] = Array.from({ length: 60 }).map((_, i) => ({
    sku: `CHUNK-SKU-${i}`,
    stock_quantity: 100
  }));

  const chunk1 = sixtyItems.slice(0, 30);
  const chunk2 = sixtyItems.slice(30, 60);

  const res1 = await woo.batchUpdateStock(chunk1);
  const res2 = await woo.batchUpdateStock(chunk2);

  assert.equal(res1.success, true);
  assert.equal(res2.success, true);
  assert.equal(await woo.fetchChannelStock('CHUNK-SKU-0'), 100);
  assert.equal(await woo.fetchChannelStock('CHUNK-SKU-59'), 100);
});

test('WooCommerce Adapter - HPOS mode toggle and storage engine validation', async () => {
  const woo = new MockWooCommerceAdapter('store_woo_legacy', {}, false); // HPOS disabled (legacy)

  assert.equal(woo.hposEnabled, false);
  const legacyRes = await woo.batchUpdateStock([{ sku: 'LEGACY-SKU', stock_quantity: 42 }]);
  assert.equal(legacyRes.success, true);
  assert.equal(legacyRes.hposCompatible, false);
  assert.equal(legacyRes.storageEngine, 'LEGACY_POSTS');

  // Enable HPOS
  woo.setHposEnabled(true);
  const hposRes = await woo.batchUpdateStock([{ sku: 'HPOS-SKU', stock_quantity: 99 }]);
  assert.equal(hposRes.success, true);
  assert.equal(hposRes.hposCompatible, true);
  assert.equal(hposRes.storageEngine, 'HPOS_TABLES');
});

test('WooCommerce Adapter - Error Handling (HTTP 503 Server Overload & Invalid Params)', async () => {
  const woo = new MockWooCommerceAdapter('store_woo_eu');

  // Case A: Simulate Server Overload (HTTP 503 Action Scheduler saturation)
  woo.setSimulateServerFailure(true, 503);
  const fail503 = await woo.batchUpdateStock([{ sku: 'OVERLOAD-SKU', stock_quantity: 10 }]);
  assert.equal(fail503.success, false);
  assert.equal(fail503.errors?.[0].code, 'woocommerce_server_overload_503');
  assert.match(fail503.errors?.[0].message || '', /Action Scheduler/);

  // Case B: Simulate Gateway Timeout (HTTP 504)
  woo.setSimulateServerFailure(true, 504);
  const fail504 = await woo.batchUpdateStock([{ sku: 'TIMEOUT-SKU', stock_quantity: 10 }]);
  assert.equal(fail504.success, false);
  assert.equal(fail504.errors?.[0].code, 'woocommerce_gateway_timeout_504');

  // Disable simulation
  woo.setSimulateServerFailure(false);

  // Case C: Invalid product parameters (e.g. negative stock)
  const invalidRes = await woo.batchUpdateStock([{ sku: 'INVALID-QTY', stock_quantity: -5 }]);
  assert.equal(invalidRes.success, false);
  assert.equal(invalidRes.errors?.[0].code, 'rest_invalid_param');
});
