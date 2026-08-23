# Phase 3 Architecture: CloudEvents v1.0 Event Specification

All internal messages follow the **CloudEvents v1.0 standard**.

---

## 1. Inventory Adjusted Event (`com.ecom.inventory.adjusted`)
```json
{
  "specversion": "1.0",
  "id": "evt_9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "type": "com.ecom.inventory.adjusted",
  "source": "/ledger/engine",
  "time": "2026-08-24T03:00:00Z",
  "datacontenttype": "application/json",
  "data": {
    "masterSku": "SHIRT-BLK-M",
    "quantityDelta": -1,
    "previousStock": 100,
    "resultingStock": 99,
    "reason": "ORDER_FULFILLMENT",
    "originStoreId": "store_shopify_us_01",
    "orderReference": "ORD-Shopify-94821",
    "version": 42
  }
}
```

---

## 2. Drift Detected Event (`com.ecom.drift.detected`)
```json
{
  "specversion": "1.0",
  "id": "evt_8f3a1c2e-4b5d-6e7f-8a9b-0c1d2e3f4a5b",
  "type": "com.ecom.drift.detected",
  "source": "/auditor/continuous",
  "time": "2026-08-24T03:15:00Z",
  "datacontenttype": "application/json",
  "data": {
    "masterSku": "HOODIE-GRY-L",
    "storeId": "store_woo_eu_02",
    "ledgerStock": 45,
    "channelStock": 38,
    "discrepancyDelta": -7,
    "autoRepairTriggered": true
  }
}
```

---

## 3. Sync Failed Event (`com.ecom.sync.failed`)
```json
{
  "specversion": "1.0",
  "id": "evt_4c1eeb4a-1a2b-4c3d-8e5f-1a2b3c4d5e6f",
  "type": "com.ecom.sync.failed",
  "source": "/adapter/woocommerce",
  "time": "2026-08-24T03:00:02Z",
  "datacontenttype": "application/json",
  "data": {
    "targetStoreId": "store_woo_eu_02",
    "externalSku": "SHIRT-BLK-M",
    "attemptCount": 3,
    "httpStatus": 504,
    "errorMessage": "Gateway Timeout from WooCommerce WordPress Host",
    "deadLetter": true
  }
}
```
