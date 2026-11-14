import { test, expect } from '@playwright/test';
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';

interface CapturedEmail {
  to: string[];
  raw: string;
  decoded: string;
}

const DATA_DIR = path.join(process.cwd(), 'src', 'data');
const SNAPSHOT_FILES = [
  'customers.json',
  'orders.json',
  'products.json',
  'payment_gateways.json',
  'auth_settings.json',
  'email_verification_tokens.json',
  'password_reset_tokens.json',
  'smtp_configs.json',
  'notification_delivery_logs.json',
  'email_delivery_logs.json',
  'audit_logs.json',
];

const TEN_VIEWPORTS = [
  { width: 320, height: 568, name: '320px Mobile Portrait Small' },
  { width: 375, height: 667, name: '375px Mobile Portrait Medium' },
  { width: 390, height: 844, name: '390px Mobile Large' },
  { width: 480, height: 854, name: '480px Mobile Landscape' },
  { width: 768, height: 1024, name: '768px Tablet Portrait' },
  { width: 1024, height: 768, name: '1024px Tablet Landscape' },
  { width: 1280, height: 800, name: '1280px Laptop Standard' },
  { width: 1440, height: 900, name: '1440px Desktop Wide' },
  { width: 1920, height: 1080, name: '1920px FHD Desktop' },
  { width: 2560, height: 1440, name: '2560px QHD Ultra-wide' },
];

function decodeEmailPayload(raw: string): string {
  let out = raw.replace(/=\r?\n/g, '').replace(/=([0-9A-Fa-f]{2})/g, (_m, hex) => {
    try {
      return String.fromCharCode(parseInt(hex, 16));
    } catch {
      return _m;
    }
  });
  return out;
}

function startLocalSmtpCaptureServer(): Promise<{
  port: number;
  emails: CapturedEmail[];
  close: () => Promise<void>;
}> {
  return new Promise((resolve, reject) => {
    const emails: CapturedEmail[] = [];
    const server = net.createServer((socket) => {
      let buffer = '';
      let inData = false;
      let authStage: 0 | 1 | 2 = 0;
      let rcptTo: string[] = [];
      let msgData = '';

      socket.write('220 localhost ESMTP InfiniCharm-Capture\r\n');

      socket.on('data', (chunk) => {
        buffer += chunk.toString('utf8');

        while (true) {
          if (inData) {
            const endIdx = buffer.indexOf('\r\n.\r\n');
            const altEnd = buffer.indexOf('\n.\n');
            if (endIdx !== -1) {
              msgData += buffer.slice(0, endIdx);
              buffer = buffer.slice(endIdx + 5);
              emails.push({
                to: [...rcptTo],
                raw: msgData,
                decoded: decodeEmailPayload(msgData),
              });
              inData = false;
              msgData = '';
              socket.write('250 2.0.0 Ok: queued cleanly\r\n');
              continue;
            } else if (altEnd !== -1) {
              msgData += buffer.slice(0, altEnd);
              buffer = buffer.slice(altEnd + 3);
              emails.push({
                to: [...rcptTo],
                raw: msgData,
                decoded: decodeEmailPayload(msgData),
              });
              inData = false;
              msgData = '';
              socket.write('250 2.0.0 Ok: queued cleanly\r\n');
              continue;
            } else {
              break;
            }
          }

          const lineEnd = buffer.indexOf('\n');
          if (lineEnd === -1) break;
          const line = buffer.slice(0, lineEnd).replace(/\r$/, '');
          buffer = buffer.slice(lineEnd + 1);
          const upper = line.toUpperCase();

          if (authStage === 1) {
            authStage = 2;
            socket.write('334 UGFzc3dvcmQ6\r\n');
          } else if (authStage === 2) {
            authStage = 0;
            socket.write('235 2.7.0 Authentication successful\r\n');
          } else if (upper.startsWith('EHLO')) {
            socket.write('250-localhost\r\n250-AUTH PLAIN LOGIN\r\n250-SIZE 10485760\r\n250 8BITMIME\r\n');
          } else if (upper.startsWith('HELO')) {
            socket.write('250 localhost\r\n');
          } else if (upper.startsWith('AUTH PLAIN ')) {
            socket.write('235 2.7.0 Authentication successful\r\n');
          } else if (upper === 'AUTH PLAIN') {
            authStage = 2;
            socket.write('334 \r\n');
          } else if (upper.startsWith('AUTH LOGIN')) {
            authStage = upper.length > 10 ? 2 : 1;
            socket.write(authStage === 2 ? '334 UGFzc3dvcmQ6\r\n' : '334 VXNlcm5hbWU6\r\n');
          } else if (upper.startsWith('MAIL FROM:')) {
            rcptTo = [];
            msgData = '';
            socket.write('250 2.1.0 Ok\r\n');
          } else if (upper.startsWith('RCPT TO:')) {
            const m = line.match(/<([^>]+)>/);
            if (m) rcptTo.push(m[1].toLowerCase());
            socket.write('250 2.1.5 Ok\r\n');
          } else if (upper === 'DATA') {
            inData = true;
            socket.write('354 End data with <CR><LF>.<CR><LF>\r\n');
          } else if (upper === 'RSET') {
            rcptTo = [];
            msgData = '';
            socket.write('250 2.0.0 Ok\r\n');
          } else if (upper === 'QUIT') {
            socket.write('221 2.0.0 Bye\r\n');
            socket.end();
            break;
          } else {
            socket.write('250 Ok\r\n');
          }
        }
      });
    });

    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        reject(new Error('Failed to bind local capture SMTP server'));
        return;
      }
      resolve({
        port: addr.port,
        emails,
        close: () =>
          new Promise<void>((res) => {
            server.close(() => res());
          }),
      });
    });
  });
}

