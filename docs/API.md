# Internal API & Webhook Specifications (docs/API.md)

## 1. Ingestion Gateways

### `POST /api/v1/webhooks/shopify/:storeId`
- **Purpose**: Ingests Shopify order and inventory events.
- **Headers**:
  - `X-Shopify-Hmac-Sha256`: Base64 HMAC-SHA256 signature.
  - `X-Shopify-Topic`: `orders/create` | `inventory_levels/update`.
  - `X-Shopify-Webhook-Id`: Unique event UUID for idempotency caching.
- **Response**: `HTTP 200 OK` (`{ "status": "acknowledged", "orderId": "..." }`) or `HTTP 401 Unauthorized`.

### `POST /api/v1/webhooks/woocommerce/:storeId`
- **Purpose**: Ingests WooCommerce order and stock events.
- **Headers**:
  - `X-WC-Webhook-Signature`: Base64 HMAC-SHA256 signature.
  - `X-WC-Webhook-Topic`: `order.created` | `product.updated`.
  - `X-WC-Webhook-ID`: Event ID for deduplication.
- **Response**: `HTTP 200 OK` or `HTTP 401 Unauthorized`.

---

## 2. Master Ledger & Reconciliation Endpoints

### `GET /api/v1/inventory`
- **Query Params**: `page=1&limit=50&sku=SHIRT-BLK-M`
- **Response**:
  ```json
  {
    "total": 1,
    "items": [
      {
        "masterSku": "SHIRT-BLK-M",
        "title": "Classic Black Cotton T-Shirt (M)",
        "currentStock": 99,
        "version": 42,
        "mappings": [
          { "storeId": "store_shopify_us", "externalSku": "SHIRT-BLK-M", "channelStock": 99, "status": "IN_SYNC" },
          { "storeId": "store_woo_eu", "externalSku": "SHIRT-BLK-M", "channelStock": 99, "status": "IN_SYNC" }
        ]
      }
    ]
  }
  ```

### `POST /api/v1/reconciliation/trigger`
- **Purpose**: Manually triggers an immediate full-catalog drift scan and auto-repair.
- **Response**:
  ```json
  {
    "audited": 4,
    "discrepanciesFound": 0,
    "repaired": 0,
    "durationMs": 312
  }
  ```
