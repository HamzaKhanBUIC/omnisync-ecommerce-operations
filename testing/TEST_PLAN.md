# Phase 4 QA: Master Test Plan & Coverage Strategy

## 1. Test Pyramid Distribution & Architecture

### Unit Tests (70%)
- **Master Ledger Engine** (`tests/unit/ledger.test.ts`):
  - Atomic signed delta mutations (`quantityDelta = -N/+N`), zero overselling stockout protection, optimistic locking/version incrementation, immutable audit trail.
- **Cryptographic Security** (`tests/unit/hmac.test.ts`):
  - Constant-time HMAC-SHA256 verification (`crypto.timingSafeEqual`) for `X-Shopify-Hmac-Sha256` and `X-WC-Webhook-Signature`.
- **Token Bucket Rate Limiter** (`tests/unit/ratelimit.test.ts`):
  - Token consumption, capacity bounds, time-based refill dynamics, and non-blocking asynchronous backoff.
- **Idempotency Guard** (`tests/unit/idempotency.test.ts`):
  - Deduplication caching with cached response payload retrieval.
  - 50-repetition duplicate event ID replay resilience (AC-2 compliance).
  - Short and long TTL expiration with automatic cache eviction.
  - Multi-key concurrent tracking with isolated lifecycle management.
  - Edge-case handling (special character keys, URL-encoded event IDs, nullish payloads).

### Integration Tests (20%)
- **Multi-Channel Platform Adapters** (`tests/integration/adapters.test.ts`):
  - **Shopify GraphQL Adapter**:
    - Order normalization: payload field extraction, line items, currency, prices, fallback defaults.
    - `inventoryAdjustQuantities` GraphQL mutation execution and resulting channel stock synchronization.
    - Enforced hard limit: rejection of mutations exceeding 250 adjustments (`MAX_ARRAY_SIZE_EXCEEDED`).
    - Concurrency lock contention simulation with GraphQL `userErrors` propagation.
    - Leaky bucket point depletion, cost tracking (`requestedQueryCost`, `actualQueryCost`), and `THROTTLED` (HTTP 429) simulation with timed refill recovery.
  - **WooCommerce REST v3 Adapter**:
    - Order normalization: HPOS and legacy metadata extraction, line items, totals.
    - REST v3 batch updates (`/wp-json/wc/v3/products/batch`) with HPOS storage engine validation.
    - Batch limit enforcement (100 objects maximum) and recommended chunking workflows (25–50 items).
    - Storage engine mode toggling (`HPOS_TABLES` vs `LEGACY_POSTS`).
    - Robust error handling: HTTP 503 Action Scheduler server overload, HTTP 504 Gateway Timeout, parameter validation.

### E2E & Concurrency Simulations (10%)
- **Flash Sale Concurrency** (`tests/simulations/concurrency.test.ts`):
  - 30 simultaneous checkout webhooks competing for 5 limited-edition stock units under high race-condition pressure.
  - Automated drift detection and 1-cycle auto-healing against external store discrepancies.

---

## 2. Coverage Targets & Gate Thresholds
- Ledger mutation & idempotency logic: **100% branch coverage**.
- Cryptographic signature verifiers: **100% branch coverage**.
- Adapter GraphQL & REST contract validation: **100% branch coverage**.
- Suite execution runtime requirement: **< 1,500ms** total duration via `node --experimental-strip-types --test`.
