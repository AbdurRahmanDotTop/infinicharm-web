import { NextRequest, NextResponse } from 'next/server';
import {
  getServerCustomerById,
  updateCustomer,
  deleteCustomer,
} from '@/lib/server/customers-store';
import { getServerOrders } from '@/lib/server/orders-store';
import { dispatchNotificationEvent } from '@/lib/server/notification-dispatcher';

function verifyAdminSession(req: NextRequest) {
  const adminCookie = req.cookies.get('infinicharm_admin_session')?.value;
  return adminCookie === 'active';
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!verifyAdminSession(req)) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
    }

    const { id } = await params;
    const customer = getServerCustomerById(id);
    if (!customer) {
      return NextResponse.json({ success: false, error: 'Customer not found.' }, { status: 404 });
    }

    // Get orders
    const allOrders = getServerOrders();
    const customerOrders = allOrders.filter(
      (o) =>
        (o.customerId && o.customerId === customer.id) ||
        (o.customerEmail && o.customerEmail.toLowerCase() === customer.email.toLowerCase()) ||
        (o.customerPhone && o.customerPhone === customer.phone)
    );

    const { passwordHash, ...safe } = customer;

    return NextResponse.json({
      success: true,
      customer: safe,
      orders: customerOrders,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Error fetching customer.' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!verifyAdminSession(req)) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const before = getServerCustomerById(id);

    const updated = updateCustomer(id, body);
    if (!updated) {
      return NextResponse.json({ success: false, error: 'Customer not found.' }, { status: 404 });
    }

    try {
      if (before && body.status && before.status !== updated.status) {
        await dispatchNotificationEvent({
          eventKey: 'CUSTOMER_STATUS_CHANGED',
          customerEmail: updated.email,
          customerName: updated.fullName,
          entityType: 'CUSTOMER',
          entityId: updated.id,
          extraVars: {
            customer_name: updated.fullName,
            customer_email: updated.email,
            activity_summary: `Your account status has changed from ${before.status} to ${updated.status}.`,
          },
        });
      } else {
        await dispatchNotificationEvent({
          eventKey: 'CUSTOMER_PROFILE_UPDATED',
          customerEmail: updated.email,
          customerName: updated.fullName,
          entityType: 'CUSTOMER',
          entityId: updated.id,
          extraVars: {
            customer_name: updated.fullName,
            customer_email: updated.email,
            activity_summary: 'Your account profile details were updated by an administrator.',
          },
        });
      }
    } catch (notifyErr) {
      console.error('[admin/customers/[id]] PUT non-blocking notification error:', notifyErr);
    }

    const { passwordHash, ...safe } = updated;
    return NextResponse.json({
      success: true,
      customer: safe,
      message: 'Customer profile updated successfully.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Error updating customer.' }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!verifyAdminSession(req)) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
    }

    const { id } = await params;
    const targetCustomer = getServerCustomerById(id);
    if (!targetCustomer) {
      return NextResponse.json({ success: false, error: 'Customer not found or already deleted.' }, { status: 404 });
    }

    if (
      targetCustomer.id === 'cust-founder-01' ||
      targetCustomer.email.toLowerCase() === 'abdurrahmanibnghufran@gmail.com' ||
      (targetCustomer as any).role === 'SUPER_ADMIN' ||
      targetCustomer.role === 'ADMIN'
    ) {
      return NextResponse.json(
        { success: false, error: 'Protected root founder and administrator accounts cannot be deleted.' },
        { status: 403 }
      );
    }

    const success = deleteCustomer(id);
    if (!success) {
      return NextResponse.json({ success: false, error: 'Customer not found or already deleted.' }, { status: 404 });
    }

    if (targetCustomer) {
      try {
        await dispatchNotificationEvent({
          eventKey: 'CUSTOMER_ACCOUNT_DELETED',
          customerEmail: targetCustomer.email,
          customerName: targetCustomer.fullName,
          entityType: 'CUSTOMER',
          entityId: id,
          extraVars: {
            customer_name: targetCustomer.fullName,
            customer_email: targetCustomer.email,
            activity_summary: `Customer account ${targetCustomer.email} and associated records were permanently removed by admin.`,
          },
        });
      } catch (notifyErr) {
        console.error('[admin/customers/[id]] DELETE non-blocking notification error:', notifyErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Customer deleted successfully.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Error deleting customer.' }, { status: 500 });
  }
}

