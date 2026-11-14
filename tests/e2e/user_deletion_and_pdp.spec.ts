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

test.describe('Order Fulfillment & Deleted User Cleanup Verification', () => {
  test('Admin Orders table contains zero residual [Deleted Customer] records', async ({ context, page }) => {
    // Authenticate as Admin
    await context.addCookies([
      { name: 'infinicharm_admin_session', value: 'active', domain: 'localhost', path: '/' },
    ]);
    await page.setExtraHTTPHeaders({ 'x-e2e-audit': 'true' });

    // Navigate to Admin Orders
    await page.goto('/admin/orders');

    // Confirm heading
    const pageTitle = page.locator('h1');
    await expect(pageTitle).toContainText('Order Fulfillment & Shipments');

    // Confirm that no order has customer name "[Deleted Customer]"
    const deletedCustomerText = page.locator('text="[Deleted Customer]"');
    const count = await deletedCustomerText.count();
    expect(count).toBe(0);
  });
});

test.describe('Storefront Badges & PDP Dynamic Management Verification', () => {
  test('Product detail page dynamically renders active shipping & replacement guarantee badges', async ({ page }) => {
    await page.goto('/product/100-kashmiri-honey');

    // Verify product title
    const heading = page.locator('h1');
    await expect(heading).toContainText('100% Kashmiri Honey');

    // Verify dynamic shipping badge
    const shippingBadge = page.locator('text=/Free Shipping on orders above ₹4,?999/').first();
    await expect(shippingBadge).toBeVisible();

    // Verify dynamic guarantee badge
    const guaranteeBadge = page.locator('text=Transit Damage Replacement Guarantee');
    await expect(guaranteeBadge).toBeVisible();

    // Verify Sourcing & Authenticity Highlights card
    const originHighlight = page.locator('text=Origin:');
    await expect(originHighlight).toBeVisible();
  });

  test('Admin Settings page displays Storefront Badges & Guarantees management hub', async ({ context, page }) => {
    // Authenticate as Admin
    await context.addCookies([
      { name: 'infinicharm_admin_session', value: 'active', domain: 'localhost', path: '/' },
    ]);
    await page.setExtraHTTPHeaders({ 'x-e2e-audit': 'true' });

    await page.goto('/admin/settings');

    // Verify Badges management header
    const badgesHeader = page.locator('text=Storefront Badges & Replacement Guarantees');
    await expect(badgesHeader).toBeVisible();

    // Verify badge controls exist
    const shippingItem = page.locator('text=/Free Shipping on orders above ₹4,?999/').first();
    await expect(shippingItem).toBeVisible();

    const guaranteeItem = page.locator('text=Transit Damage Replacement Guarantee').first();
    await expect(guaranteeItem).toBeVisible();
  });
});

test.describe('10-Viewport Responsive Verification on PDP (320px to 2560px)', () => {
  for (const vp of VIEWPORTS) {
    test(`PDP renders with 0px horizontal overflow on ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/product/100-kashmiri-honey');

      // Wait for product title
      await expect(page.locator('h1')).toBeVisible();

      // Check horizontal overflow
      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth - window.innerWidth;
      });

      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});
