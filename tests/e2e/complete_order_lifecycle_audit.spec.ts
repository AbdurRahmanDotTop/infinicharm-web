import { test, expect, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const VIEWPORTS_10 = [
  { name: 'Mobile-320', width: 320, height: 568 },
  { name: 'Mobile-375', width: 375, height: 667 },
  { name: 'Mobile-390', width: 390, height: 844 },
  { name: 'Mobile-414', width: 414, height: 896 },
  { name: 'Tablet-768', width: 768, height: 1024 },
  { name: 'Tablet-1024', width: 1024, height: 768 },
  { name: 'Laptop-1280', width: 1280, height: 720 },
  { name: 'Laptop-1440', width: 1440, height: 900 },
  { name: 'Desktop-1920', width: 1920, height: 1080 },
  { name: 'Ultrawide-2560', width: 2560, height: 1440 },
];

const DATA_DIR = path.join(process.cwd(), 'src', 'data');
const SNAPSHOT_FILES = [
  'orders.json',
  'products.json',
  'payment_gateways.json',
  'coupons.json',
  'notification_logs.json',
  'audit_logs.json',
];

function attachRuntimeWatchers(page: Page) {
  const consoleErrors: string[] = [];
  const consoleWarnings: string[] = [];
  const pageErrors: string[] = [];
  const serverErrors: string[] = [];

  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error') {
      consoleErrors.push(`[${page.url()}] ${text}`);
    } else if (
      msg.type() === 'warning' &&
      (text.includes('aria-hidden') || text.includes('useCache'))
    ) {
      consoleWarnings.push(`[${page.url()}] ${text}`);
    }
  });
  page.on('pageerror', (err) => pageErrors.push(`[${page.url()}] ${err.message}`));
  page.on('response', (res) => {
    const url = res.url();
    if (url.startsWith('http://localhost:3000') && res.status() >= 500) {
      serverErrors.push(`${res.status()} ${url}`);
    }
  });

  return { consoleErrors, consoleWarnings, pageErrors, serverErrors };
}

