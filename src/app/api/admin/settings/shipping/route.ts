import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession, getAdminActorEmail } from '@/lib/server/admin-auth';
import { getShippingSettings, updateShippingSettings } from '@/lib/server/shipping-store';
import { updateStorefrontBadge, getStorefrontBadges } from '@/lib/server/storefront-badges-store';
import { appendServerAuditLog } from '@/lib/server/server-audit-store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    if (!verifyAdminSession(req)) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
    }

    const settings = getShippingSettings();
    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed fetching shipping settings.' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    if (!verifyAdminSession(req)) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const updateRes = updateShippingSettings(body);
    if (!updateRes.success) {
      return NextResponse.json(
        { success: false, error: updateRes.error || 'Failed updating shipping settings.' },
        { status: 400 }
      );
    }

    // Keep storefront badge synced
    try {
      const badges = getStorefrontBadges();
      const shippingBadge = badges.find((b) => b.key === 'free_shipping' || b.id === 'badge-free-shipping');
      if (shippingBadge) {
        updateStorefrontBadge(shippingBadge.id, {
          title: `Free Shipping on orders above ₹${updateRes.settings.freeShippingThresholdRupees}`,
          thresholdRupees: updateRes.settings.freeShippingThresholdRupees,
          conditionsText: `Applicable on orders above ₹${updateRes.settings.freeShippingThresholdRupees} across all pincodes in India.`,
        });
      }
    } catch (badgeErr) {
      console.warn('[admin/shipping PUT] Non-fatal error syncing badges:', badgeErr);
    }

    // Log admin audit
    try {
      const adminEmail = getAdminActorEmail(req) || 'admin@infinicharm.com';
      appendServerAuditLog({
        actorId: 'admin',
        actorEmail: adminEmail,
        action: 'UPDATE_SHIPPING_SETTINGS',
        resourceType: 'settings',
        resourceId: 'shipping_settings',
        diff: {
          freeShippingThresholdRupees: updateRes.settings.freeShippingThresholdRupees,
          standardShippingFeeRupees: updateRes.settings.standardShippingFeeRupees,
          expressShippingFeeRupees: updateRes.settings.expressShippingFeeRupees,
          freeShippingEnabled: updateRes.settings.freeShippingEnabled,
        },
      });
    } catch {
      // audit logging best-effort
    }

    return NextResponse.json({
      success: true,
      settings: updateRes.settings,
      message: 'Shipping settings saved and storefront badges synchronized successfully.',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed updating shipping settings.' },
      { status: 500 }
    );
  }
}
