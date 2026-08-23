import test from 'node:test';
import assert from 'node:assert/strict';
import { MasterLedgerEngine } from '../../src/backend/ledgerEngine.ts';
import { EcommerceOperationsOrchestrator } from '../../src/workflows/orchestrator.ts';
import { MockShopifyAdapter, MockWooCommerceAdapter } from '../../src/integrations/channelAdapter.ts';

test('High Concurrency Flash Sale - Zero Overselling Guarantee', async () => {
  const ledger = new MasterLedgerEngine();
  // Only 5 units available of limited edition item
  ledger.registerProduct('LIMITED-EDITION-BOOT', 'Limited Edition Boots', 5);

  const orchestrator = new EcommerceOperationsOrchestrator(ledger);
  const shopifyStore = new MockShopifyAdapter('store_shopify', { 'LIMITED-EDITION-BOOT': 5 });
  const wooStore = new MockWooCommerceAdapter('store_woo', { 'LIMITED-EDITION-BOOT': 5 });

  orchestrator.registerAdapter(shopifyStore);
  orchestrator.registerAdapter(wooStore);

  orchestrator.addMapping({ storeId: 'store_shopify', masterSku: 'LIMITED-EDITION-BOOT', externalItemId: 'shp_1', externalSku: 'LIMITED-EDITION-BOOT', syncEnabled: true });
  orchestrator.addMapping({ storeId: 'store_woo', masterSku: 'LIMITED-EDITION-BOOT', externalItemId: 'wc_1', externalSku: 'LIMITED-EDITION-BOOT', syncEnabled: true });

  // Simulate 30 simultaneous checkout webhooks competing for 5 items
  const orders = Array.from({ length: 30 }).map((_, idx) => {
    const origin = idx % 2 === 0 ? 'store_shopify' : 'store_woo';
    const payload = {
      id: `ord_${idx}`,
      line_items: [{ sku: 'LIMITED-EDITION-BOOT', quantity: 1, price: '120.00' }]
    };
    return orchestrator.handleInboundOrder(payload, origin, `idemp_key_${idx}`);
  });

  const results = await Promise.all(orders);

  const successful = results.filter(r => r.success);
  const rejected = results.filter(r => !r.success);

  assert.equal(successful.length, 5, 'Exactly 5 orders must succeed');
  assert.equal(rejected.length, 25, 'Remaining 25 orders must be rejected for stockout');

  // Master stock must be exactly 0
  const finalProduct = ledger.getProduct('LIMITED-EDITION-BOOT');
  assert.equal(finalProduct?.currentStock, 0);

  // Verify channels received updated stock of 0
  const shopifyStock = await shopifyStore.fetchChannelStock('LIMITED-EDITION-BOOT');
  const wooStock = await wooStore.fetchChannelStock('LIMITED-EDITION-BOOT');
  assert.equal(shopifyStock, 0);
  assert.equal(wooStock, 0);
});

test('Reconciliation Workflow - Drift Detection and Auto-Healing', async () => {
  const ledger = new MasterLedgerEngine();
  ledger.registerProduct('WATCH-GLD', 'Gold Watch', 20);

  const orchestrator = new EcommerceOperationsOrchestrator(ledger);
  const shopifyStore = new MockShopifyAdapter('store_shopify', { 'WATCH-GLD': 20 });
  const wooStore = new MockWooCommerceAdapter('store_woo', { 'WATCH-GLD': 20 });

  orchestrator.registerAdapter(shopifyStore);
  orchestrator.registerAdapter(wooStore);

  orchestrator.addMapping({ storeId: 'store_shopify', masterSku: 'WATCH-GLD', externalItemId: 'shp_w', externalSku: 'WATCH-GLD', syncEnabled: true });
  orchestrator.addMapping({ storeId: 'store_woo', masterSku: 'WATCH-GLD', externalItemId: 'wc_w', externalSku: 'WATCH-GLD', syncEnabled: true });

  // Inject manual drift on WooCommerce store (e.g. someone manually edited stock in WP Admin to 14)
  await wooStore.updateStock('WATCH-GLD', 14);
  assert.equal(await wooStore.fetchChannelStock('WATCH-GLD'), 14);

  // Run Reconciliation
  const auditResult = await orchestrator.reconcileDrift();
  assert.equal(auditResult.discrepanciesFound, 1);
  assert.equal(auditResult.repaired, 1);

  // WooCommerce stock must now match Master Ledger (20)
  assert.equal(await wooStore.fetchChannelStock('WATCH-GLD'), 20);
});
