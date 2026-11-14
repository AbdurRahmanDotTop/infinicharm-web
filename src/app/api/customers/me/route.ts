import { NextRequest, NextResponse } from 'next/server';
import {
  resolveAuthenticatedCustomer,
  updateCustomer,
} from '@/lib/server/customers-store';
import { getServerOrders } from '@/lib/server/orders-store';
import { isOrderOwnedByCustomer } from '@/lib/services/orders';
import {
  subscribeToNewsletter,
  unsubscribeFromNewsletter,
} from '@/lib/server/newsletter-store';
import { dispatchNotificationEvent } from '@/lib/server/notification-dispatcher';

export async function GET(req: NextRequest) {
  try {
    const customer = resolveAuthenticatedCustomer(req);
    if (!customer) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Please sign in to view your account.' },
        { status: 401 }
      );
    }

    if (customer.status === 'SUSPENDED') {
      return NextResponse.json(
        { success: false, error: 'Account suspended.' },
        { status: 403 }
      );
    }

    // Get orders belonging strictly to this customer
    const allOrders = getServerOrders();
    const customerOrders = allOrders.filter((o) => isOrderOwnedByCustomer(o, customer));

    const { passwordHash, ...safeCustomer } = customer;

    return NextResponse.json({
      success: true,
      customer: safeCustomer,
      orders: customerOrders,
    });
  } catch (err: any) {
    console.error('Customer ME GET error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const customer = resolveAuthenticatedCustomer(req);
    if (!customer) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { fullName, phone, preferences } = body;

    const updates: any = {};
    if (fullName) updates.fullName = fullName.trim();
    if (phone) updates.phone = phone.trim();
    if (preferences) updates.preferences = preferences;

    const updated = updateCustomer(customer.id, updates);
    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Failed to update customer profile.' },
        { status: 500 }
      );
    }

    if (typeof preferences?.newsletterSubscribed === 'boolean') {
      if (preferences.newsletterSubscribed) {
        subscribeToNewsletter({
          email: updated.email,
          fullName: updated.fullName,
          source: 'customer_profile_toggle',
        });
      } else {
        unsubscribeFromNewsletter({ email: updated.email });
      }
    }

    try {
      await dispatchNotificationEvent({
        eventKey: 'CUSTOMER_PROFILE_UPDATED',
        customerEmail: updated.email,
        customerName: updated.fullName,
        entityType: 'CUSTOMER',
        entityId: updated.id,
        extraVars: {
          customer_name: updated.fullName,
          customer_email: updated.email,
          customer_phone: updated.phone || 'Not provided',
          activity_summary: 'Your profile details were updated cleanly from your account dashboard.',
        },
      });
    } catch (notifyErr) {
      console.error('[customers/me] non-blocking notification error:', notifyErr);
    }

    const { passwordHash, ...safe } = updated;
    return NextResponse.json({
      success: true,
      customer: safe,
      message: 'Profile updated successfully.',
    });
  } catch (err: any) {
    console.error('Customer ME PUT error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}

