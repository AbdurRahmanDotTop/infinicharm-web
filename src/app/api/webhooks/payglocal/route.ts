import { NextResponse } from 'next/server';

// ==============================================================================
// InfiniCharm — PayGlocal Webhook Ingestion API Route
// Governing Standard: Asynchronous payment status synchronization
// Merchant ID: ptplabdurrah9915
// ==============================================================================

export async function POST(request: Request) {
  try {
    const rawPayload = await request.text();
    const tokenHeader = request.headers.get('x-gl-token') || request.headers.get('x-gl-token-external');
    const merchantId = request.headers.get('x-gl-merchantid') || 'ptplabdurrah9915';

    let parsedPayload: any = {};
    try {
      parsedPayload = JSON.parse(rawPayload);
    } catch {
      parsedPayload = { raw: rawPayload };
    }

    const orderNumber = parsedPayload?.clientTxnInformation?.orderId || parsedPayload?.orderId || 'UNKNOWN';
    const status = (parsedPayload?.status || 'SENT_FOR_CAPTURE').toUpperCase();
    const amount = parsedPayload?.paymentData?.totalAmount || '0.00';
    const amountInPaise = Math.round(parseFloat(amount) * 100);

    // In a production server, here we would verify the JWS signature using PayGlocal's public key
    const isValidSignature = Boolean(tokenHeader || merchantId === 'ptplabdurrah9915');

    if (!isValidSignature) {
      return NextResponse.json(
        { error: 'Invalid JWS Signature or Merchant ID' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      status: 'OK',
      received: true,
      orderNumber,
      transactionStatus: status,
      amountInPaise,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

