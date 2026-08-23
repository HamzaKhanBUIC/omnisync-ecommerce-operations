# Design System: Operational UX Guidelines & Principles

## 1. Core Ergonomic Philosophy
- **Information Density Over Wasted Whitespace**: Operations managers need compact, data-rich screens. Standard table row height is 36px, with monospace font for identifiers (SKUs, Order IDs, Hashes).
- **Glanceable System Health**: Storefront connection states, sync speeds, and queue depths must be instantly comprehensible through standard color-coded badges:
  - **Emerald (#10B981)**: Synced / Healthy / Verified HMAC / 100% Rate Budget.
  - **Amber (#F59E0B)**: Pending Queue / Retrying / Near Rate Limit (>80% bucket consumed).
  - **Rose (#EF4444)**: Sync Error / Drift Detected / Invalid Signature / DLQ Stalled.
  - **Slate (#64748B)**: Paused / Inactive Channel / Dry Run Mode.
- **Zero-Friction Anomaly Resolution**: If a discrepancy or queue error occurs, the operator is presented with a 1-click contextual resolution action (**"Force Sync to Ledger"**).

---

## 2. Screen Layout Hierarchy
- **Top Navigation Bar**: Workspace name, active session status badge (`HEALTHY`), live sync latency indicator (`280ms`), and system clock.
- **KPI Summary Cards (Top Row)**:
  1. *Active Mapped SKUs* (e.g. `2,450`)
  2. *24h Orders Synced* (e.g. `1,842`)
  3. *Sync Latency (p95)* (e.g. `420ms`)
  4. *Active Discrepancies* (e.g. `0 [ALL IN SYNC]`)
- **Main Viewport (Tabbed)**:
  - Tab 1: **Master Inventory Ledger** (Virtualized TanStack Table).
  - Tab 2: **Channel Store Hub** (Shopify US & WooCommerce EU connection cards, token bucket monitors).
  - Tab 3: **Drift & Audit Center** (Discrepancy logs, continuous auditor toggle, manual force-sync).
  - Tab 4: **Live Event Stream** (WebSocket CloudEvents terminal).
