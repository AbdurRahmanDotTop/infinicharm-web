import { NextRequest, NextResponse } from 'next/server';
import {
  loginCustomerAccount,
  setCustomerAuthCookies,
} from '@/lib/server/auth-service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const email = body?.email ? String(body.email) : '';
    const password = body?.password ? String(body.password) : '';
    const rememberMe = body?.rememberMe !== false;

    if (!email.trim() || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required.' },
        { status: 400 }
      );
    }

    const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const { customer, error, code } = await loginCustomerAccount({
      email,
      password,
      ipAddress,
    });

    if (!customer) {
      const status =
        code === 'EMAIL_NOT_VERIFIED' ||
        code === 'SUSPENDED' ||
        code === 'INACTIVE' ||
        code === 'LOGIN_DISABLED'
          ? 403
          : 401;
      return NextResponse.json(
        {
          success: false,
          code,
          requiresVerification: code === 'EMAIL_NOT_VERIFIED',
          error: error || 'Invalid email or password.',
        },
        { status }
      );
    }

    const response = NextResponse.json({
      success: true,
      customer,
      message: 'Successfully authenticated.',
    });

    setCustomerAuthCookies(response, customer, rememberMe);
    return response;
  } catch (err: any) {
    console.error('[api/auth/customer/login] POST error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}
