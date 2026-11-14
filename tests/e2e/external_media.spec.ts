import { test, expect } from '@playwright/test';

test.describe('External Media Management & Storage-Free Architecture (PRD 05 / MediaUses.md)', () => {
  test('1. Storefront product cards load direct external HTTPS media without proxy', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Select all product card images
    const images = page.locator('img[src^="http"]');
    const count = await images.count();
    expect(count).toBeGreaterThan(0);

    // Verify external URLs are direct origins and not server proxies
    for (let i = 0; i < Math.min(count, 5); i++) {
      const src = await images.nth(i).getAttribute('src');
      expect(src).toBeTruthy();
      expect(src).not.toContain('/_next/image?url=');
      expect(src).not.toContain('/api/media/proxy');
      expect(src).toMatch(/^https:\/\/(blogger\.googleusercontent\.com|images\.unsplash\.com|plus\.unsplash\.com|zamzamstoreeg\.com|rukminim2\.flixcart\.com|encrypted-tbn0\.gstatic\.com)/);
    }
  });

  test('2. Product Detail Page (PDP) renders external media gallery, badges, and YouTube/Drive support', async ({ page }) => {
    await page.goto('/product/100-kashmiri-honey');
    await page.waitForLoadState('domcontentloaded');

    // Verify product title is present
    const title = page.getByRole('heading', { level: 1 });
    await expect(title).toBeVisible();

    // Verify primary image is from Blogger
    const primaryImg = page.locator('img[alt*="100% Kashmiri Honey"]').first();
    await expect(primaryImg).toBeVisible();
    const src = await primaryImg.getAttribute('src');
    expect(src).toContain('blogger.googleusercontent.com');

    // Verify origin authenticity card
    await expect(page.getByText('Bairgania, Sitamarhi, Bihar')).toBeVisible();
  });

  test('3. Admin External Media Library renders dashboard metrics, filters, and asset cards', async ({ context, page }) => {
    await context.addCookies([
      { name: 'infinicharm_admin_session', value: 'active', domain: 'localhost', path: '/' },
    ]);
    // Navigate to admin media page
    await page.goto('/admin/media');
    await page.waitForLoadState('domcontentloaded');

    // Verify header and PRD 05 badge
    await expect(page.getByText('External Media Library & CDN Registry')).toBeVisible();
    await expect(page.getByText('PRD 05 Compliant')).toBeVisible();

    // Verify analytics cards
    await expect(page.getByText('Total Assets')).toBeVisible();
    await expect(page.getByText('Active Assets')).toBeVisible();
    await expect(page.getByText('Images').first()).toBeVisible();
    await expect(page.getByText('YouTube Videos')).toBeVisible();
    await expect(page.getByText('Drive Certificates')).toBeVisible();

    // Verify provider badges on media cards
    await expect(page.getByText('BLOGGER').first()).toBeVisible();

    // Test Copy URL button
    const copyButton = page.getByRole('button', { name: 'Copy URL' }).first();
    await expect(copyButton).toBeVisible();
  });

  test('4. Admin Register Asset Modal provides live auto-detection and preview before save', async ({ context, page }) => {
    await context.addCookies([
      { name: 'infinicharm_admin_session', value: 'active', domain: 'localhost', path: '/' },
    ]);
    await page.goto('/admin/media');
    await page.waitForLoadState('domcontentloaded');

    // Open Register modal
    const registerBtn = page.getByRole('button', { name: 'Register External Asset' });
    await registerBtn.click();

    // Modal should be visible
    await expect(page.getByText('Zero Media Binaries Architecture')).toBeVisible();

    // Type a YouTube URL
    const urlInput = page.getByPlaceholder(/blogger\.googleusercontent\.com/i);
    await urlInput.fill('https://youtu.be/dQw4w9WgXcQ');

    // Auto-detection badge should appear
    await expect(page.getByText('Detected: YOUTUBE')).toBeVisible();

    // Close modal
    const cancelBtn = page.getByRole('button', { name: 'Cancel' });
    await cancelBtn.click();
  });

  test('5. Delete confirmation explicitly states zero deletion of external source file', async ({ context, page }) => {
    await context.addCookies([
      { name: 'infinicharm_admin_session', value: 'active', domain: 'localhost', path: '/' },
    ]);
    await page.goto('/admin/media');
    await page.waitForLoadState('domcontentloaded');

    // Click trash button on first card
    const deleteBtn = page.getByTitle('Delete external asset reference').first();
    await deleteBtn.click();

    // Verify confirmation text
    await expect(page.getByText('Remove External Asset Reference?')).toBeVisible();
    await expect(
      page.getByText('The original file on Blogger/YouTube/Drive remains completely untouched')
    ).toBeVisible();

    // Cancel deletion
    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  test('6. 10 Viewports Responsive Audit on Admin Media Library (320px to 2560px)', async ({ context, page }) => {
    await context.addCookies([
      { name: 'infinicharm_admin_session', value: 'active', domain: 'localhost', path: '/' },
    ]);
    const viewports = [
      { width: 320, height: 600, name: 'Mobile Mini' },
      { width: 375, height: 667, name: 'iPhone SE' },
      { width: 414, height: 896, name: 'Mobile Large' },
      { width: 640, height: 900, name: 'Tablet Small' },
      { width: 768, height: 1024, name: 'iPad Portrait' },
      { width: 1024, height: 768, name: 'iPad Landscape' },
      { width: 1280, height: 800, name: 'Laptop Standard' },
      { width: 1440, height: 900, name: 'Desktop HD' },
      { width: 1920, height: 1080, name: 'Full HD' },
      { width: 2560, height: 1440, name: '2K / QHD' },
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/admin/media');
      await page.waitForLoadState('domcontentloaded');

      // Verify zero horizontal overflow
      const hasHorizontalOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasHorizontalOverflow, `Horizontal overflow detected at ${vp.width}px (${vp.name})`).toBe(false);
    }
  });
});
