// ==============================================================================
// InfiniCharm — Single Category Item API (/api/categories/[id])
// Supports fetch, update, active toggle, and delete
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  getServerCategoryById,
  updateServerCategory,
  toggleServerCategoryActive,
  deleteServerCategory,
} from '@/lib/server/categories-store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const category = getServerCategoryById(id);

    if (!category) {
      return NextResponse.json({ success: false, error: 'Category not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, category });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch category' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (body.action === 'TOGGLE_ACTIVE') {
      const res = toggleServerCategoryActive(id, body.isActive);
      if (!res.success) {
        return NextResponse.json({ success: false, error: res.error }, { status: 400 });
      }
      return NextResponse.json({
        success: true,
        category: res.category,
        message: `Category ${res.category?.name} is now ${res.category?.isActive ? 'ACTIVE' : 'INACTIVE'}.`,
      });
    }

    const res = updateServerCategory(id, body);
    if (!res.success) {
      return NextResponse.json({ success: false, error: res.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      category: res.category,
      message: `Category "${res.category?.name}" updated successfully.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update category' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return PUT(request, { params });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const res = deleteServerCategory(id);

    if (!res.success) {
      return NextResponse.json({ success: false, error: res.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Category with ID "${id}" deleted successfully.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete category' },
      { status: 500 }
    );
  }
}

