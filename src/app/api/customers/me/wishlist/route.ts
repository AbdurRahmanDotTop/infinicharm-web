import { NextRequest, NextResponse } from 'next/server';
import {
  resolveAuthenticatedCustomer,
  manageCustomerWishlist,
} from '@/lib/server/customers-store';
import { dispatchNotificationEvent } from '@/lib/server/notification-dispatcher';

export async function GET(req: NextRequest) {
  try {
    const customer = resolveAuthenticatedCustomer(req);
    if (!customer) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      wishlist: customer.wishlistProductIds || [],
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Wishlist error.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const customer = resolveAuthenticatedCustomer(req);
    if (!customer) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
    }

    const body = await req.json();
    const { productId, action } = body; // action: 'ADD' | 'REMOVE' | 'TOGGLE'

    if (!productId) {
      return NextResponse.json({ success: false, error: 'productId is required.' }, { status: 400 });
    }

    const wasSaved = (customer.wishlistProductIds || []).includes(productId);
    const updated = manageCustomerWishlist(customer.id, productId, action || 'TOGGLE');
    const isNowSaved = updated.includes(productId);

    if (isNowSaved && !wasSaved) {
      try {
        await dispatchNotificationEvent({
          eventKey: 'WISHLIST_ITEM_ADDED',
          customerEmail: customer.email,
          customerName: customer.fullName,
          entityType: 'PRODUCT',
          entityId: productId,
          extraVars: {
            customer_name: customer.fullName,
            customer_email: customer.email,
            product_title: String(productId),
            activity_summary: `Saved product ${productId} to customer wishlist.`,
          },
        });
      } catch (notifyErr) {
        console.error('[customers/me/wishlist] non-blocking notification error:', notifyErr);
      }
    }

    return NextResponse.json({
      success: true,
      wishlist: updated,
      message: 'Wishlist updated.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Wishlist error.' }, { status: 500 });
  }
}

