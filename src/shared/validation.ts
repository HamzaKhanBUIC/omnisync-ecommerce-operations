import type { WarehouseLocation } from './types.ts';

/** Upper bound for one order line item. */
export const MAX_LINE_QUANTITY = 10_000;
/** Upper bound for one manual adjustment or warehouse transfer. */
export const MAX_STOCK_CHANGE = 100_000;
export const MAX_LINE_ITEMS = 250;
const MAX_ID_LENGTH = 128;

export const WAREHOUSE_LOCATIONS: readonly WarehouseLocation[] = ['MAIN_US_3PL', 'WEST_US_HUB', 'EU_CENTRAL', 'UK_FULFILLMENT'];
/** Reasons a client may give for a manual adjustment (order and transfer entries are system-only). */
export const MANUAL_ADJUSTMENT_REASONS = ['MANUAL_ADJUSTMENT', 'RETURN', 'RECONCILIATION_FIX'] as const;

export function isPositiveInt(value: unknown, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= max;
}

/** Non-empty string of at most 128 characters (SKUs, reference ids). */
export function isIdentifier(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= MAX_ID_LENGTH;
}

/** Platform order ids are positive integers (Shopify, WooCommerce) or identifier strings. */
export function isOrderId(value: unknown): boolean {
  return isPositiveInt(value, Number.MAX_SAFE_INTEGER) || isIdentifier(value);
}

export function isWarehouseLocation(value: unknown): value is WarehouseLocation {
  return typeof value === 'string' && (WAREHOUSE_LOCATIONS as readonly string[]).includes(value);
}

/** Returns an error message, or null when every line item has a sku and a bounded positive integer quantity. */
export function validateOrderItems(items: unknown): string | null {
  if (!Array.isArray(items) || items.length === 0) return 'line_items must be a non-empty array';
  if (items.length > MAX_LINE_ITEMS) return `line_items may contain at most ${MAX_LINE_ITEMS} entries`;
  for (const item of items) {
    if (!isIdentifier(item?.sku)) return 'every line item needs a sku';
    if (!isPositiveInt(item.quantity, MAX_LINE_QUANTITY)) {
      return `quantity for ${item.sku} must be an integer from 1 to ${MAX_LINE_QUANTITY}`;
    }
  }
  return null;
}
