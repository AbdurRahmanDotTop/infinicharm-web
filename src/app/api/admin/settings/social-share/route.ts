import { NextRequest, NextResponse } from 'next/server';
import {
  getSocialAndShareSettings,
  updateShareSettings,
  reorderSocialLinks,
} from '@/lib/server/social-share-store';
import { verifyAdminSession, getAdminActorEmail } from '@/lib/server/admin-auth';
import { appendServerAuditLog } from '@/lib/server/server-audit-store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  if (!verifyAdminSession(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const settings = getSocialAndShareSettings();
    return NextResponse.json(
      { success: true, settings },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to load social and share settings.' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  if (!verifyAdminSession(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Invalid settings payload.' },
        { status: 400 }
      );
    }

    const actorEmail = getAdminActorEmail(req);

    if (body.sharing && typeof body.sharing === 'object') {
      updateShareSettings(body.sharing);
    }

    if (Array.isArray(body.orderedIds)) {
      reorderSocialLinks(body.orderedIds);
    }

    const updated = getSocialAndShareSettings();

    appendServerAuditLog({
      actorId: 'usr-admin-01',
      actorEmail,
      action: 'UPDATE_SOCIAL_SHARE_SETTINGS',
      resourceType: 'social_share_settings',
      resourceId: 'global-social-share',
      ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
      diff: {
        sharing: updated.sharing,
        socialLinkCount: updated.socialLinks.length,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Social and sharing settings updated successfully.',
      settings: updated,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to update settings.' },
      { status: 500 }
    );
  }
}

