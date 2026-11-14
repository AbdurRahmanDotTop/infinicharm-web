import { NextRequest, NextResponse } from 'next/server';
import { addSocialLink, getSocialAndShareSettings } from '@/lib/server/social-share-store';
import { verifyAdminSession, getAdminActorEmail } from '@/lib/server/admin-auth';
import { appendServerAuditLog } from '@/lib/server/server-audit-store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  if (!verifyAdminSession(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Invalid link payload.' },
        { status: 400 }
      );
    }

    const { platform, label, url, isEnabled, description } = body;
    if (!label || !url) {
      return NextResponse.json(
        { success: false, error: 'Label and URL are required.' },
        { status: 400 }
      );
    }

    const newLink = addSocialLink({
      platform: platform || 'other',
      label: String(label).trim(),
      url: String(url).trim(),
      isEnabled: isEnabled !== false,
      description: description ? String(description).trim() : undefined,
    });

    const actorEmail = getAdminActorEmail(req);
    appendServerAuditLog({
      actorId: 'usr-admin-01',
      actorEmail,
      action: 'CREATE_SOCIAL_LINK',
      resourceType: 'social_link',
      resourceId: newLink.id,
      ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
      diff: {
        id: newLink.id,
        platform: newLink.platform,
        label: newLink.label,
        url: newLink.url,
      },
    });

    const allSettings = getSocialAndShareSettings();

    return NextResponse.json({
      success: true,
      message: 'Social link added successfully.',
      link: newLink,
      settings: allSettings,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to create social link.' },
      { status: 500 }
    );
  }
}

