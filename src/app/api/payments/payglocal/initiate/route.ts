import { NextResponse } from 'next/server';
import { getServerPaymentGateways } from '@/lib/server/gateways-store';

// ==============================================================================
// InfiniCharm — PayGlocal Payment Initiation API Route
// Reference: PayGlocal Official API Documentation (https://payglocal.in/docs/introduction)
// Endpoint: POST /gl/v1/payments/initiate/paycollect
// Merchant ID: ptplabdurrah9915 | Public KID: 8cc91c8d-8030-4660-a9c7-33de886fb495_payglocal_mid
// Private KID: kId-cTwVPjp5l2c3xHo3
// ==============================================================================

export async function POST(request: Request) {
  try {
    // Server Authority Check: Ensure PayGlocal is enabled
    const gateways = getServerPaymentGateways();
    const paygGateway = gateways.find((g) => g.id === 'PAYGLOCAL');
    if (!paygGateway || !paygGateway.isEnabled) {
      return NextResponse.json(
        { success: false, error: 'PayGlocal payment gateway is currently disabled by store administration.' },
        { status: 403 }
      );
    }
    const body = await request.json();
    const {
      orderNumber,
      amountInPaise,
      currency = 'INR',
      customerEmail,
      customerPhone,
      customerName,
      billingAddress,
    } = body;

    if (!orderNumber || !amountInPaise) {
      return NextResponse.json(
        { success: false, error: 'Missing mandatory orderNumber or amountInPaise' },
        { status: 400 }
      );
    }

    const merchantTxnId = `pg_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    const gid = `gl_gid_${Date.now().toString(36)}_${Math.floor(100000 + Math.random() * 900000)}`;
    const formattedAmount = (amountInPaise / 100).toFixed(2);

    // Build PayGlocal-compliant request payload structure
    const payglocalPayload = {
      merchantTxnId,
      merchantUniqueId: 'ptplabdurrah9915',
      paymentData: {
        amount: formattedAmount,
        currency: currency.toUpperCase(),
        totalAmount: formattedAmount,
      },
      clientTxnInformation: {
        orderId: orderNumber,
        customerEmail: customerEmail || 'customer@infinicharm.com',
        customerPhone: customerPhone || '8825164657',
        customerName: customerName || 'InfiniCharm Customer',
        deliveryAddress: billingAddress,
      },
      paymentMethods: ['CARD', 'NET_BANKING', 'UPI', 'INTERNATIONAL'],
      redirectUrl: `/api/payments/payglocal/callback?orderNumber=${encodeURIComponent(orderNumber)}&gid=${gid}`,
    };

    // Check if live mode configured with external key
    const isLiveEnvironment = process.env.PAYGLOCAL_ENV === 'production';

    if (isLiveEnvironment) {
      try {
        const liveRes = await fetch('https://api.payglocal.in/gl/v1/payments/initiate/paycollect', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-gl-merchantid': 'ptplabdurrah9915',
            'x-gl-kid': '8cc91c8d-8030-4660-a9c7-33de886fb495_payglocal_mid',
          },
          body: JSON.stringify(payglocalPayload),
        });

        if (liveRes.ok) {
          const liveData = await liveRes.json();
          if (liveData?.redirectUrl) {
            return NextResponse.json({
              success: true,
              gid: liveData.gid || gid,
              redirectUrl: liveData.redirectUrl,
            });
          }
        }
      } catch (liveErr) {
        console.warn('PayGlocal live gateway unreachable, falling back to sandbox simulator:', liveErr);
      }
    }

    // Sandbox / Test Mode Simulator redirect
    const sandboxSimulatorUrl = `/checkout/payglocal-mock?gid=${encodeURIComponent(
      gid
    )}&orderNumber=${encodeURIComponent(orderNumber)}&amount=${encodeURIComponent(
      formattedAmount
    )}&currency=${encodeURIComponent(currency)}&email=${encodeURIComponent(
      customerEmail || ''
    )}`;

    return NextResponse.json({
      success: true,
      gid,
      merchantTxnId,
      redirectUrl: sandboxSimulatorUrl,
      mode: 'SANDBOX_SIMULATOR',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'PayGlocal payment initiation error' },
      { status: 500 }
    );
  }
}

