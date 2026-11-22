import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  getServerProducts,
  getServerProductByIdOrSlug,
  saveServerProduct,
  deleteServerProduct,
  updateServerProductStock,
  toggleServerProductStatus,
  duplicateServerProduct,
  bulkUpdateServerProducts,
} from '../../src/lib/server/products-store.ts';
import type { Product } from '../../src/types/index.ts';

describe('Product Management Full CRUD & Pricing Authority Suite', () => {
  const testProductId = `prod-test-crud-${Date.now()}`;
  const testProductSlug = `organic-acacia-honey-test-${Date.now().toString().slice(-4)}`;

  it('enforces Integer Paise Pricing Authority & Strikethrough M.R.P. Precedence', () => {
    const products = getServerProducts({ admin: true });
    assert(products.length > 0, 'Products catalogue must contain baseline products');

    // 100% Kashmiri Honey: Selling = ₹2,400 (240000 paise), M.R.P. = ₹2,800 (280000 paise)
    const honey = products.find((p) => p.slug === '100-kashmiri-honey' || p.id === 'S-01-P-01');
    assert(honey, 'Kashmiri Honey must exist in catalogue');

    const primaryVariant = honey.variants[0];
    assert.strictEqual(primaryVariant.priceInPaise, 240000, 'Selling checkout price must be exactly ₹2,400 (240000 paise)');
    assert.strictEqual(primaryVariant.compareAtPriceInPaise, 280000, 'Original M.R.P. compare-at price must be ₹2,800 (280000 paise)');
    assert(
      primaryVariant.compareAtPriceInPaise! > primaryVariant.priceInPaise,
      'Original M.R.P. must be higher than selling price to render valid discount savings'
    );

    const savingsInPaise = primaryVariant.compareAtPriceInPaise! - primaryVariant.priceInPaise;
    const discountPercent = Math.round((savingsInPaise / primaryVariant.compareAtPriceInPaise!) * 100);
    assert.strictEqual(savingsInPaise, 40000, 'Customer savings must be exactly ₹400.00 (40000 paise)');
    assert.strictEqual(discountPercent, 14, 'Discount percentage must be 14% OFF');
  });

  it('performs Admin CREATE product with integer paise financial authority', () => {
    const newProduct: Product = {
      id: testProductId,
      title: 'Wild Forest Acacia Honey',
      slug: testProductSlug,
      productType: 'simple',
      status: 'PUBLISHED',
      isFeatured: true,
      isNewArrival: false,
      brand: 'InfiniCharm Reserve',
      baseSku: 'INF-ACH-01',
      categoryId: 'cat-honey',
      tags: ['acacia', 'wild-forest', 'raw-honey'],
      shortDescription: 'Certified raw organic acacia honey cold-extracted from pristine Himalayan valleys.',
      fullDescription: 'Single-origin wild acacia harvest bottled in pharmaceutical-grade UV glass jars.',
      originCountry: 'India',
      originRegion: 'Kashmir Valley',
      ingredients: '100% Raw Acacia Honey',
      storageInstructions: 'Store in dry pantry away from direct sunlight.',
      fssaiLicenseNumber: 'FSSAI Lic. No. 10423000001234',
      variants: [
        {
          id: `var-${testProductId}-1`,
          productId: testProductId,
          sku: 'INF-ACH-500G',
          title: '500g Jar',
          priceInPaise: 180000, // ₹1,800 selling price
          compareAtPriceInPaise: 220000, // ₹2,200 M.R.P. (₹400 / 18% OFF)
          costPriceInPaise: 110000, // ₹1,100 cost
          stockQuantity: 40,
          lowStockThreshold: 10,
          weightInGrams: 500,
          isActive: true,
          attributes: {},
        },
      ],
      media: [
        {
          id: `med-${testProductId}-1`,
          provider: 'EXTERNAL_HTTPS',
          externalUrl: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=800&q=80',
          mimeType: 'image/jpeg',
          altText: 'Wild Forest Acacia Honey 500g Jar',
          role: 'PRIMARY',
          displayOrder: 1,
          isActive: true,
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const res = saveServerProduct(newProduct);
    assert(res.success, 'saveServerProduct must succeed');
    assert.strictEqual(res.product?.id, testProductId);
    assert.strictEqual(res.product?.variants[0].priceInPaise, 180000);
    assert.strictEqual(res.product?.variants[0].compareAtPriceInPaise, 220000);
  });

  it('performs Admin READ by ID and Slug with real database persistence', () => {
    const byId = getServerProductByIdOrSlug(testProductId, true);
    assert(byId, 'Product must be found by ID');
    assert.strictEqual(byId?.title, 'Wild Forest Acacia Honey');
    assert.strictEqual(byId?.variants[0].stockQuantity, 40);

    const bySlug = getServerProductByIdOrSlug(testProductSlug, false);
    assert(bySlug, 'Published product must be readable by slug for storefront PDP');
    assert.strictEqual(bySlug?.id, testProductId);
  });

  it('performs Admin UPDATE stock increment and decrement', () => {
    const incRes = updateServerProductStock(testProductId, `var-${testProductId}-1`, 10);
    assert(incRes.success, 'Stock increment must succeed');
    assert.strictEqual(incRes.newStock, 50, 'Stock must increment from 40 to 50');

    const decRes = updateServerProductStock(testProductId, `var-${testProductId}-1`, -5);
    assert(decRes.success, 'Stock decrement must succeed');
    assert.strictEqual(decRes.newStock, 45, 'Stock must decrement from 50 to 45');
  });

  it('performs Admin TOGGLE product status between PUBLISHED and DRAFT', () => {
    const toggle1 = toggleServerProductStatus(testProductId);
    assert(toggle1.success, 'First toggle must succeed');
    assert.strictEqual(toggle1.product?.status, 'DRAFT', 'Status must switch to DRAFT');

    // Verify storefront visibility gate: DRAFT product must NOT be returned to public callers
    const publicQuery = getServerProductByIdOrSlug(testProductId, false);
    assert.strictEqual(publicQuery, null, 'Public callers must never receive DRAFT products');

    // Admin callers CAN view DRAFT product
    const adminQuery = getServerProductByIdOrSlug(testProductId, true);
    assert(adminQuery, 'Admin callers must be able to view DRAFT products');
    assert.strictEqual(adminQuery?.status, 'DRAFT');

    // Toggle back to PUBLISHED
    const toggle2 = toggleServerProductStatus(testProductId);
    assert(toggle2.success, 'Second toggle must succeed');
    assert.strictEqual(toggle2.product?.status, 'PUBLISHED', 'Status must switch back to PUBLISHED');
  });

  it('performs Admin DUPLICATE product into a separate draft clone', () => {
    const dupRes = duplicateServerProduct(testProductId);
    assert(dupRes.success, 'duplicateServerProduct must succeed');
    assert(dupRes.product, 'Cloned product must be returned');

    const clone = dupRes.product;
    assert.strictEqual(clone.status, 'DRAFT', 'Cloned product must start in DRAFT status');
    assert(clone.id.startsWith('prod-copy-'), 'Cloned product must have a copy ID');
    assert(clone.slug.includes('-copy-'), 'Cloned product must have copy slug');
    assert.strictEqual(clone.title, 'Wild Forest Acacia Honey (Copy)');
    assert(clone.variants[0].sku.includes('-COPY-'), 'Variant SKU must include COPY tag');

    // Cleanup the duplicate clone
    const cleanDup = deleteServerProduct(clone.id);
    assert(cleanDup.success, 'Deleting test clone must succeed');
  });

  it('performs Admin BULK operations: status mutation and bulk deletion', () => {
    // 1. Bulk DRAFT
    const bulkDraft = bulkUpdateServerProducts([testProductId], 'DRAFT');
    assert(bulkDraft.success, 'bulkUpdateServerProducts DRAFT must succeed');
    assert.strictEqual(bulkDraft.count, 1);

    const checkDraft = getServerProductByIdOrSlug(testProductId, true);
    assert.strictEqual(checkDraft?.status, 'DRAFT');

    // 2. Bulk PUBLISH
    const bulkPub = bulkUpdateServerProducts([testProductId], 'PUBLISH');
    assert(bulkPub.success, 'bulkUpdateServerProducts PUBLISH must succeed');
    assert.strictEqual(bulkPub.count, 1);

    const checkPub = getServerProductByIdOrSlug(testProductId, true);
    assert.strictEqual(checkPub?.status, 'PUBLISHED');

    // 3. Bulk DELETE
    const bulkDel = bulkUpdateServerProducts([testProductId], 'DELETE');
    assert(bulkDel.success, 'bulkUpdateServerProducts DELETE must succeed');
    assert.strictEqual(bulkDel.count, 1);

    const checkDel = getServerProductByIdOrSlug(testProductId, true);
    assert.strictEqual(checkDel, null, 'Deleted product must no longer exist in catalogue');
  });
});
