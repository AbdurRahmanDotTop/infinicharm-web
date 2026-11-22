import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getProductRecommendations,
  getProductDiscountInfo,
} from '../../src/lib/services/recommendations.ts';
import { getAllProducts } from '../../src/lib/data/products.ts';
import type { Product } from '../../src/types/index.ts';

describe('Product Recommendations & Dynamic Discount System', () => {
  const catalog = getAllProducts(false);

  it('calculates genuine discount percentages and savings for catalog products', () => {
    const honey = catalog.find((p) => p.id === 'S-01-P-01');
    assert.ok(honey, 'Kashmiri Honey exists');

    const discountInfo = getProductDiscountInfo(honey);
    assert.equal(discountInfo.hasDiscount, true);
    assert.equal(discountInfo.priceInPaise, 240000);
    assert.equal(discountInfo.compareAtPriceInPaise, 280000);
    assert.equal(discountInfo.savingsInPaise, 40000);
    assert.equal(discountInfo.discountPercent, 14);
    assert.equal(discountInfo.savingsFormatted, '₹400.00');
    assert.equal(discountInfo.priceFormatted, '₹2,400.00');
    assert.equal(discountInfo.compareAtPriceFormatted, '₹2,800.00');
  });

  it('calculates 25% discount for Takmeeli Talbeena and Premium Dates', () => {
    const talbeena = catalog.find((p) => p.id === 'S-01-P-03');
    assert.ok(talbeena, 'Talbeena exists');
    const talbeenaInfo = getProductDiscountInfo(talbeena);
    assert.equal(talbeenaInfo.hasDiscount, true);
    assert.equal(talbeenaInfo.discountPercent, 25);
    assert.equal(talbeenaInfo.savingsInPaise, 9900);

    const dates = catalog.find((p) => p.id === 'S-01-P-04');
    assert.ok(dates, 'Dates exists');
    const datesInfo = getProductDiscountInfo(dates);
    assert.equal(datesInfo.hasDiscount, true);
    assert.equal(datesInfo.discountPercent, 25);
    assert.equal(datesInfo.savingsInPaise, 30000);
  });

  it('returns complementary recommendations when an item is in cart', () => {
    // If cart has Zamzam Water (S-01-P-02), recommended items should NEVER include Zamzam Water
    const recs = getProductRecommendations({
      cartItems: [{ productId: 'S-01-P-02' }],
      limit: 3,
      catalog,
    });

    assert.ok(recs.length > 0, 'Recommendations returned');
    assert.ok(recs.length <= 3, 'Respects limit');
    assert.equal(
      recs.some((p) => p.id === 'S-01-P-02'),
      false,
      'Does not recommend item already in cart'
    );

    // Natural pairing for Zamzam Water is Premium Dates (S-01-P-04) or Honey (S-01-P-01)
    const recommendedIds = recs.map((p) => p.id);
    assert.ok(
      recommendedIds.includes('S-01-P-04') || recommendedIds.includes('S-01-P-01'),
      'Includes authentic pairing'
    );
  });

  it('excludes multiple items already in the cart and recommends remaining candidates', () => {
    const recs = getProductRecommendations({
      cartItems: [{ productId: 'S-01-P-01' }, { productId: 'S-01-P-02' }],
      limit: 2,
      catalog,
    });

    assert.equal(
      recs.some((p) => p.id === 'S-01-P-01' || p.id === 'S-01-P-02'),
      false,
      'Excludes both cart items'
    );
    assert.ok(recs.length <= 2, 'Respects limit of 2');
  });

  it('gracefully returns an empty array when all products in the catalog are in the cart', () => {
    const allCartItems = catalog.map((p) => ({ productId: p.id }));
    const recs = getProductRecommendations({
      cartItems: allCartItems,
      limit: 3,
      catalog,
    });

    assert.deepEqual(recs, [], 'Returns empty array without mock data');
  });

  it('falls back to isFeatured products when cart is empty', () => {
    const recs = getProductRecommendations({
      cartItems: [],
      limit: 3,
      catalog,
    });

    assert.equal(recs.length, 3, 'Returns 3 recommendations');
    recs.forEach((p) => {
      assert.equal(p.status, 'PUBLISHED', 'All recommended products are published');
    });
  });

  it('excludes target product on PDP product detail page', () => {
    const honey = catalog.find((p) => p.id === 'S-01-P-01')!;
    const recs = getProductRecommendations({
      currentProductId: honey.id,
      limit: 3,
      catalog,
    });

    assert.equal(
      recs.some((p) => p.id === honey.id),
      false,
      'Does not recommend the product currently being viewed'
    );
  });
});
