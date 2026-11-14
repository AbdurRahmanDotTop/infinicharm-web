import { NextRequest, NextResponse } from 'next/server';
import {
  resolveAuthenticatedCustomer,
  manageCustomerAddress,
} from '@/lib/server/customers-store';
import { dispatchNotificationEvent } from '@/lib/server/notification-dispatcher';

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
    const updated = manageCustomerAddress(customer.id, 'UPDATE', {
      ...body,
      id: addressId,
    });

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

    return NextResponse.json({
      success: true,
      addresses: updated,
      message: 'Address updated successfully.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Error updating address.' }, { status: 500 });
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
    return NextResponse.json({
      success: true,
      addresses: updated,
      message: 'Address deleted successfully.',
    });
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
    const { action } = body; // 'SET_DEFAULT_SHIPPING' or 'SET_DEFAULT_BILLING'

    if (action !== 'SET_DEFAULT_SHIPPING' && action !== 'SET_DEFAULT_BILLING') {
      return NextResponse.json({ success: false, error: 'Invalid patch action.' }, { status: 400 });
    }

    const updated = manageCustomerAddress(customer.id, action, { id: addressId });
    return NextResponse.json({
      success: true,
      addresses: updated,
      message: 'Default address updated.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Error updating default.' }, { status: 500 });
  }
}

