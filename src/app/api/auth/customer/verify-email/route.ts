import { NextRequest, NextResponse } from 'next/server';
import { verifyEmailWithTokenOrOtp, setCustomerAuthCookies } from '@/lib/server/auth-service';
import { sanitizeRedirectPath } from '@/lib/validation/auth';
import { getAuthSettings } from '@/lib/server/auth-settings-store';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const token = body?.token ? String(body.token).trim() : '';
    const email = body?.email ? String(body.email).trim() : '';
    const otp = body?.otp ? String(body.otp).trim() : '';

    if (!token && (!email || !otp)) {
      return NextResponse.json(
        {
          success: false,
          status: 'INVALID',
          error: 'Either a verification link token or email with 6-digit verification code is required.',
        },
        { status: 400 }
      );
    }

    const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const outcome = verifyEmailWithTokenOrOtp({
      token,
      email,
      otp,
      ipAddress,
    });

    const settings = getAuthSettings();
    const safeRedirect = sanitizeRedirectPath(
      outcome.redirectPath,
      settings.verificationRedirectPath || '/account'
    );

    if (!outcome.valid || !outcome.customer) {
      return NextResponse.json(
        {
          success: false,
          status: outcome.status,
          email: outcome.email || email,
          redirectPath: safeRedirect,
          error: outcome.error || 'Verification failed.',
        },
        { status: outcome.status === 'EXPIRED' ? 410 : 400 }
      );
    }

    const res = NextResponse.json({
      success: true,
      status: 'VERIFIED',
      email: outcome.customer.email,
      redirectPath: safeRedirect,
      autoRedirectSeconds: settings.autoRedirectAfterVerificationSeconds,
      customer: outcome.customer,
      message: 'Your email address has been verified successfully. You can now sign in securely.',
    });

    setCustomerAuthCookies(res, outcome.customer);
    return res;
  } catch (err: any) {
    console.error('[api/auth/customer/verify-email] POST error:', err);
    return NextResponse.json(
      { success: false, status: 'INVALID', error: 'Unable to verify email.' },
      { status: 500 }
    );
  }
}

