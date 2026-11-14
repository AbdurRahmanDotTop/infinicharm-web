// ==============================================================================
// InfiniCharm — Verified Purchase Review Moderation Service
// Governing PRD: PRD 11 (Customer Account Portal, Verified Reviews & Live Support)
// Invariant: Zero Fake Reviews — Strictly requires a verified DELIVERED purchase
// ==============================================================================

import type { Order, Review } from '../../types/index.ts';

export interface ReviewValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Checks whether a customer is authorized to review a product.
 * Enforces PRD 11 Section 3.1: Only customers with a verified DELIVERED purchase may review.
 */
export function canCustomerReviewProduct(
  customerId: string,
  productId: string,
  customerOrders: Order[],
  options?: {
    customerEmail?: string;
    customerPhone?: string;
    productSlug?: string;
    productSku?: string;
    productTitle?: string;
    requireDeliveredStatus?: boolean;
  }
): {
  canReview: boolean;
  reason?: string;
  order?: Order;
  orderNumber?: string;
  orderId?: string;
} {
  if (!customerId || !productId) {
    return { canReview: false, reason: 'Customer ID and Product ID are required' };
  }

  const requireDelivered = options?.requireDeliveredStatus ?? true;
  const targetId = productId.toLowerCase().trim();
  const targetSlug = options?.productSlug?.toLowerCase().trim();
  const targetSku = options?.productSku?.toLowerCase().trim();
  const targetTitle = options?.productTitle?.toLowerCase().trim();
  const targetEmail = options?.customerEmail?.toLowerCase().trim();

  // Find qualifying orders containing the target product
  const qualifyingOrder = customerOrders.find((order) => {
    // 1. Match customer identity
    const matchesCustomer =
      order.customerId === customerId ||
      (targetEmail && order.customerEmail && order.customerEmail.toLowerCase().trim() === targetEmail);

    if (!matchesCustomer) return false;

    // 2. Match order status
    const isStatusValid = requireDelivered
      ? order.status === 'DELIVERED'
      : order.status === 'DELIVERED' ||
        (order.paymentStatus === 'PAID' &&
          ['CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'DELIVERED'].includes(order.status));

    if (!isStatusValid) return false;

    // 3. Match product item
    const hasProduct = order.items.some((item) => {
      const itemProdId = item.productId?.toLowerCase().trim();
      const itemSku = item.sku?.toLowerCase().trim();
      const itemTitle = item.productTitle?.toLowerCase().trim();

      if (itemProdId === targetId || itemSku === targetId) return true;
      if (targetSlug && (itemProdId === targetSlug || itemSku === targetSlug)) return true;
      if (targetSku && (itemProdId === targetSku || itemSku === targetSku)) return true;
      if (targetTitle && itemTitle === targetTitle) return true;
      return false;
    });

    return hasProduct;
  });

  if (!qualifyingOrder) {
    return {
      canReview: false,
      reason: 'Only customers who have purchased and received this item can submit a review.',
    };
  }

  return {
    canReview: true,
    order: qualifyingOrder,
    orderNumber: qualifyingOrder.orderNumber,
    orderId: qualifyingOrder.id,
  };
}

/**
 * Validates review submission inputs.
 */
export function validateReviewSubmission(
  rating: number,
  comment: string,
  title?: string
): ReviewValidationResult {
  const errors: string[] = [];

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    errors.push('Rating must be an integer between 1 and 5 stars.');
  }

  if (!comment || comment.trim().length < 10) {
    errors.push('Review comment must be at least 10 characters long.');
  }

  if (title && title.trim().length > 100) {
    errors.push('Review title cannot exceed 100 characters.');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

