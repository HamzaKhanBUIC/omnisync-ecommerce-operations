# Product Definition: Functional & Non-Functional Requirements

## 1. Functional Requirements (FR)

- **FR-01 (Webhook Ingestion)**: System MUST ingest and acknowledge Shopify and WooCommerce order/inventory webhooks within **< 100ms** of arrival with HTTP 200/202.
- **FR-02 (HMAC Cryptographic Validation)**: System MUST validate `X-Shopify-Hmac-Sha256` and `X-WC-Webhook-Signature` using constant-time comparisons (`crypto.timingSafeEqual`). Any invalid signature MUST be rejected with HTTP 401.
- **FR-03 (Idempotency Guard)**: System MUST deduplicate incoming webhooks by caching event IDs/payload hashes for 24 hours. Replayed webhooks MUST return the original response without executing duplicate ledger transactions.
- **FR-04 (Atomic Delta Mutations)**: System MUST deduct inventory in the Master Ledger using relative signed deltas (`quantityDelta = -N/+N`) within an atomic database transaction.
- **FR-05 (Stockout Protection)**: If a requested delta exceeds available stock, the transaction MUST fail gracefully, log a stockout event, and prevent negative stock balances.
- **FR-06 (Cross-Channel Broadcast)**: Upon successful ledger mutation, the system MUST broadcast the updated inventory level to all other connected storefronts with active SKU mappings.
- **FR-07 (Proactive Rate Limiting)**: System MUST enforce client-side token bucket rate limits mirroring Shopify GraphQL point costs and WooCommerce REST batch thresholds with 15% safety headroom.
- **FR-08 (Continuous Drift Audit)**: System MUST execute an automated background reconciliation scan every 15 minutes comparing channel stock against Master Ledger truth.
- **FR-09 (Automated Self-Healing)**: When drift is detected, system MUST automatically calculate the required adjustment, update the drifted channel, and log the repair in the audit trail.
- **FR-10 (High-Density Dashboard)**: UI MUST display real-time store connection health, sync speed latency, active SKU counts, and recent transaction stream.
- **FR-11 (Discrepancy Resolution Modal)**: UI MUST provide a side-by-side comparison modal allowing operators to view discrepancies and execute 1-click manual overrides ("Force Sync to Ledger").
- **FR-12 (Audit Trail Logging)**: Every inventory mutation MUST be permanently logged with timestamp, SKU, delta, resulting stock, reason, origin store, and reference order ID.

---

## 2. Non-Functional Requirements (NFR)

- **NFR-01 (Availability)**: 99.95% uptime for webhook ingestion endpoints.
- **NFR-02 (Sync Latency)**: p95 end-to-end sync latency across platforms must be **< 800ms**.
- **NFR-03 (Throughput)**: Capable of sustaining burst loads of **250 concurrent order webhooks/second**.
- **NFR-04 (Zero Ghost Inventory)**: Concurrency race condition testing must demonstrate 0.000% overselling rate under flash sale conditions.
- **NFR-05 (Data Security)**: Store API credentials and webhook secrets MUST be encrypted at rest using AES-256-GCM. Plaintext secrets MUST NEVER appear in application logs.
- **NFR-06 (Observability)**: All logs must be structured JSON with correlation IDs (`trace_id`).
- **NFR-07 (UI Responsiveness)**: Dashboard data grid must render 5,000+ SKUs with virtualized scrolling and **< 16ms frame render times**.
