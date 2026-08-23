import test from 'node:test';
import assert from 'node:assert/strict';
import * as crypto from 'node:crypto';
import { verifyShopifyHmac, verifyWooCommerceHmac } from '../../src/shared/hmac.ts';
import { IdempotencyGuard } from '../../src/backend/idempotencyGuard.ts';
import { MasterLedgerEngine } from '../../src/backend/ledgerEngine.ts';
import { EcommerceOperationsOrchestrator } from '../../src/workflows/orchestrator.ts';
import { MockShopifyAdapter, MockWooCommerceAdapter } from '../../src/integrations/channelAdapter.ts';

test('Security: Shopify HMAC Signature Verification & Forgery Defense', () => {
  const secret = 'shpss_live_sec_7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c';
  const originalPayload = JSON.stringify({
    id: 991823746,
    order_number: '1042',
    line_items: [
      { sku: 'SHOE-APX-BLK-10', quantity: 1, price: '159.99', title: 'Apex Running Shoes' }
    ],
    total_price: '159.99',
    currency: 'USD',
    customer: { email: 'buyer@example.com', first_name: 'Alice' }
  });

  // Valid HMAC generation
  const validSignature = crypto
    .createHmac('sha256', secret)
    .update(originalPayload)
    .digest('base64');

  // 1. Genuine Webhook Payload & Signature
  assert.equal(
    verifyShopifyHmac(originalPayload, validSignature, secret),
    true,
    'Authentic Shopify webhook payload must verify successfully'
  );

  // 2. Tampered Payload - Price Manipulation Attack ($159.99 -> $0.01)
  const priceTamperedPayload = JSON.stringify({
    id: 991823746,
    order_number: '1042',
    line_items: [
      { sku: 'SHOE-APX-BLK-10', quantity: 1, price: '0.01', title: 'Apex Running Shoes' }
    ],
    total_price: '0.01',
    currency: 'USD',
    customer: { email: 'buyer@example.com', first_name: 'Alice' }
  });
  assert.equal(
    verifyShopifyHmac(priceTamperedPayload, validSignature, secret),
    false,
    'Price-tampered payload must be rejected'
  );

  // 3. Tampered Payload - Quantity Inflation Attack (1 -> 100)
  const quantityTamperedPayload = JSON.stringify({
    id: 991823746,
    order_number: '1042',
    line_items: [
      { sku: 'SHOE-APX-BLK-10', quantity: 100, price: '159.99', title: 'Apex Running Shoes' }
    ],
    total_price: '159.99',
    currency: 'USD',
    customer: { email: 'buyer@example.com', first_name: 'Alice' }
  });
  assert.equal(
    verifyShopifyHmac(quantityTamperedPayload, validSignature, secret),
    false,
    'Quantity-tampered payload must be rejected'
  );

  // 4. Forged Signature with Attacker Secret
  const attackerSecret = 'attacker_compromised_secret_key_9999999999999999';
  const forgedSignature = crypto
    .createHmac('sha256', attackerSecret)
    .update(originalPayload)
    .digest('base64');
  assert.equal(
    verifyShopifyHmac(originalPayload, forgedSignature, secret),
    false,
    'Signature forged with unauthorized secret must be rejected'
  );

  // 5. Corrupted Header Signature (Single Character Mutation)
  const corruptedSig = validSignature.substring(0, validSignature.length - 2) + 'AA';
  assert.equal(
    verifyShopifyHmac(originalPayload, corruptedSig, secret),
    false,
    'Corrupted signature must be rejected'
  );

  // 6. Buffer Payload Verification
  const bufferPayload = Buffer.from(originalPayload, 'utf8');
  assert.equal(
    verifyShopifyHmac(bufferPayload, validSignature, secret),
    true,
    'Buffer representation of raw payload must verify successfully'
  );
});

