import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  getStorefrontBadges,
  createStorefrontBadge,
  updateStorefrontBadge,
  toggleStorefrontBadge,
  reorderStorefrontBadges,
  deleteStorefrontBadge,
} from '../../src/lib/server/storefront-badges-store.ts';
import {
  getServerProducts,
  saveServerProduct,
} from '../../src/lib/server/products-store.ts';
import { deleteCustomer } from '../../src/lib/server/customers-store.ts';
import fs from 'node:fs';
import path from 'node:path';

describe('Storefront Badges & Guarantees Engine', () => {
  it('loads authoritative default badges including shipping and guarantee', () => {
    const badges = getStorefrontBadges();
    assert(Array.isArray(badges));
    assert(badges.length >= 2);

    const shippingBadge = badges.find((b) => b.key === 'free_shipping' || b.icon === 'Truck');
    assert(shippingBadge, 'Shipping badge must exist');
    assert(shippingBadge.isEnabled === true, 'Default shipping badge must be enabled');

    const guaranteeBadge = badges.find((b) => b.key === 'replacement_guarantee' || b.icon === 'RotateCcw');
    assert(guaranteeBadge, 'Replacement guarantee badge must exist');
    assert(guaranteeBadge.isEnabled === true, 'Default guarantee badge must be enabled');
  });

  it('supports creating, toggling, updating, and reordering badges', () => {
    const testBadge = {
      id: `badge-test-${Date.now()}`,
      key: 'nmr_certified',
      title: '100% NMR Lab Certified',
      subtitle: 'Zero adulteration batch guarantee',
      icon: 'ShieldCheck',
      isEnabled: true,
      displayOrder: 99,
      linkUrl: '/policies/authenticity',
    };

    // Create
    const createRes = createStorefrontBadge(testBadge);
    assert(createRes.success, 'Creating badge must succeed');

    // Toggle
    const toggleRes = toggleStorefrontBadge(testBadge.id);
    assert(toggleRes.success, 'Toggling badge must succeed');
    assert.strictEqual(toggleRes.badge?.isEnabled, false);

    // Toggle back
    const toggleRes2 = toggleStorefrontBadge(testBadge.id);
    assert.strictEqual(toggleRes2.badge?.isEnabled, true);

    // Update
    const updateRes = updateStorefrontBadge(testBadge.id, { title: '100% NMR Certified Batch' });
    assert.strictEqual(updateRes.badge?.title, '100% NMR Certified Batch');

    // Clean up
    const delRes = deleteStorefrontBadge(testBadge.id);
    assert(delRes.success, 'Deleting badge must succeed');
  });
});

describe('Product PDP Dynamic Elements & Overrides', () => {
  it('persists and retrieves customBadge, tagline, highlights, and policy overrides', () => {
    const products = getServerProducts({ admin: true });
    assert(products.length > 0, 'Products catalogue must not be empty');

    const firstProduct = { ...products[0] };
    const originalTagline = firstProduct.tagline;
    const originalHighlights = firstProduct.highlights;
    const originalBadge = firstProduct.customBadge;
    const originalSpecs = firstProduct.specifications;
    const originalRelated = firstProduct.relatedProductIds;

    firstProduct.tagline = 'Specially Harvested Himalayan Reserve';
    firstProduct.customBadge = 'Artisan Reserve';
    firstProduct.customShippingText = 'Same-Day Dispatch with Cold Chain';
    firstProduct.customGuaranteeText = '100% Zero-Breakage Delivery Guarantee';
    firstProduct.returnPolicyText = 'Immediate refund or reshipment if tamper seal is broken.';
    firstProduct.highlights = [
      'Raw Wild Honey from High Altitude Valleys',
      'Tested by Independent NABL Accredited Lab',
      'Packed in UV-Resistant Glass Jars',
    ];
    firstProduct.specifications = [
      { label: 'Pollen Origin', value: 'Multi-Flora Himalayan Flora' },
      { label: 'Moisture Level', value: '< 17.8% (Natural Raw Grade)' },
    ];
    firstProduct.relatedProductIds = ['prod-sample-ref'];

    const saveRes = saveServerProduct(firstProduct);
    assert(saveRes.success, 'Saving product with PDP overrides must succeed');
    assert.strictEqual(saveRes.product?.customBadge, 'Artisan Reserve');
    assert.strictEqual(saveRes.product?.tagline, 'Specially Harvested Himalayan Reserve');
    assert.strictEqual(saveRes.product?.highlights?.length, 3);
    assert.strictEqual(saveRes.product?.specifications?.length, 2);
    assert.deepStrictEqual(saveRes.product?.relatedProductIds, ['prod-sample-ref']);
    assert.strictEqual(saveRes.product?.returnPolicyText, 'Immediate refund or reshipment if tamper seal is broken.');

    // Revert to clean state
    firstProduct.tagline = originalTagline;
    firstProduct.highlights = originalHighlights;
    firstProduct.customBadge = originalBadge;
    firstProduct.specifications = originalSpecs;
    firstProduct.relatedProductIds = originalRelated;
    delete (firstProduct as any).customShippingText;
    delete (firstProduct as any).customGuaranteeText;
    delete (firstProduct as any).returnPolicyText;
    saveServerProduct(firstProduct);
  });
});
