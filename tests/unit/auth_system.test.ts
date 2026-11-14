import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  sanitizeRedirectPath,
  validatePasswordAgainstPolicy,
  isValidEmail,
} from '../../src/lib/validation/auth.ts';
import {
  hashCustomerPassword,
  verifyCustomerPassword,
  createCustomer,
  authenticateCustomer,
  markCustomerEmailVerified,
  incrementCustomerSessionVersion,
  deleteCustomer,
} from '../../src/lib/server/customers-store.ts';
import {
  canRequestVerificationResend,
  createEmailVerificationToken,
  verifyAndConsumeEmailVerificationToken,
} from '../../src/lib/server/email-verification-store.ts';
import {
  canRequestPasswordReset,
  createPasswordResetToken,
  inspectPasswordResetToken,
  verifyAndConsumePasswordResetToken,
} from '../../src/lib/server/password-reset-store.ts';
import {
  getAuthSettings,
  updateAuthSettings,
} from '../../src/lib/server/auth-settings-store.ts';
import { verifyEmailWithTokenOrOtp } from '../../src/lib/server/auth-service.ts';

function makeTmpFile(name: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'infinicharm-auth-test-'));
  return path.join(dir, name);
}

describe('InfiniCharm Centralized Authentication & Security Unit Suite', () => {
  test('hashCustomerPassword & verifyCustomerPassword use scrypt without master backdoors', () => {
    const hash = hashCustomerPassword('Str0ngPass!99');
    assert.ok(hash.startsWith('scrypt:'), 'hash must use scrypt prefix');
    assert.equal(verifyCustomerPassword('Str0ngPass!99', hash), true);
    assert.equal(verifyCustomerPassword('Customer@1234!', hash), false, 'no hardcoded master password backdoor');
    assert.equal(verifyCustomerPassword('', hash), false);
    assert.equal(verifyCustomerPassword('Customer@1234!', 'scrypt:bad:bad'), false);
  });

  test('sanitizeRedirectPath blocks open redirects and preserves safe internal paths', () => {
    assert.equal(sanitizeRedirectPath('/checkout'), '/checkout');
    assert.equal(sanitizeRedirectPath('/account/orders?filter=active'), '/account/orders?filter=active');
    assert.equal(sanitizeRedirectPath('https://evil.example/phish', '/account'), '/account');
    assert.equal(sanitizeRedirectPath('//evil.example/phish', '/account'), '/account');
    assert.equal(sanitizeRedirectPath('/\\evil.example', '/account'), '/account');
    assert.equal(sanitizeRedirectPath(null, '/login'), '/login');
  });

  test('validatePasswordAgainstPolicy & isValidEmail enforce configurable complexity rules', () => {
    assert.equal(isValidEmail('Customer+Tag@InfiniCharm.com'), true);
    assert.equal(isValidEmail('bad-email'), false);

    const weak = validatePasswordAgainstPolicy('abc123', {
      minPasswordLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumber: true,
      requireSpecialChar: true,
    });
    assert.equal(weak.valid, false);
    assert.ok(weak.errors.length >= 3);

    const strong = validatePasswordAgainstPolicy('StrongPass!2026', {
      minPasswordLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumber: true,
      requireSpecialChar: true,
    });
    assert.equal(strong.valid, true);
    assert.equal(strong.errors.length, 0);
  });

  test('email verification tokens are hashed, single-use, superseded on resend, expired, and rate-limited', () => {
    const tmp = makeTmpFile('verify.json');
    try {
      const first = createEmailVerificationToken(
        {
          customerId: 'cust-tmp-1',
          email: 'verify.test@example.com',
          ttlMinutes: 60,
          purpose: 'REGISTRATION',
          redirectPath: '/checkout',
        },
        tmp
      );

      // Plaintext token must NEVER be persisted in storage
      const rawDisk = fs.readFileSync(tmp, 'utf8');
      assert.equal(rawDisk.includes(first.token), false, 'plaintext token must not exist on disk');

      // Cooldown blocks immediate resend
      const cooldownCheck = canRequestVerificationResend('verify.test@example.com', 30, 5, tmp);
      assert.equal(cooldownCheck.allowed, false);
      assert.ok(cooldownCheck.retryAfterSeconds >= 1);

      // Issuing second token supersedes the first token
      const second = createEmailVerificationToken(
        {
          customerId: 'cust-tmp-1',
          email: 'verify.test@example.com',
          ttlMinutes: 60,
          purpose: 'REGISTRATION',
          redirectPath: '/checkout',
        },
        tmp
      );

      const useSuperseded = verifyAndConsumeEmailVerificationToken(first.token, tmp);
      assert.equal(useSuperseded.valid, false);
      assert.equal(useSuperseded.status, 'SUPERSEDED');

      const useSecond = verifyAndConsumeEmailVerificationToken(second.token, tmp);
      assert.equal(useSecond.valid, true);
      assert.equal(useSecond.status, 'VERIFIED');
      assert.equal(useSecond.redirectPath, '/checkout');

      // Single-use replay must fail with ALREADY_USED
      const replay = verifyAndConsumeEmailVerificationToken(second.token, tmp);
      assert.equal(replay.valid, false);
      assert.equal(replay.status, 'ALREADY_USED');

      // Invalid & expired token handling
      const invalid = verifyAndConsumeEmailVerificationToken('not-even-valid', tmp);
      assert.equal(invalid.valid, false);
      assert.equal(invalid.status, 'INVALID');

      const third = createEmailVerificationToken(
        {
          customerId: 'cust-tmp-1',
          email: 'expired.test@example.com',
          ttlMinutes: 10,
        },
        tmp
      );
      const records = JSON.parse(fs.readFileSync(tmp, 'utf8'));
      records[0].expiresAt = new Date(Date.now() - 60_000).toISOString();
      fs.writeFileSync(tmp, JSON.stringify(records, null, 2), 'utf8');

      const expired = verifyAndConsumeEmailVerificationToken(third.token, tmp);
      assert.equal(expired.valid, false);
      assert.equal(expired.status, 'EXPIRED');
    } finally {
      fs.rmSync(path.dirname(tmp), { recursive: true, force: true });
    }
  });

  test('password reset tokens are single-use, detect expiry/replay/invalid, and rate-limit per hour', () => {
    const tmp = makeTmpFile('reset.json');
    try {
      const issued = createPasswordResetToken('reset.user@example.com', 30, tmp);
      const rawDisk = fs.readFileSync(tmp, 'utf8');
      assert.equal(rawDisk.includes(issued.token), false, 'plaintext reset token must not exist on disk');

      const inspectOk = inspectPasswordResetToken(issued.token, tmp);
      assert.equal(inspectOk.valid, true);
      assert.equal(inspectOk.status, 'VALID');

      const consumed = verifyAndConsumePasswordResetToken(issued.token, tmp);
      assert.equal(consumed.valid, true);

      const reuse = inspectPasswordResetToken(issued.token, tmp);
      assert.equal(reuse.valid, false);
      assert.equal(reuse.status, 'ALREADY_USED');

      const badConsume = verifyAndConsumePasswordResetToken(issued.token, tmp);
      assert.equal(badConsume.valid, false);
      assert.equal(badConsume.status, 'ALREADY_USED');

      // Hourly cap
      assert.equal(canRequestPasswordReset('reset.user@example.com', 1, tmp).allowed, false);
    } finally {
      fs.rmSync(path.dirname(tmp), { recursive: true, force: true });
    }
  });

  test('customer login enforces mandatory emailVerified and bumps sessionVersion on revocation', () => {
    const testEmail = `unit-auth-${Date.now()}@example.com`;
    const created = createCustomer({
      fullName: 'Unit Verification Tester',
      email: testEmail,
      phone: '9876543210',
      password: 'UnitPass!2026',
      emailVerified: false,
      registrationSource: 'REGISTER_PAGE',
    });

    try {
      const unverifiedAttempt = authenticateCustomer(testEmail, 'UnitPass!2026');
      assert.equal(unverifiedAttempt.customer, null);
      assert.equal(unverifiedAttempt.code, 'EMAIL_NOT_VERIFIED');

      const verified = markCustomerEmailVerified(created.id);
      assert.equal(verified.success, true);
      assert.equal(verified.customer?.emailVerified, true);

      const okLogin = authenticateCustomer(testEmail, 'UnitPass!2026');
      assert.ok(okLogin.customer);
      assert.equal(okLogin.customer.email, testEmail);

      const prevVer = Number(okLogin.customer.sessionVersion || 1);
      const bumped = incrementCustomerSessionVersion(created.id);
      assert.equal(bumped, prevVer + 1);
    } finally {
      deleteCustomer(created.id);
    }
  });

  test('unverified customer verification via OTP token activates customer for authentication', () => {
    const testEmail = `otp.unit.${Date.now()}@example.com`;
    const created = createCustomer({
      fullName: 'OTP Customer',
      email: testEmail,
      phone: '9876543211',
      password: 'UnitPass!2026',
      emailVerified: false,
      registrationSource: 'REGISTER_PAGE',
    });

    try {
      const unverifiedAttempt = authenticateCustomer(testEmail, 'UnitPass!2026');
      assert.equal(unverifiedAttempt.customer, null);
      assert.equal(unverifiedAttempt.code, 'EMAIL_NOT_VERIFIED');

      // Issue verification token with 6-digit OTP
      const issued = createEmailVerificationToken({
        customerId: created.id,
        email: testEmail,
        purpose: 'REGISTRATION',
      });
      assert.ok(issued.token);
      assert.ok(/^\d{6}$/.test(issued.otp), 'must generate 6-digit OTP code');

      // Verify with OTP
      const verified = verifyEmailWithTokenOrOtp({
        email: testEmail,
        otp: issued.otp,
      });
      assert.equal(verified.valid, true);
      assert.equal(verified.status, 'VERIFIED');
      assert.ok(verified.customer);
      assert.equal(verified.customer.emailVerified, true);

      // Subsequent login succeeds
      const okLogin = authenticateCustomer(testEmail, 'UnitPass!2026');
      assert.ok(okLogin.customer);
      assert.equal(okLogin.customer.email, testEmail);
    } finally {
      deleteCustomer(created.id);
    }
  });

  test('auth-settings-store clamps and persists policy mutations cleanly', () => {
    const tmp = makeTmpFile('auth-settings.json');
    try {
      const initial = getAuthSettings(tmp);
      assert.equal(initial.requireEmailVerification, true);

      const updated = updateAuthSettings(
        {
          guestCheckoutEnabled: false,
          minPasswordLength: 10,
          requireSpecialChar: true,
        },
        'admin@infinicharm.com',
        tmp
      );
      assert.equal(updated.guestCheckoutEnabled, false);
      assert.equal(updated.minPasswordLength, 10);
      assert.equal(updated.requireSpecialChar, true);

      const reloaded = getAuthSettings(tmp);
      assert.equal(reloaded.guestCheckoutEnabled, false);
      assert.equal(reloaded.minPasswordLength, 10);
    } finally {
      fs.rmSync(path.dirname(tmp), { recursive: true, force: true });
    }
  });
});
