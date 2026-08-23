import { MasterLedgerEngine } from './backend/ledgerEngine.ts';
import { EcommerceOperationsOrchestrator } from './workflows/orchestrator.ts';
import { MockShopifyAdapter, MockWooCommerceAdapter } from './integrations/channelAdapter.ts';
import { EcommerceApiServer, createEcommerceServer } from './backend/server.ts';
import type { Store } from './shared/types.ts';

export function initializePlatform() {
  // 1. Initialize Master Ledger Authority
  const ledger = new MasterLedgerEngine();
  ledger.registerProduct('SHIRT-BLK-M', 'Classic Black Cotton T-Shirt (M)', 100);
  ledger.registerProduct('HOODIE-GRY-L', 'Heavyweight Fleece Hoodie (L)', 50);
  ledger.registerProduct('WATCH-GLD', 'Minimalist Gold Quartz Watch', 25);
  ledger.registerProduct('CAP-NVY', 'Embroidered Navy Dad Cap', 75);

  // 2. Initialize Operations Orchestrator
  const orchestrator = new EcommerceOperationsOrchestrator(ledger);

  // 3. Register Channel Stores with Webhook Secrets
  const shopifyStoreMeta: Store = {
    id: 'store_shopify_us',
    name: 'Shopify US Flagship Store',
    platform: 'SHOPIFY',
    storeUrl: 'https://brand-us.myshopify.com',
    apiKey: 'shp_live_key_99182',
    webhookSecret: 'shopify_secret_live_771',
    isActive: true
  };

  const wooStoreMeta: Store = {
    id: 'store_woo_eu',
    name: 'WooCommerce EU Central Store',
    platform: 'WOOCOMMERCE',
    storeUrl: 'https://shop-eu.brand.com',
    apiKey: 'wc_live_ck_44109',
    webhookSecret: 'woo_secret_live_882',
    isActive: true
  };

  orchestrator.registerStore(shopifyStoreMeta);
  orchestrator.registerStore(wooStoreMeta);

  // 4. Initialize Channel Adapters with Initial Stock
  const shopifyAdapter = new MockShopifyAdapter('store_shopify_us', {
    'SHIRT-BLK-M': 100,
    'HOODIE-GRY-L': 50,
    'WATCH-GLD': 25,
    'CAP-NVY': 75
  });

  const wooAdapter = new MockWooCommerceAdapter('store_woo_eu', {
    'SHIRT-BLK-M': 100,
    'HOODIE-GRY-L': 50,
    'WATCH-GLD': 25,
    'CAP-NVY': 75
  });

  orchestrator.registerAdapter(shopifyAdapter);
  orchestrator.registerAdapter(wooAdapter);

  // 5. Establish Channel SKU Mappings with IN_SYNC status
  const skus = ['SHIRT-BLK-M', 'HOODIE-GRY-L', 'WATCH-GLD', 'CAP-NVY'];
  for (const sku of skus) {
    orchestrator.addMapping({
      storeId: 'store_shopify_us',
      masterSku: sku,
      externalItemId: `shp_item_${sku.toLowerCase()}`,
      externalSku: sku,
      syncEnabled: true,
      channelStock: ledger.getProduct(sku)?.currentStock ?? 100,
      status: 'IN_SYNC'
    });

    orchestrator.addMapping({
      storeId: 'store_woo_eu',
      masterSku: sku,
      externalItemId: `wc_item_${sku.toLowerCase()}`,
      externalSku: sku,
      syncEnabled: true,
      channelStock: ledger.getProduct(sku)?.currentStock ?? 100,
      status: 'IN_SYNC'
    });
  }

  return { ledger, orchestrator, shopifyAdapter, wooAdapter };
}

export async function bootstrapServer(port: number = parseInt(process.env.PORT || '3000', 10)) {
  const { ledger, orchestrator, shopifyAdapter, wooAdapter } = initializePlatform();

  const apiServer = createEcommerceServer({
    port,
    orchestrator
  });

  const { url } = await apiServer.start();

  console.log("==========================================================");
  console.log("   OMNISYNC MULTI-CHANNEL ECOMMERCE OPERATIONS PLATFORM   ");
  console.log("==========================================================");
  console.log(`🚀 HTTP API Server listening at: ${url}`);
  console.log(`📊 Static Dashboard UI:        ${url}/`);
  console.log(`📡 Real-Time SSE Stream:       ${url}/api/v1/events/stream`);
  console.log(`📦 Master Inventory API:       ${url}/api/v1/inventory`);
  console.log(`🛡️ Drift Reconciliation API:   ${url}/api/v1/reconciliation/trigger`);
  console.log(`🛒 Shopify Webhook Ingest:     ${url}/api/v1/webhooks/shopify/store_shopify_us`);
  console.log(`🛍️ WooCommerce Webhook Ingest: ${url}/api/v1/webhooks/woocommerce/store_woo_eu`);
  console.log("==========================================================");

  return { apiServer, orchestrator, ledger, shopifyAdapter, wooAdapter, url };
}

export { EcommerceApiServer, createEcommerceServer };

// Auto-start if run directly as script (and not imported by test runner)
const isMainModule = (process.argv[1] && (process.argv[1].endsWith('index.ts') || process.argv[1].endsWith('index.js'))) || process.env.AUTO_START === 'true';
const isTestRunner = process.env.NODE_ENV === 'test' || process.execArgv.includes('--test') || process.argv.some(a => a.includes('.test.'));

if (isMainModule && !isTestRunner) {
  bootstrapServer().catch((err) => {
    console.error('Fatal startup error:', err);
    process.exit(1);
  });
}
