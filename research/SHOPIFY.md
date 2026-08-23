# Phase 1 Discovery: Shopify Technical API & Webhook Specifications

## 1. API Protocols & Rate Limiting Architecture

### GraphQL Admin API (Primary Invariant)
- **Rate Limit Mechanism**: Cost-based Leaky Bucket algorithm.
- **Bucket Size**: 1,000 points default (2,000 points on Shopify Plus).
- **Refill Rate**: 50 points/second (100 points/second on Plus).
- **Header Inspection**: `extensions.cost.actualQueryCost`, `extensions.cost.throttleStatus.currentlyAvailable`.
- **Throttling Error**: Returns `HTTP 429 Too Many Requests` or `{ "errors": [{ "message": "Throttled" }] }` with `extensions.code = "THROTTLED"`.

### Crucial 2026/2025 Mutation Specifics: `inventoryAdjustQuantities`
- **Idempotency Requirement**: Supported via `@idempotent` directive in `2026-01` and mandatory in `2026-04`.
- **Max Input Array Size**: Hard limit of **250 inventory adjustments per request**.
- **Concurrency & Locking Errors**: When multiple concurrent requests update the same `inventoryItemId`, Shopify returns a lock contention error ("quantities couldn't be adjusted") without userErrors. **Mitigation**: Exponential backoff with random full jitter (50ms–500ms).

### Bulk Operations API (`bulkOperationRunMutation`)
- **Use Case**: Massive catalog baseline synchronization (>5,000 SKUs).
- **Execution**: Asynchronous execution via JSONL upload and download to avoid point bucket exhaustion.

---

## 2. Webhook Delivery Behavior & Security
- **Topics**: `orders/create`, `orders/updated`, `orders/cancelled`, `inventory_levels/update`.
- **Delivery Guarantee**: At-least-once. Duplicate deliveries and out-of-order arrivals are expected.
- **Cryptographic Verification**:
  - Signature header: `X-Shopify-Hmac-Sha256` (Base64-encoded HMAC-SHA256).
  - Validation: Must compute `crypto.createHmac('sha256', secret).update(rawBodyBuffer).digest('base64')` and verify using `crypto.timingSafeEqual`.
