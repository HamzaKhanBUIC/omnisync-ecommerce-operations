# Phase 3 Architecture: Relational Data Model Specification

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum PlatformType {
  SHOPIFY
  WOOCOMMERCE
}

enum LedgerReason {
  ORDER_FULFILLMENT
  MANUAL_ADJUSTMENT
  RETURN
  RECONCILIATION_FIX
}

model Store {
  id             String        @id @default(uuid())
  platform       PlatformType
  name           String
  storeUrl       String
  apiKeyEncrypted String       // AES-256-GCM encrypted
  webhookSecretEncrypted String // AES-256-GCM encrypted
  isActive       Boolean       @default(true)
  rateLimitTokens Int          @default(40)
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt
  channelSkus    ChannelSku[]
  orders         Order[]
  auditLogs      AuditRecord[]
}

model Product {
  id             String            @id @default(uuid())
  title          String
  masterSku      String            @unique
  barcode        String?
  currentStock   Int               @default(0)
  version        Int               @default(1) // Optimistic locking
  createdAt      DateTime          @default(now())
  updatedAt      DateTime          @updatedAt
  variants       Variant[]
  ledgerEntries  InventoryLedger[]
}

model Variant {
  id             String        @id @default(uuid())
  productId      String
  product        Product       @relation(fields: [productId], references: [id], onDelete: Cascade)
  variantSku     String        @unique
  title          String
  price          Decimal       @db.Decimal(10, 2)
  channelSkus    ChannelSku[]
}

model ChannelSku {
  id             String        @id @default(uuid())
  storeId        String
  store          Store         @relation(fields: [storeId], references: [id], onDelete: Cascade)
  variantId      String
  variant        Variant       @relation(fields: [variantId], references: [id], onDelete: Cascade)
  externalSku    String
  externalItemId String
  syncEnabled    Boolean       @default(true)
  lastSyncedAt   DateTime?
  lastDriftCheck DateTime?

  @@unique([storeId, externalSku])
}

model InventoryLedger {
  id             String        @id @default(uuid())
  productId      String
  product        Product       @relation(fields: [productId], references: [id], onDelete: Cascade)
  quantityDelta  Int
  resultingStock Int
  reason         LedgerReason
  originStoreId  String?
  referenceId    String?       // Order ID or adjustment ID
  createdAt      DateTime      @default(now())

  @@index([productId, createdAt])
}

model Order {
  id             String        @id @default(uuid())
  storeId        String
  store          Store         @relation(fields: [storeId], references: [id])
  externalId     String
  orderNumber    String
  status         String        // "PENDING" | "SYNCED" | "FAILED"
  rawPayload     Json
  createdAt      DateTime      @default(now())

  @@unique([storeId, externalId])
}

model AuditRecord {
  id             String        @id @default(uuid())
  storeId        String?
  store          Store?        @relation(fields: [storeId], references: [id])
  action         String
  payload        Json
  traceId        String
  timestamp      DateTime      @default(now())
}
```
