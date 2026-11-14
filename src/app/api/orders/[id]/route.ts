import { NextRequest, NextResponse } from 'next/server';
import {
  getServerOrderByIdOrNumber,
  updateServerOrderStatus,
  updateServerOrderTracking,
  approveServerOrderUtr,
  rejectServerOrderUtr,
  addServerOrderTimelineEvent,
} from '@/lib/server/orders-store';
import { resolveAuthenticatedCustomer } from '@/lib/server/customers-store';
import {
  isOrderOwnedByCustomer,
  sanitizeOrderForPublicTracking,
  verifyGuestOrderAuthorization,
  type OrderPrivacyMeta,
} from '@/lib/services/orders';
import { OrderStatus } from '@/types';
import {
  dispatchOrderLifecycleNotification,
  mapOrderStatusToEventKey,
} from '@/lib/server/order-notifications';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ==============================================================================
// InfiniCharm — Single Order Lookup & State Machine Transition API
// Governing PRD: PRD 10 (Order Management, Fulfillment Lifecycle & Logistics)
// Standards: Strict server-side ownership verification & PII redaction
// ==============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const contact = searchParams.get('contact');

    const order = getServerOrderByIdOrNumber(id);

    if (!order) {
      return NextResponse.json(
        { success: false, error: `Order "${id}" not found.` },
        { status: 404 }
      );
    }

    // Legacy guest contact mismatch check
    if (contact && !verifyGuestOrderAuthorization(order, contact)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: contact details do not match order records.' },
        { status: 403 }
      );
    }

    // Server-side authentication & ownership verification
    const isAdmin = request.cookies.get('infinicharm_admin_session')?.value === 'active';
    const authCustomer = resolveAuthenticatedCustomer(request);

    const isOwner = isOrderOwnedByCustomer(order, authCustomer);
    const canViewPrivateDetails = isAdmin || isOwner;

    const privacy: OrderPrivacyMeta = {
      isAuthenticated: Boolean(authCustomer) || isAdmin,
      isOwner,
      isAdmin,
      canViewPrivateDetails,
      accessState: canViewPrivateDetails
        ? 'AUTHORIZED'
        : authCustomer
          ? 'WRONG_ACCOUNT'
          : 'UNAUTHENTICATED',
    };

    const payloadOrder = canViewPrivateDetails ? order : sanitizeOrderForPublicTracking(order);

    return NextResponse.json(
      { success: true, order: payloadOrder, privacy },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, private',
          Vary: 'Cookie',
        },
      }
    );
  } catch (error: any) {
    console.error('Error fetching order by ID:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (request.cookies.get('infinicharm_admin_session')?.value !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin privileges required.' },
        { status: 401 }
      );
    }
    const { id } = await params;
    const body = await request.json();
    const action = body.action;

    if (!action) {
      return NextResponse.json(
        { success: false, error: 'Missing action parameter in request body.' },
        { status: 400 }
      );
    }

    // 1. Approve Custom UPI UTR
    if (action === 'APPROVE_UTR') {
      const adminName = body.adminName || 'Super Admin';
      const result = approveServerOrderUtr(id, adminName);
      if (!result.success) {
        return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      }
      if (result.order) {
        try {
          await dispatchOrderLifecycleNotification('ORDER_PAYMENT_APPROVED', result.order, {
            statusMessage: `Payment UTR has been verified by ${adminName}. Your consignment is moving into packing.`,
          });
        } catch (err) {
          console.error('[api/orders/[id]] APPROVE_UTR notification error:', err);
        }
      }
      return NextResponse.json({ success: true, order: result.order });
    }

    // 2. Reject Custom UPI UTR
    if (action === 'REJECT_UTR') {
      const reason = body.reason || 'UTR could not be verified in bank statement.';
      const adminName = body.adminName || 'Super Admin';
      const result = rejectServerOrderUtr(id, reason, adminName);
      if (!result.success) {
        return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      }
      if (result.order) {
        try {
          await dispatchOrderLifecycleNotification('ORDER_PAYMENT_REJECTED', result.order, {
            statusMessage: `Payment verification failed: ${reason}`,
          });
        } catch (err) {
          console.error('[api/orders/[id]] REJECT_UTR notification error:', err);
        }
      }
      return NextResponse.json({ success: true, order: result.order });
    }

    // 3. Update Status
    if (action === 'UPDATE_STATUS') {
      const newStatus = body.status as OrderStatus;
      const adminNotes = body.adminNotes;
      const actor = body.actor || 'Store Admin';

      if (!newStatus) {
        return NextResponse.json(
          { success: false, error: 'Target status is required.' },
          { status: 400 }
        );
      }

      const result = updateServerOrderStatus(id, newStatus, adminNotes, actor);
      if (!result.success) {
        return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      }
      const eventKey = result.order ? mapOrderStatusToEventKey(newStatus) : null;
      if (result.order && eventKey) {
        try {
          await dispatchOrderLifecycleNotification(eventKey, result.order, {
            statusMessage:
              adminNotes ||
              `Your order ${result.order.orderNumber} status updated to ${newStatus}.`,
          });
        } catch (err) {
          console.error('[api/orders/[id]] UPDATE_STATUS notification error:', err);
        }
      }
      return NextResponse.json({ success: true, order: result.order });
    }

    // 4. Update Courier & Tracking
    if (action === 'UPDATE_TRACKING') {
      const { courierName, trackingNumber, estimatedDeliveryDate, checkpointNotes, actor } = body;

      if (!courierName || !trackingNumber) {
        return NextResponse.json(
          { success: false, error: 'courierName and trackingNumber are required.' },
          { status: 400 }
        );
      }

      const result = updateServerOrderTracking(
        id,
        courierName,
        trackingNumber,
        estimatedDeliveryDate,
        checkpointNotes,
        actor || 'Logistics Operations'
      );

      if (!result.success) {
        return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      }
      if (result.order) {
        try {
          await dispatchOrderLifecycleNotification('ORDER_SHIPPED', result.order, {
            statusMessage: `Dispatched via ${courierName} with AWB ${trackingNumber}.`,
          });
        } catch (err) {
          console.error('[api/orders/[id]] UPDATE_TRACKING notification error:', err);
        }
      }
      return NextResponse.json({ success: true, order: result.order });
    }

    // 5. Add custom timeline checkpoint
    if (action === 'ADD_TIMELINE_EVENT') {
      const { title, description, location, actor, status, type, isCustomerVisible } = body;
      const result = addServerOrderTimelineEvent(id, {
        title,
        description,
        location,
        actor,
        status: status || 'PROCESSING',
        type: type || 'LOGISTICS',
        isCustomerVisible: isCustomerVisible !== false,
      });

      if (!result.success) {
        return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      }
      return NextResponse.json({ success: true, order: result.order });
    }

    return NextResponse.json(
      { success: false, error: `Unrecognized action: ${action}` },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Error updating order:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error updating order' },
      { status: 500 }
    );
  }
}

