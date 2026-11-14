import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.join(process.cwd(), 'src', 'data');
const SNAPSHOT_FILES = [
  'orders.json',
  'customers.json',
  'products.json',
  'notification_delivery_logs.json',
  'audit_logs.json',
];
const snapshots = new Map<string, string | null>();

let TEST_ORDER_NUMBER = '';
const OWNER_EMAIL = `track-owner-${Date.now()}@example.com`;
const OWNER_PASS = 'OwnerTrack!2026';
const SENSITIVE_ITEM_TEXT = '100% Kashmiri Honey';
const SENSITIVE_ADDRESS_TEXT = 'Ward No. 07, Lahsaniya';
const SENSITIVE_PHONE = '8825164657';

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

test.describe('Track Order Premium UI & Strict Privacy Enforcement', () => {
  test.beforeAll(async ({ playwright }) => {
    for (const f of SNAPSHOT_FILES) {
      const p = path.join(DATA_DIR, f);
      snapshots.set(f, fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null);
    }

    const adminCtx = await playwright.request.newContext({ baseURL: 'http://localhost:3000' });
    const adminLogin = await adminCtx.post('/api/admin/auth/login', {
      data: { email: 'admin@infinicharm.com', password: process.env.ADMIN_PASSWORD || 'Admin@1234!' },
    });
    expect(adminLogin.ok()).toBe(true);

    const createRes = await adminCtx.post('/api/admin/customers', {
      data: {
        fullName: 'Track Order Privacy Owner',
        email: OWNER_EMAIL,
        phone: SENSITIVE_PHONE,
        password: OWNER_PASS,
        emailVerified: true,
        status: 'ACTIVE',
      },
    });
    expect(createRes.ok()).toBe(true);
    await adminCtx.dispose();

    const ownerCtx = await playwright.request.newContext({ baseURL: 'http://localhost:3000' });
    const ownerLogin = await ownerCtx.post('/api/auth/customer/login', {
      data: { email: OWNER_EMAIL, password: OWNER_PASS },
    });
    expect(ownerLogin.ok()).toBe(true);
    const ownerJson = await ownerLogin.json();

    const orderRes = await ownerCtx.post('/api/orders', {
      data: {
        orderNumber: `INF-202611-${Math.floor(1000 + Math.random() * 9000)}`,
        customerId: ownerJson.customer.id,
        customerEmail: OWNER_EMAIL,
        customerPhone: `+91${SENSITIVE_PHONE}`,
        paymentMethod: 'CUSTOM_UPI',
        utrNumber: '412345678901',
        subtotalInPaise: 240000,
        discountInPaise: 0,
        shippingInPaise: 0,
        totalInPaise: 240000,
        shippingAddress: {
          fullName: 'Track Order Privacy Owner',
          phone: SENSITIVE_PHONE,
          addressLine1: SENSITIVE_ADDRESS_TEXT,
          city: 'East Champaran',
          state: 'Bihar',
          postalCode: '845427',
        },
        items: [
          {
            productId: 'S-01-P-01',
            variantId: 'var-S-01-P-01-01',
            productTitle: '100% Kashmiri Honey – Pure Taste & Natural Sweetness',
            variantTitle: 'Standard Pack',
            sku: 'S-01-P-01',
            priceInPaise: 240000,
            quantity: 1,
          },
        ],
      },
    });
    expect(orderRes.ok()).toBe(true);
    const orderData = await orderRes.json();
    TEST_ORDER_NUMBER = orderData.order?.orderNumber || orderData.orderNumber;
    await ownerCtx.dispose();
  });

  test.afterAll(() => {
    for (const [f, content] of snapshots.entries()) {
      const p = path.join(DATA_DIR, f);
      if (content === null) {
        if (fs.existsSync(p)) fs.unlinkSync(p);
      } else {
        fs.writeFileSync(p, content, 'utf8');
      }
    }
  });
  test('Scenario 1: Unauthenticated visitor sees tracking timeline only, zero PII in DOM or API, and Login CTA', async ({ page, request }) => {
    const apiRes = await request.get(`/api/orders/${TEST_ORDER_NUMBER}`);
    expect(apiRes.status()).toBe(200);
    const apiJson = await apiRes.json();

    expect(apiJson.success).toBe(true);
    expect(apiJson.privacy.accessState).toBe('UNAUTHENTICATED');
    expect(apiJson.privacy.canViewPrivateDetails).toBe(false);
    expect(apiJson.order.items).toBeUndefined();
    expect(apiJson.order.shippingAddress).toBeUndefined();
    expect(apiJson.order.billingAddress).toBeUndefined();
    expect(apiJson.order.customerEmail).toBeUndefined();
    expect(apiJson.order.customerPhone).toBeUndefined();
    expect(apiJson.order.totalInPaise).toBeUndefined();
    const rawApiText = JSON.stringify(apiJson);
    expect(rawApiText).not.toContain(SENSITIVE_ITEM_TEXT);
    expect(rawApiText).not.toContain(SENSITIVE_ADDRESS_TEXT);
    expect(rawApiText).not.toContain('abdurrahmanibnghufran@gmail.com');

    // GET /api/orders collection must reject unauthenticated callers
    const listRes = await request.get('/api/orders');
    expect(listRes.status()).toBe(401);

    await page.goto(`/track-order?id=${TEST_ORDER_NUMBER}`);
    await expect(page.getByText('LIVE FULFILLMENT STEPPER')).toBeVisible();
    await expect(page.getByText('Chronological Journey & Checkpoints')).toBeVisible();

    // Private block must NOT exist in DOM and sensitive PII strings must NEVER appear inside <main>
    await expect(page.getByTestId('private-order-details')).toHaveCount(0);
    await expect(page.locator('main')).not.toContainText(SENSITIVE_ITEM_TEXT);
    await expect(page.locator('main')).not.toContainText(SENSITIVE_ADDRESS_TEXT);
    await expect(page.locator('main')).not.toContainText('+918825164657');

    // Warning card + Login link with redirect
    const warning = page.getByTestId('order-privacy-warning');
    await expect(warning).toBeVisible();
    await expect(warning).toContainText(
      'Your order details are private and can only be accessed through the account used to place the order. Please log in to view your items and delivery destination.'
    );

    const loginBtn = page.getByTestId('track-order-login-btn');
    await expect(loginBtn).toBeVisible();
    await expect(loginBtn).toHaveAttribute(
      'href',
      `/login?redirect=${encodeURIComponent(`/track-order?id=${TEST_ORDER_NUMBER}`)}`
    );
  });

  test('Scenario 2: Logged-in different customer is blocked from viewing consignment items & destination', async ({ request, page }) => {
    const loginRes = await page.request.post('/api/auth/customer/login', {
      data: { email: 'customer@infinicharm.com', password: 'Customer@1234!' },
    });
    expect(loginRes.ok()).toBe(true);

    await page.goto(`/track-order?id=${TEST_ORDER_NUMBER}`);
    await expect(page.getByText('LIVE FULFILLMENT STEPPER')).toBeVisible();

    // Check API response directly using the authenticated wrong-account session
    const apiJson = await page.evaluate(async (orderNo) => {
      const res = await fetch(`/api/orders/${orderNo}`);
      return res.json();
    }, TEST_ORDER_NUMBER);

    expect(apiJson.success).toBe(true);
    expect(apiJson.privacy.accessState).toBe('WRONG_ACCOUNT');
    expect(apiJson.privacy.canViewPrivateDetails).toBe(false);
    expect(apiJson.order.items).toBeUndefined();
    expect(apiJson.order.shippingAddress).toBeUndefined();
    expect(apiJson.order.customerEmail).toBeUndefined();
    expect(apiJson.order.customerPhone).toBeUndefined();
    const rawWrongAccountText = JSON.stringify(apiJson);
    expect(rawWrongAccountText).not.toContain(SENSITIVE_ITEM_TEXT);
    expect(rawWrongAccountText).not.toContain(SENSITIVE_ADDRESS_TEXT);

    // Collection endpoint must not return another customer's order
    const listJson = await page.evaluate(async () => {
      const res = await fetch('/api/orders');
      return res.json();
    });
    expect(listJson.success).toBe(true);
    const leaked = (listJson.orders || []).some((o: { orderNumber: string }) => o.orderNumber === TEST_ORDER_NUMBER);
    expect(leaked).toBe(false);

    await expect(page.getByTestId('private-order-details')).toHaveCount(0);
    await expect(page.locator('main')).not.toContainText(SENSITIVE_ITEM_TEXT);
    await expect(page.locator('main')).not.toContainText(SENSITIVE_ADDRESS_TEXT);
    await expect(page.locator('main')).not.toContainText('+918825164657');

    const warning = page.getByTestId('order-privacy-warning');
    await expect(warning).toBeVisible();
    await expect(warning).toContainText(
      'This order is associated with a different account. Please log in using the account you used to place this order to view the consignment items and delivery destination.'
    );
    await expect(page.getByTestId('track-order-switch-login-btn')).toBeVisible();
  });

  test('Scenario 3: Authenticated owner sees Items in Consignment & Delivery Destination cleanly on desktop & all 11 viewports', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    const loginRes = await page.request.post('/api/auth/customer/login', {
      data: { email: OWNER_EMAIL, password: OWNER_PASS },
    });
    expect(loginRes.ok()).toBe(true);

    await page.goto(`/track-order?id=${TEST_ORDER_NUMBER}`);

    const privateSection = page.getByTestId('private-order-details');
    await expect(privateSection).toBeVisible();
    await expect(privateSection).toContainText('Items in Consignment');
    await expect(privateSection).toContainText(SENSITIVE_ITEM_TEXT);
    await expect(privateSection).toContainText('Delivery Destination');
    await expect(privateSection).toContainText(SENSITIVE_ADDRESS_TEXT);
    await expect(page.getByTestId('order-privacy-warning')).toHaveCount(0);

    // Verify desktop fulfillment stepper lays stages horizontally (multi-column, not stacked)
    const stepperGrid = page.locator('.md\\:grid-cols-6, .md\\:grid-cols-7').first();
    await expect(stepperGrid).toBeVisible();
    const childBoxes = await stepperGrid.locator('> div').evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.x), y: Math.round(r.y) };
      })
    );
    expect(childBoxes.length).toBeGreaterThanOrEqual(6);
    // All horizontal step headers should start on the same horizontal row
    const distinctRows = new Set(childBoxes.map((b) => Math.round(b.y / 10) * 10));
    expect(distinctRows.size).toBe(1);

    // 11-viewport zero horizontal overflow audit
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(100);
      const metrics = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      expect(
        metrics.scrollWidth,
        `Horizontal overflow detected on /track-order at ${vp.name}`
      ).toBeLessThanOrEqual(metrics.innerWidth);
    }

    expect(pageErrors).toEqual([]);
  });
});

