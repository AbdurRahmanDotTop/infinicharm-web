import { NextRequest, NextResponse } from 'next/server';
import {
  resolveAuthenticatedCustomer,
  updateCustomerPassword,
} from '@/lib/server/customers-store';
import { setCustomerAuthCookies } from '@/lib/server/auth-service';
import { dispatchNotificationEvent } from '@/lib/server/notification-dispatcher';

export async function POST(req: NextRequest) {
  try {
    const customer = resolveAuthenticatedCustomer(req);
    if (!customer) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
    }

    const body = await req.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, error: 'Current password and new password are required.' },
        { status: 400 }
      );
    }

    const result = updateCustomerPassword(customer.id, currentPassword, newPassword);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    try {
      await dispatchNotificationEvent({
        eventKey: 'PASSWORD_CHANGED',
        customerEmail: customer.email,
        customerName: customer.fullName,
        entityType: 'CUSTOMER',
        entityId: customer.id,
        extraVars: {
          customer_name: customer.fullName,
          customer_email: customer.email,
          activity_summary: `Your account password was changed successfully on ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}.`,
        },
      });
    } catch (notifyErr) {
      console.error('[customers/me/password] non-blocking notification error:', notifyErr);
    }

    const response = NextResponse.json({
      success: true,
      message: 'Password changed successfully. Your account is secured.',
    });
    setCustomerAuthCookies(
      response,
      { id: customer.id, sessionVersion: (customer.sessionVersion ?? 1) + 1 },
      true
    );
    return response;
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Password update error.' }, { status: 500 });
  }
}

