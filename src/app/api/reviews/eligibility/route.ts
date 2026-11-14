import { NextRequest, NextResponse } from 'next/server';
import { resolveAuthenticatedCustomer } from '@/lib/server/customers-store';
import { getServerOrders } from '@/lib/server/orders-store';
import { getServerProductByIdOrSlug } from '@/lib/server/products-store';
import {
  getCustomerReviewForProduct,
  getReviewSettings,
} from '@/lib/server/reviews-store';
import { canCustomerReviewProduct } from '@/lib/services/reviews';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get('productId');

    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'Product ID or slug is required.' },
        { status: 400 }
      );
    }

    const product = getServerProductByIdOrSlug(productId);
    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Product not found.' },
        { status: 404 }
      );
    }

    const customer = resolveAuthenticatedCustomer(req);
    if (!customer) {
      return NextResponse.json({
        success: true,
        authenticated: false,
        eligible: false,
        reason: 'Please sign in to your customer account to submit a verified review.',
        product: {
          id: product.id,
          title: product.title,
          slug: product.slug,
        },
      });
    }

    // Customer is authenticated; check orders
    const allOrders = getServerOrders();
    const settings = getReviewSettings();

    const check = canCustomerReviewProduct(customer.id, product.id, allOrders, {
      customerEmail: customer.email,
      productSlug: product.slug,
      productTitle: product.title,
      requireDeliveredStatus: settings.requireDeliveredStatus,
    });

    const existingReview = getCustomerReviewForProduct(customer.id, product.id);

    return NextResponse.json({
      success: true,
      authenticated: true,
      eligible: check.canReview,
      reason: check.canReview ? undefined : check.reason,
      customer: {
        id: customer.id,
        fullName: customer.fullName,
        email: customer.email,
      },
      product: {
        id: product.id,
        title: product.title,
        slug: product.slug,
      },
      orderNumber: check.orderNumber,
      orderId: check.orderId,
      existingReview,
    });
  } catch (err: any) {
    console.error('Reviews eligibility check error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to check review eligibility' },
      { status: 500 }
    );
  }
}

