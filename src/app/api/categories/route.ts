// ==============================================================================
// InfiniCharm — Categories Authority API (/api/categories)
// Supports dynamic category retrieval (active / all) and creation
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerCategories, createServerCategory } from '@/lib/server/categories-store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('activeOnly') === 'true' || searchParams.get('active') === 'true';

    const categories = getServerCategories(activeOnly);

    return NextResponse.json(
      {
        success: true,
        count: categories.length,
        categories,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const res = createServerCategory(body);
    if (!res.success) {
      return NextResponse.json({ success: false, error: res.error }, { status: 400 });
    }

    return NextResponse.json(
      {
        success: true,
        category: res.category,
        message: `Category "${res.category?.name}" created successfully.`,
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create category' },
      { status: 500 }
    );
  }
}

