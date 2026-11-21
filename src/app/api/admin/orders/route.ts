import { NextRequest, NextResponse } from 'next/server';
import {
  getServerOrders,
  createAdminOrder,
} from '@/lib/server/orders-store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ==============================================================================
// InfiniCharm — Admin Orders Management API
// Standards: Strict Admin Authorization, Real-Time Persistence, Audit Logging
// ==============================================================================

export async function GET(request: NextRequest) {
  try {
    const isAdmin = request.cookies.get('infinicharm_admin_session')?.value === 'active';
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin session required.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.toLowerCase() || searchParams.get('search')?.toLowerCase() || '';
    const status = searchParams.get('status');
    const paymentStatus = searchParams.get('paymentStatus');

    let orders = getServerOrders();

    if (status && status !== 'ALL') {
      orders = orders.filter((o) => o.status === status);
    }

    if (paymentStatus && paymentStatus !== 'ALL') {
      if (paymentStatus === 'REVIEW') {
        orders = orders.filter((o) => o.manualApprovalStatus === 'PENDING_REVIEW');
      } else {
        orders = orders.filter((o) => o.paymentStatus === paymentStatus);
      }
    }

    if (query) {
      orders = orders.filter(
        (o) =>
          o.orderNumber?.toLowerCase().includes(query) ||
          o.id?.toLowerCase().includes(query) ||
          o.customerPhone?.includes(query) ||
          o.shippingAddress?.fullName?.toLowerCase().includes(query) ||
          o.shippingAddress?.phone?.includes(query) ||
          o.customerEmail?.toLowerCase().includes(query) ||
          o.utrNumber?.toLowerCase().includes(query)
      );
    }

    return NextResponse.json(
      { success: true, count: orders.length, orders },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, private',
          Vary: 'Cookie',
        },
      }
    );
  } catch (error: any) {
    console.error('Error in GET /api/admin/orders:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const isAdmin = request.cookies.get('infinicharm_admin_session')?.value === 'active';
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin session required.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const actor = body.actor || 'Operations Admin';

    if (!body.customerName || !body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Customer name and at least one order item are required.' },
        { status: 400 }
      );
    }

    const result = createAdminOrder(body, actor);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json(
      { success: true, order: result.order },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error in POST /api/admin/orders:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error creating order' },
      { status: 500 }
    );
  }
}
