# Phase 1 Discovery: Customer Segmentation & ICP Analysis

## 1. Customer Segmentation Matrix

| Segment | Monthly Order Volume | Catalog Size | Storefront Setup | Pain Severity | Tech Sophistication | Willingness to Pay | ICP Rank |
|---|---|---|---|---|---|---|---|
| **Small Shopify Merchant** | < 300 orders/mo | 10–100 SKUs | 1 Shopify Store | **LOW** | Low | Low (< $29/mo) | Rank 5 |
| **Small WooCommerce Merchant** | < 300 orders/mo | 10–100 SKUs | 1 WooCommerce Store | **LOW** | Medium | Low (< $29/mo) | Rank 6 |
| **Mid-Market Multi-Store Brand (D2C)** | 1,000–30,000 orders/mo | 200–5,000 SKUs | 1 Shopify + 1–2 WooCommerce / Regional | **CRITICAL** | Medium-High | **HIGH ($149–$499/mo)** | **RANK 1 (PRIMARY ICP)** |
| **Hybrid D2C + B2B Merchant** | 2,000–50,000 orders/mo | 500–15,000 SKUs | Shopify (D2C) + WooCommerce (B2B/Wholesale) | **CRITICAL** | High | **HIGH ($299–$799/mo)** | **RANK 2 (SECONDARY ICP)** |
| **E-Commerce Operations Agency** | 10,000–100,000+ orders across 5–30 client stores | 1,000–50,000 SKUs | Multi-client mixed Shopify & WooCommerce | **HIGH** | High | **VERY HIGH ($499–$1,500/mo)** | **RANK 3 (CHANNEL PARTNER)** |
| **Enterprise Retailer** | > 100,000 orders/mo | > 50,000 SKUs | Custom headless + SAP / NetSuite | **MEDIUM** | Enterprise | Enterprise ($2k+/mo) | Rank 4 (Non-Goal) |

---

## 2. Deep Persona Profiles

### Primary ICP Persona: "Elena — Operations Director at Omnichannel D2C Brand"
- **Company Profile**: $4.5M Annual GMV, selling high-end athletic apparel across Shopify US and WooCommerce EU.
- **Daily Workflow**: Spends 1.5 to 2.5 hours every morning cross-referencing exported CSVs from Shopify and WooCommerce in Excel to manually balance inventory.
- **Core Trigger / Catastrophe**: "During our Black Friday campaign, an Instagram reel went viral. We sold 140 units of our limited-edition jacket on Shopify within 12 minutes. Because WooCommerce didn't sync fast enough, our European store accepted 32 orders for items we didn't have. We had to cancel orders, issue $1,200 in discount vouchers, and our trust score plummeted."
- **Willingness to Pay**: "If a tool guarantees zero overselling and takes away the morning spreadsheet reconciliation nightmare, I'll happily pay $300 to $500/month without thinking twice."

### Secondary Channel Persona: "Marcus — Technical Lead at E-Commerce Development Agency"
- **Company Profile**: Digital agency managing 18 multi-store Shopify & WooCommerce merchant clients.
- **Daily Workflow**: Builds bespoke webhook listeners on AWS Lambda / DigitalOcean to sync stock. Constantly gets paged on weekends when WooCommerce server CPU spikes or Shopify API updates break custom scripts.
- **Core Trigger**: "Clients blame us when inventory desyncs. We waste 40+ engineering hours a month babysitting fragile webhook cron jobs. We want a reliable, turnkey middleware we can deploy across all our clients."
