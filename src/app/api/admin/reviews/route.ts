import { NextRequest, NextResponse } from 'next/server';
import {
  getServerReviews,
  moderateReview,
  deleteReview,
  getReviewSettings,
  saveReviewSettings,
  getReviewStats,
} from '@/lib/server/reviews-store';
import { getServerProducts } from '@/lib/server/products-store';
import { logAdminAction } from '@/lib/services/audit';
import { dispatchNotificationEvent } from '@/lib/server/notification-dispatcher';
import { getProductShareUrl } from '@/lib/utils/env-urls';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'ALL';
    const productId = searchParams.get('productId') || 'ALL';
    const search = (searchParams.get('search') || '').toLowerCase().trim();

    let reviews = getServerReviews();

    // Calculate overall moderation metrics
    const totalReviews = reviews.length;
    const pendingCount = reviews.filter((r) => r.status === 'PENDING').length;
    const approvedCount = reviews.filter((r) => r.status === 'APPROVED').length;
    const rejectedCount = reviews.filter((r) => r.status === 'REJECTED').length;
    const hiddenCount = reviews.filter((r) => r.status === 'HIDDEN').length;

    const overallStats = getReviewStats();
    const settings = getReviewSettings();
    const allProducts = getServerProducts({ admin: true });

    // Apply filtering
    if (status !== 'ALL') {
      reviews = reviews.filter((r) => r.status === status);
    }

    if (productId !== 'ALL') {
      const cleanProd = productId.toLowerCase();
      reviews = reviews.filter(
        (r) =>
          r.productId.toLowerCase() === cleanProd ||
          (r.productSlug && r.productSlug.toLowerCase() === cleanProd)
      );
    }

    if (search) {
      reviews = reviews.filter(
        (r) =>
          r.customerName.toLowerCase().includes(search) ||
          (r.customerEmail && r.customerEmail.toLowerCase().includes(search)) ||
          (r.productTitle && r.productTitle.toLowerCase().includes(search)) ||
          r.productId.toLowerCase().includes(search) ||
          (r.orderNumber && r.orderNumber.toLowerCase().includes(search)) ||
          (r.title && r.title.toLowerCase().includes(search)) ||
          r.comment.toLowerCase().includes(search)
      );
    }

    return NextResponse.json({
      success: true,
      reviews,
      metrics: {
        totalReviews,
        pendingCount,
        approvedCount,
        rejectedCount,
        hiddenCount,
        averageRating: overallStats.averageRating,
      },
      settings,
      products: allProducts.map((p) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
      })),
    });
  } catch (err: any) {
    console.error('Admin reviews GET error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to fetch reviews' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, status, adminReply, settings } = body;

    // Handle settings update
    if (settings) {
      const updatedSettings = saveReviewSettings(settings);
      logAdminAction('UPDATE_REVIEW_SETTINGS', 'reviews', 'global_settings', settings);
      return NextResponse.json({
        success: true,
        settings: updatedSettings,
        message: 'Review moderation settings updated successfully.',
      });
    }

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Review ID is required.' },
        { status: 400 }
      );
    }

    const updated = moderateReview(id, { status, adminReply });
    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Review not found.' },
        { status: 404 }
      );
    }

    logAdminAction('MODERATE_REVIEW', 'reviews', id, { status, adminReply });

    try {
      await dispatchNotificationEvent({
        eventKey: 'REVIEW_MODERATED',
        customerEmail: updated.customerEmail,
        customerName: updated.customerName,
        entityType: 'REVIEW',
        entityId: updated.id,
        extraVars: {
          product_title: updated.productTitle,
          review_rating: updated.rating,
          review_comment: adminReply || updated.comment,
          review_status: updated.status,
          customer_name: updated.customerName,
          customer_email: updated.customerEmail || '',
          action_url: getProductShareUrl(updated.productSlug, req),
          activity_summary: `Your review for ${updated.productTitle} is now marked ${updated.status}.${adminReply ? ` Store reply: "${adminReply}"` : ''}`,
        },
      });
    } catch (notifyErr) {
      console.error('[api/admin/reviews] non-blocking REVIEW_MODERATED notification error:', notifyErr);
    }

    return NextResponse.json({
      success: true,
      review: updated,
      message: 'Review updated successfully.',
    });
  } catch (err: any) {
    console.error('Admin reviews PUT error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to update review' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Review ID is required.' },
        { status: 400 }
      );
    }

    const ok = deleteReview(id);
    if (!ok) {
      return NextResponse.json(
        { success: false, error: 'Review not found or already deleted.' },
        { status: 404 }
      );
    }

    logAdminAction('DELETE_REVIEW', 'reviews', id, {});

    return NextResponse.json({
      success: true,
      message: 'Review permanently deleted.',
    });
  } catch (err: any) {
    console.error('Admin reviews DELETE error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to delete review' },
      { status: 500 }
    );
  }
}
