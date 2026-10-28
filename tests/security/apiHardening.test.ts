import test from 'node:test';
import assert from 'node:assert/strict';
import * as crypto from 'node:crypto';
import { initializePlatform, type PlatformOptions } from '../../src/index.ts';
import { createEcommerceServer, type ServerOptions } from '../../src/backend/server.ts';

const SHOPIFY_TEST_SECRET = 'test_shopify_webhook_secret';
const WOO_TEST_SECRET = 'test_woo_webhook_secret';
const API_TEST_TOKEN = 'test_api_token';
const AUTH = { Authorization: `Bearer ${API_TEST_TOKEN}` };
const MUTATING_ROUTES: Array<[string, unknown]> = [
  ['/api/v1/inventory/adjust', { masterSku: 'SHIRT-BLK-M', quantityDelta: 5 }],
  ['/api/v1/inventory/transfer', { masterSku: 'SHIRT-BLK-M', fromLocation: 'MAIN_US_3PL', toLocation: 'EU_CENTRAL', quantity: 1 }],
  ['/api/v1/reconciliation/trigger', {}]
];

function sign(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64');
}

async function startPlatform(platformOptions: PlatformOptions, serverOptions: ServerOptions = {}) {
  const platform = initializePlatform(platformOptions);
  const server = createEcommerceServer({ port: 0, orchestrator: platform.orchestrator, ...serverOptions });
  const { url } = await server.start(0);
  return { ...platform, server, url };
}

function shopifyOrder(id: number, quantity: unknown = 1, sku = 'SHIRT-BLK-M'): string {
  return JSON.stringify({ id, order_number: `SHP-${id}`, line_items: [{ sku, quantity, price: '29.99' }] });
}

