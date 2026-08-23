# Phase 3 Architecture: Master Inventory Ledger Authority & Invariants

## 1. Single Source of Truth Hierarchy
- **Master Ledger Authority**: The PostgreSQL database hosting `InventoryLedger` is the sole immutable authority for all product quantities.
- **Storefronts as Projections**: External storefronts (Shopify, WooCommerce) are downstream projections that reflect ledger state.

---

## 2. The Delta-Based Invariant Law
```
Rule: NEVER overwrite Master Ledger with an absolute value from a webhook.
```
- When an order arrives: `quantityDelta = -item.quantity`.
- Ledger computes: `resultingStock = currentStock + quantityDelta`.
- If `resultingStock < 0`: The transaction fails, preventing overselling.
- If `resultingStock >= 0`: State commits atomically, version increments (`version += 1`), and new resultingStock broadcasts to all mapped channels.

---

## 3. Optimistic Concurrency Control (OCC)
- Every SKU maintains an incremental `version` integer.
- Database transactions execute:
  ```sql
  UPDATE "Product" 
  SET "currentStock" = "currentStock" + $delta, "version" = "version" + 1 
  WHERE "masterSku" = $sku AND "version" = $expectedVersion AND ("currentStock" + $delta) >= 0;
  ```
- If rows affected == 0, transaction retries with fresh version lookup.
