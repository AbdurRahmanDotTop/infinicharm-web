import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateProductSalesMetrics,
  sortProductsByBestSelling,
} from '../../src/lib/services/sales.ts';
import {
  getHomepageSections,
  getHomepageSectionById,
  updateHomepageSection,
  toggleHomepageSection,
  reorderHomepageSections,
} from '../../src/lib/server/homepage-store.ts';
import type { Order, Product } from '../../src/types/index.ts';

const mockProducts: Product[] = [
  {
    id: 'prod-honey-01',
    slug: '100-kashmiri-honey',
    title: '100% Kashmiri Honey',
    brand: 'InfiniCharm',
    originCountry: 'India',
    status: 'PUBLISHED',
    isFeatured: true,
    isNewArrival: false,
    displayOrder: 1,
    categoryId: 'cat-honey',
    variants: [{ id: 'var-honey-1', productId: 'prod-honey-01', sku: 'HON-500', title: '500g', priceInPaise: 240000, stockQuantity: 50, lowStockThreshold: 10, weightInGrams: 500, isActive: true, attributes: {} }],
    media: [{ id: 'm1', externalUrl: 'https://images.unsplash.com/honey', mediaType: 'IMAGE', provider: 'UNSPLASH', mimeType: 'image/jpeg', altText: 'Honey', role: 'PRIMARY' }],
  },
  {
    id: 'prod-zamzam-02',
    slug: 'zamzam-water-5-litres',
    title: 'Zamzam Water 5 Litres',
    brand: 'InfiniCharm',
    originCountry: 'Saudi Arabia',
    status: 'PUBLISHED',
    isFeatured: true,
    isNewArrival: false,
    displayOrder: 2,
    categoryId: 'cat-zamzam-water',
    variants: [{ id: 'var-zamzam-1', productId: 'prod-zamzam-02', sku: 'ZAM-5L', title: '5L', priceInPaise: 600000, stockQuantity: 40, lowStockThreshold: 5, weightInGrams: 5000, isActive: true, attributes: {} }],
    media: [{ id: 'm2', externalUrl: 'https://images.unsplash.com/zamzam', mediaType: 'IMAGE', provider: 'EXTERNAL_DIRECT', mimeType: 'image/jpeg', altText: 'Zamzam', role: 'PRIMARY' }],
  },
  {
    id: 'prod-talbeena-03',
    slug: 'takmeeli-talbeena',
    title: 'Takmeeli Talbeena',
    brand: 'InfiniCharm',
    originCountry: 'India',
    status: 'PUBLISHED',
    isFeatured: false,
    isNewArrival: true,
    displayOrder: 3,
    categoryId: 'cat-takmeeli-talbeena',
    variants: [{ id: 'var-talbeena-1', productId: 'prod-talbeena-03', sku: 'TAL-1KG', title: '4x250g', priceInPaise: 30000, stockQuantity: 100, lowStockThreshold: 10, weightInGrams: 1000, isActive: true, attributes: {} }],
    media: [{ id: 'm3', externalUrl: 'https://images.unsplash.com/talbeena', mediaType: 'IMAGE', provider: 'EXTERNAL_DIRECT', mimeType: 'image/jpeg', altText: 'Talbeena', role: 'PRIMARY' }],
  },
] as unknown as Product[];

