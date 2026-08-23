export type PlatformType = 'SHOPIFY' | 'WOOCOMMERCE';

export type WarehouseLocation = 'MAIN_US_3PL' | 'WEST_US_HUB' | 'EU_CENTRAL' | 'UK_FULFILLMENT';

export interface Store {
  id: string;
  name: string;
  platform: PlatformType;
  storeUrl: string;
  apiKey: string;
  webhookSecret: string;
  isActive: boolean;
  rateLimitTokens?: number;
}

export interface BundleComponent {
  componentSku: string;
  quantityRequired: number;
}

export interface MasterProduct {
  id: string;
  title: string;
  masterSku: string;
  barcode?: string;
  category?: string;
  price: number;
  currentStock: number;
  locations: Record<WarehouseLocation, number>;
  safetyStockThreshold: number;
  isBundle?: boolean;
  bundleRecipe?: BundleComponent[];
  version: number;
}

export interface ChannelMapping {
  storeId: string;
  masterSku: string;
  externalItemId: string;
  externalSku: string;
  syncEnabled: boolean;
  channelStock?: number;
  status?: 'IN_SYNC' | 'DRIFT_DETECTED' | 'PAUSED';
}

export interface LedgerEntry {
  id: string;
  masterSku: string;
  quantityDelta: number;
  resultingStock: number;
  location?: WarehouseLocation;
  reason: 'ORDER_FULFILLED' | 'MANUAL_ADJUSTMENT' | 'RETURN' | 'RECONCILIATION_FIX' | 'WAREHOUSE_TRANSFER';
  referenceId?: string;
  originStoreId?: string;
  timestamp: string;
}

export interface CloudEvent<T = any> {
  specversion: '1.0';
  id: string;
  type: string;
  source: string;
  time: string;
  datacontenttype: 'application/json';
  data: T;
}

export interface OrderItem {
  sku: string;
  quantity: number;
  price: number;
  title?: string;
}

export interface NormalizedOrder {
  orderId: string;
  storeId: string;
  platform: PlatformType;
  orderNumber: string;
  customerEmail?: string;
  customerName?: string;
  shippingCountry?: string;
  items: OrderItem[];
  totalPrice?: number;
  currency?: string;
  status: 'PENDING' | 'SYNCED' | 'SPLIT_ROUTED' | 'FAILED_DLQ';
  createdAt?: string;
}

export interface SyncResult {
  success: boolean;
  storeId: string;
  sku: string;
  updatedStock: number;
  latencyMs: number;
  error?: string;
}

export interface CircuitBreakerState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failures: number;
  lastFailureTime: number;
  threshold: number;
  cooldownMs: number;
}
