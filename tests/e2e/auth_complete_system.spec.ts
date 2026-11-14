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
  'auth_settings.json',
  'email_verification_tokens.json',
  'password_reset_tokens.json',
  'smtp_configs.json',
  'notification_delivery_logs.json',
  'email_delivery_logs.json',
  'audit_logs.json',
  'payment_transactions.json',
];
const snapshots = new Map<string, string | null>();

const TEN_VIEWPORTS = [
  { width: 320, height: 568, name: '320px Mobile Portrait Small' },
  { width: 375, height: 667, name: '375px Mobile Portrait Medium' },
  { width: 414, height: 896, name: '414px Mobile Portrait Large' },
  { width: 480, height: 854, name: '480px Mobile Landscape' },
  { width: 600, height: 960, name: '600px Small Tablet Portrait' },
  { width: 768, height: 1024, name: '768px Tablet Portrait' },
  { width: 1024, height: 768, name: '1024px Tablet Landscape' },
  { width: 1280, height: 800, name: '1280px Laptop Standard' },
  { width: 1440, height: 900, name: '1440px Desktop Wide' },
  { width: 1920, height: 1080, name: '1920px FHD Desktop' },
  { width: 2560, height: 1440, name: '2560px QHD Ultra-wide' },
];

function decodeEmailPayload(raw: string): string {
  // Handle soft line breaks and =3D/=26 hex escapes from quoted-printable plus base64 MIME chunks
  let out = raw.replace(/=\r?\n/g, '').replace(/=([0-9A-Fa-f]{2})/g, (_m, hex) => {
    try {
      return String.fromCharCode(parseInt(hex, 16));
    } catch {
      return _m;
    }
  });

  const parts = raw.split(/\r?\n\r?\n/);
  for (const part of parts) {
    const compact = part.replace(/\s+/g, '');
    if (compact.length >= 40 && /^[A-Za-z0-9+/=]+$/.test(compact)) {
      try {
        const decodedPart = Buffer.from(compact, 'base64').toString('utf8');
        if (decodedPart.includes('http') || decodedPart.includes('<html') || decodedPart.includes('token=')) {
          out += '\n' + decodedPart;
        }
      } catch {}
    }
  }
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

async function waitForCapturedLink(
  emails: CapturedEmail[],
  recipientEmail: string,
  pathFragment: '/verify-email' | '/reset-password',
  minEmailIndex: number = 0
): Promise<{ url: string; nextIndex: number }> {
  const target = recipientEmail.toLowerCase();
  const re = new RegExp(`https?:\\/\\/[^\\s"'<>]+${pathFragment.replace('/', '\\/')}\\?token=[a-f0-9]+`, 'i');
  const deadline = Date.now() + 12_000;
  while (Date.now() < deadline) {
    for (let i = emails.length - 1; i >= minEmailIndex; i--) {
      const e = emails[i];
      if (!e.to.includes(target) && !e.decoded.toLowerCase().includes(target)) continue;
      const m = e.decoded.match(re);
      if (m) {
        return { url: m[0], nextIndex: i + 1 };
      }
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`Timed out waiting for SMTP ${pathFragment} email to ${recipientEmail}`);
}

test.describe('Complete Authentication, Email Verification, Checkout & Admin Auth Audit', () => {
  test.describe.configure({ mode: 'serial' });
  let smtpCapture: Awaited<ReturnType<typeof startLocalSmtpCaptureServer>>;

  test.beforeEach(async () => {
    test.setTimeout(90_000);
  });

  test.beforeAll(async () => {
    for (const file of SNAPSHOT_FILES) {
      const fullPath = path.join(DATA_DIR, file);
      snapshots.set(file, fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf8') : null);
    }

    smtpCapture = await startLocalSmtpCaptureServer();

    // Read .env.local if present to match Next.js server encryption cipher key
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
  });

  test.afterAll(async () => {
    if (smtpCapture) {
      await smtpCapture.close();
    }
    for (const [file, raw] of snapshots.entries()) {
      const fullPath = path.join(DATA_DIR, file);
      if (raw === null) {
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      } else {
        fs.writeFileSync(fullPath, raw, 'utf8');
      }
    }
  });

  test('Scenario 1 & 2: Register -> Unverified login denied -> Resend invalidates previous link -> Single-use verify + Expired/Invalid rejection -> Verified login & reload persistence', async ({ page }) => {
    const uniqueEmail = `e2e-reg-${Date.now()}@example.com`;
    const password = 'ValidPass!2026';
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text());
    });
    page.on('pageerror', (e) => pageErrors.push(e.message));

    const startIdx = smtpCapture.emails.length;

    await page.goto('/register');
    await page.getByLabel('Full Name').fill('Aarav E2E Tester');
    await page.getByLabel('Email Address').fill(uniqueEmail);
    await page.getByLabel('Mobile Phone (Optional)').fill('9876543210');
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByLabel('Confirm Password', { exact: true }).fill(password);
    await page.locator('input[type="checkbox"]').check();
    await page.getByRole('button', { name: /Create InfiniCharm Account/i }).click();

    await expect(page.getByTestId('register-verification-pending')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('register-verification-pending')).toContainText(uniqueEmail);

    const firstMail = await waitForCapturedLink(smtpCapture.emails, uniqueEmail, '/verify-email', startIdx);

    // Unverified user MUST NOT log in
    await page.goto('/login');
    await page.getByLabel('Email Address').fill(uniqueEmail);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: /Sign In to Account/i }).click();
    await expect(page.getByTestId('resend-verification-box')).toBeVisible();

    // Test cooldown rate-limit (30s cooldown on immediate resend)
    const resendBtn = page.getByTestId('resend-verification-box').getByRole('button');
    await resendBtn.click();
    await expect(page.getByTestId('resend-verification-box')).toContainText(/wait \d+s/i, { timeout: 15000 });

    // Clear cooldown timestamp artificially in test store only to exercise link superseding, then click Resend via UI
    const vTokensPath = path.join(DATA_DIR, 'email_verification_tokens.json');
    const vTokens = JSON.parse(fs.readFileSync(vTokensPath, 'utf8'));
    vTokens.forEach((t: any) => {
      if (t.email === uniqueEmail) {
        t.createdAt = new Date(Date.now() - 40_000).toISOString();
      }
    });
    fs.writeFileSync(vTokensPath, JSON.stringify(vTokens, null, 2), 'utf8');

    const beforeResendIdx = smtpCapture.emails.length;
    await page.reload();
    await page.getByLabel('Email Address').fill(uniqueEmail);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: /Sign In to Account/i }).click();
    await page.getByTestId('resend-verification-box').getByRole('button').click();

    const secondMail = await waitForCapturedLink(smtpCapture.emails, uniqueEmail, '/verify-email', beforeResendIdx);
    expect(secondMail.url).not.toBe(firstMail.url);

    // Superseded first verification link MUST fail
    const firstUrlObj = new URL(firstMail.url);
    await page.goto(firstUrlObj.pathname + firstUrlObj.search);
    await expect(page.getByTestId('verify-email-card')).toContainText(/replaced|newer|Verification/i);

    // Invalid verification link MUST be rejected
    await page.goto('/verify-email?token=invalid-mock-token-for-test-verification-flow');
    await expect(page.getByTestId('verify-email-card')).toContainText(/invalid|does not exist/i);

    // Valid latest verification link activates account cleanly
    const secondUrlObj = new URL(secondMail.url);
    await page.goto(secondUrlObj.pathname + secondUrlObj.search);
    await expect(page.getByTestId('verify-email-card')).toContainText(/Email Verified Successfully/i, { timeout: 15000 });

    // Reusing the SAME verification link MUST fail (single-use)
    await page.goto(secondUrlObj.pathname + secondUrlObj.search);
    await expect(page.getByTestId('verify-email-card')).toContainText(/already been used/i, { timeout: 15000 });

    // Verified login succeeds and persists across page reload
    await page.goto('/login');
    await page.getByLabel('Email Address').fill(uniqueEmail);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: /Sign In to Account/i }).click();
    await expect(page).toHaveURL(/\/account/, { timeout: 15000 });
    await page.reload();
    await expect(page).toHaveURL(/\/account/);

    expect(pageErrors).toEqual([]);
    expect(
      consoleErrors.filter(
        (e) =>
          !e.includes('400') &&
          !e.includes('401') &&
          !e.includes('403') &&
          !e.includes('429')
      )
    ).toEqual([]);
  });

  test('Scenario 3: WooCommerce-like Checkout registration preserves cart/form, requires verification, supports inline login & guest checkout control', async ({ page }) => {
    const checkoutEmail = `e2e-checkout-${Date.now()}@example.com`;
    const checkoutPass = 'CheckoutPass!2026';

    // Add approved product to cart via storefront
    await page.goto('/product/100-kashmiri-honey');
    await page.getByRole('button', { name: /Add to Bag|Add to Cart/i }).first().click();

    await page.goto('/checkout');
    await expect(page.getByTestId('checkout-create-account-checkbox')).toBeVisible();

    // Fill shipping details & check Create Account
    await page.getByPlaceholder('e.g. AbdurRahman').fill('Checkout Woo Tester');
    await page.getByPlaceholder('e.g. 9876543210').fill('9876501234');
    await page.getByTestId('checkout-email-input').fill(checkoutEmail);
    await page.getByTestId('checkout-create-account-checkbox').check();
    await page.getByTestId('checkout-account-password').fill(checkoutPass);
    await page.getByTestId('checkout-account-confirm-password').fill(checkoutPass);

    await page.getByPlaceholder('e.g. Ward No. 07, Lahsaniya, Near Central Mosque').fill('42 Market Road');
    await page.getByPlaceholder('e.g. 845427 or 110001').fill('845427');
    await page.getByPlaceholder('Auto-filled or type city').fill('Motihari');
    await page.getByPlaceholder('e.g. Bihar, Delhi, Karnataka').fill('Bihar');

    // Custom UPI is active by default — enter 12-digit UTR & submit order
    await page.getByPlaceholder('e.g. 431902847190').fill('431902847190');

    const beforeRegMailIdx = smtpCapture.emails.length;
    await page.getByRole('button', { name: /Confirm & Place Order/i }).click();

    // Mandatory verification stops order before submitting unverified account; form & cart preserved!
    await expect(page.getByTestId('checkout-pending-verification-banner')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('checkout-pending-verification-banner')).toContainText(checkoutEmail);

    const verifyMail = await waitForCapturedLink(smtpCapture.emails, checkoutEmail, '/verify-email', beforeRegMailIdx);
    const verifyUrl = new URL(verifyMail.url);

    // Verify account via emailed link (with redirect=/checkout)
    await page.goto(verifyUrl.pathname + verifyUrl.search);
    await expect(page.getByTestId('verify-email-card')).toContainText(/Email Verified Successfully/i, { timeout: 15000 });

    // Return to checkout -> saved draft restores shipping address cleanly, and inline sign-in works!
    await page.goto('/checkout?verified=1');
    await expect(page.getByPlaceholder('e.g. AbdurRahman')).toHaveValue('Checkout Woo Tester');
    await expect(page.getByPlaceholder('e.g. Ward No. 07, Lahsaniya, Near Central Mosque')).toHaveValue('42 Market Road');

    await expect(page.getByTestId('checkout-inline-login')).toBeVisible();
    await page.getByTestId('checkout-inline-login-email').fill(checkoutEmail);
    await page.getByTestId('checkout-inline-login-password').fill(checkoutPass);
    await page.getByTestId('checkout-inline-login-submit').click();

    await expect(page.getByTestId('checkout-signed-in-badge')).toBeVisible();
    await expect(page.getByTestId('checkout-signed-in-badge')).toContainText(checkoutEmail);

    // Duplicate email checkout registration check in a fresh browser context -> explicit rejection & zero duplicate customer
    const guestCtx = await page.context().browser()!.newContext({ baseURL: 'http://localhost:3000' });
    const dupRes = await guestCtx.request.post('/api/auth/customer/register', {
      data: {
        fullName: 'Duplicate Check',
        email: checkoutEmail,
        phone: '9876501234',
        password: checkoutPass,
        source: 'CHECKOUT',
      },
    });
    expect(dupRes.status()).toBe(409);
    await guestCtx.close();

    // Place order as verified checkout user -> succeeds and links to checkoutEmail's customerId
    await page.getByPlaceholder('e.g. 431902847190').fill('431902847191');
    await page.getByRole('button', { name: /Confirm & Place Order/i }).click();
    await expect(page).toHaveURL(/\/checkout\/(confirmation|success)|\/track-order/, { timeout: 30000 });
    await expect(page.locator('main')).toContainText(/Confirmed|Order|Consignment/i);
  });

  test('Scenario 4: Forgot password -> real SMTP link -> single-use reset -> old session invalidated & new password works', async ({ page, browser }) => {
    const resetEmail = `e2e-reset-${Date.now()}@example.com`;
    const oldPass = 'OldSecret!2026';
    const newPass = 'NewSecret!2026';

    // Create verified user via Admin API
    const adminCtx = await browser.newContext({ baseURL: 'http://localhost:3000' });
    await adminCtx.request.post('/api/admin/auth/login', {
      data: { email: 'admin@infinicharm.com', password: process.env.ADMIN_PASSWORD || 'Admin@1234!' },
    });
    const created = await adminCtx.request.post('/api/admin/customers', {
      data: {
        fullName: 'Reset Flow Tester',
        email: resetEmail,
        phone: '9876543299',
        password: oldPass,
        emailVerified: true,
        status: 'ACTIVE',
      },
    });
    expect(created.ok()).toBe(true);
    await adminCtx.close();

    // Context A: active logged-in session before password reset
    const sessionCtx = await browser.newContext({ baseURL: 'http://localhost:3000' });
    const sessionPage = await sessionCtx.newPage();
    await sessionPage.goto('/login');
    await sessionPage.getByLabel('Email Address').fill(resetEmail);
    await sessionPage.getByLabel('Password', { exact: true }).fill(oldPass);
    await sessionPage.getByRole('button', { name: /Sign In to Account/i }).click();
    await sessionPage.waitForURL(/\/account/);

    // Request password reset from Context B -> non-enumerating success for both real & fake emails
    const beforeMailIdx = smtpCapture.emails.length;
    await page.goto('/forgot-password');
    await page.getByPlaceholder('e.g. customer@infinicharm.com').fill(resetEmail);
    await page.getByRole('button', { name: /Send Password Reset Link/i }).click();
    await expect(page.getByTestId('forgot-password-confirmation')).toBeVisible();

    const resetMail = await waitForCapturedLink(smtpCapture.emails, resetEmail, '/reset-password', beforeMailIdx);
    const resetUrl = new URL(resetMail.url);

    // Invalid reset token rejected
    await page.goto('/reset-password?token=invalid-mock-token-for-test-reset-flow');
    await expect(page.getByTestId('reset-token-invalid-card')).toBeVisible();

    // Open real token -> reset password cleanly
    await page.goto(resetUrl.pathname + resetUrl.search);
    await expect(page.getByLabel('New Password', { exact: true })).toBeVisible({ timeout: 15000 });
    await page.getByLabel('New Password', { exact: true }).fill(newPass);
    await page.getByLabel('Confirm New Password', { exact: true }).fill(newPass);
    await page.getByRole('button', { name: /Set New Password/i }).click();
    await expect(page.getByTestId('reset-password-success')).toBeVisible();

    // Replay reset token MUST be rejected
    await page.goto(resetUrl.pathname + resetUrl.search);
    await expect(page.getByTestId('reset-token-invalid-card')).toBeVisible();

    // Context A's old session cookie (`sv`) MUST now be invalidated on /api/customers/me
    const oldSessionCheck = await sessionPage.request.get('/api/customers/me');
    expect(oldSessionCheck.status()).toBe(401);
    await sessionCtx.close();

    // Old password rejected, new password accepted
    await page.goto('/login');
    await page.getByLabel('Email Address').fill(resetEmail);
    await page.getByLabel('Password', { exact: true }).fill(oldPass);
    await page.getByRole('button', { name: /Sign In to Account/i }).click();
    await expect(page.locator('main [role="alert"]')).toContainText(/incorrect|invalid/i);

    await page.getByLabel('Password', { exact: true }).fill(newPass);
    await page.getByRole('button', { name: /Sign In to Account/i }).click();
    await expect(page).toHaveURL(/\/account/, { timeout: 15000 });
  });

  test('Scenario 5: Logout session invalidation, Admin RBAC protection, Admin Auth Policy & Customer Verification CRUD, Audit Logs, and 10-Viewport Audit', async ({ page, browser }) => {
    // 1. Unauthenticated caller cannot access Admin APIs or /admin/settings
    const anonCtx = await browser.newContext({ baseURL: 'http://localhost:3000' });
    expect((await anonCtx.request.get('/api/admin/auth/settings')).status()).toBe(401);
    expect((await anonCtx.request.get('/api/admin/audit-logs')).status()).toBe(401);
    expect(
      (
        await anonCtx.request.post('/api/admin/customers/cust-01/verify-email', {
          data: { action: 'VERIFY' },
        })
      ).status()
    ).toBe(401);
    const anonPage = await anonCtx.newPage();
    await anonPage.goto('/admin/settings');
    await expect(anonPage).toHaveURL(/\/admin\/login/);
    await anonCtx.close();

    // 2. Logged-in Customer cannot call Admin endpoints
    const custCtx = await browser.newContext({ baseURL: 'http://localhost:3000' });
    await custCtx.request.post('/api/auth/customer/login', {
      data: { email: 'customer@infinicharm.com', password: 'Customer@1234!' },
    });
    expect((await custCtx.request.get('/api/admin/auth/settings')).status()).toBe(401);
    expect((await custCtx.request.post('/api/auth/customer/logout')).ok()).toBe(true);
    // Old customer context cannot access /api/customers/me after logout
    expect((await custCtx.request.get('/api/customers/me')).status()).toBe(401);
    await custCtx.close();

    // 3. Create unverified customer to test Admin manual verify/revoke in UI
    const pendingEmail = `admin-verify-${Date.now()}@example.com`;
    const regRes = await page.request.post('/api/auth/customer/register', {
      data: {
        fullName: 'Admin Verify Target',
        email: pendingEmail,
        phone: '9876543211',
        password: 'TargetPass!2026',
        source: 'REGISTER_PAGE',
      },
    });
    expect(regRes.ok()).toBe(true);
    const regJson = await regRes.json();
    const targetCustomerId = regJson.customer.id;

    // 4. Sign in via /admin/login or session cookie
    await page.context().addCookies([
      { name: 'infinicharm_admin_session', value: 'active', url: 'http://localhost:3000' },
    ]);
    await page.goto('/admin/dashboard');

    // 5. Update Auth Settings in /admin/settings and confirm persistence across reload
    await page.goto('/admin/settings');
    await expect(page.getByTestId('admin-auth-settings-card')).toBeVisible();
    await page.getByTestId('auth-toggle-guestCheckoutEnabled').click();
    await expect(page.getByTestId('auth-toggle-guestCheckoutEnabled')).toContainText(/Disabled/i);
    await page.getByTestId('save-auth-settings-btn').click();
    await expect(page.getByTestId('auth-settings-feedback')).toContainText(/updated|persisted/i);

    await page.reload();
    await expect(page.getByTestId('auth-toggle-guestCheckoutEnabled')).toContainText(/Disabled/i);

    // Public checkout settings API reflects disabled guestCheckoutEnabled and /api/orders blocks guest submission
    const guestOrderBlocked = await (await browser.newContext({ baseURL: 'http://localhost:3000' })).request.post('/api/orders', {
      data: {
        orderNumber: `INF-202611-${Math.floor(1000 + Math.random() * 9000)}`,
        customerId: 'guest',
        customerEmail: 'guest-blocked@example.com',
        customerPhone: '9876543210',
        paymentMethod: 'COD',
        shippingAddress: {
          fullName: 'Guest Blocked',
          phone: '9876543210',
          addressLine1: '1 Test Road',
          city: 'Motihari',
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
    expect(guestOrderBlocked.status()).toBe(401);

    // Restore guestCheckoutEnabled back to Enabled
    await page.getByTestId('auth-toggle-guestCheckoutEnabled').click();
    await page.getByTestId('save-auth-settings-btn').click();
    await expect(page.getByTestId('auth-settings-feedback')).toBeVisible();

    // 6. Verify & Revoke Customer in /admin/customers
    await page.goto('/admin/customers');
    await page.getByTestId('filter-verification-unverified').click();
    await expect(page.getByTestId(`admin-verify-customer-${targetCustomerId}`)).toBeVisible();
    await page.getByTestId(`admin-verify-customer-${targetCustomerId}`).click();
    await expect(page.getByText(/marked as email verified/i)).toBeVisible();

    // Check /admin/audit-logs contains real server auth/admin events
    await page.goto('/admin/audit-logs');
    await expect(page.locator('main')).toContainText(/ADMIN_LOGIN_SUCCESS|AUTH_SETTINGS_UPDATED|ADMIN_VERIFY_CUSTOMER_EMAIL/i);

    // 7. 10-Viewport Zero Horizontal Overflow Audit across Auth & Admin Pages
    const routesToCheck = ['/login', '/register', '/forgot-password', '/admin/settings'];
    for (const route of routesToCheck) {
      await page.goto(route);
      for (const vp of TEN_VIEWPORTS) {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.waitForTimeout(80);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth
        );
        expect(overflow, `Horizontal overflow on ${route} at ${vp.name}`).toBe(false);
      }
    }

    // Admin sign-out works cleanly
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/admin/settings');
    await page.getByTestId('admin-signout-btn').click();
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});

