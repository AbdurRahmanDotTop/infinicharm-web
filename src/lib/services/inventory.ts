// ==============================================================================
// InfiniCharm — Inventory Management & Stock State Service
// Governing PRD: PRD 06 (Catalogue Architecture & Inventory Management)
// Standard: Atomic non-negative constraints, Truthful Low-Stock Indicators
// ==============================================================================

export type StockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export interface StockInfo {
  status: StockStatus;
  label: string;
  isAvailable: boolean;
  quantity: number;
  lowStockThreshold: number;
}

/**
 * Returns the authoritative stock status and badge label derived directly from inventory.
 */
export function getStockStatus(
  stockQuantity: number,
  lowStockThreshold: number = 5
): StockInfo {
  if (stockQuantity <= 0) {
    return {
      status: 'OUT_OF_STOCK',
      label: 'Out of Stock',
      isAvailable: false,
      quantity: 0,
      lowStockThreshold,
    };
  }

  if (stockQuantity <= lowStockThreshold) {
    return {
      status: 'LOW_STOCK',
      label: `Only ${stockQuantity} Left in Stock`,
      isAvailable: true,
      quantity: stockQuantity,
      lowStockThreshold,
    };
  }

  return {
    status: 'IN_STOCK',
    label: 'In Stock — Ready to Dispatch',
    isAvailable: true,
    quantity: stockQuantity,
    lowStockThreshold,
  };
}

/**
 * Checks whether the requested cart quantity can be fulfilled by live inventory.
 */
export function canFulfillQuantity(
  requestedQuantity: number,
  availableStock: number
): boolean {
  if (requestedQuantity <= 0) return false;
  return requestedQuantity <= availableStock;
}

