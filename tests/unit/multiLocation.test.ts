import { test } from 'node:test';
import * as assert from 'node:assert';
import { MasterLedgerEngine } from '../../src/backend/ledgerEngine.ts';

test('Multi-Location Warehouse Inventory - Allocation, Routing & Transfers', async () => {
  const ledger = new MasterLedgerEngine();

  const product = ledger.registerProduct('HOODIE-GRY-L', 'Heavyweight Grey Fleece Hoodie (L)', 100, {
    price: 79.99,
    locations: {
      MAIN_US_3PL: 50,
      WEST_US_HUB: 20,
      EU_CENTRAL: 20,
      UK_FULFILLMENT: 10
    }
  });

  assert.strictEqual(product.locations.MAIN_US_3PL, 50);
  assert.strictEqual(product.locations.EU_CENTRAL, 20);

  // 1. Warehouse Transfer: Move 15 units from MAIN_US_3PL to EU_CENTRAL
  const transfer = await ledger.transferWarehouseStock('HOODIE-GRY-L', 'MAIN_US_3PL', 'EU_CENTRAL', 15);
  assert.strictEqual(transfer.success, true, 'Warehouse transfer should succeed');

  const afterTransfer = ledger.getProduct('HOODIE-GRY-L')!;
  assert.strictEqual(afterTransfer.locations.MAIN_US_3PL, 35, 'Source location should have 35 units');
  assert.strictEqual(afterTransfer.locations.EU_CENTRAL, 35, 'Target location should now have 35 units');
  assert.strictEqual(afterTransfer.currentStock, 100, 'Global master stock must remain unchanged during transfer');

  // 2. Reject transfer exceeding source stock
  const invalidTransfer = await ledger.transferWarehouseStock('HOODIE-GRY-L', 'WEST_US_HUB', 'EU_CENTRAL', 50);
  assert.strictEqual(invalidTransfer.success, false, 'Transfer exceeding source stock must fail');
});
