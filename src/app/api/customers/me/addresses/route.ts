import { NextRequest, NextResponse } from 'next/server';
import {
  resolveAuthenticatedCustomer,
  manageCustomerAddress,
  autoSaveCustomerOrderDetails,
  sanitizeCustomer,
  getServerCustomerById,
} from '@/lib/server/customers-store';
import { getServerOrders } from '@/lib/server/orders-store';
import { isOrderOwnedByCustomer } from '@/lib/services/orders';
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

    if (!customer.hasExplicitlyClearedAddresses && (!customer.addresses || customer.addresses.length === 0)) {
      const allOrders = getServerOrders();
      const customerOrders = allOrders.filter((o) => isOrderOwnedByCustomer(o, customer));
      const latestOrderWithAddress = customerOrders
        .filter((o) => o.shippingAddress?.addressLine1 && o.shippingAddress?.postalCode)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

      if (latestOrderWithAddress?.shippingAddress) {
        try {
          const autoSaveRes = autoSaveCustomerOrderDetails({
            customerId: customer.id,
            customerEmail: customer.email,
            customerPhone: customer.phone || latestOrderWithAddress.customerPhone || latestOrderWithAddress.shippingAddress.phone,
            customerName: customer.fullName || latestOrderWithAddress.shippingAddress.fullName,
            shippingAddress: latestOrderWithAddress.shippingAddress,
            billingAddress: latestOrderWithAddress.billingAddress,
            saveAddressToBook: true,
            makeDefaultShipping: true,
            makeDefaultBilling: true,
          });
          if (autoSaveRes.customer?.addresses) {
            customer.addresses = autoSaveRes.customer.addresses;
          }
        } catch (healErr) {
          console.error('[API Addresses Route] Self-healing address sync error:', healErr);
        }
      }
    }

    const response = NextResponse.json({
      success: true,
      addresses: customer.addresses || [],
    });
    const safeCustomer = sanitizeCustomer(customer);
    response.cookies.set('infinicharm_customer_data', encodeURIComponent(JSON.stringify(safeCustomer)), {
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
    return response;
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
      type: body.type || 'HOME',
      label: body.label || (body.type === 'OFFICE' ? 'Office' : body.type === 'OTHER' ? 'Other' : 'Home'),
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

    const response = NextResponse.json({
      success: true,
      addresses: updatedAddresses,
      message: 'Address added successfully.',
    }, { status: 201 });

    const freshCustomer = getServerCustomerById(customer.id) || customer;
    const safeCustomer = sanitizeCustomer(freshCustomer);
    safeCustomer.addresses = updatedAddresses || [];
    response.cookies.set('infinicharm_customer_data', encodeURIComponent(JSON.stringify(safeCustomer)), {
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}
