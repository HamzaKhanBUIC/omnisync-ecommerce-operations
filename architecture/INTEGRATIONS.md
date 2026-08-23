# Phase 3 Architecture: Channel Integration Adapter Contracts

```typescript
export interface ChannelAdapter {
  platform: 'SHOPIFY' | 'WOOCOMMERCE';
  storeId: string;
  rateLimiter: TokenBucketLimiter;
  
  validateWebhookSignature(rawBody: string | Buffer, signature: string, secret: string): boolean;
  normalizeOrder(rawPayload: Record<string, any>): NormalizedOrder;
  updateStock(externalItemId: string, newStock: number): Promise<SyncResult>;
  batchUpdateStock(items: Array<{ externalItemId: string; quantity: number }>): Promise<BatchSyncResult>;
  fetchChannelStock(externalItemId: string): Promise<number>;
}
```

## 1. Shopify Adapter Implementation
- Uses Shopify GraphQL `inventoryAdjustQuantities` mutation.
- Includes mandatory `@idempotent` key.
- Chunks requests up to maximum 250 adjustments per payload.
- Monitors `extensions.cost.throttleStatus.currentlyAvailable` to adjust token bucket dynamically.

## 2. WooCommerce Adapter Implementation
- Uses WooCommerce REST API v3 `/wp-json/wc/v3/products/batch`.
- Chunks requests into 25–50 items per payload to prevent server 504 timeouts.
- Natively compatible with High-Performance Order Storage (HPOS).
