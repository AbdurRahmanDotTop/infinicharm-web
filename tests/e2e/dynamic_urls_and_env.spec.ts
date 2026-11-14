import { test, expect } from '@playwright/test';

test.describe('Dynamic URL & Environment Detection System — InfiniCharm', () => {
  test('1. First-visit origin detection persists to localStorage and cookie with zero stale override', async ({ page }) => {
    // 1. Visit root page
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => localStorage.getItem('infinicharm_app_origin') !== null, { timeout: 10000 });

    // 2. Verify client storage & cookie persistence
    const origin = await page.evaluate(() => localStorage.getItem('infinicharm_app_origin'));
    const firstVisit = await page.evaluate(() => localStorage.getItem('infinicharm_first_visit_at'));
    const cookies = await page.context().cookies();
    const originCookie = cookies.find((c) => c.name === 'infinicharm_origin');

    expect(origin).toBe('http://localhost:3000');
    expect(firstVisit).toBeTruthy();
    expect(originCookie).toBeDefined();
    expect(decodeURIComponent(originCookie!.value)).toBe('http://localhost:3000');

    // 3. Verify OpenGraph meta tag reflects local origin
    const ogUrl = await page.locator('meta[property="og:url"]').getAttribute('content');
    expect(ogUrl).toBe('http://localhost:3000');

    // 4. Hard refresh / stale cache override protection:
    // If a stale URL was somehow saved in storage, live origin must overwrite it
    await page.evaluate(() => {
      localStorage.setItem('infinicharm_app_origin', 'http://localhost:9999-stale');
    });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
      () => localStorage.getItem('infinicharm_app_origin') === 'http://localhost:3000',
      { timeout: 5000 }
    );

    const revalidatedOrigin = await page.evaluate(() => localStorage.getItem('infinicharm_app_origin'));
    expect(revalidatedOrigin).toBe('http://localhost:3000');
  });

  test('2. Product sharing dialog generates local origin URLs without production domain leak', async ({ page }) => {
    await page.goto('/product/100-kashmiri-honey', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    // Find and click the inline or floating share button
    const shareBtn = page.locator('button:has-text("Share")').first();
    await expect(shareBtn).toBeVisible({ timeout: 10000 });
    await shareBtn.click();

    // Check share modal input or link text
    const shareInput = page.locator('input[readonly]').first();
    await expect(shareInput).toBeVisible({ timeout: 5000 });

    const sharedUrl = await shareInput.inputValue();
    expect(sharedUrl).toContain('http://localhost:3000/product/100-kashmiri-honey');
    expect(sharedUrl).not.toContain('https://infinicharm.com');
  });

  test('3. Admin payment webhooks display dynamic local origin endpoints', async ({ page }) => {
    // Set authenticated admin session
    await page.context().addCookies([
      { name: 'infinicharm_admin_session', value: 'active', url: 'http://localhost:3000' },
    ]);

    // Navigate to Payments tab and wait for client hydration
    await page.goto('/admin/payments', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await expect(page.getByRole('heading', { name: /Payment Gateway Management/i })).toBeVisible({ timeout: 10000 });

    // Switch to Webhook Diagnostics tab
    const webhookTab = page.getByRole('button', { name: /Webhook Diagnostics/i });
    await expect(webhookTab).toBeVisible({ timeout: 5000 });
    await webhookTab.click();

    // Check webhook endpoint codes
    const rzpEndpoint = page.locator('code:has-text("razorpay")').first();
    await expect(rzpEndpoint).toBeVisible({ timeout: 10000 });
    const rzpText = await rzpEndpoint.textContent();
    expect(rzpText).toBe('http://localhost:3000/api/webhooks/razorpay');

    const peEndpoint = page.locator('code:has-text("phonepe")').first();
    await expect(peEndpoint).toBeVisible({ timeout: 10000 });
    const peText = await peEndpoint.textContent();
    expect(peText).toBe('http://localhost:3000/api/webhooks/phonepe');
  });

  test('4. Order tracking page functions seamlessly under local development origin', async ({ page }) => {
    await page.goto('/track-order?id=INF-202611-TEST', { waitUntil: 'domcontentloaded' });

    // Page must load without unhandled error
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
    const currentUrl = page.url();
    expect(currentUrl).toContain('http://localhost:3000/track-order');
    expect(currentUrl).not.toContain('https://infinicharm.com');
  });

  test('5. Server API endpoints process forwarded host headers without crashing', async ({ request }) => {
    // Test server API with simulated production headers
    const prodRes = await request.get('/api/products', {
      headers: {
        'x-forwarded-host': 'infinicharm.com',
        'x-forwarded-proto': 'https',
      },
    });

    expect(prodRes.status()).toBe(200);
    const prodData = await prodRes.json();
    expect(prodData.success).toBe(true);
    expect(Array.isArray(prodData.products)).toBe(true);

    // Test with local development headers
    const localRes = await request.get('/api/products', {
      headers: {
        host: 'localhost:3000',
      },
    });

    expect(localRes.status()).toBe(200);
    const localData = await localRes.json();
    expect(localData.success).toBe(true);
  });
});