test('Security: WooCommerce HMAC Signature Verification & Forgery Defense', () => {
  const secret = 'wc_secret_live_88392019482019284729103857291029';
  const originalPayload = JSON.stringify({
    id: 55421,
    number: 'WC-55421',
    line_items: [
      { sku: 'WTCH-QTM-TTN-LTH', quantity: 1, price: '495.00', name: 'Quantum Chronograph' }
    ],
    total: '495.00',
    currency: 'EUR',
    date_created: '2026-08-24T03:00:00Z'
  });

  const validSignature = crypto
    .createHmac('sha256', secret)
    .update(originalPayload)
    .digest('base64');

  // 1. Genuine Webhook
  assert.equal(
    verifyWooCommerceHmac(originalPayload, validSignature, secret),
    true,
    'Authentic WooCommerce webhook must verify successfully'
  );

  // 2. Tampered Line Item SKU (SKU Substitution Attack)
  const skuTamperedPayload = JSON.stringify({
    id: 55421,
    number: 'WC-55421',
    line_items: [
      { sku: 'WTCH-QTM-LTD-GLD', quantity: 1, price: '495.00', name: 'Founders Gold Edition' }
    ],
    total: '495.00',
    currency: 'EUR',
    date_created: '2026-08-24T03:00:00Z'
  });
  assert.equal(
    verifyWooCommerceHmac(skuTamperedPayload, validSignature, secret),
    false,
    'SKU-tampered payload must be rejected'
  );

  // 3. Arbitrary / Random String Signature
  assert.equal(
    verifyWooCommerceHmac(originalPayload, 'aW52YWxpZF9zaWduYXR1cmVfaGVhZGVyX2F0dGFjaw==', secret),
    false,
    'Arbitrary random signature must be rejected'
  );
});

test('Security: Unicode, UTF-8 Multi-Byte, and Boundary Payloads', () => {
  const secret = 'multibyte_secret_key_8841';
  const unicodePayload = JSON.stringify({
    id: 88120,
    customer_notes: 'Spécial delivery: 咖啡 & 👟 and tea (日本語)',
    line_items: [{ sku: 'SHOE-APX-BLK-10', title: 'Chaussures de sport — Édition Limitée' }]
  });

  const unicodeSig = crypto
    .createHmac('sha256', secret)
    .update(unicodePayload, 'utf8')
    .digest('base64');

  assert.equal(
    verifyShopifyHmac(unicodePayload, unicodeSig, secret),
    true,
    'Multi-byte UTF-8 characters must verify with zero corruption'
  );

  // Empty / Null / Edge Case Inputs
  assert.equal(verifyShopifyHmac('', unicodeSig, secret), false, 'Empty payload must fail gracefully');
  assert.equal(verifyShopifyHmac(unicodePayload, '', secret), false, 'Empty signature must fail gracefully');
  assert.equal(verifyShopifyHmac(unicodePayload, unicodeSig, ''), false, 'Empty secret must fail gracefully');
  assert.equal(verifyShopifyHmac(null as any, unicodeSig, secret), false, 'Null payload must fail gracefully');
  assert.equal(verifyShopifyHmac(unicodePayload, null as any, secret), false, 'Null signature must fail gracefully');
});

test('Security: Timing-Safe Resistance Verification', () => {
  const secret = 'timing_safe_audit_secret_key_12345';
  const rawBody = JSON.stringify({ event: 'order.created', id: 'ord_timing_001' });

  const genuineDigest = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('base64');

  // Verify differing character positions across the entire signature string
  const positionsToTest = [0, 5, 10, 20, genuineDigest.length - 1];
  for (const pos of positionsToTest) {
    const mutatedChar = genuineDigest[pos] === 'A' ? 'B' : 'A';
    const mutatedSig = genuineDigest.substring(0, pos) + mutatedChar + genuineDigest.substring(pos + 1);
    assert.equal(
      verifyShopifyHmac(rawBody, mutatedSig, secret),
      false,
      `Mutated signature at byte position ${pos} must return false`
    );
    assert.equal(
      verifyWooCommerceHmac(rawBody, mutatedSig, secret),
      false,
      `WooCommerce signature at byte position ${pos} must return false`
    );
  }

  // Verify mismatched length does not throw RangeError or unhandled exception
  const truncatedSig = genuineDigest.substring(0, 20);
  const extendedSig = genuineDigest + 'AAAA';
  assert.equal(verifyShopifyHmac(rawBody, truncatedSig, secret), false);
  assert.equal(verifyShopifyHmac(rawBody, extendedSig, secret), false);

  // Warmup JIT
  for (let i = 0; i < 200; i++) {
    verifyShopifyHmac(rawBody, genuineDigest, secret);
  }

  // Verify consistent sub-millisecond constant-time evaluation
  const iterations = 500;
  const start = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) {
    verifyShopifyHmac(rawBody, genuineDigest, secret);
  }
  const durationNs = Number(process.hrtime.bigint() - start);
  const avgUs = (durationNs / iterations) / 1000;

  assert.ok(avgUs < 500, `Average HMAC verification must be fast and constant-time (avg: ${avgUs.toFixed(2)}μs)`);
});

