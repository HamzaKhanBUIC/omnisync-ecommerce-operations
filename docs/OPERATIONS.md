# Production Operations & SRE Runbook (docs/OPERATIONS.md)

## 1. Deployment Architecture
- **API Ingestion Gateway**: Deployed on auto-scaling containers (Kubernetes / Google Cloud Run) behind Cloudflare WAF.
- **Queue Engine**: Redis 7 cluster backed by BullMQ workers scaled based on queue depth metric `bullmq_waiting_jobs > 50`.
- **Database**: Managed PostgreSQL 16 with automatic continuous WAL archiving, daily snapshots, and read-replicas.

---

## 2. Monitoring & Prometheus Alert Rules

| Alert Metric | Condition | Severity | Action |
|---|---|---|---|
| **Webhook 5xx Spikes** | Rate of 5xx responses > 1% for 2m | **CRITICAL (P1)** | Page on-call; inspect database connection pool. |
| **DLQ Queue Growth** | `bullmq_failed_jobs > 5` for 5m | **HIGH (P2)** | Inspect DLQ error logs; trigger channel reconnect or credential refresh. |
| **Persistent Drift** | Drift detected > 3 items on 2 consecutive audits | **HIGH (P2)** | Run manual reconciliation job; inspect store plugin conflict. |
| **API Bucket Exhaustion** | Leaky bucket available tokens < 10% for 3m | **MEDIUM (P3)** | Throttle batch sync workers; inspect flash sale velocity. |
