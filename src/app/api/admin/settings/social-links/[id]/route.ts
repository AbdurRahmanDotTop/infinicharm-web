import { NextRequest, NextResponse } from 'next/server';
import {
  updateSocialLink,
  deleteSocialLink,
  getSocialAndShareSettings,
} from '@/lib/server/social-share-store';
import { verifyAdminSession, getAdminActorEmail } from '@/lib/server/admin-auth';
import { appendServerAuditLog } from '@/lib/server/server-audit-store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAdminSession(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Invalid update payload.' },
        { status: 400 }
      );
    }

    const updated = updateSocialLink(id, body);
    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Social link not found.' },
        { status: 404 }
      );
    }

    const actorEmail = getAdminActorEmail(req);
    appendServerAuditLog({
      actorId: 'usr-admin-01',
      actorEmail,
      action: 'UPDATE_SOCIAL_LINK',
      resourceType: 'social_link',
      resourceId: id,
      ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
      diff: body,
    });

    const allSettings = getSocialAndShareSettings();

    return NextResponse.json({
      success: true,
      message: 'Social link updated successfully.',
      link: updated,
      settings: allSettings,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to update social link.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAdminSession(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const deleted = deleteSocialLink(id);
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Social link not found.' },
        { status: 404 }
      );
    }

    const actorEmail = getAdminActorEmail(req);
    appendServerAuditLog({
      actorId: 'usr-admin-01',
      actorEmail,
      action: 'DELETE_SOCIAL_LINK',
      resourceType: 'social_link',
      resourceId: id,
      ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
    });

    const allSettings = getSocialAndShareSettings();

    return NextResponse.json({
      success: true,
      message: 'Social link deleted successfully.',
      settings: allSettings,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to delete social link.' },
      { status: 500 }
    );
  }
}
