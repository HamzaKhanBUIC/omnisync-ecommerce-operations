import { test } from 'node:test';
import * as assert from 'node:assert';
import { MasterLedgerEngine } from '../../src/backend/ledgerEngine.ts';

test('Composite Bundles - Virtual Stock Calculation and Atomic Component Deductions', async () => {
  const ledger = new MasterLedgerEngine();

  // Register raw components
  ledger.registerProduct('SHIRT-BLK-M', 'Classic Black T-Shirt (M)', 50, { price: 29.99 });
  ledger.registerProduct('CAP-NVY-OS', 'Embroidered Navy Cap (OS)', 20, { price: 24.99 });
  ledger.registerProduct('SOCKS-WHT-PK', 'Athletic White Socks (3-Pack)', 100, { price: 14.99 });

  // Register Bundle SKU: "SUMMER-COMBO-01" = 2x T-Shirt + 1x Cap + 2x Socks
  ledger.registerProduct('SUMMER-COMBO-01', 'Ultimate Summer Apparel Combo', 0, {
    price: 89.99,
    isBundle: true,
    bundleRecipe: [
      { componentSku: 'SHIRT-BLK-M', quantityRequired: 2 },
      { componentSku: 'CAP-NVY-OS', quantityRequired: 1 },
      { componentSku: 'SOCKS-WHT-PK', quantityRequired: 2 }
    ]
  });

  // 1. Verify calculated virtual stock
  // SHIRT has 50 (max 25 bundles), CAP has 20 (max 20 bundles), SOCKS has 100 (max 50 bundles)
  // Bottleneck component is CAP -> exactly 20 bundles available
  const bundle = ledger.getProduct('SUMMER-COMBO-01')!;
  assert.strictEqual(bundle.currentStock, 20, 'Virtual bundle stock should equal the bottleneck component capacity (20)');

  // 2. Fulfill an order for 5 bundles
  const result = await ledger.applyDelta('SUMMER-COMBO-01', -5, 'ORDER_FULFILLED', 'store_shopify_us', 'ORD-BUNDLE-991');
  assert.strictEqual(result.success, true, 'Bundle order fulfillment should succeed');

  // Verify component stock decrements:
  // SHIRT: 50 - (5 * 2) = 40
  // CAP: 20 - (5 * 1) = 15
  // SOCKS: 100 - (5 * 2) = 90
  const shirt = ledger.getProduct('SHIRT-BLK-M')!;
  const cap = ledger.getProduct('CAP-NVY-OS')!;
  const socks = ledger.getProduct('SOCKS-WHT-PK')!;

  assert.strictEqual(shirt.currentStock, 40, 'Shirt stock should be decremented by 10 units');
  assert.strictEqual(cap.currentStock, 15, 'Cap stock should be decremented by 5 units');
  assert.strictEqual(socks.currentStock, 90, 'Socks stock should be decremented by 10 units');

  // Verify resulting virtual bundle stock is now 15
  const updatedBundle = ledger.getProduct('SUMMER-COMBO-01')!;
  assert.strictEqual(updatedBundle.currentStock, 15, 'Updated bundle stock should reflect remaining bottleneck (15)');

  // 3. Attempt to fulfill 16 bundles (exceeding stock by 1)
  const overOrder = await ledger.applyDelta('SUMMER-COMBO-01', -16, 'ORDER_FULFILLED', 'store_shopify_us', 'ORD-BUNDLE-OVER');
  assert.strictEqual(overOrder.success, false, 'Over-ordering bundles must be rejected');
  assert.match(overOrder.error!, /Insufficient component stock/, 'Error should specify insufficient component stock');
});
