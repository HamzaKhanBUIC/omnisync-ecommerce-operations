# Product Definition: Core Merchant User Workflows

## Workflow 1: Store Connection & Baseline Catalog Mapping
```
[Merchant / Agency] ──► [Clicks 'Connect Shopify' (OAuth) & 'Connect WooCommerce' (API Keys)]
                              │
                              ▼
                      [System Validates Credentials & Webhook HMAC Secret]
                              │
                              ▼
                      [Auto-Matches SKUs by masterSku or Barcode]
                              │
                              ▼
                      [Generates Master Ledger Baseline Snapshot]
                              │
                              ▼
                      [Activates Sub-Second Bi-Directional Sync]
```

---

## Workflow 2: Real-Time Order Checkout & Sub-Second Sync
```
[Customer buys SKU on Shopify] ──► [Shopify triggers 'orders/create' Webhook]
                                             │
                                             ▼
                                [Ingestion Gateway: Constant-Time HMAC Verify]
                                             │
                                             ▼
                                [IdempotencyGuard: Checks duplicate key]
                                             │
                                             ▼
                                [Master Ledger Engine: Atomic delta -1 applied]
                                             │
                                             ▼
                                [Token Bucket Queue: Dispatches update to WooCommerce]
                                             │
                                             ▼
                                [WooCommerce Stock Updated in <800ms]
```

---

## Workflow 3: Continuous Drift Detection & Automated Self-Healing
```
[Background Auditor Loop (Every 15m)] ──► [Polls Shopify & WooCommerce API stock levels]
                                                       │
                                                       ▼
                                          [Compares Live Stock vs Master Ledger Truth]
                                                       │
                                     ┌─────────────────┴─────────────────┐
                                     ▼                                   ▼
                              [Discrepancy = 0]                [Discrepancy Detected]
                                     │                                   │
                               [Log Status OK]              [Calculates Required Delta]
                                                                         │
                                                                         ▼
                                                            [Auto-Repairs Channel to Ledger]
                                                                         │
                                                                         ▼
                                                            [Logs Audit Trail & Dashboard Alert]
```
