// ==============================================================================
// InfiniCharm — Sales Calculation & Best-Selling Ranking Service
// Governing Invariants: Single Source of Truth, Real Data, Server Authority
// Zero Mock Data: Calculations derived exclusively from valid, non-cancelled orders.
// ==============================================================================

import type { Order, Product } from '../../types/index.ts';

export interface ProductSalesMetric {
  productId: string;
  unitsSold: number;
  revenueInPaise: number;
  orderCount: number;
}

/**
 * Calculates genuine sales metrics per product from authoritative orders.
 * Excludes cancelled, refunded, failed, and unpaid orders to guarantee strict financial reality.
 */
export function calculateProductSalesMetrics(orders: Order[]): Map<string, ProductSalesMetric> {
  const metrics = new Map<string, ProductSalesMetric>();

  if (!Array.isArray(orders) || orders.length === 0) {
    return metrics;
  }

  // Filter only genuine, valid orders that represent completed or active sales
  const validOrders = orders.filter((order) => {
    const status = String(order.status || '').toUpperCase();
    const paymentStatus = String(order.paymentStatus || '').toUpperCase();

    // Exclude cancelled and refunded orders
    if (status === 'CANCELLED' || status === 'REFUNDED') {
      return false;
    }

    // Exclude failed or unpaid orders
    if (status === 'PAYMENT_FAILED' || status === 'PAYMENT_NOT_RECEIVED') {
      return false;
    }
    if (paymentStatus === 'FAILED' || paymentStatus === 'REFUNDED') {
      return false;
    }

    return true;
  });

  for (const order of validOrders) {
    if (!Array.isArray(order.items)) continue;

    for (const item of order.items) {
      if (!item.productId) continue;

      const qty = Math.max(0, Math.round(Number(item.quantity || 0)));
      if (qty <= 0) continue;

      const unitPrice = Number(item.priceInPaise) || 0;
      const current = metrics.get(item.productId) || {
        productId: item.productId,
        unitsSold: 0,
        revenueInPaise: 0,
        orderCount: 0,
      };

      current.unitsSold += qty;
      current.revenueInPaise += unitPrice * qty;
      current.orderCount += 1;
      metrics.set(item.productId, current);
    }
  }

  return metrics;
}

/**
 * Ranks products by sales performance in descending order of total units sold.
 * Products with higher units sold appear first.
 * For products with equal sales (or fresh catalogs with 0 sales), a deterministic
 * tie-breaker (displayOrder or product ID) is used to preserve catalogue order.
 */
export function sortProductsByBestSelling(
  products: Product[],
  salesMetrics: Map<string, ProductSalesMetric>,
  limit = 99
): Product[] {
  const published = products.filter((p) => p.status === 'PUBLISHED');

  const sorted = [...published].sort((a, b) => {
    const unitsA = salesMetrics.get(a.id)?.unitsSold || 0;
    const unitsB = salesMetrics.get(b.id)?.unitsSold || 0;

    // Highest sales first
    if (unitsB !== unitsA) {
      return unitsB - unitsA;
    }

    // Secondary tie-breaker: Display Order or catalogue order
    const orderA = a.displayOrder !== undefined ? a.displayOrder : 999;
    const orderB = b.displayOrder !== undefined ? b.displayOrder : 999;
    if (orderA !== orderB) {
      return orderA - orderB;
    }

    return a.id.localeCompare(b.id);
  });

  const cappedLimit = Math.max(1, Math.min(limit, 99));
  return sorted.slice(0, cappedLimit);
}
