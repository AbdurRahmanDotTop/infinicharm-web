import { NextRequest, NextResponse } from 'next/server';
import { getContactSettings, saveContactSettings } from '@/lib/server/contact-settings-store';
import { appendServerAuditLog } from '@/lib/server/server-audit-store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const settings = getContactSettings();
  return NextResponse.json({ success: true, settings });
}

export async function PUT(request: NextRequest) {
  const adminCookie = request.cookies.get('infinicharm_admin_session')?.value;
  if (adminCookie !== 'active') {
    return NextResponse.json({ success: false, error: 'Unauthorized: Admin privileges required.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const updated = saveContactSettings(body, 'admin@infinicharm.com');

    try {
      appendServerAuditLog({
        actorId: 'admin',
        actorEmail: 'admin@infinicharm.com',
        action: 'UPDATE_CONTACT_PAGE_SETTINGS',
        resourceType: 'CMS_CONTACT_PAGE',
        resourceId: 'contact_settings',
        diff: {
          primaryPhone: updated.primaryPhone,
          supportEmail: updated.supportEmail,
          updatedAt: updated.updatedAt,
        },
      });
    } catch (auditErr) {
      console.warn('Audit log write error:', auditErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Contact page configuration updated successfully.',
      settings: updated,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to update contact settings.' },
      { status: 500 }
    );
  }
}
