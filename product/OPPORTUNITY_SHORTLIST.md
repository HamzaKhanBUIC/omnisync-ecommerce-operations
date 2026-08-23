# Phase 1: Opportunity Shortlist & Evaluation Matrix

## 1. Opportunity Candidates Evaluated

### Opportunity A: "All-in-One E-Commerce CRM & Marketing Automation"
- **Scope**: Centralized customer records, abandoned cart recovery, email/SMS marketing, support ticket routing.
- **Verdict**: **REJECTED (NON-GOAL)**.
- **Rationale**: Heavily commoditized by Klaviyo, Omnisend, Gorgias, and Shopify Flow. Low differentiation, massive surface area.

### Opportunity B: "Full-Scale Omnichannel ERP & Accounting System"
- **Scope**: Purchase orders, invoice generation, sales tax calculation, general ledger accounting.
- **Verdict**: **REJECTED (NON-GOAL)**.
- **Rationale**: Extreme regulatory and financial complexity. Dominant legacy players (NetSuite, Xero, QuickBooks). High churn and protracted sales cycles.

### Opportunity C: "Self-Healing Multi-Channel Inventory Ledger & Operations Engine"
- **Scope**: Sub-second bi-directional inventory synchronization, append-only master ledger, token-bucket rate limiting, automatic continuous drift reconciliation, and 1-click manual anomaly resolution for Shopify & WooCommerce.
- **Verdict**: **ACCEPTED (WINNING PRODUCT WEDGE)**.
- **Rationale**: Highest pain severity (overselling disasters, 8+ hrs/wk lost in spreadsheets), high willingness to pay ($149–$499/mo), clear technical differentiation (mathematically consistent ledger vs fragile polling triggers), manageable scope with massive reliability impact.

---

## 2. Multi-Criteria Opportunity Scorecard (Winning Wedge: Opp C)

| Evaluation Dimension | Weight | Score (1–10) | Weighted Score | Justification |
|---|---|---|---|---|
| **Problem Severity** | 15% | 10 | 1.50 | Overselling causes instant revenue loss, order cancellations, and brand damage. |
| **Frequency of Pain** | 10% | 9 | 0.90 | Occurs continuously throughout daily order fulfillment and promotional sales. |
| **Revenue Impact** | 15% | 10 | 1.50 | Directly prevents stockout cancellations and saves $1,000s in customer compensation. |
| **Current Solution Weakness** | 15% | 9 | 1.35 | Existing tools are either fragile 15-min polling triggers (Zapier) or $1k/mo clunky ERPs (Cin7). |
| **Willingness to Pay** | 10% | 9 | 0.90 | Mid-market merchants and agencies readily allocate $149–$499/mo for inventory peace of mind. |
| **Reachability & Distribution** | 10% | 9 | 0.90 | Direct distribution via Shopify App Store, WooCommerce marketplace, and agency partners. |
| **Technical Feasibility** | 10% | 9 | 0.90 | Clean TypeScript/Node.js event-driven architecture with PostgreSQL atomic transactions. |
| **Differentiation** | 5% | 9 | 0.45 | Append-only delta ledger + continuous 15-min background self-healing auto-repair. |
| **Integration Complexity** | 5% | 8 | 0.40 | Well-documented Shopify GraphQL & WooCommerce REST v3 APIs. |
| **Reliability Risk (Inverse)** | 5% | 9 | 0.45 | Proven with test suites (concurrency simulation, timing-safe HMAC, leaky bucket). |
| **TOTAL SCORE** | **100%** | — | **9.25 / 10.00** | **OUTSTANDING VIABILITY** |
