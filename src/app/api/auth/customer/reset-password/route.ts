import { NextRequest, NextResponse } from 'next/server';
import {
  clearCustomerAuthCookies,
  completeCustomerPasswordReset,
} from '@/lib/server/auth-service';
import { inspectPasswordResetToken } from '@/lib/server/password-reset-store';

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token')?.trim() || '';
    if (!token) {
      return NextResponse.json(
        { valid: false, status: 'INVALID', error: 'Reset token is missing.' },
        { status: 400 }
      );
    }

    const inspection = inspectPasswordResetToken(token);
    if (!inspection.valid) {
      return NextResponse.json(
        {
          valid: false,
          status: inspection.status,
          error: inspection.error || 'Password reset link is invalid or expired.',
        },
        { status: inspection.status === 'EXPIRED' ? 410 : 400 }
      );
    }

    return NextResponse.json({
      valid: true,
      status: 'VALID',
    });
  } catch (err) {
    console.error('[api/auth/customer/reset-password] GET error:', err);
    return NextResponse.json(
      { valid: false, status: 'INVALID', error: 'Unable to verify reset token.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json().catch(() => null);
    if (!raw || typeof raw !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Invalid password reset submission.' },
        { status: 400 }
      );
    }

    const token = typeof raw.token === 'string' ? raw.token.trim() : undefined;
    const email = typeof raw.email === 'string' ? raw.email.trim() : undefined;
    const otp = typeof raw.otp === 'string' ? raw.otp.trim() : undefined;
    const newPassword = typeof raw.newPassword === 'string' ? raw.newPassword : '';

    if (!newPassword) {
      return NextResponse.json(
        { success: false, error: 'New password is required.' },
        { status: 400 }
      );
    }

    if (!token && (!email || !otp)) {
      return NextResponse.json(
        {
          success: false,
          error: 'A valid reset link token or registered email with 6-digit recovery PIN is required.',
        },
        { status: 400 }
      );
    }

    const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const result = await completeCustomerPasswordReset({
      token,
      email,
      otp,
      newPassword,
      ipAddress,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Unable to reset password.' },
        { status: result.status || 400 }
      );
    }

    const response = NextResponse.json({
      success: true,
      message: result.message,
    });
    clearCustomerAuthCookies(response);
    return response;
  } catch (err) {
    console.error('[api/auth/customer/reset-password] POST error:', err);
    return NextResponse.json({ success: false, error: 'Unable to reset password.' }, { status: 500 });
  }
}
