import { NextRequest, NextResponse } from 'next/server';
import {
  registerCustomerAccount,
  resolvePublicOrigin,
  setCustomerAuthCookies,
} from '@/lib/server/auth-service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Invalid registration payload.' },
        { status: 400 }
      );
    }

    const { email, fullName, phone, password, source, redirectPath } = body;
    const origin = resolvePublicOrigin(req);
    const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1';

    const result = await registerCustomerAccount({
      fullName: String(fullName || ''),
      email: String(email || ''),
      phone: phone ? String(phone) : '',
      password: String(password || ''),
      customFields: body.customFields && typeof body.customFields === 'object' ? body.customFields : undefined,
      registrationSource: source === 'CHECKOUT' ? 'CHECKOUT' : 'REGISTER_PAGE',
      redirectPath: typeof redirectPath === 'string' ? redirectPath : undefined,
      origin,
      ipAddress,
    });

    if (!result.success || !result.customer) {
      return NextResponse.json(
        { success: false, code: result.code, error: result.error || 'Registration failed.' },
        { status: result.status || 400 }
      );
    }

    const response = NextResponse.json(
      {
        success: true,
        requiresVerification: Boolean(result.requiresVerification),
        customer: result.customer,
        message: result.requiresVerification
          ? 'Account created. Please check your inbox and click the single-use verification link before signing in.'
          : 'Account created successfully.',
      },
      { status: 201 }
    );

    // Strictly only establish an authenticated session if email verification is NOT required
    if (!result.requiresVerification) {
      setCustomerAuthCookies(response, result.customer, true);
    }

    return response;
  } catch (err: any) {
    console.error('[api/auth/customer/register] POST error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal server error during registration.' },
      { status: 500 }
    );
  }
}
