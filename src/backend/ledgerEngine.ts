import type { MasterProduct, LedgerEntry, WarehouseLocation, BundleComponent } from '../shared/types.ts';

export class MasterLedgerEngine {
  private products: Map<string, MasterProduct> = new Map();
  private auditLedger: LedgerEntry[] = [];
  private lockMap: Map<string, boolean> = new Map();

  public registerProduct(
    masterSku: string,
    title: string,
    initialStock: number,
    options?: {
      barcode?: string;
      category?: string;
      price?: number;
      safetyStock?: number;
      locations?: Partial<Record<WarehouseLocation, number>>;
      isBundle?: boolean;
      bundleRecipe?: BundleComponent[];
    }
  ): MasterProduct {
    const defaultLocations: Record<WarehouseLocation, number> = {
      MAIN_US_3PL: options?.locations?.MAIN_US_3PL ?? Math.floor(initialStock * 0.5),
      WEST_US_HUB: options?.locations?.WEST_US_HUB ?? Math.floor(initialStock * 0.2),
      EU_CENTRAL: options?.locations?.EU_CENTRAL ?? Math.floor(initialStock * 0.2),
      UK_FULFILLMENT: options?.locations?.UK_FULFILLMENT ?? (initialStock - (Math.floor(initialStock * 0.5) + Math.floor(initialStock * 0.2) + Math.floor(initialStock * 0.2)))
    };

    const product: MasterProduct = {
      id: `prod_${Math.random().toString(36).substring(2, 9)}`,
      title,
      masterSku,
      barcode: options?.barcode ?? `UPC-${Math.floor(100000000000 + Math.random() * 900000000000)}`,
      category: options?.category ?? 'General Apparel',
      price: options?.price ?? 49.99,
      currentStock: initialStock,
      locations: defaultLocations,
      safetyStockThreshold: options?.safetyStock ?? 10,
      isBundle: options?.isBundle ?? false,
      bundleRecipe: options?.bundleRecipe,
      version: 1
    };
    this.products.set(masterSku, product);

    this.auditLedger.push({
      id: `led_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      masterSku,
      quantityDelta: initialStock,
      resultingStock: initialStock,
      reason: 'MANUAL_ADJUSTMENT',
      location: 'MAIN_US_3PL',
      timestamp: new Date().toISOString()
    });

    return product;
  }

  public getProduct(masterSku: string): MasterProduct | undefined {
    const p = this.products.get(masterSku);
    if (!p) return undefined;

    // If product is a bundle, compute virtual availability from components
    if (p.isBundle && p.bundleRecipe && p.bundleRecipe.length > 0) {
      let maxAvailableBundle = Number.MAX_SAFE_INTEGER;
      for (const comp of p.bundleRecipe) {
        const compProd = this.products.get(comp.componentSku);
        const compStock = compProd ? compProd.currentStock : 0;
        const availableFromComp = Math.floor(compStock / comp.quantityRequired);
        maxAvailableBundle = Math.min(maxAvailableBundle, availableFromComp);
      }
      return {
        ...p,
        currentStock: maxAvailableBundle === Number.MAX_SAFE_INTEGER ? 0 : maxAvailableBundle
      };
    }

    return { ...p };
  }

  public getAllProducts(): MasterProduct[] {
    return Array.from(this.products.keys()).map(sku => this.getProduct(sku)!);
  }

  public getAuditTrail(masterSku?: string): LedgerEntry[] {
    if (!masterSku) return [...this.auditLedger];
    return this.auditLedger.filter(e => e.masterSku === masterSku);
  }

  /**
   * Applies an atomic delta change to a product's stock with optimistic locking.
   * If the item is a bundle, atomically deducts the individual component SKUs.
   */
  public async applyDelta(
    masterSku: string,
    quantityDelta: number,
    reason: 'ORDER_FULFILLED' | 'MANUAL_ADJUSTMENT' | 'RETURN' | 'RECONCILIATION_FIX' | 'WAREHOUSE_TRANSFER',
    originStoreId?: string,
    referenceId?: string,
    preferredLocation: WarehouseLocation = 'MAIN_US_3PL'
  ): Promise<{ success: boolean; newStock: number; entry?: LedgerEntry; error?: string }> {
    // Acquire mutex for SKU
    while (this.lockMap.get(masterSku)) {
      await new Promise(r => setTimeout(r, 5));
    }
    this.lockMap.set(masterSku, true);

    try {
      const product = this.products.get(masterSku);
      if (!product) {
        return { success: false, newStock: 0, error: `SKU ${masterSku} not found` };
      }

      // Handle Bundle Breakdown
      if (product.isBundle && product.bundleRecipe && product.bundleRecipe.length > 0) {
        if (quantityDelta < 0) {
          const multiplier = Math.abs(quantityDelta);
          // 1. Pre-check all components
          for (const comp of product.bundleRecipe) {
            const compProd = this.products.get(comp.componentSku);
            const needed = comp.quantityRequired * multiplier;
            if (!compProd || compProd.currentStock < needed) {
              return {
                success: false,
                newStock: product.currentStock,
                error: `Insufficient component stock for bundle ${masterSku}: ${comp.componentSku} (needed ${needed}, available ${compProd?.currentStock ?? 0})`
              };
            }
          }
          // 2. Deduct all components
          for (const comp of product.bundleRecipe) {
            const needed = comp.quantityRequired * multiplier;
            const compProd = this.products.get(comp.componentSku)!;
            compProd.currentStock -= needed;
            compProd.version += 1;
            this.auditLedger.push({
              id: `led_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              masterSku: comp.componentSku,
              quantityDelta: -needed,
              resultingStock: compProd.currentStock,
              reason: 'ORDER_FULFILLED',
              originStoreId,
              referenceId: `BUNDLE_${masterSku}_${referenceId || 'ORD'}`,
              timestamp: new Date().toISOString()
            });
          }
        }
        const updatedBundle = this.getProduct(masterSku)!;
        return { success: true, newStock: updatedBundle.currentStock };
      }

      // Standard Product Mutation
      const targetStock = product.currentStock + quantityDelta;
      if (targetStock < 0) {
        return {
          success: false,
          newStock: product.currentStock,
          error: `Insufficient stock for ${masterSku}. Available: ${product.currentStock}, Requested: ${Math.abs(quantityDelta)}`
        };
      }

      // Mutate state atomically
      product.currentStock = targetStock;
      product.version += 1;

      // Adjust location breakdown
      if (product.locations[preferredLocation] !== undefined) {
        product.locations[preferredLocation] = Math.max(0, product.locations[preferredLocation] + quantityDelta);
      }

      const entry: LedgerEntry = {
        id: `led_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        masterSku,
        quantityDelta,
        resultingStock: targetStock,
        reason,
        location: preferredLocation,
        originStoreId,
        referenceId,
        timestamp: new Date().toISOString()
      };

      this.auditLedger.push(entry);
      return { success: true, newStock: targetStock, entry };
    } finally {
      this.lockMap.delete(masterSku);
    }
  }

  /**
   * Warehouse Transfer between locations
   */
  public async transferWarehouseStock(
    masterSku: string,
    fromLoc: WarehouseLocation,
    toLoc: WarehouseLocation,
    quantity: number
  ): Promise<{ success: boolean; error?: string }> {
    const product = this.products.get(masterSku);
    if (!product) return { success: false, error: `SKU ${masterSku} not found` };

    if ((product.locations[fromLoc] || 0) < quantity) {
      return { success: false, error: `Insufficient stock at ${fromLoc} for transfer` };
    }

    product.locations[fromLoc] -= quantity;
    product.locations[toLoc] = (product.locations[toLoc] || 0) + quantity;
    product.version += 1;

    this.auditLedger.push({
      id: `led_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      masterSku,
      quantityDelta: 0,
      resultingStock: product.currentStock,
      reason: 'WAREHOUSE_TRANSFER',
      referenceId: `XFER_${fromLoc}_TO_${toLoc}_QTY_${quantity}`,
      timestamp: new Date().toISOString()
    });

    return { success: true };
  }
}
