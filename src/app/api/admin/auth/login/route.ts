import { NextRequest, NextResponse } from 'next/server';
import { appendServerAuditLog } from '@/lib/server/server-audit-store';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const email = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '');
    const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1';

    const expectedEmail = (process.env.ADMIN_EMAIL || 'admin@infinicharm.com').toLowerCase();
    const expectedPass = process.env.ADMIN_PASSWORD || 'Admin@1234!';

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Please provide both administrative email and password.' },
        { status: 400 }
      );
    }

    if (email !== expectedEmail || password !== expectedPass) {
      appendServerAuditLog({
        actorId: 'anonymous',
        actorEmail: email || 'unknown',
        action: 'ADMIN_LOGIN_FAILED',
        resourceType: 'admin_auth',
        resourceId: email || 'unknown',
        ipAddress,
        diff: { authenticated: false },
      });
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid administrative credentials. Access restricted to authorized personnel.',
        },
        { status: 401 }
      );
    }

    appendServerAuditLog({
      actorId: 'usr-admin-01',
      actorEmail: email,
      action: 'ADMIN_LOGIN_SUCCESS',
      resourceType: 'admin_auth',
      resourceId: 'usr-admin-01',
      ipAddress,
      diff: { authenticated: true },
    });

    const response = NextResponse.json({
      success: true,
      admin: {
        email,
        name: 'Operations Administrator',
        role: 'SUPER_ADMIN',
      },
    });
    response.cookies.set('infinicharm_admin_session', 'active', {
      path: '/',
      maxAge: 86400,
      sameSite: 'lax',
      httpOnly: false,
    });
    response.cookies.set('infinicharm_admin_email', email, {
      path: '/',
      maxAge: 86400,
      sameSite: 'lax',
      httpOnly: true,
    });
    return response;
  } catch (err) {
    console.error('[api/admin/auth/login] POST error:', err);
    return NextResponse.json({ success: false, error: 'Unable to sign in.' }, { status: 500 });
  }
}

