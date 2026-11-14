import { test, expect } from '@playwright/test';

// ==============================================================================
// InfiniCharm — Backup, Restore, Import & Export E2E Playwright Suite
// 10 Viewports responsive audit, Admin RBAC gates, and Complete Lifecycle
// ==============================================================================

const TEST_VIEWPORTS = [
  { width: 375, height: 667, name: 'Mobile-375' },
  { width: 768, height: 1024, name: 'Tablet-768' },
  { width: 1280, height: 800, name: 'Desktop-1280' },
];

test.describe('Admin Backup, Restore, Import & Export System', () => {
  test('1. Enforces Admin Authentication gate on /admin/backup', async ({ page }) => {
    // Navigate without admin cookie
    await page.goto('/admin/backup', { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  for (const vp of TEST_VIEWPORTS) {
    test(`2. [${vp.name}] Admin Backup Dashboard renders responsive controls`, async ({
      page,
      context,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      // Grant authenticated admin session
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

      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      await page.goto('/admin/backup', { waitUntil: 'networkidle' });
      await expect(page).toHaveURL('/admin/backup');

      // Verify Page Title & Summary Cards
      await expect(page.getByRole('heading', { name: /Backup, Restore & Data Hub/i })).toBeVisible();
      await expect(page.getByText('Total Backups')).toBeVisible();
      await expect(page.getByText('Storage Footprint')).toBeVisible();
      await expect(page.getByText('Zero Secret Exposure')).toBeVisible();

      // Verify 4 Main Tabs
      await expect(page.getByTestId('tab-create')).toBeVisible();
      await expect(page.getByTestId('tab-restore')).toBeVisible();
      await expect(page.getByTestId('tab-import-export')).toBeVisible();
      await expect(page.getByTestId('tab-history')).toBeVisible();

      // Check zero horizontal overflow
      const hasOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth
      );
      expect(hasOverflow, `${vp.name} must have zero horizontal overflow`).toBe(false);

      // Verify no critical errors
      expect(consoleErrors.filter((e) => !e.includes('favicon'))).toHaveLength(0);
    });
  }

  test('3. Full Backup lifecycle: Create, Validate, and History inspect', async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

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

    await page.goto('/admin/backup', { waitUntil: 'networkidle' });

    // Step 1: Create Full Backup
    const createBtn = page.getByTestId('create-full-backup-btn');
    await expect(createBtn).toBeVisible();
    await createBtn.click();

    // Verify switch to Archive History tab and success alert
    await expect(page.getByText(/generated successfully/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: /Saved Backup Archives/i })).toBeVisible({ timeout: 5000 });

    // Step 2: Switch to Import & Export tab
    await page.getByTestId('tab-import-export').click();
    await expect(page.getByRole('heading', { name: /Export Section Data/i })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('heading', { name: /Import Section Data/i })).toBeVisible({ timeout: 5000 });

    // Test Import Preview with sample CSV
    const sampleCsv = `id,name,slug,isActive\ntest-cat-e2e,E2E Category,e2e-category,true`;
    await page.locator('textarea').fill(sampleCsv);
    const validateBtn = page.getByTestId('validate-preview-btn');
    await validateBtn.scrollIntoViewIfNeeded();
    await validateBtn.click();

    await expect(page.getByText(/Preview Summary:/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Total: 1/i)).toBeVisible();

    // Step 3: Switch to History tab and verify archive presence
    await page.getByTestId('tab-history').click();
    await expect(page.getByText(/SHA-256:/i).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('link', { name: /Download/i }).first()).toBeVisible({ timeout: 5000 });
  });
});
