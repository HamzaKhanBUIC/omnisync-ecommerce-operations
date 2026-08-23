# Product Definition: MVP Scope & Boundary Decisions

## 1. The Core MVP Wedge: "The Self-Healing Multi-Channel Inventory Ledger"

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      IN-SCOPE (MVP PHASE 1 & 2)                         │
├─────────────────────────────────────────────────────────────────────────┤
│ 1. Sub-Second Bi-Directional Inventory Synchronization (<800ms)         │
│ 2. PostgreSQL Append-Only Master Ledger (Atomic relative deltas)        │
│ 3. Proactive Leaky Bucket Rate Limiter (Zero HTTP 429 errors)           │
│ 4. Cryptographic Constant-Time Webhook Security (Shopify & WooCommerce)  │
│ 5. Idempotent Ingestion Guard (Deduplication cache)                     │
│ 6. Continuous 15-Minute Background Drift Auditor                        │
│ 7. Automated Self-Healing Reconciliation Engine                         │
│ 8. High-Density Operational Dashboard & Discrepancy Inspector Modal     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Deferred Capabilities (Post-MVP Phase 3 Roadmap)
- Multi-warehouse 3PL routing rules based on customer shipping geo-location.
- Dynamic composite SKU bundle stock calculation.
- Automated purchase order (PO) generation based on sales velocity.
- Amazon SP-API and TikTok Shop connectors.

---

## 3. Explicit Non-Goals (Out of Scope Forever)
- Generic customer email/SMS marketing or abandoned cart recovery (owned by Klaviyo).
- Full accounting general ledger, invoicing, and sales tax calculation (owned by QuickBooks/Xero).
- Customer-facing checkout hosting or storefront rendering.
- Physical POS hardware terminal manufacturing.
