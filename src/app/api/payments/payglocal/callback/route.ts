import { NextResponse } from 'next/server';

// ==============================================================================
// InfiniCharm — PayGlocal Callback & Redirect Verification Handler
// Reference: PayGlocal Official API Documentation (https://payglocal.in/docs/introduction)
// ==============================================================================

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orderNumber = searchParams.get('orderNumber') || '';
  const gid = searchParams.get('gid') || '';
  const status = (searchParams.get('status') || 'SUCCESS').toUpperCase();

  const isSuccess =
    status === 'SUCCESS' ||
    status === 'SENT_FOR_CAPTURE' ||
    status === 'AUTHORIZED' ||
    status === 'COMPLETED';

  if (!orderNumber) {
    return NextResponse.redirect(new URL('/checkout?error=invalid_order', request.url));
  }

  if (isSuccess) {
    // Redirect to order confirmation with success parameters
    const confirmUrl = new URL('/checkout/confirmation', request.url);
    confirmUrl.searchParams.set('orderNumber', orderNumber);
    confirmUrl.searchParams.set('gateway', 'PAYGLOCAL');
    confirmUrl.searchParams.set('gid', gid);
    confirmUrl.searchParams.set('status', 'PAID');
    return NextResponse.redirect(confirmUrl);
  } else {
    // Redirect back to checkout with failure error
    const checkoutUrl = new URL('/checkout', request.url);
    checkoutUrl.searchParams.set('payment_error', `PayGlocal transaction ${status.toLowerCase()}`);
    checkoutUrl.searchParams.set('orderNumber', orderNumber);
    return NextResponse.redirect(checkoutUrl);
  }
}

export async function POST(request: Request) {
  return GET(request);
}

