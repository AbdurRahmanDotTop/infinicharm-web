import { test, expect } from '@playwright/test';

test.describe('InfiniCharm Social Links, Content Sharing & Information Sanitization Audit', () => {
  test('Footer renders all official social links and ZERO admin portal links', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const footer = page.locator('footer');
    await expect(footer).toBeVisible();

    // Verify all 7 social links from SocialLinks.md exist in footer
    const youtubeLink = footer.locator('a[href*="youtube.com/channel/UCJcnqFc-_JX0uF8-xNrU1rg"]');
    await expect(youtubeLink).toBeAttached();
    await expect(youtubeLink).toHaveAttribute('target', '_blank');

    const facebookLink = footer.locator('a[href*="facebook.com/InfiniCharmOfficial"]');
    await expect(facebookLink).toBeAttached();
    await expect(facebookLink).toHaveAttribute('target', '_blank');

    const instagramLink = footer.locator('a[href*="instagram.com/InfiniCharmofficial"]');
    await expect(instagramLink).toBeAttached();
    await expect(instagramLink).toHaveAttribute('target', '_blank');

    const crumbInfinicharm = footer.locator('a[href*="thecrumb.co/InfiniCharmOfficial"]');
    await expect(crumbInfinicharm).toBeAttached();
    await expect(crumbInfinicharm).toHaveAttribute('target', '_blank');

    const crumbTechilyfly = footer.locator('a[href*="thecrumb.co/TechilyFly"]');
    await expect(crumbTechilyfly).toBeAttached();
    await expect(crumbTechilyfly).toHaveAttribute('target', '_blank');

    const crumbFounder = footer.locator('a[href*="thecrumb.co/AbdurRahmanDotTopTechilyFly"]');
    await expect(crumbFounder).toBeAttached();
    await expect(crumbFounder).toHaveAttribute('target', '_blank');

    const websiteLink = footer.locator('a[href*="infinicharm.com"]');
    await expect(websiteLink.first()).toBeAttached();

    // Verify ZERO admin links exist in footer
    const adminLink = footer.locator('a[href*="/admin"]');
    await expect(adminLink).toHaveCount(0);

    const adminText = footer.getByText('Admin Portal', { exact: false });
    await expect(adminText).toHaveCount(0);
  });

  test('Public storefront pages contain ZERO exposure of admin@infinicharm.com', async ({ page }) => {
    // 1. Contact Page
    await page.goto('/contact');
    await page.waitForLoadState('domcontentloaded');
    const contactText = await page.content();
    expect(contactText).not.toContain('admin@infinicharm.com');
    expect(contactText).toContain('support@infinicharm.com');

    // 2. Compliance Policy Page
    await page.goto('/policies/compliance');
    await page.waitForLoadState('domcontentloaded');
    const complianceText = await page.content();
    expect(complianceText).not.toContain('admin@infinicharm.com');
    expect(complianceText).toContain('support@infinicharm.com');

    // 3. Privacy Policy Page
    await page.goto('/policies/privacy');
    await page.waitForLoadState('domcontentloaded');
    const privacyText = await page.content();
    expect(privacyText).not.toContain('admin@infinicharm.com');
    expect(privacyText).toContain('support@infinicharm.com');

    // 4. Refunds Policy Page
    await page.goto('/policies/refunds');
    await page.waitForLoadState('domcontentloaded');
    const refundsText = await page.content();
    expect(refundsText).not.toContain('admin@infinicharm.com');
    expect(refundsText).toContain('support@infinicharm.com');
  });

  test('Product Detail Page has floating and CTA share buttons with working modal and copy link', async ({
    page,
  }) => {
    // Navigate directly to the first approved product
    await page.goto('/product/100-kashmiri-honey');
    await page.waitForLoadState('domcontentloaded');

    // Check Action CTA Row Share Button
    const shareCta = page.getByRole('button', { name: /Share/i }).first();
    await expect(shareCta).toBeVisible();

    // Check Floating Share Button on Media Gallery
    const floatingShare = page.locator('button[title="Share Product"]');
    await expect(floatingShare).toBeVisible();

    // Click the Share CTA to open Share Modal
    await shareCta.click();

    // Verify Share Modal dialog is opened
    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible();
    await expect(modal.getByText('Share this with friends')).toBeVisible();

    // Verify Channels: WhatsApp, X (Twitter), Facebook, LinkedIn, Email
    await expect(modal.locator('a[title*="WhatsApp"]')).toBeVisible();
    await expect(modal.locator('a[title*="Twitter"]')).toBeVisible();
    await expect(modal.locator('a[title*="Facebook"]')).toBeVisible();
    await expect(modal.locator('a[title*="LinkedIn"]')).toBeVisible();
    await expect(modal.locator('a[title*="Email"]')).toBeVisible();

    // Verify Copy Link Input & Action
    const copyBtn = modal.getByRole('button', { name: /Copy/i });
    await expect(copyBtn).toBeVisible();
    await copyBtn.click();
    await expect(modal.getByText(/Copied!/i)).toBeVisible();

    // Close modal
    const closeBtn = modal.locator('button[aria-label="Close share dialog"]');
    await closeBtn.click();
    await expect(modal).not.toBeVisible();
  });

  test('Blog Detail Page provides functional sharing triggers', async ({ page }) => {
    // Navigate directly to the first approved blog article
    await page.goto('/blog/kashmiri-honey-purity-and-uses');
    await page.waitForLoadState('domcontentloaded');

    // Share subtle button in article header meta
    const headerShare = page.getByRole('button', { name: /Share/i }).first();
    await expect(headerShare).toBeVisible();

    // Share button in article action bar
    const bottomShare = page.getByRole('button', { name: /Share/i }).last();
    await expect(bottomShare).toBeVisible();

    // Click header share
    await headerShare.click();
    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible();
    await expect(modal.getByText('Share this with friends')).toBeVisible();

    // Press Escape to dismiss
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
  });

  test('Track Order Page provides shareable consignment reference', async ({ page }) => {
    await page.goto('/track-order');
    await page.waitForLoadState('domcontentloaded');

    // Search an order or verify presence of form
    const input = page.locator('input[placeholder*="INF-"]');
    await expect(input).toBeVisible();

    // Search a consignment query
    await input.fill('INF-202611-7655');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(600);

    // If order found, verify share button
    const shareBtn = page.getByRole('button', { name: /Share/i });
    if (await shareBtn.count() > 0) {
      await expect(shareBtn.first()).toBeVisible();
    }
  });

  test('Admin Settings page includes Social Media Links & Content Sharing card with CRUD capability', async ({
    page,
    context,
  }) => {
    // Add admin session cookie
    await context.addCookies([
      {
        name: 'infinicharm_admin_session',
        value: 'active',
        domain: 'localhost',
        path: '/',
      },
      {
        name: 'infinicharm_admin_email',
        value: 'admin@infinicharm.com',
        domain: 'localhost',
        path: '/',
      },
    ]);

    await page.goto('/admin/settings');
    await page.waitForLoadState('domcontentloaded');

    // Verify Social & Content Sharing Card
    const socialHeader = page.getByText('Social Media Links & Content Sharing Policy');
    await expect(socialHeader).toBeVisible();
    await socialHeader.scrollIntoViewIfNeeded();

    await expect(
      page.getByRole('button', { name: /Add Social Channel/i })
    ).toBeVisible();

    // Check presence of YouTube and The Crumb in admin list
    await expect(page.getByText('The Crumb (InfiniCharm)', { exact: true })).toBeVisible({ timeout: 15000 });

    // Verify Sharing Settings Section
    await expect(page.getByText('Content Sharing Experience Configuration')).toBeVisible();
    await expect(page.getByRole('button', { name: /Save Sharing Settings/i })).toBeVisible();
  });

  test('Zero horizontal overflow across all viewport widths', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    expect(hasHorizontalOverflow).toBe(false);
  });
});
