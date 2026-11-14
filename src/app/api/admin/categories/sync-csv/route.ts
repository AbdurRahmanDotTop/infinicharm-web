// ==============================================================================
// InfiniCharm — Admin CSV Category Sync Endpoint
// Syncs categories.json directly with All_Docs/Products/*Categories*.csv
// ==============================================================================

import { NextResponse } from 'next/server';
import {
  synchronizeCsvCategoriesToDatabase,
  importCategoriesFromCsvDirectory,
  getProductCsvDirectory,
} from '@/lib/server/csv-importer';
import { logAdminAction } from '@/lib/services/audit';

export async function GET() {
  try {
    const csvDir = getProductCsvDirectory();
    const csvCategories = importCategoriesFromCsvDirectory();
    return NextResponse.json({
      success: true,
      csvDirectoryAvailable: !!csvDir,
      csvDirectory: csvDir,
      availableCsvCategoryCount: csvCategories.length,
      categories: csvCategories,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed checking Categories CSV status' },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const result = synchronizeCsvCategoriesToDatabase();
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to sync CSV categories' },
        { status: 400 }
      );
    }

    logAdminAction('SYNC_CATEGORIES_FROM_CSV', 'categories', 'csv_catalogue', {
      syncedCount: result.count,
      categoryIds: result.categories.map((c) => c.id),
    });

    return NextResponse.json({
      success: true,
      message: `Successfully synchronized ${result.count} approved categories from CSV.`,
      count: result.count,
      categories: result.categories,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Category CSV Sync failed' },
      { status: 500 }
    );
  }
}

