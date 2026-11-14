import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  requestCustomerPasswordReset,
  resolvePublicOrigin,
} from '@/lib/server/auth-service';

const ForgotPasswordSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address.'),
});

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json().catch(() => null);
    const parsed = ForgotPasswordSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Valid email is required.' },
        { status: 400 }
      );
    }

    const origin = resolvePublicOrigin(req);
    const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const res = await requestCustomerPasswordReset({
      email: parsed.data.email,
      origin,
      ipAddress,
    });

    return NextResponse.json(res);
  } catch (err) {
    console.error('[api/auth/customer/forgot-password] POST error:', err);
    return NextResponse.json(
      { error: 'Unable to process password reset request.' },
      { status: 500 }
    );
  }
}
