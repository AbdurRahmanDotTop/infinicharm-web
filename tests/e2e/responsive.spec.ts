import { test, expect } from '@playwright/test';

test.describe('Storefront & Admin Responsive Viewport Audits', () => {
  test('homepage renders cleanly without horizontal overflow', async ({ page }) => {
    await page.goto('/');

    // Check brand title
    const brandHeading = page.locator('h1');
    await expect(brandHeading).toBeVisible();
    await expect(brandHeading).toContainText('Pure Harvests');

    // Check no horizontal overflow
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalScroll).toBe(false);

    // Verify all 5 approved categories are accessible in homepage Shop by Category grid
    const categorySlugs = await page
      .locator('main a[href^="/shop?category="]')
      .evaluateAll((els) => Array.from(new Set(els.map((el) => el.getAttribute('href')))));
    expect(categorySlugs.length).toBe(5);
  });

  test('admin login portal renders with secure credentials prompt', async ({ page }) => {
    await page.goto('/admin/login');

    const adminHeading = page.locator('h1');
    await expect(adminHeading).toBeVisible();
    await expect(adminHeading).toContainText('Sign In to Admin Center');

    // Check test credentials helper is present in dev
    const devHelp = page.locator('text=admin@infinicharm.com');
    await expect(devHelp).toBeVisible();
  });
});

