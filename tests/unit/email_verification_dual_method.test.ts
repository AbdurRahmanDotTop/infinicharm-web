import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  createEmailVerificationToken,
  verifyAndConsumeEmailVerificationOtp,
  verifyAndConsumeEmailVerificationToken,
  canRequestVerificationResend,
  hashVerificationOtp,
  hashVerificationToken,
} from '../../src/lib/server/email-verification-store.ts';
import { renderEmailVariables } from '../../src/lib/server/mailer.ts';

function makeTmpFile(name: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'infinicharm-dual-verify-'));
  return path.join(dir, name);
}

describe('InfiniCharm Dual-Method Email Verification Suite', () => {
  test('1. Generates 6-digit OTP and 32-byte hex token, securely hashed on disk', () => {
    const tmp = makeTmpFile('tokens.json');
    try {
      const email = 'user.test@infinicharm.com';
      const issued = createEmailVerificationToken(
        {
          customerId: 'cust-101',
          email,
          ttlMinutes: 30,
          purpose: 'REGISTRATION',
          redirectPath: '/account',
        },
        tmp
      );

      // Check return shapes
      assert.ok(issued.token && issued.token.length >= 32, 'Token must be a secure hex string');
      assert.ok(issued.otp && /^\d{6}$/.test(issued.otp), `OTP must be exactly 6 numeric digits, got: ${issued.otp}`);
      assert.strictEqual(issued.redirectPath, '/account');

      // Check persistent file
      const rawDisk = fs.readFileSync(tmp, 'utf8');
      assert.strictEqual(rawDisk.includes(issued.token), false, 'Plaintext direct link token must NEVER exist on disk');
      assert.strictEqual(rawDisk.includes(issued.otp), false, 'Plaintext 6-digit OTP must NEVER exist on disk');

      const parsed = JSON.parse(rawDisk);
      assert.strictEqual(parsed.length, 1);
      assert.ok(parsed[0].tokenHash, 'Must store tokenHash');
      assert.ok(parsed[0].otpHash, 'Must store otpHash');
      assert.strictEqual(parsed[0].email, email);
      assert.strictEqual(parsed[0].usedAt, null);
      assert.strictEqual(parsed[0].revokedAt, null);
    } finally {
      fs.rmSync(path.dirname(tmp), { recursive: true, force: true });
    }
  });

  test('2. OTP verification succeeds, marks record used, and invalidates direct link token atomically', () => {
    const tmp = makeTmpFile('tokens.json');
    try {
      const email = 'customer.verify@infinicharm.com';
      const issued = createEmailVerificationToken(
        {
          customerId: 'cust-202',
          email,
          ttlMinutes: 60,
          purpose: 'REGISTRATION',
          redirectPath: '/checkout',
        },
        tmp
      );

      // Verify using OTP
      const otpRes = verifyAndConsumeEmailVerificationOtp(email, issued.otp, tmp);
      assert.strictEqual(otpRes.valid, true);
      assert.strictEqual(otpRes.status, 'VERIFIED');
      assert.strictEqual(otpRes.customerId, 'cust-202');
      assert.strictEqual(otpRes.email, email);
      assert.strictEqual(otpRes.redirectPath, '/checkout');

      // Now attempting to verify with the direct link token MUST fail with ALREADY_USED
      const linkRes = verifyAndConsumeEmailVerificationToken(issued.token, tmp);
      assert.strictEqual(linkRes.valid, false);
      assert.strictEqual(linkRes.status, 'ALREADY_USED');

      // Replaying OTP again MUST also fail with ALREADY_USED
      const replayOtp = verifyAndConsumeEmailVerificationOtp(email, issued.otp, tmp);
      assert.strictEqual(replayOtp.valid, false);
      assert.strictEqual(replayOtp.status, 'ALREADY_USED');
    } finally {
      fs.rmSync(path.dirname(tmp), { recursive: true, force: true });
    }
  });

  test('3. Direct link token verification succeeds, marks record used, and invalidates OTP atomically', () => {
    const tmp = makeTmpFile('tokens.json');
    try {
      const email = 'link.first@infinicharm.com';
      const issued = createEmailVerificationToken(
        {
          customerId: 'cust-303',
          email,
          ttlMinutes: 60,
          purpose: 'CHECKOUT_REGISTRATION',
          redirectPath: '/checkout',
        },
        tmp
      );

      // Verify using direct link token
      const linkRes = verifyAndConsumeEmailVerificationToken(issued.token, tmp);
      assert.strictEqual(linkRes.valid, true);
      assert.strictEqual(linkRes.status, 'VERIFIED');
      assert.strictEqual(linkRes.customerId, 'cust-303');
      assert.strictEqual(linkRes.redirectPath, '/checkout');

      // Now attempting to verify with the OTP MUST fail with ALREADY_USED
      const otpRes = verifyAndConsumeEmailVerificationOtp(email, issued.otp, tmp);
      assert.strictEqual(otpRes.valid, false);
      assert.strictEqual(otpRes.status, 'ALREADY_USED');

      // Replaying direct link again MUST also fail with ALREADY_USED
      const replayLink = verifyAndConsumeEmailVerificationToken(issued.token, tmp);
      assert.strictEqual(replayLink.valid, false);
      assert.strictEqual(replayLink.status, 'ALREADY_USED');
    } finally {
      fs.rmSync(path.dirname(tmp), { recursive: true, force: true });
    }
  });

  test('4. Resending verification supersedes previous OTP and link token', () => {
    const tmp = makeTmpFile('tokens.json');
    try {
      const email = 'resend.test@infinicharm.com';
      const first = createEmailVerificationToken({ customerId: 'cust-404', email }, tmp);
      const second = createEmailVerificationToken({ customerId: 'cust-404', email }, tmp);

      // First OTP must be SUPERSEDED
      const useFirstOtp = verifyAndConsumeEmailVerificationOtp(email, first.otp, tmp);
      assert.strictEqual(useFirstOtp.valid, false);
      assert.strictEqual(useFirstOtp.status, 'SUPERSEDED');

      // First token must be SUPERSEDED
      const useFirstToken = verifyAndConsumeEmailVerificationToken(first.token, tmp);
      assert.strictEqual(useFirstToken.valid, false);
      assert.strictEqual(useFirstToken.status, 'SUPERSEDED');

      // Second OTP works
      const useSecondOtp = verifyAndConsumeEmailVerificationOtp(email, second.otp, tmp);
      assert.strictEqual(useSecondOtp.valid, true);
      assert.strictEqual(useSecondOtp.status, 'VERIFIED');
    } finally {
      fs.rmSync(path.dirname(tmp), { recursive: true, force: true });
    }
  });

  test('5. Expired OTP and expired link token are rejected with EXPIRED', () => {
    const tmp = makeTmpFile('tokens.json');
    try {
      const email = 'expired.test@infinicharm.com';
      const issued = createEmailVerificationToken(
        {
          customerId: 'cust-505',
          email,
          ttlMinutes: 10,
        },
        tmp
      );

      // Force expiration in the data store
      const records = JSON.parse(fs.readFileSync(tmp, 'utf8'));
      records[0].expiresAt = new Date(Date.now() - 60_000).toISOString();
      records[0].otpExpiresAt = new Date(Date.now() - 60_000).toISOString();
      fs.writeFileSync(tmp, JSON.stringify(records, null, 2), 'utf8');

      const otpRes = verifyAndConsumeEmailVerificationOtp(email, issued.otp, tmp);
      assert.strictEqual(otpRes.valid, false);
      assert.strictEqual(otpRes.status, 'EXPIRED');

      const tokenRes = verifyAndConsumeEmailVerificationToken(issued.token, tmp);
      assert.strictEqual(tokenRes.valid, false);
      assert.strictEqual(tokenRes.status, 'EXPIRED');
    } finally {
      fs.rmSync(path.dirname(tmp), { recursive: true, force: true });
    }
  });

  test('6. Invalid OTP codes and malformed inputs return INVALID', () => {
    const tmp = makeTmpFile('tokens.json');
    try {
      const email = 'invalid.test@infinicharm.com';
      createEmailVerificationToken({ customerId: 'cust-606', email }, tmp);

      // Wrong 6-digit code
      const wrong = verifyAndConsumeEmailVerificationOtp(email, '000000', tmp);
      assert.strictEqual(wrong.valid, false);
      assert.strictEqual(wrong.status, 'INVALID');

      // Malformed (not 6 digits)
      const short = verifyAndConsumeEmailVerificationOtp(email, '123', tmp);
      assert.strictEqual(short.valid, false);
      assert.strictEqual(short.status, 'INVALID');

      // Nonexistent email
      const none = verifyAndConsumeEmailVerificationOtp('not-found@example.com', '123456', tmp);
      assert.strictEqual(none.valid, false);
      assert.strictEqual(none.status, 'INVALID');
    } finally {
      fs.rmSync(path.dirname(tmp), { recursive: true, force: true });
    }
  });

  test('7. Resend rate-limiting enforces cooldown and max per hour limits', () => {
    const tmp = makeTmpFile('tokens.json');
    try {
      const email = 'ratelimit.test@infinicharm.com';
      createEmailVerificationToken({ customerId: 'cust-707', email }, tmp);

      // Immediate resend should be blocked by cooldown (30s)
      const blocked = canRequestVerificationResend(email, 30, 5, tmp);
      assert.strictEqual(blocked.allowed, false);
      assert.ok(blocked.retryAfterSeconds > 0);

      // After cooldown window, allowed
      const allowed = canRequestVerificationResend(email, 0, 5, tmp);
      assert.strictEqual(allowed.allowed, true);
    } finally {
      fs.rmSync(path.dirname(tmp), { recursive: true, force: true });
    }
  });

  test('8. Email template variable renderer resolves both OTP code and direct link', () => {
    const template = {
      subject: 'Verify Your Email — {{otp_code}} is your code',
      htmlContent: '<p>Code: {{otp_code}}</p><a href="{{verification_link}}">Verify</a><p>{{site_name}}</p>',
      textContent: 'Code: {{otp_code}} Link: {{verification_link}}',
    };

    const rendered = renderEmailVariables(template, {
      subscriberEmail: 'aarav@example.com',
      extraVars: {
        customer_name: 'Aarav Sharma',
        customer_email: 'aarav@example.com',
        otp_code: '592814',
        verification_link: 'http://localhost:3000/verify-email?token=abc123xyz',
        site_name: 'InfiniCharm (TechilyFly India)',
        otp_expires_in: '60 minutes',
        link_expires_in: '60 minutes',
      },
    });

    assert.strictEqual(rendered.subject, 'Verify Your Email — 592814 is your code');
    assert.ok(rendered.htmlContent.includes('Code: 592814'), 'HTML must contain the OTP code');
    assert.ok(
      rendered.htmlContent.includes('http://localhost:3000/verify-email?token=abc123xyz'),
      'HTML must contain unescaped verification link'
    );
    assert.ok(rendered.textContent.includes('592814'), 'Text content must contain the OTP code');
  });
});

