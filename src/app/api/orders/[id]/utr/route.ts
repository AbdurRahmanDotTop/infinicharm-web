import { NextRequest, NextResponse } from 'next/server';
import { submitServerOrderUtr } from '@/lib/server/orders-store';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const utr = body.utr || body.utrNumber || body.customUpiUtrNumber;
    const payerName = body.payerName || body.customerName || 'Customer / Payer';

    if (!utr || typeof utr !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'Please enter a valid 12-digit UPI Transaction Reference (UTR) Number.',
        },
        { status: 400 }
      );
    }

    const result = submitServerOrderUtr(id, utr, payerName);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, order: result.order });
  } catch (error: any) {
    console.error('Error submitting order UTR:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
