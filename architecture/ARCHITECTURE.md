# Phase 3 Architecture: Distributed System Topology

## 1. High-Level System Architecture Diagram

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
                                    │ Redis / BullMQ Queues │
                                    │ (Inbound Event Queue) │
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
                                               ▼
                                    ┌───────────────────────┐
                                    │ Channel Sync Workers  │
                                    │ (Token-Bucket Limiter)│
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

## 2. Core Architectural Invariants

### 1. CQRS (Command Query Responsibility Segregation)
- **Command Path (Mutations)**: Ingested via webhooks ➔ Enqueued in Redis ➔ Processed by Master Ledger with atomic row/mutex locking ➔ Persisted as an immutable append-only ledger entry.
- **Query Path (Reads)**: Read models served from memory/Redis cache or optimized database read-replicas for sub-10ms UI latency.

### 2. Transactional Outbox Pattern
- Database state mutation and outgoing event creation occur in the same database transaction.
- Background dispatch workers poll the outbox table and emit CloudEvents into the outbound channel queue, guaranteeing **at-least-once broadcast delivery**.

### 3. Proactive Token-Bucket Rate Throttling
- Outbound channel clients maintain local token buckets that track Shopify GraphQL cost (1,000 pts / 50 pts refill) and WooCommerce batch rates (25 items/request).
- Workers pause gracefully rather than hammering external APIs into HTTP 429 rate limit bans.
