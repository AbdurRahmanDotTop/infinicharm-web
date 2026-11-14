// ==============================================================================
// InfiniCharm — Admin CSV Product Sync Endpoint
// Syncs products.json directly with All_Docs/Products/*.csv
// ==============================================================================

import { NextResponse } from 'next/server';
import {
  synchronizeCsvProductsToDatabase,
  importProductsFromCsvDirectory,
  getProductCsvDirectory,
} from '@/lib/server/csv-importer';
import { logAdminAction } from '@/lib/services/audit';

export async function GET() {
  try {
    const csvDir = getProductCsvDirectory();
    const csvProducts = importProductsFromCsvDirectory();
    return NextResponse.json({
      success: true,
      csvDirectoryAvailable: !!csvDir,
      csvDirectory: csvDir,
      availableCsvProductCount: csvProducts.length,
      products: csvProducts,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed checking CSV status' },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const result = synchronizeCsvProductsToDatabase();
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to sync CSV products' },
        { status: 400 }
      );
    }

    logAdminAction('SYNC_PRODUCTS_FROM_CSV', 'products', 'csv_catalogue', {
      syncedCount: result.count,
      productIds: result.products.map((p) => p.id),
    });

    return NextResponse.json({
      success: true,
      message: `Successfully synchronized ${result.count} product(s) from CSV.`,
      count: result.count,
      products: result.products,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'CSV Sync failed' },
      { status: 500 }
    );
  }
}

