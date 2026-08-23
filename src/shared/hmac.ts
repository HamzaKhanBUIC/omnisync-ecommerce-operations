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
