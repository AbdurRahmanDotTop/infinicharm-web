import { test, expect } from '@playwright/test';

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

test.describe('Newsletter Circle, Unsubscribe, Brevo Verification & Admin Marketing Hub', () => {
  test('Full E2E flow: Storefront subscribe -> Duplicate -> Admin CRUD -> Brevo Live Verify -> Unsubscribe -> Cleanup', async ({
    context,
    page,
  }) => {
    test.setTimeout(90_000);
    const request = context.request;
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

    const testEmail = `e2e.circle.${Date.now()}@example.com`;
    let createdSubscriberId: string | null = null;
    let createdTemplateId: string | null = null;
    let createdCampaignId: string | null = null;
    let originalWidgetSettings: Record<string, unknown> | null = null;

    // Fetch baseline settings to restore after test
    const origSetRes = await request.get('/api/admin/newsletter/settings');
    if (origSetRes.ok()) {
      const origSetData = await origSetRes.json();
      originalWidgetSettings = origSetData.settings;
      // Disable welcome send only during automated example.com test to avoid polluting Brevo stats
      await request.put('/api/admin/newsletter/settings', {
        data: { sendWelcomeEmail: false },
      });
    }

    try {
      // 1. Storefront Homepage Circle Validation & Subscription
      await page.goto('/', { waitUntil: 'networkidle' });
      const section = page.locator('#infinicharm-circle-newsletter');
      await expect(section).toBeVisible();

      const emailInput = page.locator('#circle-newsletter-email');
      const submitBtn = section.locator('button[type="submit"]');

      // Invalid email check
      await emailInput.fill('invalid-email-address');
      await submitBtn.click();
      await expect(section.locator('[role="alert"]')).toContainText('valid email');

      // Real subscription persistence
      await emailInput.fill(testEmail);
      await submitBtn.click();
      await expect(section.locator('[role="status"]')).toBeVisible({ timeout: 10000 });

      // Duplicate submission feedback
      await emailInput.fill(testEmail);
      await submitBtn.click();
      await expect(section.locator('[role="status"]')).toContainText(/already.*(subscribed|active member)/i);

      // 2. Verify subscriber record exists in Backend API & Admin Panel
      const subRes = await request.get(
        `/api/admin/newsletter/subscribers?search=${encodeURIComponent(testEmail)}`
      );
      expect(subRes.ok()).toBe(true);
      const subData = await subRes.json();
      expect(subData.subscribers.length).toBe(1);
      createdSubscriberId = subData.subscribers[0].id;
      const unsubscribeToken: string = subData.subscribers[0].unsubscribeToken;
      expect(subData.subscribers[0].status).toBe('ACTIVE');

      // 3. Open Admin Newsletter Hub & check Subscribers, Templates, Campaigns & Settings
      await page.goto('/admin/newsletter', { waitUntil: 'networkidle' });
      await expect(page.locator('h1')).toContainText('Newsletter & Email Marketing');
      await expect(page.locator('table').getByText(testEmail)).toBeVisible();

      // Open separated Settings -> Email & SMTP Configuration -> verify secret is masked AND run live Brevo Verification!
      await page.goto('/admin/settings/email-smtp', { waitUntil: 'networkidle' });
      await expect(page.getByText('Brevo Primary Transactional Relay')).toBeVisible();
      // Confirm no xkeysib- raw key anywhere on page
      const bodyText = await page.locator('body').innerText();
      expect(bodyText.includes('xkeysib-')).toBe(false);

      await page.getByRole('button', { name: 'Verify Connection' }).first().click();
      await expect(page.locator('[role="status"]').first()).toContainText(/Verified live via Brevo/i, {
        timeout: 15000,
      });

      // Return to Newsletter Hub -> switch to Marketing Templates tab -> create and verify template
      await page.goto('/admin/newsletter', { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: 'Marketing Templates' }).click();
      await page.getByRole('button', { name: 'New Template' }).click();
      const tplName = `E2E Template ${Date.now()}`;
      await page.locator('form input[required]').first().fill(tplName);
      await page.getByRole('button', { name: 'Save Template' }).click();
      await expect(page.getByText(tplName)).toBeVisible();

      const tplRes = await request.get('/api/admin/email-templates');
      const tplData = await tplRes.json();
      const matchedTpl = tplData.templates.find((t: { name: string }) => t.name === tplName);
      expect(matchedTpl).toBeTruthy();
      createdTemplateId = matchedTpl.id;

      // 4. Token-Based One-Click Unsubscribe Page -> Exclude unsubscribed from Campaign segment
      await page.goto(`/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`, {
        waitUntil: 'networkidle',
      });
      await expect(page.getByText(testEmail)).toBeVisible();
      await page.getByRole('button', { name: /Unsubscribe from All Marketing Emails/i }).click();
      await expect(page.locator('[role="status"]')).toContainText('unsubscribed');

      // Confirm DB status is now UNSUBSCRIBED
      const afterUnsubRes = await request.get(
        `/api/admin/newsletter/subscribers?search=${encodeURIComponent(testEmail)}`
      );
      const afterUnsubData = await afterUnsubRes.json();
      expect(afterUnsubData.subscribers[0].status).toBe('UNSUBSCRIBED');

      // Create a campaign targeted to CUSTOM_SELECTION containing only this now-unsubscribed user -> dispatch should exclude it!
      const createCmpRes = await request.post('/api/admin/campaigns', {
        data: {
          name: `E2E Exclusion Test ${Date.now()}`,
          subject: 'Test Exclusion Subject',
          senderName: 'InfiniCharm',
          senderEmail: 'support@infinicharm.com',
          htmlContent: '<p>Hello {{subscriber_name}}</p>',
          segment: 'CUSTOM_SELECTION',
          selectedSubscriberIds: [createdSubscriberId],
        },
      });
      expect(createCmpRes.status()).toBe(201);
      const cmpJson = await createCmpRes.json();
      createdCampaignId = cmpJson.campaign.id;
      expect(cmpJson.campaign.eligibleCount).toBe(0);
      expect(cmpJson.campaign.skippedCount).toBeGreaterThanOrEqual(1);

      // 5. Widget Settings Update reflects live on Storefront `/`
      const customHeading = 'Join InfiniCharm Dispatch E2E';
      await request.put('/api/admin/newsletter/settings', {
        data: { heading: customHeading },
      });
      await page.goto('/', { waitUntil: 'networkidle' });
      await expect(page.locator('#newsletter-circle-heading')).toHaveText(customHeading);

      // 6. Verify 10 Viewports Zero Horizontal Overflow across `/`, `/unsubscribe`, `/admin/newsletter`
      const routesToAudit = [
        '/',
        `/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`,
        '/admin/newsletter',
      ];
      for (const route of routesToAudit) {
        for (const vp of VIEWPORTS_10) {
          await page.setViewportSize({ width: vp.width, height: vp.height });
          await page.goto(route, { waitUntil: 'domcontentloaded' });
          const overflow = await page.evaluate(() => {
            return document.documentElement.scrollWidth > window.innerWidth + 1;
          });
          expect(overflow, `Horizontal overflow on ${route} at ${vp.name}`).toBe(false);
        }
      }

      expect(consoleErrors, `Unexpected browser console/page errors: ${consoleErrors.join('; ')}`).toEqual([]);
    } finally {
      // Clean up test records & restore original settings
      if (createdCampaignId) {
        await request.delete(`/api/admin/campaigns/${createdCampaignId}`).catch(() => {});
      }
      if (createdTemplateId) {
        await request.delete(`/api/admin/email-templates/${createdTemplateId}`).catch(() => {});
      }
      if (createdSubscriberId) {
        await request.delete(`/api/admin/newsletter/subscribers/${createdSubscriberId}`).catch(() => {});
      }
      if (originalWidgetSettings) {
        await request.put('/api/admin/newsletter/settings', {
          data: originalWidgetSettings,
        }).catch(() => {});
      }
    }
  });
});
