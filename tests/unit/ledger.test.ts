import test from 'node:test';
import assert from 'node:assert/strict';
import { MasterLedgerEngine } from '../../src/backend/ledgerEngine.ts';

test('MasterLedgerEngine - Atomic deltas and audit logging', async () => {
  const ledger = new MasterLedgerEngine();
  const product = ledger.registerProduct('SKU-100', 'Test Product', 50);

  assert.equal(product.currentStock, 50);
  assert.equal(product.version, 1);

  // Apply reduction
  const res1 = await ledger.applyDelta('SKU-100', -5, 'ORDER_FULFILLED', 'store_1', 'ord_1');
  assert.equal(res1.success, true);
  assert.equal(res1.newStock, 45);

  const updatedProd = ledger.getProduct('SKU-100');
  assert.equal(updatedProd?.currentStock, 45);
  assert.equal(updatedProd?.version, 2);

  // Prevent stockout oversell
  const res2 = await ledger.applyDelta('SKU-100', -100, 'ORDER_FULFILLED', 'store_1', 'ord_2');
  assert.equal(res2.success, false);
  assert.match(res2.error || '', /Insufficient stock/);

  // Verify Audit Trail length
  const audit = ledger.getAuditTrail('SKU-100');
  assert.equal(audit.length, 2); // Initial creation + 1 valid deduction
});
