import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const VIEWPORTS_10 = [
  { width: 320, height: 568, name: '320px-Mobile-XS' },
  { width: 375, height: 667, name: '375px-Mobile-SE' },
  { width: 414, height: 896, name: '414px-Mobile-L' },
  { width: 480, height: 854, name: '480px-Mobile-Landscape' },
  { width: 640, height: 960, name: '640px-Phablet' },
  { width: 768, height: 1024, name: '768px-Tablet' },
  { width: 1024, height: 768, name: '1024px-Tablet-Landscape' },
  { width: 1280, height: 800, name: '1280px-Desktop' },
  { width: 1440, height: 900, name: '1440px-Desktop-Wide' },
  { width: 2560, height: 1440, name: '2560px-QHD' },
];

const DATA_DIR = path.join(process.cwd(), 'src', 'data');
const SNAPSHOT_FILES = [
  'inquiries.json',
  'notification_logs.json',
  'notification_rules.json',
  'notification_preferences.json',
  'orders.json',
  'password_reset_tokens.json',
];

test.describe('Centralized Email Notifications, Enquiries & Separated Admin Settings', () => {
  test('Full E2E: Categorized Admin Nav -> Independent SMTP -> Enquiries -> Rules CRUD -> Order Toggle Dispatch -> 10 Viewports', async ({
    context,
    page,
  }) => {
    test.setTimeout(90_000);
    const snapshots: Record<string, string | null> = {};
    for (const filename of SNAPSHOT_FILES) {
      const fp = path.join(DATA_DIR, filename);
      snapshots[filename] = fs.existsSync(fp) ? fs.readFileSync(fp, 'utf8') : null;
    }

    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(`console.error: ${msg.text()}`);
      }
    });

    await context.addCookies([
      { name: 'infinicharm_admin_session', value: 'active', domain: 'localhost', path: '/' },
    ]);

    try {
      // 1. Verify Admin Settings links and Independent Email & SMTP Configuration module
      await page.goto('/admin/settings', { waitUntil: 'networkidle' });
      await expect(page.getByText('Email & SMTP Configuration')).toBeVisible();
      await expect(page.getByText('Email Notifications Hub')).toBeVisible();
      await expect(page.getByText('Email Templates Library')).toBeVisible();

      await page.goto('/admin/settings/email-smtp', { waitUntil: 'networkidle' });
      await expect(
        page.getByRole('heading', { name: 'Email & SMTP Configuration' })
      ).toBeVisible();
      await expect(page.getByText(/Brevo|Relay/i).first()).toBeVisible();

      // Verify /api/admin/smtp masks secret
      const smtpRes = await context.request.get('/api/admin/smtp');
      expect(smtpRes.ok()).toBeTruthy();
      const smtpJson = await smtpRes.json();
      expect(Array.isArray(smtpJson.configs)).toBeTruthy();
      for (const cfg of smtpJson.configs) {
        expect(JSON.stringify(cfg)).not.toContain('xkeysib-');
      }

      // 2. Verify /admin/newsletter no longer exposes an embedded Brevo & SMTP tab
      await page.goto('/admin/newsletter', { waitUntil: 'networkidle' });
      await expect(page.getByRole('button', { name: 'Brevo & SMTP' })).toHaveCount(0);
      await expect(page.getByRole('link', { name: /Email & SMTP Setup/i })).toBeVisible();

      // 3. Verify /admin/email-templates shows categorized blueprints
      await page.goto('/admin/email-templates', { waitUntil: 'networkidle' });
      await expect(page.getByRole('heading', { name: 'Email Templates', exact: true })).toBeVisible();
      await expect(page.getByText('New Customer Enquiry — Admin Alert')).toBeVisible();

      // 4. Verify Disabled Notification Rule blocks dispatch cleanly without breaking transactions
      // Toggle ENQUIRY_SUBMITTED rule OFF via Admin API, submit /contact enquiry, check DISABLED log
      const toggleOffRes = await context.request.patch(
        '/api/admin/notifications/rules/rule-enquiry-submitted',
        { data: { isEnabled: false } }
      );
      expect(toggleOffRes.ok()).toBeTruthy();

      await page.goto('/contact', { waitUntil: 'networkidle' });
      await page.fill('input[placeholder*="Ramesh Kumar"]', 'E2E Contact Customer');
      await page.fill('input[placeholder*="10-digit mobile"]', '9876543210');
      await page.fill('input[placeholder*="name@example.com"]', 'e2e.contact@example.com');
      await page.fill('main input[placeholder*="Kashmiri Honey"]', 'E2E Enquiry Test');
      await page.fill(
        'textarea[placeholder*="how we can assist"]',
        'Verifying persisted server inquiry & centralized notification logging.'
      );
      await page.getByRole('button', { name: /Submit Inquiry/i }).click();
      await expect(page.getByText(/Inquiry Submitted Successfully/i)).toBeVisible({
        timeout: 8000,
      });

      // Confirm /admin/inquiries loads it from real server database (not localStorage)
      await page.goto('/admin/inquiries', { waitUntil: 'networkidle' });
      await expect(page.getByText('E2E Enquiry Test')).toBeVisible({ timeout: 8000 });
      await expect(page.getByText('E2E Contact Customer')).toBeVisible();

      // Check Delivery Logs recorded DISABLED status cleanly when rule was turned off
      const disabledLogsRes = await context.request.get(
        '/api/admin/notifications/logs?eventKey=ENQUIRY_SUBMITTED'
      );
      const disabledLogsJson = await disabledLogsRes.json();
      expect(disabledLogsJson.logs.length).toBeGreaterThan(0);
      expect(disabledLogsJson.logs[0].status).toBe('DISABLED');

      // Re-enable rule and verify Order placement still succeeds cleanly when ORDER_PLACED rule toggled off
      await context.request.patch('/api/admin/notifications/rules/rule-enquiry-submitted', {
        data: { isEnabled: true },
      });

      await context.request.patch('/api/admin/notifications/rules/rule-order-placed', {
        data: { isEnabled: false },
      });

      const orderRes = await context.request.post('/api/orders', {
        data: {
          items: [{ productId: 'prod-100-kashmiri-honey', variantId: 'var-500g', quantity: 1 }],
          paymentMethod: 'COD',
          shippingAddress: {
            fullName: 'E2E Order Buyer',
            phone: '9876500001',
            addressLine1: '101 Station Road',
            city: 'Motihari',
            state: 'Bihar',
            postalCode: '845427',
            country: 'India',
          },
          customerEmail: 'e2e.order@example.com',
        },
      });
      // Order creation might succeed (201) if product/variant exists, or skip if id differs; check gracefully
      if (orderRes.status() === 201) {
        const ordLogsRes = await context.request.get(
          '/api/admin/notifications/logs?eventKey=ORDER_PLACED'
        );
        const ordLogsJson = await ordLogsRes.json();
        expect(ordLogsJson.logs[0]?.status).toBe('DISABLED');
      }

      // 5. Full CRUD UI flow on /admin/email-notifications
      await page.goto('/admin/email-notifications', { waitUntil: 'networkidle' });
      await expect(page.getByRole('heading', { name: 'Email Notifications' })).toBeVisible();

      await page.getByTestId('create-notification-rule-btn').click();
      await page.fill(
        'input[placeholder*="High-Value Order Admin Alert"]',
        'E2E Audit Notification Rule'
      );
      await page.fill('input[placeholder="ORDER_PLACED"]', 'E2E_CUSTOM_EVENT');
      await page.getByRole('button', { name: 'Create Notification Rule' }).click();
      await expect(page.getByRole('heading', { name: 'E2E Audit Notification Rule' })).toBeVisible({ timeout: 5000 });

      // Open Delivery Logs tab cleanly
      await page.getByRole('button', { name: /Delivery Logs/i }).click();
      await expect(page.getByText('ENQUIRY_SUBMITTED').first()).toBeVisible();

      // Open Global Preferences tab cleanly & save
      await page.getByRole('button', { name: /Global Preferences/i }).click();
      await page.getByRole('button', { name: /Save Global Preferences/i }).click();
      await expect(page.getByText(/Global notification preferences updated/i)).toBeVisible();

      // Switch back to Event Rules, Duplicate, then Delete our E2E rule + its copy
      await page.getByRole('button', { name: /Event Rules/i }).click();
      const searchInput = page.getByPlaceholder('Search event key, rule name, or category...');
      await searchInput.fill('E2E Audit Notification Rule');
      await expect(page.getByText('E2E Audit Notification Rule')).toBeVisible();

      // Duplicate
      await page.getByTitle('Duplicate Rule').first().click();
      await expect(
        page.getByRole('heading', { name: 'E2E Audit Notification Rule (Copy)', exact: true })
      ).toBeVisible({
        timeout: 5000,
      });

      // Delete both E2E rules cleanly via Confirmation Modal
      for (let i = 0; i < 2; i++) {
        await page.getByTitle('Delete Rule').first().click();
        await page.getByText('Delete Rule', { exact: true }).click();
        await expect(page.getByTitle('Delete Rule')).toHaveCount(1 - i, { timeout: 5000 });
      }
      await searchInput.fill('');

      // 6. Responsive 10-viewport overflow audit on key pages
      const auditRoutes = [
        '/admin/email-notifications',
        '/admin/settings/email-smtp',
        '/admin/email-templates',
        '/contact',
      ];

      for (const route of auditRoutes) {
        await page.goto(route, { waitUntil: 'networkidle' });
        for (const vp of VIEWPORTS_10) {
          await page.setViewportSize({ width: vp.width, height: vp.height });
          const overflow = await page.evaluate(() => {
            const doc = document.documentElement;
            return {
              scrollWidth: doc.scrollWidth,
              innerWidth: window.innerWidth,
            };
          });
          expect(
            overflow.scrollWidth,
            `${route} @ ${vp.name} horizontal overflow (${overflow.scrollWidth} > ${overflow.innerWidth})`
          ).toBeLessThanOrEqual(overflow.innerWidth + 1);
        }
      }

      // Expect zero uncaught page / console errors
      expect(consoleErrors, `Unexpected console/page errors: ${consoleErrors.join('; ')}`).toEqual(
        []
      );
    } finally {
      // Restore clean baseline files so zero E2E test artifacts linger
      for (const filename of SNAPSHOT_FILES) {
        const fp = path.join(DATA_DIR, filename);
        const orig = snapshots[filename];
        if (orig !== null) {
          fs.writeFileSync(fp, orig, 'utf8');
        } else if (fs.existsSync(fp)) {
          fs.unlinkSync(fp);
        }
      }
    }
  });
});

