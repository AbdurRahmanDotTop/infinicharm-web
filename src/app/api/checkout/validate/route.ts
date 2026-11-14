import { NextResponse } from 'next/server';
import { validateOrderPaymentMethod } from '@/lib/server/gateways-store';

// ==============================================================================
// InfiniCharm — Server-Side Checkout Payment Method Validation Endpoint
// Ensures disabled payment methods cannot be submitted even via direct API requests
// ==============================================================================

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { paymentMethod, amountInPaise } = body;

    if (!paymentMethod) {
      return NextResponse.json(
        { valid: false, error: 'Payment method is required.' },
        { status: 400 }
      );
    }

    const validation = validateOrderPaymentMethod(paymentMethod, amountInPaise);

    if (!validation.valid) {
      return NextResponse.json(
        {
          valid: false,
          error: validation.error || `Payment method '${paymentMethod}' is currently disabled.`,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      valid: true,
      gatewayId: validation.gateway?.id,
      gatewayName: validation.gateway?.name,
    });
  } catch (err: any) {
    console.error('Checkout validation error:', err);
    return NextResponse.json(
      { valid: false, error: err?.message || 'Server validation failed.' },
      { status: 500 }
    );
  }
}

