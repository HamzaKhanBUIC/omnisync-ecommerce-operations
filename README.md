# OmniSync: Multi-Channel Ecommerce Operations Platform

[![Tests](https://img.shields.io/badge/Tests-47%2F47%20Passed-10B981?style=flat-square&logo=node.js)](https://github.com/)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)
[![Node Version](https://img.shields.io/badge/Node.js-%3E%3D20.0-06B6D4?style=flat-square&logo=node.js)](https://nodejs.org/)
[![Oversell Rate](https://img.shields.io/badge/Oversell%20Rate-0.000%25-10B981?style=flat-square)](testing/RED_TEAM_REPORT.md)
[![Sync Latency](https://img.shields.io/badge/Sync%20Latency%20(p95)-280ms-10B981?style=flat-square)](testing/PERFORMANCE_REPORT.md)

OmniSync is a multi-channel inventory orchestration and automated reconciliation engine built for high-velocity merchants selling simultaneously across **Shopify** and **WooCommerce**.

Multi-store brands often struggle with polling delays in automation tools or rigid legacy ERPs, resulting in ghost inventory, overselling during flash sales, and unreconciled stock drift between sales channels.

OmniSync addresses this with an append-only PostgreSQL master delta ledger, sub-second bi-directional synchronization, token-bucket rate regulation, and an automated background drift auditor that reconciles storefront discrepancies.

---

## Operations Console Preview

![OmniSync Operations Console](docs/assets/dashboard_preview.png)

*High-density operations console featuring real-time telemetry, virtualized inventory matrix, multi-location hub allocations, token-bucket rate gauges, side-by-side drift diffs, and live CloudEvents streaming.*

---

## Core Architectural Capabilities

### 1. Zero Ghost Inventory & Concurrency Protection
- **Append-Only Delta Ledger**: Deducts stock via atomic relative signed mutations (`quantityDelta = -N/+N`) with row-level optimistic concurrency control (`version`), preventing overselling during concurrent checkout bursts.
- **Idempotency Guard**: 24-hour sliding TTL cache preventing duplicate ledger deductions from replayed webhooks.

### 2. Sub-Second Cross-Channel Broadcast
- **Event-Driven CQRS Pipeline**: Ingests orders in `<15ms`, mutates the ledger, and propagates stock updates downstream across all connected channels in `< 420ms (p95)`.

### 3. Proactive Client-Side Rate Limiting
- **Token Bucket Regulation**: Outbound workers regulate API traffic mirroring platform rate constraints (**Shopify 40/80 point leaky bucket**, **WooCommerce 25 req/s batch limit**) with 15% safety headroom, eliminating `HTTP 429 Too Many Requests` exceptions.

### 4. Continuous Drift Detection & Automated Reconciliation
- **Automated Background Auditor**: Scans live channel stock against Master Ledger records every 15 minutes.
- **Automated Reconciliation**: Computes required adjustments, synchronizes drifted storefronts, and records immutable double-entry audit trail logs.

### 5. Multi-Location Fulfillment & Composite Bundles
- **Warehouse Hub Allocations**: Physical stock partitioned across 4 geographic fulfillment hubs (`MAIN_US_3PL`, `WEST_US_HUB`, `EU_CENTRAL`, `UK_FULFILLMENT`) with atomic inter-hub transfers.
- **Virtual Composite Bundles**: Dynamic bundle recipe calculation (e.g. `2x T-Shirt` + `1x Cap`), determining real-time bundle availability from component bottlenecks and atomically deducting individual raw items on fulfillment.

### 6. Fault Tolerance & Circuit Breaking
- **Three-State Circuit Breaker**: (`CLOSED`, `OPEN`, `HALF_OPEN`) with exponential backoff and jitter, preventing cascading worker stalls during external API outages.

---

## System Architecture

```
                                    ┌───────────────────────┐
                                    │    Shopify Store      │
                                    └──────────┬────────────┘
                                               │ Webhook Event (orders/create)
                                               ▼
┌──────────────────────┐            ┌───────────────────────┐
│  WooCommerce Store   ├───────────►│ Ingestion Gateway API │
└──────────────────────┘ Webhook    │ (Timing-Safe HMAC &   │
                                    │  Idempotency Check)   │
                                    └──────────┬────────────┘
                                               │
                                               ▼
                                    ┌───────────────────────┐
                                    │ Master Ledger Engine  │
                                    │ (PostgreSQL + Prisma) │
                                    │ (Atomic Delta Mutex)  │
                                    └──────────┬────────────┘
                                               │
                                               ▼
                                    ┌───────────────────────┐
                                    │ Transactional Outbox  │
                                    │ (CloudEvents v1.0)    │
                                    └──────────┬────────────┘
                                               │
                        ┌──────────────────────┴──────────────────────┐
                        ▼                                             ▼
            ┌───────────────────────┐                     ┌───────────────────────┐
            │ Update Shopify Stock  │                     │ Update WooCommerce    │
            │ (GraphQL Mutation)    │                     │ (REST v3 Batch HPOS)  │
            └───────────────────────┘                     └───────────────────────┘
```

---

## Verification & Benchmark Results

The entire codebase is verified by 47 automated test suites covering unit mechanics, integration gateways, HMAC security validations, and high-concurrency simulations:

```bash
$ npm test

✔ Shopify Adapter - Order Normalization (2.22ms)
✔ Shopify Adapter - GraphQL Mutations & Limits (4.78ms)
✔ Shopify Adapter - 250-Item Hard Limit Check (1.51ms)
✔ Shopify Adapter - Concurrent Lock Contention & userErrors (1.55ms)
✔ Shopify Adapter - Leaky bucket depletion & Throttling (1177.03ms)
✔ WooCommerce Adapter - HPOS & Legacy Normalization (0.45ms)
✔ WooCommerce Adapter - REST v3 Batch Stock Updates (0.41ms)
✔ WooCommerce Adapter - 100-Object Limit & Chunking (0.47ms)
✔ WooCommerce Adapter - HPOS Storage Engine Validation (0.31ms)
✔ WooCommerce Adapter - HTTP 503 & Parameter Validation (0.36ms)
✔ API Server - Health Check Endpoints (33.93ms)
✔ API Server - Master Inventory Endpoint (3.03ms)
✔ API Server - Shopify Webhook Ingest with Valid HMAC (8.96ms)
✔ API Server - Idempotency Deduplication (2.30ms)
✔ API Server - Reject Invalid HMAC 401 (3.51ms)
✔ API Server - WooCommerce Webhook Ingest with Valid HMAC (2.05ms)
✔ API Server - Reject Invalid WooCommerce HMAC 401 (2.75ms)
✔ API Server - Manual Inventory Adjustment (2.44ms)
✔ API Server - Stockout Prevention Barrier 400 (2.33ms)
✔ API Server - Drift Reconciliation Endpoint (1.99ms)
✔ API Server - Static File Serving (17.35ms)
✔ API Server - Real-Time SSE Stream (7.16ms)
✔ Security: Shopify HMAC Signature Verification & Forgery Defense (1.89ms)
✔ Security: WooCommerce HMAC Signature Verification & Forgery Defense (0.41ms)
✔ Security: Unicode, UTF-8 Multi-Byte, and Boundary Payloads (0.25ms)
✔ Security: Timing-Safe Resistance Verification (6.74ms)
✔ Security: Replay Attack Inundation (50 replayed webhooks in 1 second) (4.02ms)
✔ Security: Concurrent Replay Inundation (0.56ms)
✔ Security: Idempotency TTL Expiration Boundary (75.02ms)
✔ Flash Sale Burst: 1,000 Rapid Order Checkout Webhooks (16385.19ms) -> 0.000% Oversell Rate
✔ Flash Sale Burst: Catalog-Wide 1,000 Order Wave Across 100 SKUs (16414.50ms)
✔ Flash Sale Burst: Zero Initial Stock Stockout Barrier (6.29ms)
✔ High Concurrency Flash Sale - Zero Overselling Guarantee (6.24ms)
✔ Reconciliation Workflow - Drift Detection and Auto-Healing (0.60ms)
✔ Composite Bundles - Virtual Stock Calculation & Atomic Deductions (1.86ms)
✔ Circuit Breaker - State Machine Transitions and Threshold Tripping (65.90ms)
✔ Multi-Location Warehouse Inventory - Allocation & Transfers (1.67ms)
✔ Unit Tests: HMAC, IdempotencyGuard, MasterLedger, TokenBucketLimiter (175.32ms)

Total Tests: 47 | Passed: 47 | Failed: 0 | Duration: 33.1s
```

---

## Quick Start

### 1. Prerequisites
- **Node.js**: `>= 20.0.0`
- **Python**: `>= 3.10` (for simulation utilities)

### 2. Installation & Setup
```bash
# Clone the repository
git clone https://github.com/HamzaKhanBUIC/omnisync-ecommerce-operations.git
cd omnisync-ecommerce-operations

# Run all 47 automated test suites
npm test
```

### 3. Start the Live Operations Server & Dashboard
```bash
# Starts the server and UI at http://localhost:3000
node --experimental-strip-types src/index.ts
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Interactive Simulation & CLI Utilities
```bash
# Run 100-order concurrent flash sale simulator
python scripts/simulation/traffic_simulator.py

# Run live channel drift auditor and automated self-healing utility
python scripts/reconciliation/drift_checker.py
```

---

## API Endpoints

| Method | Endpoint | Description | Auth / Headers |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Server health, uptime, and store counts | Public |
| `GET` | `/api/v1/inventory` | Paginated Master Ledger stock and channel mappings | Public |
| `POST` | `/api/v1/inventory/adjust` | Atomic manual delta adjustment with OCC versioning | JSON Body |
| `POST` | `/api/v1/inventory/transfer` | Warehouse transfer between fulfillment hubs | JSON Body |
| `GET` | `/api/v1/orders` | Unified multi-channel order stream | Public |
| `POST` | `/api/v1/reconciliation/trigger` | Triggers full catalog drift audit and self-healing | Public |
| `GET` | `/api/v1/circuit-breakers` | Live circuit breaker states (`CLOSED`, `OPEN`) | Public |
| `GET` | `/api/v1/events/stream` | Server-Sent Events (SSE) stream (CloudEvents v1.0) | `text/event-stream` |
| `POST` | `/api/v1/webhooks/shopify/:storeId` | Ingests Shopify order and inventory webhooks | `X-Shopify-Hmac-Sha256` |
| `POST` | `/api/v1/webhooks/woocommerce/:storeId` | Ingests WooCommerce order and stock webhooks | `X-WC-Webhook-Signature` |

---

## Documentation

- [Developer Setup & Environment Guide](docs/SETUP.md)
- [Internal API Specifications](docs/API.md)
- [Channel Integration Runbook (Shopify & WooCommerce)](docs/INTEGRATIONS.md)
- [Production Operations & SRE Runbook](docs/OPERATIONS.md)
- [Red Team Chaos Engineering Report](testing/RED_TEAM_REPORT.md)
- [Final Production Release Report](docs/FINAL_RELEASE_REPORT.md)

---

## License

MIT License. Open source and free for multi-store operators.
