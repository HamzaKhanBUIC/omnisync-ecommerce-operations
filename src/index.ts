import { MasterLedgerEngine } from './backend/ledgerEngine.ts';
import { EcommerceOperationsOrchestrator } from './workflows/orchestrator.ts';
import { MockShopifyAdapter, MockWooCommerceAdapter } from './integrations/channelAdapter.ts';
import { EcommerceApiServer, createEcommerceServer } from './backend/server.ts';
import type { Store, NormalizedOrder } from './shared/types.ts';

export function initializePlatform() {
  // 1. Initialize Master Ledger Authority with realistic catalog fixtures
  const ledger = new MasterLedgerEngine();
  ledger.registerProduct('SHIRT-BLK-M', 'Classic Black Cotton T-Shirt (M)', 100, {
    category: 'Apparel',
    price: 29.99,
    barcode: 'UPC-680150366794',
    safetyStock: 15,
    locations: { MAIN_US_3PL: 50, WEST_US_HUB: 20, EU_CENTRAL: 20, UK_FULFILLMENT: 10 }
  });

  ledger.registerProduct('HOODIE-GRY-L', 'Heavyweight Fleece Hoodie (L)', 50, {
    category: 'Outerwear',
    price: 79.99,
    barcode: 'UPC-545815414826',
    safetyStock: 10,
    locations: { MAIN_US_3PL: 25, WEST_US_HUB: 10, EU_CENTRAL: 10, UK_FULFILLMENT: 5 }
  });

  ledger.registerProduct('WATCH-GLD', 'Minimalist Gold Quartz Watch', 25, {
    category: 'Horology',
    price: 199.99,
    barcode: 'UPC-613548273329',
    safetyStock: 5,
    locations: { MAIN_US_3PL: 15, WEST_US_HUB: 5, EU_CENTRAL: 5, UK_FULFILLMENT: 0 }
  });

  ledger.registerProduct('CAP-NVY', 'Embroidered Navy Dad Cap', 75, {
    category: 'Accessories',
    price: 24.99,
    barcode: 'UPC-497517412603',
    safetyStock: 10,
    locations: { MAIN_US_3PL: 40, WEST_US_HUB: 15, EU_CENTRAL: 15, UK_FULFILLMENT: 5 }
  });

  ledger.registerProduct('SUMMER-COMBO-01', 'Ultimate Summer Combo Bundle (T-Shirt + Cap)', 75, {
    category: 'Bundles',
    price: 49.99,
    barcode: 'UPC-882910471920',
    safetyStock: 10,
    isBundle: true,
    bundleRecipe: [
      { componentSku: 'SHIRT-BLK-M', quantityRequired: 1 },
      { componentSku: 'CAP-NVY', quantityRequired: 1 }
    ],
    locations: { MAIN_US_3PL: 40, WEST_US_HUB: 15, EU_CENTRAL: 15, UK_FULFILLMENT: 5 }
  });

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
  const initialStock = {
    'SHIRT-BLK-M': 100,
    'HOODIE-GRY-L': 50,
    'WATCH-GLD': 25,
    'CAP-NVY': 75,
    'SUMMER-COMBO-01': 75
  };

  const shopifyAdapter = new MockShopifyAdapter('store_shopify_us', { ...initialStock });
  const wooAdapter = new MockWooCommerceAdapter('store_woo_eu', { ...initialStock });

  orchestrator.registerAdapter(shopifyAdapter);
  orchestrator.registerAdapter(wooAdapter);

  // 5. Establish Channel SKU Mappings with IN_SYNC status
  const skus = ['SHIRT-BLK-M', 'HOODIE-GRY-L', 'WATCH-GLD', 'CAP-NVY', 'SUMMER-COMBO-01'];
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

  // 6. Seed Initial Normalized Orders for Operations Console
  const sampleOrders: NormalizedOrder[] = [
    {
      orderId: 'ord_10042',
      storeId: 'store_shopify_us',
      orderNumber: 'SHP-1042',
      customerName: 'Marcus Vance',
      customerEmail: 'm.vance@example.com',
      shippingCountry: 'US',
      items: [{ sku: 'SHIRT-BLK-M', quantity: 2, price: 29.99, title: 'Classic Black Cotton T-Shirt (M)' }],
      totalPrice: 59.98,
      currency: 'USD',
      status: 'SYNCED',
      createdAt: new Date(Date.now() - 1000 * 60 * 3).toISOString()
    },
    {
      orderId: 'ord_10041',
      storeId: 'store_woo_eu',
      orderNumber: 'WC-2089',
      customerName: 'Elena Rostova',
      customerEmail: 'elena.r@berlin.de',
      shippingCountry: 'DE',
      items: [{ sku: 'HOODIE-GRY-L', quantity: 1, price: 79.99, title: 'Heavyweight Fleece Hoodie (L)' }],
      totalPrice: 79.99,
      currency: 'EUR',
      status: 'SYNCED',
      createdAt: new Date(Date.now() - 1000 * 60 * 11).toISOString()
    },
    {
      orderId: 'ord_10040',
      storeId: 'store_shopify_us',
      orderNumber: 'SHP-1041',
      customerName: 'Liam Harrison',
      customerEmail: 'liam.h@london.uk',
      shippingCountry: 'GB',
      items: [{ sku: 'WATCH-GLD', quantity: 1, price: 199.99, title: 'Minimalist Gold Quartz Watch' }],
      totalPrice: 199.99,
      currency: 'GBP',
      status: 'SPLIT_ROUTED',
      createdAt: new Date(Date.now() - 1000 * 60 * 25).toISOString()
    }
  ];

  for (const ord of sampleOrders) {
    orchestrator.orders.push(ord);
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
