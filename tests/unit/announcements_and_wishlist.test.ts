// ==============================================================================
// InfiniCharm — Unit Tests: Announcement Bar, Wishlist & Dynamic Real Ratings
// Standards: 100% Real Data, Zero Mock Data, Invariant Enforcement
// ==============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getAnnouncementConfig,
  getActiveAnnouncements,
  createAnnouncementItem,
  updateAnnouncementItem,
  deleteAnnouncementItem,
  setMasterAnnouncementBar,
  reorderAnnouncements,
} from '../../src/lib/server/announcements-store.ts';

import {
  getServerReviews,
  getReviewStats,
  submitCustomerReview,
  moderateReview,
  deleteReview,
} from '../../src/lib/server/reviews-store.ts';

import {
  getServerCustomerById,
  manageCustomerWishlist,
} from '../../src/lib/server/customers-store.ts';

test('Top Announcement Bar Management Engine', async (t) => {
  await t.test('loads valid configuration with master toggle and active items', () => {
    const config = getAnnouncementConfig();
    assert.strictEqual(typeof config.isMasterEnabled, 'boolean');
    assert.ok(Array.isArray(config.items));
    assert.ok(config.items.length >= 4);

    const active = getActiveAnnouncements();
    assert.strictEqual(active.isMasterEnabled, config.isMasterEnabled);
    assert.ok(Array.isArray(active.leftItems));
    assert.ok(Array.isArray(active.rightItems));
  });

  await t.test('creates, updates, and deletes announcement items', () => {
    // Create new item
    const created = createAnnouncementItem({
      type: 'delivery',
      deliveryThresholdInRupees: 699,
      text: 'Special Free Delivery over ₹699',
      position: 'left',
      isEnabled: true,
    });
    assert.ok(created.id);
    assert.strictEqual(created.text, 'Special Free Delivery over ₹699');
    assert.strictEqual(created.deliveryThresholdInRupees, 699);

    // Update item
    const updated = updateAnnouncementItem(created.id, {
      text: 'Updated Flash Shipping Notice',
      isEnabled: false,
    });
    assert.ok(updated);
    assert.strictEqual(updated?.text, 'Updated Flash Shipping Notice');
    assert.strictEqual(updated?.isEnabled, false);

    // Delete item
    const deleted = deleteAnnouncementItem(created.id);
    assert.strictEqual(deleted, true);
  });

  await t.test('reorders items and toggles master visibility', () => {
    const config = getAnnouncementConfig();
    const itemIds = config.items.map((i) => i.id);
    if (itemIds.length >= 2) {
      const reversed = [...itemIds].reverse();
      const reordered = reorderAnnouncements(reversed);
      assert.strictEqual(reordered[0].id, reversed[0]);
    }

    // Toggle master
    const prev = config.isMasterEnabled;
    setMasterAnnouncementBar(!prev);
    const updated = getAnnouncementConfig();
    assert.strictEqual(updated.isMasterEnabled, !prev);

    // Restore
    setMasterAnnouncementBar(prev);
  });
});

test('Customer Wishlist Synchronization & Persistence', async (t) => {
  await t.test('adds, checks, and removes products from customer wishlist', () => {
    const custId = 'cust-01';
    const customer = getServerCustomerById(custId);
    assert.ok(customer, 'Customer cust-01 must exist');

    const testProdId = 'prod-oil-mustard-01';

    // Add to wishlist
    const afterAdd = manageCustomerWishlist(custId, testProdId, 'ADD');
    assert.ok(afterAdd.includes(testProdId));

    // Remove from wishlist
    const afterRemove = manageCustomerWishlist(custId, testProdId, 'REMOVE');
    assert.strictEqual(afterRemove.includes(testProdId), false);
  });
});

test('Real Customer Ratings Calculation & Truthful Zero-State', async (t) => {
  await t.test('correctly calculates dynamic average ratings when reviews exist', () => {
    // Submit test review
    const testReview = submitCustomerReview({
      productId: 'prod-test-rating-01',
      customerName: 'Verified Reviewer',
      rating: 5,
      comment: 'Exceptional purity and authentic cold-pressed aroma from East Champaran.',
      isVerifiedPurchase: true,
    });

    assert.ok(testReview.id);
    assert.strictEqual(testReview.rating, 5);

    const stats = getReviewStats('prod-test-rating-01');
    assert.strictEqual(stats.totalReviews >= 1, true);
    assert.strictEqual(stats.averageRating, 5);
    assert.strictEqual(stats.hasGenuineReviews, true);

    // Cleanup test review
    deleteReview(testReview.id);
    const cleanStats = getReviewStats('prod-test-rating-01');
    assert.strictEqual(cleanStats.totalReviews, 0);
    assert.strictEqual(cleanStats.averageRating, 0);
    assert.strictEqual(cleanStats.hasGenuineReviews, false);
  });
});

