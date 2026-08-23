import test from 'node:test';
import assert from 'node:assert/strict';
import * as crypto from 'node:crypto';
import { verifyShopifyHmac, verifyWooCommerceHmac } from '../../src/shared/hmac.ts';

test('HMAC Verification - Shopify and WooCommerce', () => {
  const payload = JSON.stringify({ id: 12345, status: 'paid' });
  const secret = 'super_secret_webhook_key_2026';

  const validShopifySig = crypto.createHmac('sha256', secret).update(payload).digest('base64');
  
  // Valid signature
  assert.equal(verifyShopifyHmac(payload, validShopifySig, secret), true);
  assert.equal(verifyWooCommerceHmac(payload, validShopifySig, secret), true);

  // Tampered payload
  const tamperedPayload = JSON.stringify({ id: 12345, status: 'refunded' });
  assert.equal(verifyShopifyHmac(tamperedPayload, validShopifySig, secret), false);

  // Invalid secret
  assert.equal(verifyShopifyHmac(payload, validShopifySig, 'wrong_secret'), false);
});
