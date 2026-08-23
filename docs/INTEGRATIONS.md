# Channel Integration Setup Runbook (docs/INTEGRATIONS.md)

## 1. Shopify Integration Setup
1. **Create Custom App**:
   - In Shopify Admin ➔ Settings ➔ Apps and sales channels ➔ Develop apps.
   - Name: `Ecommerce Operations Engine`.
2. **Grant Admin API Permissions**:
   - `read_products`, `write_products`
   - `read_inventory`, `write_inventory`
   - `read_orders`, `write_orders`
3. **Configure Webhook Subscriptions**:
   - Target URL: `https://api.yourdomain.com/api/v1/webhooks/shopify/<storeId>`
   - Topics: `orders/create`, `inventory_levels/update`
   - Format: `JSON`
4. **Vault Credentials**:
   - Copy **Admin API Access Token** and **Webhook Secret Key** into the store credentials vault.

---

## 2. WooCommerce Integration Setup
1. **Generate REST API Key**:
   - In WordPress Admin ➔ WooCommerce ➔ Settings ➔ Advanced ➔ REST API ➔ Add Key.
   - Permissions: `Read/Write`.
   - Ensure High-Performance Order Storage (HPOS) is enabled under Advanced ➔ Features.
2. **Configure Webhooks**:
   - WooCommerce ➔ Settings ➔ Advanced ➔ Webhooks ➔ Add Webhook.
   - Topics: `Order created`, `Product updated`.
   - Delivery URL: `https://api.yourdomain.com/api/v1/webhooks/woocommerce/<storeId>`.
   - Secret: Enter your unique shared secret.
