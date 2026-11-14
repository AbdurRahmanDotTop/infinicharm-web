// ==============================================================================
// InfiniCharm — Admin Storefront Badges & Guarantees API (/api/admin/settings/badges)
// Full CRUD: Create, Read, Update, Toggle, Delete, Reorder with Audit Logging
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  getStorefrontBadges,
  createStorefrontBadge,
  updateStorefrontBadge,
  toggleStorefrontBadge,
  deleteStorefrontBadge,
  reorderStorefrontBadges,
} from '@/lib/server/storefront-badges-store';
import { logAdminAction } from '@/lib/services/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const badges = getStorefrontBadges(false);
    return NextResponse.json({
      success: true,
      totalCount: badges.length,
      activeCount: badges.filter((b) => b.isEnabled).length,
      badges,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch badges' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const res = createStorefrontBadge(body);
    if (!res.success) {
      return NextResponse.json({ success: false, error: res.error }, { status: 400 });
    }

    logAdminAction('CREATE_STOREFRONT_BADGE', 'badge', res.badge!.id, {
      title: res.badge!.title,
      key: res.badge!.key,
      isEnabled: res.badge!.isEnabled,
    });

    return NextResponse.json(
      { success: true, badge: res.badge, message: 'Storefront badge created successfully.' },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create badge' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, id, orderedIds, ...updates } = body;

    if (action === 'REORDER' && Array.isArray(orderedIds)) {
      const res = reorderStorefrontBadges(orderedIds);
      logAdminAction('REORDER_STOREFRONT_BADGES', 'badge', 'all', { orderedIds });
      return NextResponse.json({ success: true, badges: res.badges });
    }

    if (action === 'TOGGLE' && id) {
      const res = toggleStorefrontBadge(id, updates.isEnabled);
      if (!res.success) {
        return NextResponse.json({ success: false, error: res.error }, { status: 400 });
      }
      logAdminAction('TOGGLE_STOREFRONT_BADGE', 'badge', id, { isEnabled: res.badge!.isEnabled });
      return NextResponse.json({
        success: true,
        badge: res.badge,
        message: `Badge "${res.badge!.title}" is now ${res.badge!.isEnabled ? 'ENABLED' : 'DISABLED'}.`,
      });
    }

    if (!id) {
      return NextResponse.json({ success: false, error: 'Badge ID is required' }, { status: 400 });
    }

    const res = updateStorefrontBadge(id, updates);
    if (!res.success) {
      return NextResponse.json({ success: false, error: res.error }, { status: 400 });
    }

    logAdminAction('UPDATE_STOREFRONT_BADGE', 'badge', id, updates);
    return NextResponse.json({
      success: true,
      badge: res.badge,
      message: `Badge "${res.badge!.title}" updated successfully.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update badge' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Badge ID is required' }, { status: 400 });
    }

    const res = deleteStorefrontBadge(id);
    if (!res.success) {
      return NextResponse.json({ success: false, error: res.error }, { status: 400 });
    }

    logAdminAction('DELETE_STOREFRONT_BADGE', 'badge', id);
    return NextResponse.json({ success: true, message: 'Badge deleted successfully.' });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete badge' },
      { status: 500 }
    );
  }
}

