# Design System: Screen Flows & Navigation Architecture

```
                       ┌─────────────────────────────────────┐
                       │          TOP NAVBAR (Global)        │
                       │ [Status: GREEN] [Latency: 280ms]    │
                       └──────────────────┬──────────────────┘
                                          │
                  ┌───────────────────────┴───────────────────────┐
                  ▼                                               ▼
     ┌────────────────────────┐                     ┌────────────────────────┐
     │ 1. INVENTORY LEDGER    │                     │ 2. CHANNEL STORE HUB   │
     │ - Virtual SKU table    │                     │ - Shopify US (Active)  │
     │ - Stock delta drawer   │                     │ - WooCommerce EU (Act) │
     │ - Filter by brand/loc  │                     │ - Token bucket meters  │
     └────────────┬───────────┘                     └────────────┬───────────┘
                  │                                               │
                  └───────────────────────┬───────────────────────┘
                                          │
                  ┌───────────────────────┴───────────────────────┐
                  ▼                                               ▼
     ┌────────────────────────┐                     ┌────────────────────────┐
     │ 3. DRIFT & AUDIT HUB   │                     │ 4. LIVE EVENT STREAM   │
     │ - Discrepancy list     │                     │ - Webhook arrivals     │
     │ - 1-Click Auto-Repair  │                     │ - HMAC validation logs │
     │ - Audit trail history  │                     │ - CloudEvents payload  │
     └────────────────────────┘                     └────────────────────────┘
```
