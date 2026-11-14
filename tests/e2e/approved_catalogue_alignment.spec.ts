import { test, expect } from '@playwright/test';

const APPROVED_PRODUCTS = [
  { slug: '100-kashmiri-honey', title: '100% Kashmiri Honey – Pure Taste & Natural Sweetness', price: '₹2,400' },
  { slug: 'zamzam-water-5-litres', title: 'Zamzam Water 5 Litres – Buy Online | InfiniCharm', price: '₹6,000' },
  { slug: 'takmeeli-talbeena', title: 'Takmeeli Talbeena – Traditional Barley Breakfast', price: '₹300' },
  { slug: 'premium-dates-1-kg', title: 'Premium Dates 1 KG – Buy Online at InfiniCharm', price: '₹900' },
];

const APPROVED_CATEGORIES = [
  'Honey',
  'Zamzam Water',
  'Takmeeli Talbeena',
  'Barliva',
  'Premium Dates',
];

const FORBIDDEN_LEGACY_TERMS = [
  'Kachi Ghani',
  'Mustard Oil',
  'Dehn Al Oudh',
  'Ruh Gulab',
  'Mitti Attar',
  'Deg-Bhapka Method',
  'Kannauj Copper Distillery',
  'East Champaran Kolhu',
  'Bhagalpur Handloom',
  'Pulses & Lentils',
  'Clothing & Textiles',
  'Spices & Masala',
];

const VIEWPORTS_10 = [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 414, height: 896 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 2560, height: 1440 },
];

test.describe('Approved Product & Category Catalogue Alignment', () => {
  test('Homepage displays only approved products/categories with zero legacy content', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/', { waitUntil: 'networkidle' });

    const mainScope = page.locator('main');
    const bodyText = await page.locator('body').innerText();

    for (const term of FORBIDDEN_LEGACY_TERMS) {
      expect(bodyText.toLowerCase()).not.toContain(term.toLowerCase());
    }

    for (const cat of APPROVED_CATEGORIES) {
      await expect(mainScope.getByText(cat, { exact: false }).first()).toBeVisible();
    }

    for (const prod of APPROVED_PRODUCTS) {
      await expect(mainScope.getByText(prod.title.split(' – ')[0], { exact: false }).first()).toBeVisible();
    }

    expect(errors).toEqual([]);
  });

  test('/shop and all 4 approved product detail pages render with live CSV images', async ({
    page,
  }) => {
    await page.goto('/shop', { waitUntil: 'networkidle' });

    const shopMain = page.locator('main');
    for (const prod of APPROVED_PRODUCTS) {
      await expect(shopMain.getByText(prod.title, { exact: false }).first()).toBeVisible();
    }

    const shopBody = await page.locator('body').innerText();
    for (const term of FORBIDDEN_LEGACY_TERMS) {
      expect(shopBody.toLowerCase()).not.toContain(term.toLowerCase());
    }

    for (const prod of APPROVED_PRODUCTS) {
      await page.goto(`/product/${prod.slug}`, { waitUntil: 'networkidle' });
      await expect(page.getByRole('heading', { name: prod.title }).first()).toBeVisible();
      await expect(page.getByText(prod.price, { exact: false }).first()).toBeVisible();

      // Primary gallery image must have loaded successfully without CSP/404 blocks
      const loadedImgCount = await page.evaluate(() => {
        const imgs = Array.from(document.querySelectorAll('main img')) as HTMLImageElement[];
        return imgs.filter((img) => img.complete && img.naturalWidth > 0).length;
      });
      expect(loadedImgCount).toBeGreaterThan(0);
    }
  });

  test('APIs serve exactly the 5 approved categories and 4 approved products', async ({
    request,
  }) => {
    const catRes = await request.get('/api/categories');
    expect(catRes.ok()).toBeTruthy();
    const catJson = await catRes.json();
    expect(catJson.categories).toHaveLength(5);

    const prodRes = await request.get('/api/products');
    expect(prodRes.ok()).toBeTruthy();
    const prodJson = await prodRes.json();
    expect(prodJson.products).toHaveLength(4);

    const csvSyncStatusRes = await request.get('/api/admin/categories/sync-csv');
    expect(csvSyncStatusRes.ok()).toBeTruthy();
    const syncJson = await csvSyncStatusRes.json();
    expect(syncJson.availableCsvCategoryCount).toBe(5);
  });

  test('10-Viewport responsiveness audit on homepage & shop (0px overflow)', async ({ page }) => {
    for (const vp of VIEWPORTS_10) {
      await page.setViewportSize(vp);
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      const homeOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(homeOverflow).toBeLessThanOrEqual(0);

      await page.goto('/shop', { waitUntil: 'domcontentloaded' });
      const shopOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(shopOverflow).toBeLessThanOrEqual(0);
    }
  });
});

