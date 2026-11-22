import { NextResponse } from 'next/server';
import { getServerOrders } from '@/lib/server/orders-store';
import { getServerProducts } from '@/lib/server/products-store';
import { calculateProductSalesMetrics, sortProductsByBestSelling } from '@/lib/services/sales';

// ==============================================================================
// InfiniCharm — Best-Selling Products API Route
// Invariants: Single Source of Truth, Real Data, Server Authority
// Calculates sales performance from valid orders and ranks published products.
// ==============================================================================

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.max(1, Math.min(parseInt(limitParam, 10) || 99, 99)) : 99;

    // Fetch authoritative server orders and published products
    const orders = getServerOrders();
    const products = getServerProducts({ status: 'PUBLISHED' });

    // Derive genuine sales performance
    const salesMetrics = calculateProductSalesMetrics(orders);
    const bestSellers = sortProductsByBestSelling(products, salesMetrics, limit);

    // Convert map to plain object for JSON response
    const metricsObject: Record<string, { unitsSold: number; revenueInPaise: number; orderCount: number }> = {};
    salesMetrics.forEach((metric, prodId) => {
      metricsObject[prodId] = {
        unitsSold: metric.unitsSold,
        revenueInPaise: metric.revenueInPaise,
        orderCount: metric.orderCount,
      };
    });

    return NextResponse.json(
      {
        success: true,
        count: bestSellers.length,
        products: bestSellers,
        salesMetrics: metricsObject,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error: any) {
    console.error('Error fetching best-selling products:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error fetching best-selling products' },
      { status: 500 }
    );
  }
}