async function waitForCapturedOtp(
  emails: CapturedEmail[],
  recipientEmail: string,
  minEmailIndex: number = 0
): Promise<string> {
  const target = recipientEmail.toLowerCase();
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    for (let i = emails.length - 1; i >= minEmailIndex; i--) {
      const e = emails[i];
      if (!e.to.includes(target) && !e.decoded.toLowerCase().includes(target)) continue;
      const otpMatch =
        e.decoded.match(/Verify Your Email\s*[—–-]\s*([0-9]{6})/i) ||
        e.decoded.match(/6-digit code is\s*([0-9]{6})/i) ||
        e.decoded.match(/Code:\s*([0-9]{6})/i) ||
        e.decoded.match(/letter-spacing:10px[^>]*>([0-9]{6})</i);

      if (otpMatch) {
        return otpMatch[1];
      }
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`Timed out waiting for verification OTP to ${recipientEmail}`);
}

test.describe('Complete Customer Journey & Order Fulfillment Lifecycle Audit', () => {
  test.describe.configure({ mode: 'serial' });

  let smtpCapture: Awaited<ReturnType<typeof startLocalSmtpCaptureServer>>;
  const snapshots = new Map<string, string | null>();

  test.beforeAll(async () => {
    // 1. Take snapshots of persistence stores
    for (const file of SNAPSHOT_FILES) {
      const fullPath = path.join(DATA_DIR, file);
      snapshots.set(file, fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf8') : null);
    }

    // 2. Start local SMTP capture server
    smtpCapture = await startLocalSmtpCaptureServer();

    // 3. Configure local SMTP in smtp_configs.json
    let cipherEnvKey =
      process.env.SMTP_ENCRYPTION_SECRET ||
      process.env.PAYMENT_GATEWAY_KEY_SECRET ||
      'infinicharm-local-smtp-cipher-default-key';
    const envLocalPath = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(envLocalPath)) {
      const envText = fs.readFileSync(envLocalPath, 'utf8');
      const smtpMatch = envText.match(/^SMTP_ENCRYPTION_SECRET=(.+)$/m);
      const gwMatch = envText.match(/^PAYMENT_GATEWAY_KEY_SECRET=(.+)$/m);
      const picked = smtpMatch?.[1]?.trim() || gwMatch?.[1]?.trim();
      if (picked) cipherEnvKey = picked.replace(/^["']|["']$/g, '');
    }
    const key = crypto.scryptSync(cipherEnvKey, 'infinicharm-smtp-salt-v1', 32);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const enc = Buffer.concat([cipher.update('e2e-local-smtp-secret', 'utf8'), cipher.final()]);
    const encryptedSecret = `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${enc.toString('hex')}`;

    const localSmtpConfig = [
      {
        id: 'smtp-e2e-capture',
        name: 'Playwright E2E Local Capture Relay',
        providerType: 'CUSTOM_SMTP',
        host: '127.0.0.1',
        port: smtpCapture.port,
        encryption: 'NONE',
        username: 'capture-user',
        encryptedSecret,
        useEnvCredentials: false,
        senderName: 'InfiniCharm',
        senderEmail: 'support@infinicharm.com',
        replyToEmail: 'support@infinicharm.com',
        isDefault: true,
        isEnabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    fs.writeFileSync(
      path.join(DATA_DIR, 'smtp_configs.json'),
      JSON.stringify(localSmtpConfig, null, 2),
      'utf8'
    );

    // 4. Enable COD gateway for checkout order testing (snapshot restored in afterAll)
    const gwPath = path.join(DATA_DIR, 'payment_gateways.json');
    if (fs.existsSync(gwPath)) {
      const gateways = JSON.parse(fs.readFileSync(gwPath, 'utf8'));
      const cod = gateways.find((g: any) => g.id === 'COD');
      if (cod) {
        cod.isEnabled = true;
        fs.writeFileSync(gwPath, JSON.stringify(gateways, null, 2), 'utf8');
      }
    }
  });

  test.afterAll(async () => {
    if (smtpCapture) {
      await smtpCapture.close();
    }
    for (const [file, content] of snapshots.entries()) {
      const fullPath = path.join(DATA_DIR, file);
      if (content === null) {
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      } else {
        fs.writeFileSync(fullPath, content, 'utf8');
      }
    }
  });

  test('Complete Customer Flow: Account Creation -> Email OTP Verification -> Login -> Product Selection -> Cart -> Checkout -> Order Tracking -> Admin Confirmation -> Shipping (AWB) -> Delivery -> Order History', async ({
    browser,
  }) => {
    test.setTimeout(180000);

    const timestamp = Date.now();
    const customerName = 'Zayd Rahman';
    const customerEmail = `customer.journey.${timestamp}@example.com`;
    const customerPassword = 'SecurePassword!2026';
    const startMailIdx = smtpCapture.emails.length;

    // Customer browser session
    const customerContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const customerPage = await customerContext.newPage();

    // Admin browser session
    const adminContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const adminPage = await adminContext.newPage();

    try {
      // -------------------------------------------------------------
      // STAGE 1: ACCOUNT REGISTRATION
      // -------------------------------------------------------------
      await customerPage.goto('/register');
      await expect(customerPage.getByRole('heading', { name: /Create Your Account/i })).toBeVisible();

      await customerPage.getByPlaceholder('Aarav Sharma').fill(customerName);
      await customerPage.getByPlaceholder('aarav@example.com').fill(customerEmail);
      await customerPage.getByPlaceholder('+91 98765 43210').fill('8825164657');
      await customerPage.getByLabel('Password', { exact: true }).fill(customerPassword);
      await customerPage.getByLabel('Confirm Password', { exact: true }).fill(customerPassword);
      await customerPage.locator('input[type="checkbox"]').check();
      await customerPage.getByRole('button', { name: /Create InfiniCharm Account/i }).click();

      // Verification pending screen must appear with OTP inputs
      await expect(customerPage.getByTestId('register-verification-pending')).toBeVisible({ timeout: 10000 });
      await expect(customerPage.getByTestId('register-verification-pending')).toContainText(customerEmail);
      await expect(customerPage.getByTestId('otp-input-group')).toBeVisible();

      // -------------------------------------------------------------
      // STAGE 2: EMAIL OTP VERIFICATION
      // -------------------------------------------------------------
      const receivedOtp = await waitForCapturedOtp(smtpCapture.emails, customerEmail, startMailIdx);
      expect(receivedOtp).toMatch(/^\d{6}$/);

      // Type the 6-digit OTP into the boxes
      for (let i = 0; i < 6; i++) {
        await customerPage.getByTestId(`otp-box-${i}`).fill(receivedOtp[i]);
      }

      // If submit button is enabled, click it
      const submitBtn = customerPage.getByTestId('verify-otp-submit-btn');
      if (await submitBtn.isVisible() && (await submitBtn.isEnabled())) {
        await submitBtn.click();
      }

      // Verification success confirmation and automatic redirection to /account
      await expect(
        customerPage.getByText(/Email Verified Successfully/i)
      ).toBeVisible({ timeout: 10000 });
      await customerPage.waitForURL(/\/account/, { timeout: 10000 });
      await expect(
        customerPage.getByText(customerName).or(customerPage.getByText(/Order History/i))
      ).toBeVisible();

      // -------------------------------------------------------------
      // STAGE 3: CUSTOMER LOGIN VERIFICATION
      // -------------------------------------------------------------
      // Customer is logged in and authenticated with active session cookies
      const cookies = await customerContext.cookies();
      const hasCustomerSession = cookies.some((c) => c.name === 'infinicharm_customer_session' && c.value === 'active');
      expect(hasCustomerSession).toBe(true);

      // -------------------------------------------------------------
      // STAGE 4: CATALOGUE DISCOVERY & ADD TO CART
      // -------------------------------------------------------------
      await customerPage.goto('/shop');
      await expect(customerPage.getByText(/100% Kashmiri Honey|Pure Shilajit Resin/i).first()).toBeVisible();

      // Navigate to product details page (PDP)
      await customerPage.goto('/product/100-kashmiri-honey');
      await expect(customerPage.getByRole('heading', { name: /100% Kashmiri Honey/i })).toBeVisible();

      // Click Add to Bag
      await customerPage.getByRole('button', { name: /Add to Bag/i }).click();

      // Cart drawer should open with added item
      const bagDialog = customerPage.getByRole('dialog', { name: 'Shopping Bag' });
      await expect(bagDialog).toBeVisible({ timeout: 5000 });
      await expect(bagDialog.getByText(/100% Kashmiri Honey/i).first()).toBeVisible();

      // -------------------------------------------------------------
      // STAGE 5: CHECKOUT & ORDER PLACEMENT
      // -------------------------------------------------------------
      // Click Proceed to Checkout in the drawer
      await bagDialog.getByRole('link', { name: /Proceed to Checkout/i }).click();
      await customerPage.waitForURL(/\/checkout/, { timeout: 10000 });
      await expect(customerPage.getByRole('heading', { name: /Secure Checkout/i })).toBeVisible();

      // Ensure shipping details are filled
      const addrInput = customerPage.locator('input[placeholder*="Ward No. 07"]');
      if (!(await addrInput.inputValue())) {
        await customerPage.locator('input[placeholder*="AbdurRahman"]').fill('Zayd Rahman');
        await customerPage.locator('input[placeholder*="customer@gmail.com"]').fill(customerEmail);
        await customerPage.locator('input[placeholder*="845427"]').fill('845427');
        await customerPage.waitForTimeout(400);

        const cityInput = customerPage.locator('input[placeholder*="Auto-filled or type city"]');
        if (!(await cityInput.inputValue())) {
          await cityInput.fill('Motihari');
        }
        const stateInput = customerPage.locator('input[placeholder*="e.g. Bihar, Delhi"]');
        if (!(await stateInput.inputValue())) {
          await stateInput.fill('Bihar');
        }

        await addrInput.fill('Ward No. 07, Lahsaniya, Patahi');
        await customerPage.locator('input[placeholder*="9876543210"]').fill('8825164657');
      }

      // Choose Cash on Delivery (COD) if available, or Custom UPI with 12-digit UTR
      const codOption = customerPage.locator('label:has-text("Cash on Delivery (COD)")');
      try {
        await codOption.waitFor({ state: 'visible', timeout: 5000 });
        await codOption.click();
      } catch {
        // Fallback to Custom UPI with UTR
        const utrInput = customerPage.locator('input[placeholder*="e.g. 431209876543"]');
        if (await utrInput.isVisible()) {
          await utrInput.fill('431209876543');
        }
      }

      // Place Order
      await customerPage.getByRole('button', { name: /Confirm & Place Order/i }).click();

      // Wait for navigation to /checkout/success
      await expect(customerPage).toHaveURL(/.*\/checkout\/success\?order_id=INF-.*/, { timeout: 30000 });
      const successUrl = new URL(customerPage.url());
      const placedOrderId = successUrl.searchParams.get('order_id');
      expect(placedOrderId).toBeTruthy();
      expect(placedOrderId).toMatch(/^INF-\d{6}-\d{4}$/);

      // Verify order number on success screen
      await expect(customerPage.getByText(placedOrderId!)).toBeVisible();

      // -------------------------------------------------------------
      // STAGE 6: CUSTOMER ORDER TRACKING (INITIAL PENDING STATE)
      // -------------------------------------------------------------
      await customerPage.goto(`/track-order?id=${placedOrderId}`);
      await expect(customerPage.getByText(placedOrderId!).first()).toBeVisible();
      // Owner view must show items and shipping destination
      await expect(customerPage.getByTestId('private-order-details')).toBeVisible();
      await expect(customerPage.getByText('Items in Consignment')).toBeVisible();
      await expect(customerPage.getByText('Delivery Destination')).toBeVisible();

      // -------------------------------------------------------------
      // STAGE 7: ADMIN CONFIRMATION, PROCESSING & AWB SHIPMENT
      // -------------------------------------------------------------
      // 1. Log in to Admin portal
      await adminPage.goto('/admin/login');
      await adminPage.getByPlaceholder('admin@infinicharm.com').fill('admin@infinicharm.com');
      await adminPage.locator('input[type="password"]').fill(process.env.ADMIN_PASSWORD || 'Admin@1234!');
      await adminPage.getByRole('button', { name: /Authenticate & Enter/i }).click();
      await adminPage.waitForURL(/\/admin\/dashboard/, { timeout: 10000 });

      // 2. Open Admin Orders console
      await adminPage.goto('/admin/orders');
      await expect(adminPage.getByRole('heading', { name: /Order Management|Orders/i })).toBeVisible();

      // 3. Search for the placed order
      const searchBox = adminPage.locator('input[placeholder*="Search by Order ID"]');
      await searchBox.fill(placedOrderId!);
      await adminPage.waitForTimeout(300);

      const orderRow = adminPage.locator('tr', { hasText: placedOrderId! }).first();
      await expect(orderRow).toBeVisible();
      const statusSelect = orderRow.locator('select');

      // Step A: Mark CONFIRMED
      const confirmPatchPromise = adminPage.waitForResponse(
        (r) => r.url().includes('/api/orders/') && r.request().method() === 'PATCH'
      );
      await statusSelect.selectOption('CONFIRMED');
      expect((await confirmPatchPromise).status()).toBe(200);

      // Step B: Mark PROCESSING
      const processingPatchPromise = adminPage.waitForResponse(
        (r) => r.url().includes('/api/orders/') && r.request().method() === 'PATCH'
      );
      await statusSelect.selectOption('PROCESSING');
      expect((await processingPatchPromise).status()).toBe(200);

      // Step C: Assign Courier & AWB (transitions to SHIPPED / In Transit)
      await orderRow.getByRole('button', { name: /\+ Assign AWB/i }).click();
      const testAwb = `DLV${Date.now().toString().slice(-9)}`;
      await adminPage.locator('input[placeholder*="DLV21693550161"]').fill(testAwb);
      const shipPatchPromise = adminPage.waitForResponse(
        (r) => r.url().includes('/api/orders/') && r.request().method() === 'PATCH'
      );
      await adminPage.getByRole('button', { name: /Save & Mark In Transit/i }).click();
      expect((await shipPatchPromise).status()).toBe(200);
      await expect(orderRow.getByText(testAwb)).toBeVisible();

      // -------------------------------------------------------------
      // STAGE 8: FINAL DELIVERY (OUT FOR DELIVERY -> DELIVERED)
      // -------------------------------------------------------------
      // Step D: Out for Delivery
      const ofdPatchPromise = adminPage.waitForResponse(
        (r) => r.url().includes('/api/orders/') && r.request().method() === 'PATCH'
      );
      await statusSelect.selectOption('OUT_FOR_DELIVERY');
      expect((await ofdPatchPromise).status()).toBe(200);

      // Step E: Delivered
      const deliveredPatchPromise = adminPage.waitForResponse(
        (r) => r.url().includes('/api/orders/') && r.request().method() === 'PATCH'
      );
      await statusSelect.selectOption('DELIVERED');
      expect((await deliveredPatchPromise).status()).toBe(200);

      // -------------------------------------------------------------
      // STAGE 9: CUSTOMER VERIFICATION OF DELIVERED ORDER & HISTORY
      // -------------------------------------------------------------
      await customerPage.goto(`/track-order?id=${placedOrderId}`);
      await expect(customerPage.getByText(/Delivered Successfully/i)).toBeVisible();
      await expect(customerPage.getByText(testAwb).first()).toBeVisible();

      // Customer account orders history
      await customerPage.goto('/account/orders');
      await expect(customerPage.getByText(placedOrderId!).first()).toBeVisible();
      await expect(customerPage.getByText(/DELIVERED/i).first()).toBeVisible();

      // -------------------------------------------------------------
      // STAGE 10: 10-VIEWPORT ZERO HORIZONTAL OVERFLOW AUDIT
      // -------------------------------------------------------------
      const testPages = ['/shop', `/product/100-kashmiri-honey`, `/track-order?id=${placedOrderId}`, '/account/orders'];
      for (const route of testPages) {
        await customerPage.goto(route);
        for (const vp of TEN_VIEWPORTS) {
          await customerPage.setViewportSize({ width: vp.width, height: vp.height });
          await customerPage.waitForTimeout(60);
          const hasOverflow = await customerPage.evaluate(
            () => document.documentElement.scrollWidth > window.innerWidth
          );
          expect(hasOverflow, `Horizontal overflow detected on ${route} at ${vp.name}`).toBe(false);
        }
      }
    } finally {
      await customerContext.close();
      await adminContext.close();
    }
  });
});

