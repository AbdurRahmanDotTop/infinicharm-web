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
  'auth_settings.json',
  'email_verification_tokens.json',
  'password_reset_tokens.json',
  'smtp_configs.json',
  'email_templates.json',
  'notification_delivery_logs.json',
  'email_delivery_logs.json',
  'audit_logs.json',
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

async function waitForCapturedVerificationEmail(
  emails: CapturedEmail[],
  recipientEmail: string,
  minEmailIndex: number = 0
): Promise<{ otp: string; url: string; nextIndex: number }> {
  const target = recipientEmail.toLowerCase();
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    for (let i = emails.length - 1; i >= minEmailIndex; i--) {
      const e = emails[i];
      if (!e.to.includes(target) && !e.decoded.toLowerCase().includes(target)) continue;
      const linkMatch = e.decoded.match(/https?:\/\/[^\s"'<>]+verify-email\?token=[a-f0-9]+/i);
      const otpMatch =
        e.decoded.match(/Code:\s*([0-9]{6})/) ||
        e.decoded.match(/>([0-9]{6})</) ||
        e.decoded.match(/\b([0-9]{6})\b/);

      if (linkMatch) {
        return {
          otp: otpMatch ? otpMatch[1] : '',
          url: linkMatch[0],
          nextIndex: i + 1,
        };
      }
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`Timed out waiting for verification email to ${recipientEmail}`);
}

test.describe('Dual-Method Email Verification & Admin Template Engine', () => {
  test.describe.configure({ mode: 'serial' });
  let smtpCapture: Awaited<ReturnType<typeof startLocalSmtpCaptureServer>>;

  test.beforeAll(async () => {
    for (const file of SNAPSHOT_FILES) {
      const fullPath = path.join(DATA_DIR, file);
      snapshots.set(file, fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf8') : null);
    }

    smtpCapture = await startLocalSmtpCaptureServer();

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
    for (const [file, content] of snapshots.entries()) {
      const fullPath = path.join(DATA_DIR, file);
      if (content === null) {
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      } else {
        fs.writeFileSync(fullPath, content, 'utf8');
      }
    }
  });

  test('Method 1 (OTP): Registration presents 6-digit OTP UI, rejects invalid code, and completes verification upon valid code entry', async ({
    page,
  }) => {
    const timestamp = Date.now();
    const uniqueEmail = `test.otp.${timestamp}@example.com`;
    const password = 'StrongPassword!2026';
    const startMailIdx = smtpCapture.emails.length;

    // 1. Visit registration page
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: /Create Your Account/i })).toBeVisible();

    // 2. Submit valid registration form
    await page.getByPlaceholder('Aarav Sharma').fill('OTP Tester');
    await page.getByPlaceholder('aarav@example.com').fill(uniqueEmail);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByLabel('Confirm Password', { exact: true }).fill(password);
    await page.locator('input[type="checkbox"]').check();
    await page.getByRole('button', { name: /Create InfiniCharm Account/i }).click();

    // 3. Must transition to verification pending screen with OTP UI
    await expect(page.getByTestId('register-verification-pending')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('register-verification-pending')).toContainText(uniqueEmail);
    await expect(page.getByTestId('otp-input-group')).toBeVisible();
    await expect(page.getByTestId('otp-box-0')).toBeVisible();
    await expect(page.getByTestId('otp-box-5')).toBeVisible();
    await expect(page.getByTestId('verify-otp-submit-btn')).toBeVisible();

    // 4. Test invalid OTP rejection
    for (let i = 0; i < 6; i++) {
      await page.getByTestId(`otp-box-${i}`).fill('0');
    }
    await page.getByTestId('verify-otp-submit-btn').click();
    await expect(
      page.getByTestId('register-verification-pending').getByRole('alert')
    ).toContainText(/failed|incorrect|invalid/i);

    // 5. Intercept real email captured by mock SMTP
    const captured = await waitForCapturedVerificationEmail(
      smtpCapture.emails,
      uniqueEmail,
      startMailIdx
    );
    expect(captured.otp).toMatch(/^\d{6}$/);

    // 6. Enter the real 6-digit OTP
    for (let i = 0; i < 6; i++) {
      await page.getByTestId(`otp-box-${i}`).fill(captured.otp[i]);
    }

    // 7. Verification success state displayed or navigated to account
    const successMsg = page.getByText(/Email Verified Successfully/i);
    if (await successMsg.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(successMsg).toBeVisible();
    } else {
      await page.waitForURL(/\/account|\/login/, { timeout: 10000 });
    }

    // 8. Atomicity check: The direct link from the same email must now be ALREADY_USED
    await page.goto(captured.url);
    await expect(page.getByTestId('verify-email-card')).toContainText(/already been used/i);
  });

  test('Method 2 (Direct Link): Registration email link verifies instantly and invalidates OTP', async ({
    page,
  }) => {
    const timestamp = Date.now();
    const uniqueEmail = `test.link.${timestamp}@example.com`;
    const password = 'StrongPassword!2026';
    const startMailIdx = smtpCapture.emails.length;

    // 1. Register customer
    await page.goto('/register');
    await page.getByPlaceholder('Aarav Sharma').fill('Link Tester');
    await page.getByPlaceholder('aarav@example.com').fill(uniqueEmail);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByLabel('Confirm Password', { exact: true }).fill(password);
    await page.locator('input[type="checkbox"]').check();
    await page.getByRole('button', { name: /Create InfiniCharm Account/i }).click();
    await expect(page.getByTestId('register-verification-pending')).toBeVisible({ timeout: 10000 });

    // 2. Fetch the verification link from SMTP capture
    const captured = await waitForCapturedVerificationEmail(
      smtpCapture.emails,
      uniqueEmail,
      startMailIdx
    );
    expect(captured.url).toContain('/verify-email?token=');

    // 3. Open direct verification link
    await page.goto(captured.url);
    await expect(page.getByTestId('verify-email-card')).toContainText(/Email Verified Successfully/i);

    // 4. Atomicity check: Entering the OTP now on /verify-email must fail with ALREADY_USED
    await page.goto(`/verify-email?email=${encodeURIComponent(uniqueEmail)}`);
    for (let i = 0; i < 6; i++) {
      await page.getByTestId(`otp-box-${i}`).fill(captured.otp[i]);
    }
    await page.getByRole('button', { name: /Verify Code & Activate/i }).click();
    await expect(page.getByText(/already been verified|already been used/i)).toBeVisible();
  });

  test('Admin Email Template Registry: Verification template is listed, previewable in desktop & mobile, with variables and test-send', async ({
    page,
  }) => {
    // 1. Log in as admin
    await page.goto('/admin/login');
    await page.getByPlaceholder('admin@infinicharm.com').fill('admin@infinicharm.com');
    await page.locator('input[type="password"]').fill(process.env.ADMIN_PASSWORD || 'Admin@1234!');
    await page.getByRole('button', { name: /Authenticate & Enter/i }).click();
    await page.waitForURL(/\/admin\/dashboard/, { timeout: 10000 });

    // 2. Navigate to email templates manager
    await page.goto('/admin/email-templates');
    await expect(page.getByRole('heading', { name: /Email Templates/i })).toBeVisible({ timeout: 10000 });

    // 3. Locate verification template
    await expect(page.getByText(/Customer Email Verification/i).first()).toBeVisible();

    // 4. Click Preview (Eye icon)
    const previewBtn = page.locator('button[title="Live HTML Preview"]').first();
    await previewBtn.click();

    // 5. Preview modal should be open with desktop and mobile switcher
    await expect(page.getByText(/Preview: Customer Email Verification/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Desktop/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Mobile/i })).toBeVisible();

    // 6. Toggle to Mobile view (375px)
    await page.getByRole('button', { name: /Mobile/i }).click();

    // 7. Verify test email input and button exist
    await expect(page.getByLabel('Test recipient email')).toBeVisible();
    await expect(page.getByRole('button', { name: /Send Test Email/i })).toBeVisible();

    // 8. Close preview modal
    await page.getByLabel('Close preview').click();

    // 9. 10-Viewport Zero Horizontal Overflow Audit
    const auditRoutes = ['/register', '/verify-email', '/admin/email-templates'];
    for (const route of auditRoutes) {
      await page.goto(route);
      for (const vp of TEN_VIEWPORTS) {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.waitForTimeout(60);
        const hasOverflow = await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth
        );
        expect(hasOverflow, `Horizontal overflow detected on ${route} at ${vp.name}`).toBe(false);
      }
    }
  });
});
