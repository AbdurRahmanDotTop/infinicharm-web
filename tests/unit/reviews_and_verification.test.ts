import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  canCustomerReviewProduct,
  validateReviewSubmission,
} from '../../src/lib/services/reviews.ts';
import {
  getReviewStats,
  submitCustomerReview,
  moderateReview,
  deleteReview,
  getServerReviews,
  saveServerReviews,
  getReviewSettings,
  saveReviewSettings,
} from '../../src/lib/server/reviews-store.ts';
import type { Order } from '../../src/types/index.ts';

describe('Customer Product Reviews & Ratings — Purchase Verification System', () => {
  const sampleDeliveredOrder: Order = {
    id: 'ord-unit-deliv',
    orderNumber: 'INF-202611-7788',
    customerId: 'cust-verified-01',
    customerEmail: 'verified.buyer@example.com',
    customerPhone: '9876543210',
    status: 'DELIVERED',
    subtotalInPaise: 240000,
    discountInPaise: 0,
    shippingInPaise: 0,
    taxInPaise: 0,
    totalInPaise: 240000,
    paymentMethod: 'CUSTOM_UPI',
    paymentStatus: 'PAID',
    shippingAddress: {} as any,
    billingAddress: {} as any,
    items: [
      {
        id: 'item-01',
        orderId: 'INF-202611-7788',
        productId: 'S-01-P-01',
        variantId: 'var-01',
        productTitle: '100% Kashmiri Honey – Pure Taste & Natural Sweetness',
        variantTitle: 'Standard Pack',
        sku: 'S-01-P-01',
        priceInPaise: 240000,
        quantity: 1,
        totalInPaise: 240000,
      },
    ],
    timeline: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('1. Backend purchase verification grants review eligibility ONLY for delivered product orders', () => {
    // Eligible: Customer has delivered order containing S-01-P-01
    const eligible = canCustomerReviewProduct(
      'cust-verified-01',
      'S-01-P-01',
      [sampleDeliveredOrder],
      { customerEmail: 'verified.buyer@example.com' }
    );
    assert.strictEqual(eligible.canReview, true);
    assert.strictEqual(eligible.orderNumber, 'INF-202611-7788');
    assert.strictEqual(eligible.orderId, 'ord-unit-deliv');

    // Ineligible: Customer has NOT purchased a different product
    const unpurchased = canCustomerReviewProduct(
      'cust-verified-01',
      'non-existent-product',
      [sampleDeliveredOrder],
      { customerEmail: 'verified.buyer@example.com' }
    );
    assert.strictEqual(unpurchased.canReview, false);
    assert.ok(unpurchased.reason?.includes('purchased and received'));

    // Ineligible: Different customer who has no orders
    const wrongCustomer = canCustomerReviewProduct(
      'cust-impostor-99',
      'S-01-P-01',
      [sampleDeliveredOrder],
      { customerEmail: 'impostor@example.com' }
    );
    assert.strictEqual(wrongCustomer.canReview, false);
  });

  it('2. Enforces order status delivery invariant when requireDeliveredStatus is true', () => {
    const shippedOrder: Order = {
      ...sampleDeliveredOrder,
      id: 'ord-shipped',
      orderNumber: 'INF-202611-7799',
      status: 'SHIPPED',
    };

    // Blocked when status is SHIPPED and strict delivery is required
    const notYetDelivered = canCustomerReviewProduct(
      'cust-verified-01',
      'S-01-P-01',
      [shippedOrder],
      { requireDeliveredStatus: true }
    );
    assert.strictEqual(notYetDelivered.canReview, false);

    // Permitted when requireDeliveredStatus is false and payment is PAID
    const allowedOnPaid = canCustomerReviewProduct(
      'cust-verified-01',
      'S-01-P-01',
      [shippedOrder],
      { requireDeliveredStatus: false }
    );
    assert.strictEqual(allowedOnPaid.canReview, true);
  });

  it('3. Validates review submissions (1-5 stars, min 10 char comments, max 100 char title)', () => {
    const valid = validateReviewSubmission(
      5,
      'Exquisite Kashmiri honey with authentic floral notes.',
      'True Single-Origin Quality'
    );
    assert.strictEqual(valid.isValid, true);
    assert.strictEqual(valid.errors.length, 0);

    const invalidStars = validateReviewSubmission(0, 'A decent comment for testing');
    assert.strictEqual(invalidStars.isValid, false);
    assert.ok(invalidStars.errors.some((e) => e.includes('between 1 and 5')));

    const tooShortComment = validateReviewSubmission(4, 'Too short');
    assert.strictEqual(tooShortComment.isValid, false);
    assert.ok(tooShortComment.errors.some((e) => e.includes('at least 10 characters')));

    const tooLongTitle = validateReviewSubmission(5, 'A valid comment exceeding minimum', 'A'.repeat(120));
    assert.strictEqual(tooLongTitle.isValid, false);
    assert.ok(tooLongTitle.errors.some((e) => e.includes('cannot exceed 100')));
  });

  it('4. Calculates product average rating and distribution dynamically from APPROVED reviews only', () => {
    const originalReviews = getServerReviews();

    try {
      // Clear reviews
      saveServerReviews([]);
      const emptyStats = getReviewStats('S-01-P-01');
      assert.strictEqual(emptyStats.totalReviews, 0);
      assert.strictEqual(emptyStats.averageRating, 0);
      assert.strictEqual(emptyStats.hasGenuineReviews, false);

      // Add 1 Approved (5 stars) and 1 Approved (4 stars)
      submitCustomerReview({
        productId: 'S-01-P-01',
        customerId: 'c1',
        customerName: 'Buyer One',
        rating: 5,
        comment: 'Outstanding quality and rich texture.',
        status: 'APPROVED',
      });

      submitCustomerReview({
        productId: 'S-01-P-01',
        customerId: 'c2',
        customerName: 'Buyer Two',
        rating: 4,
        comment: 'Very tasty and fast shipping experience.',
        status: 'APPROVED',
      });

      // Add 1 REJECTED (1 star) and 1 PENDING (1 star) -> MUST NOT affect public score!
      submitCustomerReview({
        productId: 'S-01-P-01',
        customerId: 'c3',
        customerName: 'Troll Reviewer',
        rating: 1,
        comment: 'Spam review that gets rejected.',
        status: 'REJECTED',
      });

      submitCustomerReview({
        productId: 'S-01-P-01',
        customerId: 'c4',
        customerName: 'Pending Reviewer',
        rating: 1,
        comment: 'Pending review awaiting moderation.',
        status: 'PENDING',
      });

      const stats = getReviewStats('S-01-P-01');
      assert.strictEqual(stats.totalReviews, 2);
      assert.strictEqual(stats.averageRating, 4.5); // (5 + 4) / 2 = 4.5
      assert.strictEqual(stats.hasGenuineReviews, true);
      assert.strictEqual(stats.ratingDistribution[5], 1);
      assert.strictEqual(stats.ratingDistribution[4], 1);
      assert.strictEqual(stats.ratingDistribution[1], 0); // Troll 1-star rejected/pending not in approved distribution
    } finally {
      // Restore reviews
      saveServerReviews(originalReviews);
    }
  });

  it('5. Admin moderation lifecycle (Approve, Reject, Hide, Reply, Delete)', () => {
    const originalReviews = getServerReviews();

    try {
      saveServerReviews([]);
      const review = submitCustomerReview({
        productId: 'S-01-P-01',
        customerId: 'test-cust',
        customerName: 'Moderation Tester',
        rating: 5,
        comment: 'Detailed review to test administrative moderation lifecycle.',
        status: 'PENDING',
      });

      // Initially Pending
      assert.strictEqual(review.status, 'PENDING');
      assert.strictEqual(getReviewStats('S-01-P-01').totalReviews, 0);

      // Admin Approves
      const approved = moderateReview(review.id, { status: 'APPROVED' });
      assert.strictEqual(approved?.status, 'APPROVED');
      assert.strictEqual(getReviewStats('S-01-P-01').totalReviews, 1);

      // Admin Replies
      const replied = moderateReview(review.id, {
        adminReply: 'Thank you for your authentic review!',
      });
      assert.strictEqual(replied?.adminReply, 'Thank you for your authentic review!');
      assert.ok(replied?.adminReplyAt);

      // Admin Hides
      const hidden = moderateReview(review.id, { status: 'HIDDEN' });
      assert.strictEqual(hidden?.status, 'HIDDEN');
      assert.strictEqual(getReviewStats('S-01-P-01').totalReviews, 0); // Hidden excluded from public stats

      // Admin Deletes
      const deleted = deleteReview(review.id);
      assert.strictEqual(deleted, true);
      assert.strictEqual(getServerReviews().length, 0);
    } finally {
      saveServerReviews(originalReviews);
    }
  });
});

