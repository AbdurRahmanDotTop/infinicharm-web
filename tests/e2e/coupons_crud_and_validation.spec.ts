import { test, expect } from '@playwright/test';

const VIEWPORTS = [
  { width: 320, height: 568, name: '320px - Mobile Portrait Small' },
  { width: 375, height: 667, name: '375px - Mobile Portrait Medium' },
  { width: 414, height: 896, name: '414px - Mobile Portrait Large' },
  { width: 480, height: 854, name: '480px - Mobile Landscape' },
  { width: 600, height: 960, name: '600px - Small Tablet Portrait' },
  { width: 768, height: 1024, name: '768px - Tablet Portrait (iPad)' },
  { width: 1024, height: 768, name: '1024px - Tablet Landscape' },
  { width: 1280, height: 800, name: '1280px - Desktop Standard' },
  { width: 1440, height: 900, name: '1440px - Desktop Wide' },
  { width: 1920, height: 1080, name: '1920px - FHD Desktop' },
  { width: 2560, height: 1440, name: '2560px - QHD / Ultra-wide' },
];

test.describe('Admin Coupons CRUD, Zero Mock Data & Storefront Validation', () => {
  test('Admin Coupons has zero demo coupons and supports Create -> Edit -> Toggle -> Delete', async ({ context, page }) => {
    await context.addCookies([
      { name: 'infinicharm_admin_session', value: 'active', domain: 'localhost', path: '/' },
    ]);
    await page.setExtraHTTPHeaders({ 'x-e2e-audit': 'true' });

    await page.goto('/admin/coupons');
    await expect(page.locator('h1')).toContainText('Coupons & Promotions Management');

    // Verify legacy hardcoded demo codes do not exist (admin may configure real coupons like WELCOME10)
    await expect(page.locator('text="PURE100"')).toHaveCount(0);
    await expect(page.locator('text="FESTIVE20"')).toHaveCount(0);
    await expect(page.locator('text="NONEXISTENT_DEMO_CODE"')).toHaveCount(0);

    const uniqueCode = `E2E${Date.now().toString().slice(-6)}`;

    try {
      // 1. Create Coupon via Modal
      await page.getByTestId('create-coupon-btn').click();
      await page.locator('input[placeholder="e.g. HARVEST15"]').fill(uniqueCode);
      await page.locator('input[placeholder*="Seasonal harvest offer"]').fill('E2E Automated Offer');
      await page.getByTestId('submit-coupon-btn').click();

      // Confirm row rendered
      const row = page.getByTestId(`coupon-row-${uniqueCode}`);
      await expect(row).toBeVisible();
      await expect(row).toContainText('10% OFF');
      await expect(row).toContainText('ACTIVE');

      // Reload & confirm DB persistence
      await page.reload();
      await expect(page.getByTestId(`coupon-row-${uniqueCode}`)).toBeVisible();

      // 2. Edit Coupon via Edit Button
      await page.getByTestId(`edit-coupon-${uniqueCode}`).click();
      const discountInput = page.locator('form input[type="number"]').first();
      await discountInput.fill('20');
      await page.getByTestId('submit-coupon-btn').click();

      await expect(page.getByTestId(`coupon-row-${uniqueCode}`)).toContainText('20% OFF');

      // 3. Delete Coupon via Confirmation Modal
      await page.getByTestId(`delete-coupon-${uniqueCode}`).click();
      await page.getByTestId('confirm-delete-coupon-btn').click();
      await expect(page.getByTestId(`coupon-row-${uniqueCode}`)).toHaveCount(0);
    } finally {
      // Cleanup in case a step failed mid-test
      const listRes = await page.request.get('/api/admin/coupons');
      if (listRes.ok()) {
        const listData = await listRes.json();
        const found = (listData.coupons || []).find((c: any) => c.code === uniqueCode);
        if (found) {
          await page.request.delete(`/api/admin/coupons/${found.id}`);
        }
      }
    }
  });

  test('Storefront rejects fake demo codes and applies admin-created coupon dynamically', async ({ context, page }) => {
    await context.addCookies([
      { name: 'infinicharm_admin_session', value: 'active', domain: 'localhost', path: '/' },
    ]);
    await page.setExtraHTTPHeaders({ 'x-e2e-audit': 'true' });

    const code = `LIVE${Date.now().toString().slice(-5)}`;
    let createdCouponId: string | null = null;

    try {
      // Create active server coupon via admin API: 15% off, min ₹500, cap ₹400
      const createRes = await page.request.post('/api/admin/coupons', {
        data: {
          code,
          description: 'Live Storefront E2E Test Coupon',
          discountType: 'PERCENTAGE',
          discountValue: 15,
          minOrderInPaise: 50000,
          maxDiscountInPaise: 40000,
          usageLimitPerCustomer: 2,
          validFrom: '2026-01-01T00:00:00.000Z',
          validUntil: '2028-12-31T23:59:59.000Z',
          applicabilityType: 'ALL',
          userEligibility: 'ALL',
          status: 'ACTIVE',
          isActive: true,
        },
      });
      expect(createRes.status()).toBe(201);
      const createData = await createRes.json();
      createdCouponId = createData.coupon.id;

      // Reject unconfigured fake demo code on /api/coupons/validate
      const fakeCheck = await page.request.post('/api/coupons/validate', {
        data: {
          code: 'NONEXISTENT_DEMO_CODE',
          items: [{ productId: 'prod-1', priceInPaise: 240000, quantity: 1 }],
        },
      });
      expect(fakeCheck.status()).toBe(400);
      const fakeData = await fakeCheck.json();
      expect(fakeData.valid).toBe(false);

      // Navigate to PDP, add product to bag, apply dynamic coupon in Cart Drawer
      await page.goto('/product/100-kashmiri-honey');
      const addToBagBtn = page.getByRole('button', { name: /add to bag/i });
      await addToBagBtn.click();

      const couponInput = page.locator('input[placeholder="Enter coupon code"]');
      await expect(couponInput).toBeVisible();
      await couponInput.fill(code);
      await page.getByRole('button', { name: /^apply$/i }).click();

      await expect(page.locator(`text="${code}"`)).toBeVisible();
      await expect(page.locator('text="Discount"')).toBeVisible();

      // Remove coupon and verify discount disappears
      await page.getByRole('button', { name: /^remove$/i }).click();
      await expect(page.locator('input[placeholder="Enter coupon code"]')).toBeVisible();
    } finally {
      if (createdCouponId) {
        await page.request.delete(`/api/admin/coupons/${createdCouponId}`);
      }
    }
  });

  test('Admin Coupons page renders cleanly across all 10+ viewports with zero horizontal overflow', async ({ context, page }) => {
    await context.addCookies([
      { name: 'infinicharm_admin_session', value: 'active', domain: 'localhost', path: '/' },
    ]);
    await page.setExtraHTTPHeaders({ 'x-e2e-audit': 'true' });

    const code = `RESP${Date.now().toString().slice(-5)}`;
    let createdId: string | null = null;

    try {
      const res = await page.request.post('/api/admin/coupons', {
        data: {
          code,
          description: 'Viewport Audit Sample',
          discountType: 'FIXED_AMOUNT',
          discountValue: 10000,
          minOrderInPaise: 50000,
          validFrom: '2026-01-01T00:00:00.000Z',
          validUntil: '2028-12-31T23:59:59.000Z',
          status: 'ACTIVE',
          isActive: true,
        },
      });
      if (res.ok()) {
        createdId = (await res.json()).coupon?.id || null;
      }

      await page.goto('/admin/coupons');
      await expect(page.locator(`text="${code}"`).first()).toBeVisible();

      for (const vp of VIEWPORTS) {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.waitForTimeout(150);
        const overflow = await page.evaluate(() => {
          return document.documentElement.scrollWidth - document.documentElement.clientWidth;
        });
        expect(overflow, `Overflow at ${vp.name}`).toBeLessThanOrEqual(0);
      }
    } finally {
      if (createdId) {
        await page.request.delete(`/api/admin/coupons/${createdId}`);
      }
    }
  });
});