test('Hardening: webhook secrets fail closed', async (t) => {
  const unconfigured = await startPlatform({ shopifyWebhookSecret: '', wooWebhookSecret: '' }, { apiToken: '' });
  const configured = await startPlatform({ shopifyWebhookSecret: SHOPIFY_TEST_SECRET, wooWebhookSecret: WOO_TEST_SECRET }, { apiToken: API_TEST_TOKEN });
  t.after(async () => {
    await unconfigured.server.stop();
    await configured.server.stop();
  });

  await t.test('missing secret: Shopify and WooCommerce webhooks are rejected with 503', async () => {
    const body = shopifyOrder(7001);
    const shopify = await fetch(`${unconfigured.url}/api/v1/webhooks/shopify/store_shopify_us`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Hmac-Sha256': sign(body, 'any-guess'), 'X-Shopify-Webhook-Id': 'evt_7001' },
      body
    });
    assert.equal(shopify.status, 503);

    const woo = await fetch(`${unconfigured.url}/api/v1/webhooks/woocommerce/store_woo_eu`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-WC-Webhook-Signature': sign(body, 'any-guess'), 'X-WC-Webhook-ID': 'wc_7001' },
      body
    });
    assert.equal(woo.status, 503);
    assert.equal(unconfigured.ledger.getProduct('SHIRT-BLK-M')?.currentStock, 100, 'stock must be unchanged');
  });

  await t.test('missing secret: reported as a startup warning', () => {
    const warnings = unconfigured.server.getConfigWarnings().join('\n');
    assert.match(warnings, /SHOPIFY_WEBHOOK_SECRET/);
    assert.match(warnings, /WOO_WEBHOOK_SECRET/);
    assert.doesNotMatch(configured.server.getConfigWarnings().join('\n'), /WEBHOOK_SECRET/);
  });

  await t.test('unknown store or platform mismatch is rejected with 404', async () => {
    const body = shopifyOrder(7002);
    for (const path of ['/api/v1/webhooks/shopify/store_unknown', '/api/v1/webhooks/shopify', '/api/v1/webhooks/shopify/store_woo_eu']) {
      const res = await fetch(`${configured.url}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Shopify-Hmac-Sha256': sign(body, SHOPIFY_TEST_SECRET) },
        body
      });
      assert.equal(res.status, 404, path);
    }
    assert.equal(configured.ledger.getProduct('SHIRT-BLK-M')?.currentStock, 100);
  });

  await t.test('bad or missing signature is rejected with 401', async () => {
    const body = shopifyOrder(7003);
    const wrongSecret = await fetch(`${configured.url}/api/v1/webhooks/shopify/store_shopify_us`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Hmac-Sha256': sign(body, 'wrong-secret') },
      body
    });
    assert.equal(wrongSecret.status, 401);

    const noHeader = await fetch(`${configured.url}/api/v1/webhooks/woocommerce/store_woo_eu`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body
    });
    assert.equal(noHeader.status, 401);
    assert.equal(configured.ledger.getProduct('SHIRT-BLK-M')?.currentStock, 100, 'stock must be unchanged');
  });
});

test('Hardening: bearer token on mutating routes', async (t) => {
  const secured = await startPlatform({ shopifyWebhookSecret: SHOPIFY_TEST_SECRET }, { apiToken: API_TEST_TOKEN });
  const noToken = await startPlatform({ shopifyWebhookSecret: SHOPIFY_TEST_SECRET }, { apiToken: '' });
  t.after(async () => {
    await secured.server.stop();
    await noToken.server.stop();
  });

  const post = (base: string, path: string, body: unknown, headers: Record<string, string> = {}) =>
    fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });

  await t.test('missing token: every mutating route returns 401', async () => {
    for (const [path, body] of MUTATING_ROUTES) {
      const res = await post(secured.url, path, body);
      assert.equal(res.status, 401, path);
      assert.equal(res.headers.get('www-authenticate'), 'Bearer');
    }
    assert.equal(secured.ledger.getProduct('SHIRT-BLK-M')?.currentStock, 100, 'stock must be unchanged');
  });

  await t.test('wrong token or wrong scheme returns 401', async () => {
    const wrong = await post(secured.url, '/api/v1/inventory/adjust', MUTATING_ROUTES[0][1], { Authorization: 'Bearer not-the-token' });
    assert.equal(wrong.status, 401);
    const basic = await post(secured.url, '/api/v1/inventory/adjust', MUTATING_ROUTES[0][1], { Authorization: `Basic ${API_TEST_TOKEN}` });
    assert.equal(basic.status, 401);
    assert.equal(secured.ledger.getProduct('SHIRT-BLK-M')?.currentStock, 100);
  });

  await t.test('valid token is accepted', async () => {
    const res = await post(secured.url, '/api/v1/inventory/adjust', MUTATING_ROUTES[0][1], AUTH);
    assert.equal(res.status, 200);
    assert.equal(secured.ledger.getProduct('SHIRT-BLK-M')?.currentStock, 105);
  });

  await t.test('no OMNISYNC_API_TOKEN configured: mutating routes return 503 and a warning is logged', async () => {
    for (const [path, body] of MUTATING_ROUTES) {
      const res = await post(noToken.url, path, body, AUTH);
      assert.equal(res.status, 503, path);
    }
    assert.match(noToken.server.getConfigWarnings().join('\n'), /OMNISYNC_API_TOKEN/);
    assert.doesNotMatch(secured.server.getConfigWarnings().join('\n'), /OMNISYNC_API_TOKEN/);
  });

  await t.test('read-only demo routes stay public', async () => {
    for (const path of ['/health', '/api/v1/inventory', '/api/v1/orders', '/api/v1/audit', '/api/v1/circuit-breakers']) {
      const res = await fetch(`${secured.url}${path}`);
      assert.equal(res.status, 200, path);
    }
  });
});

test('Hardening: CORS allow-list replaces the wildcard', async (t) => {
  const allowed = 'https://ops.example.test';
  const listed = await startPlatform({}, { apiToken: API_TEST_TOKEN, allowedOrigins: [`${allowed}/`] });
  const unlisted = await startPlatform({}, { apiToken: API_TEST_TOKEN, allowedOrigins: [] });
  t.after(async () => {
    await listed.server.stop();
    await unlisted.server.stop();
  });

  await t.test('listed origin is echoed back, never "*"', async () => {
    const res = await fetch(`${listed.url}/api/v1/inventory`, { headers: { Origin: allowed } });
    assert.equal(res.headers.get('access-control-allow-origin'), allowed);
    assert.match(res.headers.get('vary') || '', /Origin/);

    const preflight = await fetch(`${listed.url}/api/v1/inventory/adjust`, {
      method: 'OPTIONS',
      headers: { Origin: allowed, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization' }
    });
    assert.equal(preflight.status, 204);
    assert.match(preflight.headers.get('access-control-allow-headers') || '', /Authorization/);
  });

  await t.test('unlisted origin gets no CORS headers', async () => {
    for (const server of [listed, unlisted]) {
      const res = await fetch(`${server.url}/api/v1/inventory`, { headers: { Origin: 'https://evil.example.test' } });
      assert.equal(res.headers.get('access-control-allow-origin'), null);
      const preflight = await fetch(`${server.url}/api/v1/inventory/adjust`, {
        method: 'OPTIONS',
        headers: { Origin: 'https://evil.example.test', 'Access-Control-Request-Method': 'POST' }
      });
      assert.equal(preflight.headers.get('access-control-allow-origin'), null);
    }
  });
});

test('Hardening: duplicate webhook events and orders are ignored', async (t) => {
  const platform = await startPlatform({ shopifyWebhookSecret: SHOPIFY_TEST_SECRET }, { apiToken: API_TEST_TOKEN });
  t.after(async () => {
    await platform.server.stop();
  });

  const deliver = (body: string, eventId: string) =>
    fetch(`${platform.url}/api/v1/webhooks/shopify/store_shopify_us`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Hmac-Sha256': sign(body, SHOPIFY_TEST_SECRET), 'X-Shopify-Webhook-Id': eventId },
      body
    }).then(res => res.json());

  await t.test('5 parallel deliveries of one event deduct stock once', async () => {
    const body = shopifyOrder(8001, 1, 'CAP-NVY');
    const results = await Promise.all(Array.from({ length: 5 }, () => deliver(body, 'evt_parallel_8001')));
    assert.equal(results.filter(r => r.status === 'acknowledged' && !r.isDuplicate).length, 1);
    assert.equal(results.filter(r => r.isDuplicate).length, 4);
    assert.equal(platform.ledger.getProduct('CAP-NVY')?.currentStock, 74, '75 - 1');
  });

  await t.test('5 concurrent ingests of one event in the same tick deduct stock once', async () => {
    const payload = { id: 8010, line_items: [{ sku: 'HOODIE-GRY-L', quantity: 1 }] };
    const results = await Promise.all(
      Array.from({ length: 5 }, () => platform.orchestrator.handleInboundOrder(payload, 'store_shopify_us', 'evt_same_tick_8010'))
    );
    assert.equal(results.filter(r => r.success && !r.isDuplicate).length, 1);
    assert.equal(platform.ledger.getProduct('HOODIE-GRY-L')?.currentStock, 49, '50 - 1');
  });

  await t.test('a different event id for the same order is ignored', async () => {
    const body = shopifyOrder(8002, 2, 'CAP-NVY');
    const first = await deliver(body, 'evt_orders_create_8002');
    const second = await deliver(body, 'evt_orders_paid_8002');
    assert.equal(first.isDuplicate, undefined);
    assert.equal(second.isDuplicate, true);
    assert.equal(platform.ledger.getProduct('CAP-NVY')?.currentStock, 72, '74 - 2, once');
  });

  await t.test('an order rejected for stock can be retried after restock', async () => {
    const { orchestrator, ledger } = platform;
    const payload = { id: 8003, line_items: [{ sku: 'WATCH-GLD', quantity: 30 }] };
    const rejected = await orchestrator.handleInboundOrder(payload, 'store_shopify_us', 'evt_retry_8003');
    assert.equal(rejected.success, false);

    await ledger.applyDelta('WATCH-GLD', 10, 'MANUAL_ADJUSTMENT');
    const retried = await orchestrator.handleInboundOrder(payload, 'store_shopify_us', 'evt_retry_8003');
    assert.equal(retried.success, true);
    assert.equal(retried.isDuplicate, undefined);
    assert.equal(ledger.getProduct('WATCH-GLD')?.currentStock, 5, '25 + 10 - 30');
  });
});

test('Hardening: input validation on mutating routes', async (t) => {
  const platform = await startPlatform(
    { shopifyWebhookSecret: SHOPIFY_TEST_SECRET, wooWebhookSecret: WOO_TEST_SECRET },
    { apiToken: API_TEST_TOKEN }
  );
  t.after(async () => {
    await platform.server.stop();
  });

  const stock = (sku: string) => platform.ledger.getProduct(sku)?.currentStock;
  const post = (path: string, body: string, headers: Record<string, string> = {}) =>
    fetch(`${platform.url}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body });
  const shopifyWebhook = (body: string) =>
    post('/api/v1/webhooks/shopify/store_shopify_us', body, { 'X-Shopify-Hmac-Sha256': sign(body, SHOPIFY_TEST_SECRET) });

  await t.test('invalid webhook line-item quantity returns 400 and leaves stock unchanged', async () => {
    let id = 9100;
    for (const quantity of [-5, 0, 1.5, '2', null, 10_001]) {
      const res = await shopifyWebhook(shopifyOrder(++id, quantity));
      assert.equal(res.status, 400, `quantity ${JSON.stringify(quantity)}`);
    }
    const woo = JSON.stringify({ id: 9200, line_items: [{ sku: 'SHIRT-BLK-M', quantity: -3 }] });
    const wooRes = await post('/api/v1/webhooks/woocommerce/store_woo_eu', woo, { 'X-WC-Webhook-Signature': sign(woo, WOO_TEST_SECRET) });
    assert.equal(wooRes.status, 400);
    assert.equal(stock('SHIRT-BLK-M'), 100, 'a negative quantity must never add stock');
  });

  await t.test('webhook without order id, sku or line items returns 400', async () => {
    for (const payload of [
      { line_items: [{ sku: 'SHIRT-BLK-M', quantity: 1 }] },
      { id: 9301, line_items: [{ quantity: 1 }] },
      { id: 9302, line_items: [] },
      { id: 9303 }
    ]) {
      const res = await shopifyWebhook(JSON.stringify(payload));
      assert.equal(res.status, 400, JSON.stringify(payload));
    }
    assert.equal(stock('SHIRT-BLK-M'), 100);
  });

  await t.test('invalid adjustment returns 400', async () => {
    for (const body of [
      { masterSku: 'SHIRT-BLK-M', quantityDelta: 1.5 },
      { masterSku: 'SHIRT-BLK-M', quantityDelta: '5' },
      { masterSku: 'SHIRT-BLK-M', quantityDelta: 0 },
      { masterSku: 'SHIRT-BLK-M', quantityDelta: 1_000_000 },
      { masterSku: '', quantityDelta: 1 },
      { masterSku: 'SHIRT-BLK-M', quantityDelta: 1, reason: 'ORDER_FULFILLED' },
      { masterSku: 'SHIRT-BLK-M', quantityDelta: 1, preferredLocation: 'MARS_BASE' }
    ]) {
      const res = await post('/api/v1/inventory/adjust', JSON.stringify(body), AUTH);
      assert.equal(res.status, 400, JSON.stringify(body));
    }
    assert.equal(stock('SHIRT-BLK-M'), 100);
  });

  await t.test('invalid transfer returns 400; a valid one still works', async () => {
    const base = { masterSku: 'SHIRT-BLK-M', fromLocation: 'MAIN_US_3PL', toLocation: 'EU_CENTRAL' };
    for (const body of [
      { ...base, quantity: -3 },
      { ...base, quantity: 0 },
      { ...base, quantity: '2' },
      { ...base, quantity: 2.5 },
      { ...base, fromLocation: 'NOWHERE', quantity: 1 },
      { ...base, toLocation: '__proto__', quantity: 1 },
      { ...base, toLocation: 'MAIN_US_3PL', quantity: 1 }
    ]) {
      const res = await post('/api/v1/inventory/transfer', JSON.stringify(body), AUTH);
      assert.equal(res.status, 400, JSON.stringify(body));
    }
    assert.equal(platform.ledger.getProduct('SHIRT-BLK-M')?.locations.MAIN_US_3PL, 50);

    const ok = await post('/api/v1/inventory/transfer', JSON.stringify({ ...base, quantity: 5 }), AUTH);
    assert.equal(ok.status, 200);
    assert.equal(platform.ledger.getProduct('SHIRT-BLK-M')?.locations.MAIN_US_3PL, 45);
  });

  await t.test('malformed JSON returns 400 and oversized bodies return 413', async () => {
    const badJson = await post('/api/v1/inventory/adjust', '{"masterSku":', AUTH);
    assert.equal(badJson.status, 400);
    const array = await post('/api/v1/inventory/adjust', '[1,2]', AUTH);
    assert.equal(array.status, 400);
    const badWebhookJson = await shopifyWebhook('not json');
    assert.equal(badWebhookJson.status, 400);

    const huge = await post('/api/v1/inventory/adjust', JSON.stringify({ pad: 'x'.repeat(1024 * 1024 + 10) }), AUTH);
    assert.equal(huge.status, 413);
  });

  await t.test('ledger rejects non-integer deltas directly', async () => {
    const result = await platform.ledger.applyDelta('CAP-NVY', Number.NaN, 'MANUAL_ADJUSTMENT');
    assert.equal(result.success, false);
    assert.equal(stock('CAP-NVY'), 75);
  });
});
