import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  getShippingSettings,
  updateShippingSettings,
  DEFAULT_SHIPPING_SETTINGS,
} from '../../src/lib/server/shipping-store.ts';
import {
  calculateCartTotals,
  FREE_SHIPPING_THRESHOLD_PAISE,
  STANDARD_SHIPPING_FEE_PAISE,
  EXPRESS_SHIPPING_FEE_PAISE,
} from '../../src/lib/services/pricing.ts';
import { getStorefrontBadges } from '../../src/lib/server/storefront-badges-store.ts';

describe('Centralized Shipping Settings Authority', () => {
  it('loads authoritative shipping settings with ₹4,999 free shipping threshold', () => {
    const settings = getShippingSettings();
    assert.strictEqual(settings.freeShippingEnabled, true);
    assert.strictEqual(settings.freeShippingThresholdPaise, 499900);
    assert.strictEqual(settings.freeShippingThresholdRupees, 4999);
    assert.strictEqual(settings.standardShippingFeePaise, 6000);
    assert.strictEqual(settings.standardShippingFeeRupees, 60);
    assert.strictEqual(settings.expressShippingFeePaise, 15000);
    assert.strictEqual(settings.expressShippingFeeRupees, 150);
  });

  it('updates shipping settings and returns synchronized paise and rupees values', () => {
    const updateRes = updateShippingSettings({
      freeShippingThresholdRupees: 4999,
      standardShippingFeeRupees: 60,
      expressShippingFeeRupees: 150,
      freeShippingEnabled: true,
    });
    assert.strictEqual(updateRes.success, true);
    assert.strictEqual(updateRes.settings.freeShippingThresholdPaise, 499900);
    assert.strictEqual(updateRes.settings.standardShippingFeePaise, 6000);
    assert.strictEqual(updateRes.settings.expressShippingFeePaise, 15000);
  });

  it('financial engine enforces ₹4,999 threshold for free standard shipping', () => {
    assert.strictEqual(FREE_SHIPPING_THRESHOLD_PAISE, 499900);
    assert.strictEqual(STANDARD_SHIPPING_FEE_PAISE, 6000);
    assert.strictEqual(EXPRESS_SHIPPING_FEE_PAISE, 15000);

    // Below ₹4,999: ₹3,000 subtotal (300000 paise) -> charges standard ₹60 (6000 paise)
    const belowItems = [
      { variantId: 'v-1', priceInPaise: 300000, quantity: 1, categorySlug: 'honey' },
    ];
    const belowTotals = calculateCartTotals(belowItems, null, 'Bihar');
    assert.strictEqual(belowTotals.subtotalInPaise, 300000);
    assert.strictEqual(belowTotals.isFreeShipping, false);
    assert.strictEqual(belowTotals.shippingInPaise, 6000);
    assert.strictEqual(belowTotals.amountNeededForFreeShippingPaise, 199900); // Need ₹1,999 more
    assert.strictEqual(belowTotals.totalInPaise, 306000); // ₹3,060.00

    // At ₹4,999: subtotal 499900 paise -> unlocks free shipping
    const atItems = [
      { variantId: 'v-2', priceInPaise: 499900, quantity: 1, categorySlug: 'honey' },
    ];
    const atTotals = calculateCartTotals(atItems, null, 'Bihar');
    assert.strictEqual(atTotals.subtotalInPaise, 499900);
    assert.strictEqual(atTotals.isFreeShipping, true);
    assert.strictEqual(atTotals.shippingInPaise, 0);
    assert.strictEqual(atTotals.amountNeededForFreeShippingPaise, 0);
    assert.strictEqual(atTotals.totalInPaise, 499900);
  });

  it('storefront badges store reflects ₹4,999 threshold', () => {
    const badges = getStorefrontBadges();
    const shippingBadge = badges.find(
      (b) => b.key === 'free_shipping' || b.id === 'badge-free-shipping'
    );
    assert(shippingBadge, 'Shipping badge must be registered');
    assert(shippingBadge.title.includes('4,999') || shippingBadge.title.includes('4999'));
    assert.strictEqual(shippingBadge.thresholdRupees, 4999);
  });
});
