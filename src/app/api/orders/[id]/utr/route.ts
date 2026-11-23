import { NextRequest, NextResponse } from 'next/server';
import { submitServerOrderUtr } from '@/lib/server/orders-store';
import { autoSaveCustomerOrderDetails, sanitizeCustomer } from '@/lib/server/customers-store';

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

    let updatedCustomer: any = null;
    // Auto-save delivery address & customer details to customer profile upon UTR payment confirmation
    if (result.order?.shippingAddress && (result.order.customerId !== 'guest' || result.order.customerEmail)) {
      try {
        const autoSaveRes = autoSaveCustomerOrderDetails({
          customerId: result.order.customerId !== 'guest' ? result.order.customerId : undefined,
          customerEmail: result.order.customerEmail,
          customerPhone: result.order.customerPhone || result.order.shippingAddress.phone,
          customerName: result.order.shippingAddress.fullName || payerName,
          shippingAddress: result.order.shippingAddress,
          billingAddress: result.order.billingAddress,
          saveAddressToBook: true,
          makeDefaultShipping: true,
          makeDefaultBilling: true,
        });
        if (autoSaveRes.customer) {
          updatedCustomer = sanitizeCustomer(autoSaveRes.customer);
        }
      } catch (autoErr) {
        console.error('[API Order UTR Route] Auto-save customer details error:', autoErr);
      }
    }

    const response = NextResponse.json({ success: true, order: result.order, customer: updatedCustomer });
    if (updatedCustomer) {
      response.cookies.set('infinicharm_customer_data', encodeURIComponent(JSON.stringify(updatedCustomer)), {
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      });
      if (updatedCustomer.id) {
        response.cookies.set('infinicharm_customer_id', updatedCustomer.id, {
          path: '/',
          maxAge: 30 * 24 * 60 * 60,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
        });
        response.cookies.set('infinicharm_customer_session', 'active', {
          path: '/',
          maxAge: 30 * 24 * 60 * 60,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
        });
      }
    }
    return response;
  } catch (error: any) {
    console.error('Error submitting order UTR:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
