import * as crypto from 'node:crypto';

/**
 * Validates Shopify Webhook HMAC-SHA256 signature
 */
export function verifyShopifyHmac(rawBody: string | Buffer, headerSignature: string, secret: string): boolean {
  if (!rawBody || !headerSignature || !secret) return false;
  
  const hash = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('base64');
    
  try {
    const hashBuffer = Buffer.from(hash, 'utf8');
    const sigBuffer = Buffer.from(headerSignature, 'utf8');
    if (hashBuffer.length !== sigBuffer.length) return false;
    return crypto.timingSafeEqual(hashBuffer, sigBuffer);
  } catch {
    return false;
  }
}

/**
 * Constant-time comparison for shared secrets such as API tokens. Both values are
 * hashed first, so the comparison time does not depend on the expected length.
 */
export function safeCompare(provided: string, expected: string): boolean {
  if (typeof provided !== 'string' || typeof expected !== 'string' || !provided || !expected) return false;
  const a = crypto.createHash('sha256').update(provided, 'utf8').digest();
  const b = crypto.createHash('sha256').update(expected, 'utf8').digest();
  return crypto.timingSafeEqual(a, b);
}

/**
 * Validates WooCommerce Webhook HMAC-SHA256 signature (Base64)
 */
export function verifyWooCommerceHmac(rawBody: string | Buffer, headerSignature: string, secret: string): boolean {
  if (!rawBody || !headerSignature || !secret) return false;
  
  const hash = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('base64');
    
  try {
    const hashBuffer = Buffer.from(hash, 'utf8');
    const sigBuffer = Buffer.from(headerSignature, 'utf8');
    if (hashBuffer.length !== sigBuffer.length) return false;
    return crypto.timingSafeEqual(hashBuffer, sigBuffer);
  } catch {
    return false;
  }
}
