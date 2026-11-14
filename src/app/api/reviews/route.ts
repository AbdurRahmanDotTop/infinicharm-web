import { NextRequest, NextResponse } from 'next/server';
import { resolveAuthenticatedCustomer } from '@/lib/server/customers-store';
import { getServerOrders } from '@/lib/server/orders-store';
import { getServerProductByIdOrSlug } from '@/lib/server/products-store';
import {
  getApprovedReviews,
  getReviewStats,
  submitCustomerReview,
  getReviewSettings,
  deleteReview,
  getServerReviews,
} from '@/lib/server/reviews-store';
import { canCustomerReviewProduct, validateReviewSubmission } from '@/lib/services/reviews';
import { dispatchNotificationEvent } from '@/lib/server/notification-dispatcher';
import { getAdminUrl } from '@/lib/utils/env-urls';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get('productId') || undefined;

    // Resolve product if id or slug was passed
    let resolvedProductId = productId;
    if (productId) {
      const prod = getServerProductByIdOrSlug(productId);
      if (prod) {
        resolvedProductId = prod.id;
      }
    }

    const reviews = getApprovedReviews(resolvedProductId);
    const stats = getReviewStats(resolvedProductId);

    return NextResponse.json({
      success: true,
      reviews,
      stats,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to fetch reviews' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1. Mandatory Backend Authentication
    const customer = resolveAuthenticatedCustomer(req);
    if (!customer) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required. Please sign in to your customer account to submit a review.',
        },
        { status: 401 }
      );
    }

    if (customer.status === 'SUSPENDED') {
      return NextResponse.json(
        {
          success: false,
          error: 'Your customer account is suspended. You cannot submit reviews.',
        },
        { status: 403 }
      );
    }

    // 2. Parse payload
    const body = await req.json();
    const { productId, rating, comment, title } = body;

    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'Product ID or slug is required.' },
        { status: 400 }
      );
    }

    // 3. Resolve Product Authority
    const product = getServerProductByIdOrSlug(productId);
    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Product not found in catalogue.' },
        { status: 404 }
      );
    }

    // 4. Strict Backend Purchase Verification
    const allOrders = getServerOrders();
    const settings = getReviewSettings();

    const purchaseCheck = canCustomerReviewProduct(customer.id, product.id, allOrders, {
      customerEmail: customer.email,
      productSlug: product.slug,
      productTitle: product.title,
      requireDeliveredStatus: settings.requireDeliveredStatus,
    });

    if (!purchaseCheck.canReview) {
      return NextResponse.json(
        {
          success: false,
          error:
            purchaseCheck.reason ||
            'Purchase verification failed: You can only review products that have been delivered to your account.',
        },
        { status: 403 }
      );
    }

    // 5. Input Validation
    const validation = validateReviewSubmission(rating, comment, title);
    if (!validation.isValid) {
      return NextResponse.json(
        { success: false, error: validation.errors.join(' ') },
        { status: 400 }
      );
    }

    // 6. Submit Verified Review linked to verified order
    const initialStatus = settings.autoApproveVerifiedPurchases ? 'APPROVED' : 'PENDING';

    const newReview = submitCustomerReview({
      productId: product.id,
      productTitle: product.title,
      productSlug: product.slug,
      customerId: customer.id,
      customerName: customer.fullName || 'Verified Customer',
      customerEmail: customer.email,
      orderId: purchaseCheck.orderId,
      orderNumber: purchaseCheck.orderNumber,
      rating,
      title,
      comment,
      isVerifiedPurchase: true,
      status: initialStatus,
    });

    const updatedStats = getReviewStats(product.id);

    try {
      await dispatchNotificationEvent({
        eventKey: 'REVIEW_SUBMITTED',
        customerEmail: customer.email,
        customerName: customer.fullName || 'Verified Customer',
        entityType: 'REVIEW',
        entityId: newReview.id,
        extraVars: {
          product_title: product.title,
          review_rating: rating,
          review_comment: comment,
          review_status: initialStatus,
          customer_name: customer.fullName || 'Verified Customer',
          customer_email: customer.email,
          action_url: getAdminUrl('reviews', req),
        },
      });
    } catch (notifyErr) {
      console.error('[api/reviews] non-blocking REVIEW_SUBMITTED notification error:', notifyErr);
    }

    return NextResponse.json({
      success: true,
      review: newReview,
      stats: updatedStats,
      message:
        initialStatus === 'APPROVED'
          ? 'Your verified review has been submitted and published!'
          : 'Your verified review has been submitted and is pending administrator moderation.',
    });
  } catch (err: any) {
    console.error('Review submission API error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to submit review' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const customer = resolveAuthenticatedCustomer(req);
    if (!customer) {
      return NextResponse.json(
        { success: false, error: 'Authentication required.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Review ID is required.' },
        { status: 400 }
      );
    }

    const all = getServerReviews();
    const target = all.find((r) => r.id === id);

    if (!target) {
      return NextResponse.json(
        { success: false, error: 'Review not found.' },
        { status: 404 }
      );
    }

    // Ensure customer owns this review
    if (target.customerId !== customer.id && target.customerEmail?.toLowerCase() !== customer.email.toLowerCase()) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: You can only delete your own reviews.' },
        { status: 403 }
      );
    }

    deleteReview(id);

    return NextResponse.json({
      success: true,
      message: 'Your review has been deleted.',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to delete review' },
      { status: 500 }
    );
  }
}