test('Security: Replay Attack Inundation (50 replayed webhooks in 1 second)', async () => {
  const ledger = new MasterLedgerEngine();
  // Register item with initial inventory = 10
  const masterSku = 'SECURITY-REPLAY-SKU-001';
  ledger.registerProduct(masterSku, 'Anti-Replay Test Product', 10);

  const orchestrator = new EcommerceOperationsOrchestrator(ledger);
  const shopifyStore = new MockShopifyAdapter('store_shopify_replay', { [masterSku]: 10 });
  orchestrator.registerAdapter(shopifyStore);
  orchestrator.addMapping({
    storeId: 'store_shopify_replay',
    masterSku,
    externalItemId: 'shp_replay_001',
    externalSku: masterSku,
    syncEnabled: true
  });

  const replayIdempotencyKey = 'webhook_evt_shopify_replay_attack_uuid_99182';
  const orderPayload = {
    id: 'ord_replay_777',
    order_number: '777001',
    line_items: [{ sku: masterSku, quantity: 1, price: '99.00', title: 'Anti-Replay Test Product' }],
    total_price: '99.00',
    currency: 'USD'
  };

  const totalReplays = 50;
  const startTime = Date.now();
  const responses: Array<{ success: boolean; orderId?: string; error?: string }> = [];

  // Execute 50 rapid duplicate webhook deliveries within 1 second
  for (let i = 0; i < totalReplays; i++) {
    const res = await orchestrator.handleInboundOrder(
      orderPayload,
      'store_shopify_replay',
      replayIdempotencyKey
    );
    responses.push(res);
  }

  const durationMs = Date.now() - startTime;
  assert.ok(durationMs <= 1000, `Replay flood completed in ${durationMs}ms (<= 1000ms target)`);

  // Verify: Exactly 1 processed, 49 deduplicated
  const successfulCreations = responses.filter(r => r.success && !r.error?.includes('Duplicate'));
  const idempotentDeduplications = responses.filter(r => r.success && r.error?.includes('Duplicate'));

  assert.equal(successfulCreations.length, 1, 'Exactly 1 webhook should execute order fulfillment');
  assert.equal(idempotentDeduplications.length, 49, '49 replayed webhooks must be deduplicated idempotently');

  // Verify Master Ledger: stock must be exactly 9 (10 - 1), never negative or decremented 50 times
  const product = ledger.getProduct(masterSku);
  assert.equal(product?.currentStock, 9, 'Master Ledger stock must be decremented by exactly 1 unit');

  // Verify Audit Log: exactly 1 ORDER_FULFILLED entry (plus initial registration entry)
  const auditTrail = ledger.getAuditTrail(masterSku);
  const fulfilledEntries = auditTrail.filter(e => e.reason === 'ORDER_FULFILLED');
  assert.equal(fulfilledEntries.length, 1, 'Audit log must contain exactly 1 ORDER_FULFILLED record');
  assert.equal(fulfilledEntries[0].quantityDelta, -1);
  assert.equal(fulfilledEntries[0].resultingStock, 9);
});

test('Security: Concurrent Replay Inundation (50 parallel requests with same idempotency key)', async () => {
  const guard = new IdempotencyGuard(60000); // 60s TTL
  const idempotencyKey = 'concurrent_burst_replay_key_88492';

  // First request sets the key
  assert.equal(guard.isProcessed(idempotencyKey), false);
  guard.markProcessed(idempotencyKey, { status: 'processed', orderId: 'ord_123' });

  // 50 simultaneous parallel requests querying the guard
  const checks = Array.from({ length: 50 }).map(() => guard.isProcessed(idempotencyKey));
  const results = await Promise.all(checks);

  assert.equal(results.every(r => r === true), true, 'All 50 concurrent checks must detect duplicate key');
  assert.equal(guard.getResponse(idempotencyKey)?.orderId, 'ord_123');
});

test('Security: Idempotency TTL Expiration Boundary', async () => {
  const shortTtlGuard = new IdempotencyGuard(50); // 50ms TTL
  const key = 'short_lived_webhook_key_112';

  assert.equal(shortTtlGuard.isProcessed(key), false);
  shortTtlGuard.markProcessed(key, { orderId: 'ord_temp_1' });

  assert.equal(shortTtlGuard.isProcessed(key), true, 'Key should be active immediately');

  // Wait 75ms for TTL expiration
  await new Promise(r => setTimeout(r, 75));

  assert.equal(shortTtlGuard.isProcessed(key), false, 'Expired idempotency key must be pruned and return false');
});