test.describe('InfiniCharm Complete End-to-End Order Lifecycle, Security & A11y Audit', () => {
  test.describe.configure({ mode: 'serial' });

  test('1. Accessibility (BackToTop aria-hidden/inert, CartDrawer Escape) & 10-Viewport Console Cleanliness', async ({
    browser,
  }) => {
    test.setTimeout(240000);
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    await context.addCookies([
      { name: 'infinicharm_admin_session', value: 'active', domain: 'localhost', path: '/' },
    ]);
    const page = await context.newPage();
    const { consoleErrors, consoleWarnings, pageErrors, serverErrors } = attachRuntimeWatchers(page);

    try {
      // A. BackToTop focus & aria-hidden/inert guard
      await page.goto('/shop', { waitUntil: 'networkidle' });
      await page.evaluate(() => window.scrollTo(0, 750));
      await page.waitForTimeout(300);

      const wrapper = page.getByTestId('back-to-top-wrapper');
      const backBtn = page.getByTestId('back-to-top-btn');
      await expect(backBtn).toBeVisible();
      await expect(wrapper).toHaveAttribute('aria-hidden', 'false');

      // Focus explicitly via keyboard focus then activate Enter -> ensures focus releases before aria-hidden="true"
      await backBtn.focus();
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => window.scrollY < 10, null, { timeout: 5000 });
      await page.waitForTimeout(150);

      await expect(wrapper).toHaveAttribute('aria-hidden', 'true');
      const hasFocusedDescendant = await page.evaluate(() => {
        const active = document.activeElement;
        const wrap = document.querySelector('[data-testid="back-to-top-wrapper"]');
        return Boolean(wrap && active && wrap.contains(active));
      });
      expect(hasFocusedDescendant).toBe(false);

      // B. CartDrawer Escape close & focus containment
      await page.goto('/product/100-kashmiri-honey', { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: /Add to Bag/i }).click();
      const bagDialog = page.getByRole('dialog', { name: 'Shopping Bag' });
      await expect(bagDialog).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(bagDialog).toHaveCount(0);

      // C. 10-viewport responsive overflow + clean console check across key storefront + admin routes
      const auditRoutes = [
        '/',
        '/shop',
        '/product/100-kashmiri-honey',
        '/cart',
        '/checkout',
        '/track-order',
        '/admin/orders',
        '/admin/payments',
      ];

      for (const route of auditRoutes) {
        await page.goto(route, { waitUntil: 'networkidle' });
        for (const vp of VIEWPORTS_10) {
          await page.setViewportSize({ width: vp.width, height: vp.height });
          const metrics = await page.evaluate(() => ({
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
          }));
          expect(
            metrics.scrollWidth,
            `${route} @ ${vp.name} horizontal overflow (${metrics.scrollWidth} > ${metrics.clientWidth})`
          ).toBeLessThanOrEqual(metrics.clientWidth + 1);
        }
      }

      // Explicitly assert zero content.js / useCache / aria-hidden errors in clean browser context
      const allRuntimeProblems = [...consoleErrors, ...consoleWarnings, ...pageErrors, ...serverErrors];
      expect(allRuntimeProblems).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('2. Full COD Lifecycle: RBAC -> Enable COD -> Cart/Coupon -> Checkout -> Stock/Idempotency -> Admin Confirm/Process/Ship/Deliver -> Track/Notifications -> Cancel Restock', async ({
    browser,
  }) => {
    test.setTimeout(240000);

    // Snapshot persistence files so E2E mutations leave workspace clean
    const snapshots = new Map<string, string>();
    for (const fileName of SNAPSHOT_FILES) {
      const fullPath = path.join(DATA_DIR, fileName);
      if (fs.existsSync(fullPath)) {
        snapshots.set(fullPath, fs.readFileSync(fullPath, 'utf-8'));
      }
    }

    const anonContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const customerContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const adminContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });

    await adminContext.addCookies([
      { name: 'infinicharm_admin_session', value: 'active', domain: 'localhost', path: '/' },
    ]);

    const customerPage = await customerContext.newPage();
    const adminPage = await adminContext.newPage();
    const customerWatchers = attachRuntimeWatchers(customerPage);
    const adminWatchers = attachRuntimeWatchers(adminPage);

    try {
      // 1. Verify RBAC protection on unauthenticated callers
      const unauthGatewayPut = await anonContext.request.put('/api/admin/payments/gateways', {
        data: { id: 'COD', name: 'Cash on Delivery (COD)', isEnabled: true, credentials: {} },
      });
      expect(unauthGatewayPut.status()).toBe(401);

      const unauthOrderPatch = await anonContext.request.patch('/api/orders/ORD-NONEXISTENT', {
        data: { action: 'UPDATE_STATUS', status: 'CONFIRMED' },
      });
      expect(unauthOrderPatch.status()).toBe(401);

      // 2. Enable COD dynamically via authenticated Admin API
      const gwListRes = await adminContext.request.get('/api/admin/payments/gateways');
      expect(gwListRes.status()).toBe(200);
      const gwListJson = await gwListRes.json();
      const codGateway = gwListJson.gateways.find((g: any) => g.id === 'COD');
      expect(codGateway).toBeTruthy();

      const enableCodRes = await adminContext.request.put('/api/admin/payments/gateways', {
        data: { ...codGateway, isEnabled: true },
      });
      expect(enableCodRes.status()).toBe(200);

      // Create an ephemeral test coupon for checkout verification (restored via snapshots in finally)
      const createCouponRes = await adminContext.request.post('/api/admin/coupons', {
        data: {
          code: 'E2ELIFE10',
          description: 'Temporary E2E Audit Coupon',
          discountType: 'PERCENTAGE',
          discountValue: 10,
          minOrderInPaise: 10000,
          maxDiscountInPaise: 50000,
          validFrom: '2026-01-01T00:00:00.000Z',
          validUntil: '2028-01-01T00:00:00.000Z',
          applicabilityType: 'ALL',
          userEligibility: 'ALL',
          isActive: true,
        },
      });
      expect(createCouponRes.status()).toBe(201);

      // Record baseline stock for 100% Kashmiri Honey default variant
      const prodResBefore = await adminContext.request.get('/api/products?slug=100-kashmiri-honey');
      const prodJsonBefore = await prodResBefore.json();
      const targetProduct = prodJsonBefore.products?.[0] || prodJsonBefore.product;
      expect(targetProduct).toBeTruthy();
      const targetVariant = targetProduct.variants[0];
      const initialStock = targetVariant.stockQuantity;
      expect(initialStock).toBeGreaterThanOrEqual(2);

      // 3. Customer signs in via UI /login
      await customerPage.goto('/login', { waitUntil: 'networkidle' });
      await customerPage.locator('input[type="email"]').fill('customer@infinicharm.com');
      await customerPage.locator('input[type="password"]').fill('Customer@1234!');
      await customerPage.getByRole('button', { name: /Sign In/i }).click();
      await expect(customerPage).toHaveURL(/\/account/, { timeout: 35000 });

      // 4. Product discovery -> PDP -> Add to Bag -> Persistence check across reload
      await customerPage.goto('/shop', { waitUntil: 'networkidle' });
      await expect(customerPage.getByText('100% Kashmiri Honey').first()).toBeVisible();
      await customerPage.goto('/product/100-kashmiri-honey', { waitUntil: 'networkidle' });
      await customerPage.getByRole('button', { name: /Add to Bag/i }).click();
      await expect(customerPage.getByRole('dialog', { name: 'Shopping Bag' })).toBeVisible();

      // Reload & confirm Cart persists cleanly
      await customerPage.reload({ waitUntil: 'networkidle' });
      await customerPage.goto('/checkout', { waitUntil: 'networkidle' });

      // 5. Form Validation check before filling address
      const phoneInput = customerPage.locator('input[placeholder*="9876543210"]');
      const prevPhone = await phoneInput.inputValue();
      await phoneInput.fill('123'); // invalid 3-digit phone
      await customerPage.getByRole('button', { name: /Confirm & Place Order/i }).click();
      await expect(customerPage.getByText(/Please enter a valid 10-digit mobile number/i)).toBeVisible();
      await phoneInput.fill(prevPhone || '8825164657');

      // Apply coupon E2ELIFE10
      const couponInput = customerPage.locator('input[placeholder="Enter coupon code"]');
      if ((await couponInput.count()) > 0) {
        await couponInput.fill('E2ELIFE10');
        await customerPage.getByRole('button', { name: /^Apply$/i }).click();
        await expect(customerPage.getByText(/Coupon E2ELIFE10 applied/i)).toBeVisible({ timeout: 20000 });
      }

      // Ensure shipping address fields populated
      const addrInput = customerPage.locator('input[placeholder*="Ward No. 07"]');
      if (!(await addrInput.inputValue())) {
        await customerPage.locator('input[placeholder*="AbdurRahman"]').fill('AbdurRahman Ibn Ghufran');
        await customerPage.locator('input[placeholder*="customer@gmail.com"]').fill('customer@infinicharm.com');
        await customerPage.locator('input[placeholder*="845427"]').fill('845427');
        await addrInput.fill('Ward No. 07, Lahsaniya, Patahi');
      }

      // Select Cash on Delivery (COD) and place order
      const codRadio = customerPage.locator('label:has-text("Cash on Delivery (COD)")');
      await expect(codRadio).toBeVisible();
      await codRadio.click();
      await customerPage.getByRole('button', { name: /Confirm & Place Order/i }).click();

      await expect(customerPage).toHaveURL(/.*\/checkout\/success\?order_id=INF-.*/, { timeout: 30000 });
      const placedOrderNumber = new URL(customerPage.url()).searchParams.get('order_id')!;
      expect(placedOrderNumber).toBeTruthy();

      // Verify success page survives hard reload via server API fallback
      await customerPage.reload({ waitUntil: 'networkidle' });
      await expect(customerPage.getByText(placedOrderNumber)).toBeVisible();

      // 6. Verify duplicate submission prevention (409) & stock decrement
      const dupRes = await customerContext.request.post('/api/orders', {
        data: {
          orderNumber: placedOrderNumber,
          items: [{ productId: targetProduct.id, variantId: targetVariant.id, quantity: 1 }],
          paymentMethod: 'COD',
        },
      });
      expect(dupRes.status()).toBe(409);

      const prodResAfterOrder = await adminContext.request.get('/api/products?slug=100-kashmiri-honey');
      const prodJsonAfterOrder = await prodResAfterOrder.json();
      const updatedVariant = (prodJsonAfterOrder.products?.[0] || prodJsonAfterOrder.product).variants.find(
        (v: any) => v.id === targetVariant.id
      );
      expect(updatedVariant.stockQuantity).toBe(initialStock - 1);

      // Verify initial COD status is PENDING on server
      const initialOrderRes = await customerContext.request.get(`/api/orders/${placedOrderNumber}`);
      const initialOrderJson = await initialOrderRes.json();
      expect(initialOrderJson.order.status).toBe('PENDING');
      expect(initialOrderJson.order.paymentStatus).toBe('PENDING');
      expect(initialOrderJson.order.taxInPaise).toBeGreaterThan(0);

      // Verify privacy protection: anonymous session cannot see private consignment items/address
      const anonOrderRes = await anonContext.request.get(`/api/orders/${placedOrderNumber}`);
      const anonOrderJson = await anonOrderRes.json();
      expect(anonOrderJson.privacy?.isOwner).toBe(false);
      expect(anonOrderJson.privacy?.canViewPrivateDetails).toBe(false);
      expect(anonOrderJson.order.items).toBeUndefined();
      expect(anonOrderJson.order.shippingAddress).toBeUndefined();

      // 7. Admin Fulfillment Lifecycle via /admin/orders UI: PENDING -> CONFIRMED -> PROCESSING -> SHIPPED (AWB) -> OUT_FOR_DELIVERY -> DELIVERED
      await adminPage.goto('/admin/orders', { waitUntil: 'networkidle' });
      const searchBox = adminPage.locator('input[placeholder*="Search by Order ID"]');
      await searchBox.fill(placedOrderNumber);
      await adminPage.waitForTimeout(300);

      const orderRow = adminPage.locator('tr', { hasText: placedOrderNumber }).first();
      await expect(orderRow).toBeVisible();
      const statusSelect = orderRow.locator('select');

      // Step A: Confirm Order
      const patchConfirmedPromise = adminPage.waitForResponse(
        (r) => r.url().includes('/api/orders/') && r.request().method() === 'PATCH'
      );
      await statusSelect.selectOption('CONFIRMED');
      expect((await patchConfirmedPromise).status()).toBe(200);

      // Step B: Processing
      const patchProcessingPromise = adminPage.waitForResponse(
        (r) => r.url().includes('/api/orders/') && r.request().method() === 'PATCH'
      );
      await statusSelect.selectOption('PROCESSING');
      expect((await patchProcessingPromise).status()).toBe(200);

      // Step C: Assign Courier + AWB (moves to SHIPPED)
      await orderRow.getByRole('button', { name: /\+ Assign AWB/i }).click();
      await adminPage.locator('input[placeholder*="DLV21693550161"]').fill('DLV99887766554');
      const patchShippedPromise = adminPage.waitForResponse(
        (r) => r.url().includes('/api/orders/') && r.request().method() === 'PATCH'
      );
      await adminPage.getByRole('button', { name: /Save & Mark In Transit/i }).click();
      expect((await patchShippedPromise).status()).toBe(200);
      await expect(orderRow.getByText('DLV99887766554')).toBeVisible();

      // Step D: Out for Delivery -> Delivered
      const patchOfdPromise = adminPage.waitForResponse(
        (r) => r.url().includes('/api/orders/') && r.request().method() === 'PATCH'
      );
      await statusSelect.selectOption('OUT_FOR_DELIVERY');
      expect((await patchOfdPromise).status()).toBe(200);

      const patchDeliveredPromise = adminPage.waitForResponse(
        (r) => r.url().includes('/api/orders/') && r.request().method() === 'PATCH'
      );
      await statusSelect.selectOption('DELIVERED');
      expect((await patchDeliveredPromise).status()).toBe(200);

      // Verify COD payment synced to PAID upon DELIVERED
      const finalOrderRes = await adminContext.request.get(`/api/orders/${placedOrderNumber}`);
      const finalOrderJson = await finalOrderRes.json();
      expect(finalOrderJson.order.status).toBe('DELIVERED');
      expect(finalOrderJson.order.paymentStatus).toBe('PAID');

      // 8. Customer Tracking (/track-order) & Order History (/account/orders) verification
      await customerPage.goto(`/track-order?id=${placedOrderNumber}`, { waitUntil: 'networkidle' });
      await expect(customerPage.getByText(placedOrderNumber).first()).toBeVisible();
      await expect(customerPage.getByText('DLV99887766554').first()).toBeVisible();
      await expect(customerPage.getByText('Items in Consignment')).toBeVisible();
      await expect(customerPage.getByText('Delivery Destination')).toBeVisible();

      await customerPage.goto('/account/orders', { waitUntil: 'networkidle' });
      await expect(customerPage.getByText(placedOrderNumber).first()).toBeVisible();

      // 9. Transactional Notification Pipeline logs check across lifecycle events
      const notifRes = await adminContext.request.get('/api/admin/notifications/logs');
      expect(notifRes.status()).toBe(200);
      const notifJson = await notifRes.json();
      const orderLogs = (notifJson.logs || []).filter(
        (l: any) => JSON.stringify(l).includes(placedOrderNumber)
      );
      expect(orderLogs.length).toBeGreaterThan(0);

      // 10. Cancel Restock Verification
      const cancelOrderNo = `INF-E2E-CANCEL-${Date.now()}`;
      const cancelCreateRes = await customerContext.request.post('/api/orders', {
        data: {
          orderNumber: cancelOrderNo,
          items: [{ productId: targetProduct.id, variantId: targetVariant.id, quantity: 1 }],
          paymentMethod: 'COD',
          shippingAddress: {
            fullName: 'AbdurRahman Ibn Ghufran',
            phone: '8825164657',
            addressLine1: 'Ward No. 07, Patahi',
            city: 'Motihari',
            state: 'Bihar',
            postalCode: '845427',
            country: 'India',
          },
          customerEmail: 'customer@infinicharm.com',
          customerPhone: '8825164657',
        },
      });
      expect(cancelCreateRes.status()).toBe(201);

      const midStockRes = await adminContext.request.get('/api/products?slug=100-kashmiri-honey');
      const midStockJson = await midStockRes.json();
      const midStock = (midStockJson.products?.[0] || midStockJson.product).variants.find(
        (v: any) => v.id === targetVariant.id
      ).stockQuantity;
      expect(midStock).toBe(initialStock - 2);

      const cancelPatchRes = await adminContext.request.patch(`/api/orders/${cancelOrderNo}`, {
        data: { action: 'UPDATE_STATUS', status: 'CANCELLED', adminNotes: 'E2E cancellation restock test' },
      });
      expect(cancelPatchRes.status()).toBe(200);

      const afterCancelRes = await adminContext.request.get('/api/products?slug=100-kashmiri-honey');
      const afterCancelJson = await afterCancelRes.json();
      const afterCancelStock = (afterCancelJson.products?.[0] || afterCancelJson.product).variants.find(
        (v: any) => v.id === targetVariant.id
      ).stockQuantity;
      expect(afterCancelStock).toBe(initialStock - 1);

      // Verify clean runtime console/network across full flow
      expect([
        ...customerWatchers.consoleErrors,
        ...customerWatchers.consoleWarnings,
        ...customerWatchers.pageErrors,
        ...customerWatchers.serverErrors,
        ...adminWatchers.consoleErrors,
        ...adminWatchers.consoleWarnings,
        ...adminWatchers.pageErrors,
        ...adminWatchers.serverErrors,
      ]).toEqual([]);
    } finally {
      await anonContext.close();
      await customerContext.close();
      await adminContext.close();
      for (const [fullPath, originalContent] of snapshots.entries()) {
        fs.writeFileSync(fullPath, originalContent, 'utf-8');
      }
    }
  });
});
