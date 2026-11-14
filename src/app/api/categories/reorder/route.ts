// ==============================================================================
// InfiniCharm — Category Reordering API (/api/categories/reorder)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { reorderServerCategories } from '@/lib/server/categories-store';

export async function POST(request: NextRequest) {
  try {
    const { orderedIds } = await request.json();

    if (!Array.isArray(orderedIds)) {
      return NextResponse.json(
        { success: false, error: 'orderedIds must be an array of category IDs' },
        { status: 400 }
      );
    }

    const res = reorderServerCategories(orderedIds);
    if (!res.success) {
      return NextResponse.json({ success: false, error: res.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      categories: res.categories,
      message: 'Categories reordered successfully.',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to reorder categories' },
      { status: 500 }
    );
  }
}

