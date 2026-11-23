import { NextRequest, NextResponse } from 'next/server';
import {
  resolveAuthenticatedCustomer,
  manageCustomerAddress,
  sanitizeCustomer,
  getServerCustomerById,
} from '@/lib/server/customers-store';
import { getServerOrders } from '@/lib/server/orders-store';
import { dispatchNotificationEvent } from '@/lib/server/notification-dispatcher';

function makeAddressResponse(data: any, customer: any, updatedAddresses: any, status = 200) {
  const response = NextResponse.json(data, { status });
  const freshCustomer = getServerCustomerById(customer.id) || customer;
  const safeCustomer = sanitizeCustomer(freshCustomer);
  safeCustomer.addresses = updatedAddresses || [];
  safeCustomer.updatedAt = new Date().toISOString();
  response.cookies.set('infinicharm_customer_data', encodeURIComponent(JSON.stringify(safeCustomer)), {
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  response.cookies.set('infinicharm_customer_id', customer.id, {
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
  return response;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ addressId: string }> }
) {
  try {
    const { addressId } = await params;
    const customer = resolveAuthenticatedCustomer(req);
    if (!customer) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
    }

    const body = await req.json();
    const { fullName, phone, addressLine1, city, state, postalCode } = body;

    const cleanPhone = String(phone || '').replace(/\D/g, '').slice(-10);
    if (!fullName || !phone || !addressLine1 || !city || !state || !postalCode) {
      return NextResponse.json(
        { success: false, error: 'All mandatory address fields must be filled.' },
        { status: 400 }
      );
    }
    if (cleanPhone.length < 10) {
      return NextResponse.json(
        { success: false, error: 'A valid 10-digit mobile phone number is required.' },
        { status: 400 }
      );
    }

    let updated;
    try {
      updated = manageCustomerAddress(customer.id, 'UPDATE', {
        ...body,
        phone: cleanPhone,
        addressLine2: body.addressLine2 !== undefined ? String(body.addressLine2).trim() : '',
        id: addressId,
      });
    } catch (updateErr: any) {
      if (updateErr?.message?.includes('not found') && addressLine1 && postalCode) {
        updated = manageCustomerAddress(customer.id, 'ADD', {
          ...body,
          phone: cleanPhone,
          addressLine2: body.addressLine2 !== undefined ? String(body.addressLine2).trim() : '',
          id: addressId.startsWith('addr-') ? addressId : `addr-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
        });
      } else {
        throw updateErr;
      }
    }

    try {
      await dispatchNotificationEvent({
        eventKey: 'CUSTOMER_ADDRESS_UPDATED',
        customerEmail: customer.email,
        customerName: customer.fullName,
        entityType: 'ADDRESS',
        entityId: addressId,
        extraVars: {
          customer_name: customer.fullName,
          customer_email: customer.email,
          activity_summary: `Your saved delivery address was updated.`,
        },
      });
    } catch (notifyErr) {
      console.error('[addresses/[addressId]] PUT non-blocking notification error:', notifyErr);
    }

    return makeAddressResponse({
      success: true,
      addresses: updated,
      message: 'Address updated successfully.',
    }, customer, updated);
  } catch (err: any) {
    const isNotFound = err?.message?.includes('not found');
    return NextResponse.json(
      { success: false, error: err?.message || 'Error updating address.' },
      { status: isNotFound ? 404 : 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ addressId: string }> }
) {
  try {
    const { addressId } = await params;
    const customer = resolveAuthenticatedCustomer(req);
    if (!customer) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
    }

    const updated = manageCustomerAddress(customer.id, 'DELETE', { id: addressId });
    try {
      await dispatchNotificationEvent({
        eventKey: 'CUSTOMER_ADDRESS_UPDATED',
        customerEmail: customer.email,
        customerName: customer.fullName,
        entityType: 'ADDRESS',
        entityId: addressId,
        extraVars: {
          customer_name: customer.fullName,
          customer_email: customer.email,
          activity_summary: `A saved address was removed from your account.`,
        },
      });
    } catch (notifyErr) {
      console.error('[addresses/[addressId]] DELETE non-blocking notification error:', notifyErr);
    }
    return makeAddressResponse({
      success: true,
      addresses: updated,
      message: 'Address deleted successfully.',
    }, customer, updated);
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Error deleting address.' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ addressId: string }> }
) {
  try {
    const { addressId } = await params;
    const customer = resolveAuthenticatedCustomer(req);
    if (!customer) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
    }

    const body = await req.json();
    const { action, label, type, isDefaultShipping, isDefaultBilling } = body;

    let targetAction: 'SET_DEFAULT_SHIPPING' | 'SET_DEFAULT_BILLING' | 'RENAME' = action;
    if (!targetAction) {
      if (isDefaultShipping === true) targetAction = 'SET_DEFAULT_SHIPPING';
      else if (isDefaultBilling === true) targetAction = 'SET_DEFAULT_BILLING';
      else if (label !== undefined || type !== undefined) targetAction = 'RENAME';
    }

    if (
      targetAction !== 'SET_DEFAULT_SHIPPING' &&
      targetAction !== 'SET_DEFAULT_BILLING' &&
      targetAction !== 'RENAME'
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid patch action. Supported actions: SET_DEFAULT_SHIPPING, SET_DEFAULT_BILLING, RENAME.',
        },
        { status: 400 }
      );
    }

    const cleanLabel = typeof label === 'string' ? label.trim() : undefined;
    const effectiveLabel = cleanLabel !== undefined ? (cleanLabel || (type === 'OFFICE' ? 'Office' : type === 'OTHER' ? 'Other' : 'Home')) : undefined;

    const patchPayload: any = { id: addressId };
    if (effectiveLabel !== undefined) patchPayload.label = effectiveLabel;
    if (type !== undefined) patchPayload.type = type;

    let updated;
    try {
      updated = manageCustomerAddress(customer.id, targetAction, patchPayload);
    } catch (patchErr: any) {
      if (patchErr?.message?.includes('not found')) {
        const allOrders = getServerOrders();
        const matchedOrder = allOrders.find(
          (o) => (o.customerId === customer.id || (customer.email && o.customerEmail?.toLowerCase() === customer.email.toLowerCase())) &&
                 (o.shippingAddress?.id === addressId || `addr-order-${o.orderNumber}` === addressId)
        );
        if (matchedOrder?.shippingAddress) {
          const s = matchedOrder.shippingAddress;
          updated = manageCustomerAddress(customer.id, 'ADD', {
            id: addressId,
            fullName: s.fullName || customer.fullName,
            phone: s.phone || customer.phone,
            addressLine1: s.addressLine1,
            addressLine2: s.addressLine2,
            city: s.city,
            state: s.state,
            postalCode: s.postalCode,
            country: s.country,
            type: s.type,
            label: s.label,
            isDefaultShipping: targetAction === 'SET_DEFAULT_SHIPPING',
            isDefaultBilling: targetAction === 'SET_DEFAULT_BILLING',
          });
        } else {
          throw patchErr;
        }
      } else {
        throw patchErr;
      }
    }
    return makeAddressResponse({
      success: true,
      addresses: updated,
      message: targetAction === 'RENAME' ? 'Address details updated.' : 'Default address updated.',
    }, customer, updated);
  } catch (err: any) {
    const isNotFound = err?.message?.includes('not found');
    return NextResponse.json(
      { success: false, error: err?.message || 'Error updating default.' },
      { status: isNotFound ? 404 : 500 }
    );
  }
}