const mockOrders: Order[] = [
  // Order 1: Completed, 3 units of Zamzam, 1 unit of Honey
  {
    id: 'ord-001',
    orderNumber: 'INF-202611-0001',
    customerId: 'cust-01',
    customerEmail: 'buyer1@example.com',
    status: 'DELIVERED',
    paymentStatus: 'PAID',
    paymentMethod: 'UPI',
    items: [
      { id: 'item-1', orderId: 'ord-001', productId: 'prod-zamzam-02', variantId: 'var-zamzam-1', productTitle: 'Zamzam', variantTitle: '5L', sku: 'ZAM-5L', quantity: 3, priceInPaise: 600000, totalInPaise: 1800000 },
      { id: 'item-2', orderId: 'ord-001', productId: 'prod-honey-01', variantId: 'var-honey-1', productTitle: 'Honey', variantTitle: '500g', sku: 'HON-500', quantity: 1, priceInPaise: 240000, totalInPaise: 240000 },
    ],
    createdAt: '2026-11-20T10:00:00.000Z',
    updatedAt: '2026-11-20T10:00:00.000Z',
  },
  // Order 2: Processing, 2 units of Zamzam
  {
    id: 'ord-002',
    orderNumber: 'INF-202611-0002',
    customerId: 'cust-02',
    customerEmail: 'buyer2@example.com',
    status: 'PROCESSING',
    paymentStatus: 'PAID',
    paymentMethod: 'PREPAID',
    items: [
      { id: 'item-3', orderId: 'ord-002', productId: 'prod-zamzam-02', variantId: 'var-zamzam-1', productTitle: 'Zamzam', variantTitle: '5L', sku: 'ZAM-5L', quantity: 2, priceInPaise: 600000, totalInPaise: 1200000 },
    ],
    createdAt: '2026-11-21T10:00:00.000Z',
    updatedAt: '2026-11-21T10:00:00.000Z',
  },
  // Order 3: CANCELLED (Must be excluded from sales metrics!)
  {
    id: 'ord-003',
    orderNumber: 'INF-202611-0003',
    customerId: 'cust-03',
    customerEmail: 'buyer3@example.com',
    status: 'CANCELLED',
    paymentStatus: 'REFUNDED',
    paymentMethod: 'UPI',
    items: [
      { id: 'item-4', orderId: 'ord-003', productId: 'prod-honey-01', variantId: 'var-honey-1', productTitle: 'Honey', variantTitle: '500g', sku: 'HON-500', quantity: 10, priceInPaise: 240000, totalInPaise: 2400000 },
    ],
    createdAt: '2026-11-21T12:00:00.000Z',
    updatedAt: '2026-11-21T12:00:00.000Z',
  },
  // Order 4: PAYMENT_NOT_RECEIVED (Must be excluded from sales metrics!)
  {
    id: 'ord-004',
    orderNumber: 'INF-202611-0004',
    customerId: 'cust-04',
    customerEmail: 'buyer4@example.com',
    status: 'PAYMENT_NOT_RECEIVED',
    paymentStatus: 'FAILED',
    paymentMethod: 'CUSTOM_UPI',
    items: [
      { id: 'item-5', orderId: 'ord-004', productId: 'prod-talbeena-03', variantId: 'var-talbeena-1', productTitle: 'Talbeena', variantTitle: '1KG', sku: 'TAL-1KG', quantity: 20, priceInPaise: 30000, totalInPaise: 600000 },
    ],
    createdAt: '2026-11-21T14:00:00.000Z',
    updatedAt: '2026-11-21T14:00:00.000Z',
  },
] as unknown as Order[];

test('Best-Selling Products & Sales Calculation Engine', async (t) => {
  await t.test('calculates units sold strictly from valid orders, excluding cancelled and failed', () => {
    const metrics = calculateProductSalesMetrics(mockOrders);

    // Zamzam Water: 3 + 2 = 5 units sold
    assert.equal(metrics.get('prod-zamzam-02')?.unitsSold, 5);
    assert.equal(metrics.get('prod-zamzam-02')?.orderCount, 2);

    // Kashmiri Honey: 1 unit sold (cancelled order of 10 units excluded!)
    assert.equal(metrics.get('prod-honey-01')?.unitsSold, 1);
    assert.equal(metrics.get('prod-honey-01')?.orderCount, 1);

    // Takmeeli Talbeena: 0 units (failed order of 20 units excluded!)
    assert.equal(metrics.get('prod-talbeena-03')?.unitsSold || 0, 0);
  });

  await t.test('ranks products in descending order of actual units sold', () => {
    const metrics = calculateProductSalesMetrics(mockOrders);
    const ranked = sortProductsByBestSelling(mockProducts, metrics, 99);

    assert.equal(ranked.length, 3);
    // #1 must be Zamzam (5 units sold)
    assert.equal(ranked[0].id, 'prod-zamzam-02');
    // #2 must be Honey (1 unit sold)
    assert.equal(ranked[1].id, 'prod-honey-01');
    // #3 must be Talbeena (0 units sold)
    assert.equal(ranked[2].id, 'prod-talbeena-03');
  });

  await t.test('respects configurable product limit', () => {
    const metrics = calculateProductSalesMetrics(mockOrders);
    const top1 = sortProductsByBestSelling(mockProducts, metrics, 1);
    assert.equal(top1.length, 1);
    assert.equal(top1[0].id, 'prod-zamzam-02');

    const top2 = sortProductsByBestSelling(mockProducts, metrics, 2);
    assert.equal(top2.length, 2);
    assert.equal(top2[0].id, 'prod-zamzam-02');
    assert.equal(top2[1].id, 'prod-honey-01');
  });

  await t.test('safely handles empty orders with zero mock data and deterministic tie-breaker', () => {
    const emptyMetrics = calculateProductSalesMetrics([]);
    const ranked = sortProductsByBestSelling(mockProducts, emptyMetrics, 99);
    assert.equal(ranked.length, 3);
    assert.equal(ranked[0].id, 'prod-honey-01'); // displayOrder 1
    assert.equal(ranked[1].id, 'prod-zamzam-02'); // displayOrder 2
    assert.equal(ranked[2].id, 'prod-talbeena-03'); // displayOrder 3
  });
});

