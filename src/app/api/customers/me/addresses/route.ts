import { NextRequest, NextResponse } from 'next/server';
import {
  resolveAuthenticatedCustomer,
  manageCustomerAddress,
} from '@/lib/server/customers-store';
import { dispatchNotificationEvent } from '@/lib/server/notification-dispatcher';

export async function GET(req: NextRequest) {
  try {
    const customer = resolveAuthenticatedCustomer(req);
    if (!customer) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized.' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      addresses: customer.addresses || [],
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const customer = resolveAuthenticatedCustomer(req);
    if (!customer) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      fullName,
      phone,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country,
      isDefaultShipping,
      isDefaultBilling,
    } = body;

    if (!fullName || !phone || !addressLine1 || !city || !state || !postalCode) {
      return NextResponse.json(
        { success: false, error: 'All mandatory address fields must be filled.' },
        { status: 400 }
      );
    }

    const updatedAddresses = manageCustomerAddress(customer.id, 'ADD', {
      fullName,
      phone,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country: country || 'India',
      isDefaultShipping: !!isDefaultShipping,
      isDefaultBilling: !!isDefaultBilling,
    });

    try {
      await dispatchNotificationEvent({
        eventKey: 'CUSTOMER_ADDRESS_UPDATED',
        customerEmail: customer.email,
        customerName: customer.fullName,
        entityType: 'ADDRESS',
        entityId: customer.id,
        extraVars: {
          customer_name: customer.fullName,
          customer_email: customer.email,
          shipping_address: `${addressLine1}, ${city}, ${state} - ${postalCode}`,
          activity_summary: `A new shipping/billing address (${city}, ${state}) was saved to your account.`,
        },
      });
    } catch (notifyErr) {
      console.error('[customers/me/addresses] non-blocking notification error:', notifyErr);
    }

    return NextResponse.json({
      success: true,
      addresses: updatedAddresses,
      message: 'Address added successfully.',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}

