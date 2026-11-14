import { NextRequest, NextResponse } from 'next/server';
import {
  requestVerificationResend,
  resolvePublicOrigin,
} from '@/lib/server/auth-service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const email = body?.email ? String(body.email) : '';
    const redirectPath = typeof body?.redirectPath === 'string' ? body.redirectPath : undefined;
    const origin = resolvePublicOrigin(req);

    const res = await requestVerificationResend({
      email,
      redirectPath,
      origin,
    });

    if (!res.success) {
      return NextResponse.json(
        {
          success: false,
          error: res.error || 'Unable to resend verification email.',
          retryAfterSeconds: res.retryAfterSeconds,
        },
        { status: res.status || 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: res.message,
    });
  } catch (err) {
    console.error('[api/auth/customer/resend-verification] POST error:', err);
    return NextResponse.json(
      { success: false, error: 'Unable to resend verification email right now.' },
      { status: 500 }
    );
  }
}

