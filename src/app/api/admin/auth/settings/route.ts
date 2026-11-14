import { NextRequest, NextResponse } from 'next/server';
import { getAuthSettings, updateAuthSettings } from '@/lib/server/auth-settings-store';
import { verifyAdminSession, getAdminActorEmail } from '@/lib/server/admin-auth';
import { appendServerAuditLog } from '@/lib/server/server-audit-store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  if (!verifyAdminSession(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
  }
  const settings = getAuthSettings();
  return NextResponse.json(
    { success: true, settings },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
  );
}

export async function PUT(req: NextRequest) {
  if (!verifyAdminSession(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'Invalid settings payload.' }, { status: 400 });
    }

    const actorEmail = getAdminActorEmail(req);
    const updated = updateAuthSettings(body, actorEmail);

    appendServerAuditLog({
      actorId: 'usr-admin-01',
      actorEmail,
      action: 'UPDATE_AUTH_SETTINGS',
      resourceType: 'auth_settings',
      resourceId: 'global-auth-policy',
      ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
      diff: {
        registrationEnabled: updated.registrationEnabled,
        loginEnabled: updated.loginEnabled,
        checkoutRegistrationEnabled: updated.checkoutRegistrationEnabled,
        guestCheckoutEnabled: updated.guestCheckoutEnabled,
        requireEmailVerification: updated.requireEmailVerification,
        verificationTokenTtlMinutes: updated.verificationTokenTtlMinutes,
        resetTokenTtlMinutes: updated.resetTokenTtlMinutes,
        minPasswordLength: updated.minPasswordLength,
      },
    });

    return NextResponse.json({
      success: true,
      settings: updated,
      message: 'Authentication policy settings updated.',
    });
  } catch (err: any) {
    console.error('[api/admin/auth/settings] PUT error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Unable to update auth settings.' },
      { status: 500 }
    );
  }
}