test('Homepage CMS Sections & Best-Selling Placement Authority', async (t) => {
  await t.test('homepage sections contains sec-best-sellers strictly before sec-departments', () => {
    const sections = getHomepageSections();
    assert.ok(Array.isArray(sections));
    assert.ok(sections.length >= 2);

    const bestSellers = sections.find((s) => s.id === 'sec-best-sellers');
    const departments = sections.find((s) => s.id === 'sec-departments');

    assert.ok(bestSellers, 'sec-best-sellers must exist in homepage sections');
    assert.ok(departments, 'sec-departments must exist in homepage sections');

    assert.equal(bestSellers?.type, 'best_sellers');
    assert.equal(bestSellers?.isEnabled, true);
    assert.equal(bestSellers?.config?.productLimit, 99);
    assert.equal(bestSellers?.config?.buttonText, 'Add to Bag');

    // Strictly placed before "Shop by Approved Categories"
    assert.ok(
      (bestSellers?.displayOrder || 0) < (departments?.displayOrder || 0),
      `Best-Sellers displayOrder (${bestSellers?.displayOrder}) must be strictly less than Departments (${departments?.displayOrder})`
    );
  });

  await t.test('getHomepageSectionById returns authoritative section details', () => {
    const sec = getHomepageSectionById('sec-best-sellers');
    assert.ok(sec);
    assert.equal(sec?.title, 'Best-Selling Products');
    assert.equal(sec?.badge, 'TOP RATED & MOST LOVED');
  });

  await t.test('toggleHomepageSection toggles visibility state reliably', () => {
    const original = getHomepageSectionById('sec-best-sellers');
    assert.ok(original);

    // Toggle off
    const toggleOff = toggleHomepageSection('sec-best-sellers', false);
    assert.equal(toggleOff.success, true);
    assert.equal(toggleOff.section?.isEnabled, false);

    // Toggle on
    const toggleOn = toggleHomepageSection('sec-best-sellers', true);
    assert.equal(toggleOn.success, true);
    assert.equal(toggleOn.section?.isEnabled, true);
  });

  await t.test('updateHomepageSection updates configuration and CTA button text', () => {
    const updated = updateHomepageSection('sec-best-sellers', {
      config: {
        productLimit: 50,
        buttonText: 'Add to Cart',
        selectionMode: 'sales',
      },
    });

    assert.equal(updated.success, true);
    assert.equal(updated.section?.config?.productLimit, 50);
    assert.equal(updated.section?.config?.buttonText, 'Add to Cart');

    // Restore to standard 99 and "Add to Bag"
    const restored = updateHomepageSection('sec-best-sellers', {
      config: {
        productLimit: 99,
        buttonText: 'Add to Bag',
        selectionMode: 'sales',
      },
    });
    assert.equal(restored.success, true);
    assert.equal(restored.section?.config?.productLimit, 99);
    assert.equal(restored.section?.config?.buttonText, 'Add to Bag');
  });
});
