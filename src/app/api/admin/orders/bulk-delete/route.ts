import { NextRequest, NextResponse } from 'next/server';
import { bulkDeleteServerOrders } from '@/lib/server/orders-store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
    const orderIds = Array.isArray(body.orderIds) ? body.orderIds : [];
    const permanent = body.permanent === true;
    const actor = body.actor || 'Operations Admin';

    if (orderIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No order IDs provided for bulk deletion.' },
        { status: 400 }
      );
    }

    const result = bulkDeleteServerOrders(orderIds, actor, permanent);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in bulk delete orders:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
