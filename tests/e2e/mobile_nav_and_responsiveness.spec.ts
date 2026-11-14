import { test, expect } from '@playwright/test';

const TEN_VIEWPORTS = [
  { width: 320, height: 568, name: '320x568' },
  { width: 375, height: 667, name: '375x667' },
  { width: 390, height: 844, name: '390x844' },
  { width: 480, height: 854, name: '480x854' },
  { width: 768, height: 1024, name: '768x1024' },
  { width: 1024, height: 768, name: '1024x768' },
  { width: 1280, height: 800, name: '1280x800' },
  { width: 1440, height: 900, name: '1440x900' },
  { width: 1920, height: 1080, name: '1920x1080' },
  { width: 2560, height: 1440, name: '2560x1440' },
];

const KEY_STOREFRONT_ROUTES = [
  '/',
  '/shop',
  '/products',
  '/deals',
  '/search?q=honey',
  '/product/100-kashmiri-honey',
  '/blog',
  '/account',
  '/account/orders',
  '/track-order',
];

const KEY_ADMIN_ROUTES = [
  '/admin/dashboard',
  '/admin/products',
  '/admin/orders',
  '/admin/customers',
  '/admin/reviews',
  '/admin/coupons',
  '/admin/cms',
];

test.describe('Mobile Navigation, Unhidden Controls & 10-Viewport Responsiveness', () => {
  test('Storefront mobile hamburger drawer opens full height, supports close controls, search & navigation without clipping', async ({ page, context }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    const loginRes = await page.request.post('/api/auth/customer/login', {
      data: { email: 'customer@infinicharm.com', password: 'Customer@1234!' },
    });
    expect(loginRes.ok()).toBeTruthy();
    const loginData = await loginRes.json();

    await page.addInitScript((customer) => {
      window.localStorage.setItem('infinicharm_customer_user', JSON.stringify(customer));
    }, loginData.customer);

    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/', { waitUntil: 'networkidle' });

    const toggleBtn = page.getByTestId('mobile-menu-toggle');
    await expect(toggleBtn).toBeVisible();

    // Header actions remain visible on mobile (Search, Account, Wishlist, Cart)
    await expect(page.getByRole('button', { name: 'Open Search' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'View Shopping Bag' })).toBeVisible();
    await expect(page.locator('header a[href="/account/wishlist"]')).toBeVisible();

    // Open mobile navigation drawer
    await toggleBtn.click();
    const drawer = page.getByTestId('mobile-nav-drawer');
    await expect(drawer).toBeVisible();

    // Portalled drawer must occupy full viewport height (not clipped by header backdrop-blur)
    const drawerBox = await drawer.boundingBox();
    expect(drawerBox).not.toBeNull();
    expect(drawerBox!.height).toBeGreaterThanOrEqual(662);

    // Authenticated customer links & quick links are rendered inside drawer
    await expect(drawer.getByRole('link', { name: 'My Account' })).toBeVisible();
    await expect(drawer.getByRole('link', { name: 'Orders' })).toBeVisible();
    await expect(drawer.getByRole('link', { name: /^Wishlist(\s*\d+)?$/i })).toBeVisible();
    await expect(drawer.getByRole('link', { name: /Saved Wishlist/i })).toBeVisible();

    // Close via explicit Close button
    await drawer.getByRole('button', { name: 'Close Navigation Menu' }).click();
    await expect(drawer).toHaveCount(0);

    // Reopen & close by clicking backdrop outside the left slide-in panel (right edge at x=360)
    await toggleBtn.click();
    await expect(drawer).toBeVisible();
    await page.mouse.click(360, 320);
    await expect(drawer).toHaveCount(0);

    // Reopen & test inline quick search inside drawer
    await toggleBtn.click();
    await expect(drawer).toBeVisible();
    await drawer.getByPlaceholder('Search Honey, Zamzam, Talbeena, Dates...').fill('honey');
    await drawer.getByRole('button', { name: 'Search' }).click();
    await expect(page).toHaveURL(/\/search\?q=honey/);
    await expect(drawer).toHaveCount(0);

    expect(errors).toEqual([]);
  });

  test('Previously hidden mobile UI features remain visible on 320px/375px viewports', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    // 1. Homepage: Spotlight floating card must be visible on 320px mobile
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('spotlight-floating-card')).toBeVisible();

    // 2. Shop: Verified Fast Dispatch badge + product card "Add" label visible on mobile
    await page.goto('/shop', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Verified Fast Dispatch')).toBeVisible();
    await expect(page.getByRole('button', { name: /Add/i }).first()).toBeVisible();

    // 3. Product detail: Add to Bag makes StickyCartBar visible with "View Bag" label on 375px mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/product/100-kashmiri-honey');
    await page.waitForTimeout(600);
    const addBtn = page.getByRole('button', { name: /^Add to Bag$/i });
    await expect(addBtn).toBeVisible();
    await addBtn.click();
    await page.waitForTimeout(400);
    const closeBag = page.getByRole('button', { name: 'Close Shopping Bag' });
    if (await closeBag.isVisible()) {
      await closeBag.click();
    }
    await expect(page.getByRole('button', { name: /View Bag/i })).toBeVisible();

    expect(errors).toEqual([]);
  });

  test('Admin Panel mobile hamburger drawer exposes all 14 modules, operator info, Live Storefront & Sign Out without table clipping', async ({ page, context }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await context.addCookies([
      { name: 'infinicharm_admin_session', value: 'active', domain: 'localhost', path: '/' },
    ]);

    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/admin/dashboard', { waitUntil: 'networkidle' });

    // Top bar Live Storefront must remain accessible on mobile
    await expect(page.getByRole('link', { name: 'Live Storefront' })).toBeVisible();

    const adminToggle = page.getByTestId('admin-mobile-menu-toggle');
    await expect(adminToggle).toBeVisible();
    await adminToggle.click();

    const adminDrawer = page.getByTestId('admin-mobile-nav-drawer');
    await expect(adminDrawer).toBeVisible();

    const drawerBox = await adminDrawer.boundingBox();
    expect(drawerBox).not.toBeNull();
    expect(drawerBox!.height).toBeGreaterThanOrEqual(662);

    await expect(adminDrawer.getByText('admin@infinicharm.com')).toBeVisible();
    await expect(adminDrawer.getByRole('link', { name: 'Open Live Storefront' })).toBeVisible();
    await expect(adminDrawer.getByTestId('admin-mobile-signout-btn')).toBeVisible();

    // All 14 admin navigation links present inside Management Modules
    const moduleLinks = adminDrawer.locator('a[href^="/admin/"]');
    expect(await moduleLinks.count()).toBeGreaterThanOrEqual(14);

    // Navigate via drawer to /admin/orders and verify drawer closes
    await page.waitForTimeout(400);
    const ordersLink = adminDrawer.getByRole('link', { name: 'Orders' });
    await ordersLink.scrollIntoViewIfNeeded();
    await ordersLink.click();
    await expect(page).toHaveURL(/\/admin\/orders/, { timeout: 15000 });
    await expect(adminDrawer).toHaveCount(0);

    expect(errors).toEqual([]);
  });

  test('All key Storefront & Admin routes have zero horizontal overflow across all 10 viewports (320px to 2560px)', async ({ page, context }) => {
    test.setTimeout(120000);
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await context.addCookies([
      { name: 'infinicharm_admin_session', value: 'active', domain: 'localhost', path: '/' },
    ]);
    const loginRes = await page.request.post('/api/auth/customer/login', {
      data: { email: 'customer@infinicharm.com', password: 'Customer@1234!' },
    });
    expect(loginRes.ok()).toBeTruthy();

    for (const route of [...KEY_STOREFRONT_ROUTES, ...KEY_ADMIN_ROUTES]) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(200);

      for (const vp of TEN_VIEWPORTS) {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.waitForTimeout(40);
        const metrics = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        }));
        expect(
          metrics.scrollWidth,
          `Horizontal overflow on ${route} at ${vp.name} (${metrics.scrollWidth} > ${metrics.innerWidth})`
        ).toBeLessThanOrEqual(metrics.innerWidth);
      }
    }

    expect(errors).toEqual([]);
  });
});
