# Phase 1 Discovery: WooCommerce Technical API & Webhook Specifications

## 1. REST API Architecture (v3)
- **Base Endpoint**: `/wp-json/wc/v3/`.
- **Authentication**: HTTP Basic Auth over HTTPS (`consumer_key`, `consumer_secret`).
- **Storage Engine**:
  - **High-Performance Order Storage (HPOS)**: Custom dedicated tables (`wp_wc_orders`, `wp_wc_order_addresses`, `wp_wc_order_operational_data`).
  - REST API v3 is natively HPOS compatible; legacy direct queries to `wp_posts`/`wp_postmeta` bypass HPOS and cause data corruption.

---

## 2. Batch Processing & Rate Limits
- **Batch Endpoint**: `/wp-json/wc/v3/products/batch`.
- **Hard Limit**: Maximum **100 objects per batch request**.
- **Server Resource Bottlenecks**: Processing 100 products per batch on shared/standard VPS hosting frequently triggers `HTTP 503 Backend Fetch Failed` or `HTTP 504 Gateway Timeout` due to expensive cache invalidations.
- **Production Best Practice**: Chunk batch inventory requests into **25 to 50 items per payload**.

---

## 3. Webhooks & Action Scheduler Bottlenecks
- **Delivery Mechanism**: WooCommerce delegates webhooks to **Action Scheduler** (`woocommerce_deliver_webhook_async`).
- **Failure Vulnerability**:
  - On high-traffic stores, Action Scheduler queue accumulates backlogs if WordPress Cron (`wp-cron.php`) is delayed by traffic spikes or server timeouts.
  - Webhook delivery delays of 2–10 minutes are common on unoptimized hosts.
- **Cryptographic Verification**:
  - Header: `X-WC-Webhook-Signature` (Base64-encoded HMAC-SHA256 of raw body with webhook secret).
  - Must verify with constant-time equality.
