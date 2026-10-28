import test from 'node:test';
import assert from 'node:assert/strict';
import * as crypto from 'node:crypto';
import { initializePlatform, type PlatformOptions } from '../../src/index.ts';
import { createEcommerceServer, type ServerOptions } from '../../src/backend/server.ts';

const SHOPIFY_TEST_SECRET = 'test_shopify_webhook_secret';
const WOO_TEST_SECRET = 'test_woo_webhook_secret';

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
  const unconfigured = await startPlatform({ shopifyWebhookSecret: '', wooWebhookSecret: '' });
  const configured = await startPlatform({ shopifyWebhookSecret: SHOPIFY_TEST_SECRET, wooWebhookSecret: WOO_TEST_SECRET });
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
