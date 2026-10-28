import test from 'node:test';
import assert from 'node:assert/strict';
import * as crypto from 'node:crypto';
import { initializePlatform } from '../../src/index.ts';
import { createEcommerceServer, EcommerceApiServer } from '../../src/backend/server.ts';

const SHOPIFY_TEST_SECRET = 'test_shopify_webhook_secret';
const WOO_TEST_SECRET = 'test_woo_webhook_secret';
const API_TEST_TOKEN = 'test_api_token';

function computeHmac(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64');
}

test('API Server - Integration Test Suite', async (t) => {
  const { ledger, orchestrator, shopifyAdapter, wooAdapter } = initializePlatform({
    shopifyWebhookSecret: SHOPIFY_TEST_SECRET,
    wooWebhookSecret: WOO_TEST_SECRET
  });
  const server = createEcommerceServer({
    port: 0, // dynamic port allocation
    orchestrator,
    apiToken: API_TEST_TOKEN
  });

  const { url, port } = await server.start(0);

  t.after(async () => {
    await server.stop();
  });

  await t.test('1. Health Check Endpoint (GET /health and GET /api/v1/health)', async () => {
    const res = await fetch(`${url}/health`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'healthy');
    assert.equal(data.storesCount, 2);
    assert.equal(data.adaptersCount, 2);

    const res2 = await fetch(`${url}/api/v1/health`);
    assert.equal(res2.status, 200);
    const data2 = await res2.json();
    assert.equal(data2.status, 'healthy');
  });

  await t.test('2. Master Inventory Endpoint (GET /api/v1/inventory)', async () => {
    const res = await fetch(`${url}/api/v1/inventory`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(typeof data.total, 'number');
    assert.ok(data.items.length >= 4);

    const shirt = data.items.find((i: any) => i.masterSku === 'SHIRT-BLK-M');
    assert.ok(shirt);
    assert.equal(shirt.currentStock, 100);
    assert.equal(shirt.mappings.length, 2);
    assert.equal(shirt.mappings[0].status, 'IN_SYNC');
  });

  await t.test('3. Shopify Webhook Ingest - Valid HMAC Signature', async () => {
    const orderPayload = JSON.stringify({
      id: 9918231,
      order_number: 'SHP-1001',
      line_items: [
        { sku: 'SHIRT-BLK-M', quantity: 2, price: '29.99', title: 'Classic Black T-Shirt' }
      ]
    });

    const secret = SHOPIFY_TEST_SECRET;
    const signature = computeHmac(orderPayload, secret);

    const res = await fetch(`${url}/api/v1/webhooks/shopify/store_shopify_us`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Hmac-Sha256': signature,
        'X-Shopify-Webhook-Id': 'evt_order_created_001'
      },
      body: orderPayload
    });

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.status, 'acknowledged');
    assert.equal(json.orderId, '9918231');

    // Master Ledger stock must be deducted: 100 - 2 = 98
    const shirt = ledger.getProduct('SHIRT-BLK-M');
    assert.equal(shirt?.currentStock, 98);

    // Channel projections must be synchronized to 98
    const wooStock = await wooAdapter.fetchChannelStock('SHIRT-BLK-M');
    assert.equal(wooStock, 98);
  });

  await t.test('4. Shopify Webhook Ingest - Duplicate Webhook Idempotency Check', async () => {
    const orderPayload = JSON.stringify({
      id: 9918231,
      order_number: 'SHP-1001',
      line_items: [
        { sku: 'SHIRT-BLK-M', quantity: 2, price: '29.99' }
      ]
    });

    const secret = SHOPIFY_TEST_SECRET;
    const signature = computeHmac(orderPayload, secret);

    // Resend exact same webhook ID
    const res = await fetch(`${url}/api/v1/webhooks/shopify/store_shopify_us`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Hmac-Sha256': signature,
        'X-Shopify-Webhook-Id': 'evt_order_created_001'
      },
      body: orderPayload
    });

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.status, 'acknowledged');

    // Stock must NOT be deducted a second time (still 98)
    const shirt = ledger.getProduct('SHIRT-BLK-M');
    assert.equal(shirt?.currentStock, 98);
  });

  await t.test('5. Shopify Webhook Ingest - Reject Invalid HMAC Signature (401)', async () => {
    const orderPayload = JSON.stringify({
      id: 9918232,
      order_number: 'SHP-1002',
      line_items: [{ sku: 'SHIRT-BLK-M', quantity: 1, price: '29.99' }]
    });

    const res = await fetch(`${url}/api/v1/webhooks/shopify/store_shopify_us`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Hmac-Sha256': 'INVALID_TAMPERED_SIGNATURE_XYZ==',
        'X-Shopify-Webhook-Id': 'evt_tampered_001'
      },
      body: orderPayload
    });

    assert.equal(res.status, 401);
    const json = await res.json();
    assert.equal(json.success, false);
    assert.match(json.error, /Unauthorized/);
  });

  await t.test('6. WooCommerce Webhook Ingest - Valid HMAC Signature', async () => {
    const orderPayload = JSON.stringify({
      id: 440182,
      number: 'WC-2001',
      line_items: [
        { sku: 'HOODIE-GRY-L', quantity: 3, price: '65.00', name: 'Grey Hoodie' }
      ]
    });

    const secret = WOO_TEST_SECRET;
    const signature = computeHmac(orderPayload, secret);

    const res = await fetch(`${url}/api/v1/webhooks/woocommerce/store_woo_eu`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-WC-Webhook-Signature': signature,
        'X-WC-Webhook-ID': 'wc_hook_101'
      },
      body: orderPayload
    });

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.status, 'acknowledged');
    assert.equal(json.orderId, '440182');

    // Master stock deducted: 50 - 3 = 47
    const hoodie = ledger.getProduct('HOODIE-GRY-L');
    assert.equal(hoodie?.currentStock, 47);

    // Shopify channel updated
    const shopifyStock = await shopifyAdapter.fetchChannelStock('HOODIE-GRY-L');
    assert.equal(shopifyStock, 47);
  });

  await t.test('7. WooCommerce Webhook Ingest - Reject Invalid Signature (401)', async () => {
    const orderPayload = JSON.stringify({
      id: 440183,
      number: 'WC-2002',
      line_items: [{ sku: 'HOODIE-GRY-L', quantity: 1 }]
    });

    const res = await fetch(`${url}/api/v1/webhooks/woocommerce/store_woo_eu`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-WC-Webhook-Signature': 'BAD_SIGNATURE',
        'X-WC-Webhook-ID': 'wc_hook_102'
      },
      body: orderPayload
    });

    assert.equal(res.status, 401);
  });

  await t.test('8. Manual Inventory Adjustment (POST /api/v1/inventory/adjust)', async () => {
    const res = await fetch(`${url}/api/v1/inventory/adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_TEST_TOKEN}` },
      body: JSON.stringify({
        masterSku: 'WATCH-GLD',
        quantityDelta: 15,
        reason: 'MANUAL_ADJUSTMENT',
        referenceId: 'AUDIT-ADJ-99'
      })
    });

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.newStock, 40); // 25 + 15

    // Verify ledger and channels
    assert.equal(ledger.getProduct('WATCH-GLD')?.currentStock, 40);
    assert.equal(await shopifyAdapter.fetchChannelStock('WATCH-GLD'), 40);
    assert.equal(await wooAdapter.fetchChannelStock('WATCH-GLD'), 40);
  });

  await t.test('9. Manual Adjustment - Prevent Stockout Overselling (400)', async () => {
    const res = await fetch(`${url}/api/v1/inventory/adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_TEST_TOKEN}` },
      body: JSON.stringify({
        masterSku: 'WATCH-GLD',
        quantityDelta: -500 // Exceeds available 40
      })
    });

    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.success, false);
    assert.match(json.error, /Insufficient stock/);
  });

  await t.test('10. Drift Reconciliation Endpoint (POST /api/v1/reconciliation/trigger)', async () => {
    // Inject intentional drift in WooCommerce channel stock
    await wooAdapter.updateStock('CAP-NVY', 12);
    assert.equal(await wooAdapter.fetchChannelStock('CAP-NVY'), 12);
    assert.equal(ledger.getProduct('CAP-NVY')?.currentStock, 75);

    const res = await fetch(`${url}/api/v1/reconciliation/trigger`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${API_TEST_TOKEN}` }
    });

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.discrepanciesFound >= 1);
    assert.ok(json.repaired >= 1);

    // Channel stock must now be restored to Master Ledger truth (75)
    assert.equal(await wooAdapter.fetchChannelStock('CAP-NVY'), 75);
  });

  await t.test('11. Static File Serving (GET / and GET /style.css)', async () => {
    const indexRes = await fetch(`${url}/`);
    assert.equal(indexRes.status, 200);
    assert.match(indexRes.headers.get('content-type') || '', /text\/html/);
    const htmlText = await indexRes.text();
    assert.match(htmlText, /ECOMMERCE OPS|OMNISYNC/i);

    const cssRes = await fetch(`${url}/styles.css`);
    assert.equal(cssRes.status, 200);
    assert.match(cssRes.headers.get('content-type') || '', /text\/css/);

    const jsRes = await fetch(`${url}/app.js`);
    assert.equal(jsRes.status, 200);
    assert.match(jsRes.headers.get('content-type') || '', /javascript/);
  });

  await t.test('12. Real-Time SSE Stream (GET /api/v1/events/stream)', async () => {
    const controller = new AbortController();
    const res = await fetch(`${url}/api/v1/events/stream`, {
      signal: controller.signal
    });

    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /text\/event-stream/);

    const reader = res.body?.getReader();
    assert.ok(reader);

    // Read initial connected chunk
    const { value: chunk1 } = await reader.read();
    const text1 = new TextDecoder().decode(chunk1);
    assert.match(text1, /event: connected/);

    // Trigger an inventory adjustment in parallel to test CloudEvent SSE delivery
    const adjustPromise = fetch(`${url}/api/v1/inventory/adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_TEST_TOKEN}` },
      body: JSON.stringify({
        masterSku: 'SHIRT-BLK-M',
        quantityDelta: 5,
        reason: 'MANUAL_ADJUSTMENT'
      })
    });

    // Read next chunk from SSE stream
    const [_, { value: chunk2 }] = await Promise.all([adjustPromise, reader.read()]);
    const text2 = new TextDecoder().decode(chunk2);
    assert.match(text2, /event: com\.ecom\.inventory\.adjusted/);
    assert.match(text2, /SHIRT-BLK-M/);

    controller.abort();
  });
});
