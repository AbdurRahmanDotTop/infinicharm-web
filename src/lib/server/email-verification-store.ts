import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { normalizeEmail, sanitizeRedirectPath } from '../validation/auth.ts';

export const EMAIL_VERIFICATION_TOKENS_PATH = path.join(
  process.cwd(),
  'src',
  'data',
  'email_verification_tokens.json'
);

export type VerificationTokenPurpose = 'REGISTRATION' | 'CHECKOUT_REGISTRATION' | 'ADMIN_RESEND';

export interface EmailVerificationTokenRecord {
  id: string;
  customerId: string;
  email: string;
  tokenHash: string;
  otpHash?: string;
  purpose: VerificationTokenPurpose;
  redirectPath: string;
  expiresAt: string;
  otpExpiresAt?: string;
  usedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

function getPepper(): string {
  return process.env.SMTP_ENCRYPTION_SECRET || 'infinicharm-email-verify-pepper-v1';
}

export function hashVerificationToken(rawToken: string): string {
  return crypto
    .createHash('sha256')
    .update(`verify:${String(rawToken || '').trim()}:${getPepper()}`)
    .digest('hex');
}

export function hashVerificationOtp(email: string, rawOtp: string): string {
  const cleanEmail = normalizeEmail(email);
  const cleanOtp = String(rawOtp || '').trim().replace(/\D/g, '');
  return crypto
    .createHash('sha256')
    .update(`verify-otp:${cleanEmail}:${cleanOtp}:${getPepper()}`)
    .digest('hex');
}

function readRecords(
  filePath: string = EMAIL_VERIFICATION_TOKENS_PATH
): EmailVerificationTokenRecord[] {
  try {
    if (!fs.existsSync(filePath)) return [];
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(parsed) ? (parsed as EmailVerificationTokenRecord[]) : [];
  } catch {
    return [];
  }
}

function writeRecords(
  records: EmailVerificationTokenRecord[],
  filePath: string = EMAIL_VERIFICATION_TOKENS_PATH
): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = `${filePath}.${Date.now()}-${Math.floor(Math.random() * 1000)}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(records, null, 2), 'utf8');
  fs.renameSync(tmp, filePath);
}

export function canRequestVerificationResend(
  email: string,
  cooldownSeconds: number = 30,
  maxPerHour: number = 5,
  filePath: string = EMAIL_VERIFICATION_TOKENS_PATH
): { allowed: boolean; retryAfterSeconds: number; reason?: string } {
  const normalized = normalizeEmail(email);
  const records = readRecords(filePath).filter((r) => r.email === normalized);
  const now = Date.now();

  if (records.length > 0) {
    const latestMs = records
      .map((r) => new Date(r.createdAt).getTime())
      .reduce((a, b) => Math.max(a, b), 0);
    const elapsedSec = Math.floor((now - latestMs) / 1000);
    if (elapsedSec < cooldownSeconds) {
      const retryAfterSeconds = Math.max(1, cooldownSeconds - elapsedSec);
      return {
        allowed: false,
        retryAfterSeconds,
        reason: `Please wait ${retryAfterSeconds}s before requesting another verification email.`,
      };
    }
  }

  const oneHourAgo = now - 60 * 60 * 1000;
  const recentCount = records.filter(
    (r) => new Date(r.createdAt).getTime() >= oneHourAgo
  ).length;
  if (recentCount >= maxPerHour) {
    return {
      allowed: false,
      retryAfterSeconds: 300,
      reason: 'Maximum verification email limit reached for this hour. Please try again later.',
    };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

export function createEmailVerificationToken(
  input: {
    customerId: string;
    email: string;
    ttlMinutes?: number;
    otpTtlMinutes?: number;
    purpose?: VerificationTokenPurpose;
    redirectPath?: string | null;
  },
  filePath: string = EMAIL_VERIFICATION_TOKENS_PATH
): {
  token: string;
  otp: string;
  expiresAt: string;
  otpExpiresAt: string;
  redirectPath: string;
} {
  const normalized = normalizeEmail(input.email);
  const ttlMinutes = Math.max(5, Math.min(1440, Number(input.ttlMinutes ?? 60)));
  const otpTtlMinutes = Math.max(5, Math.min(1440, Number(input.otpTtlMinutes ?? ttlMinutes)));
  const rawToken = crypto.randomBytes(32).toString('hex');
  // Cryptographically secure 6-digit numeric OTP (100000 - 999999)
  const rawOtp = crypto.randomInt(100000, 1000000).toString();
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const expiresAt = new Date(nowMs + ttlMinutes * 60 * 1000).toISOString();
  const otpExpiresAt = new Date(nowMs + otpTtlMinutes * 60 * 1000).toISOString();
  const redirectPath = sanitizeRedirectPath(input.redirectPath, '/account');
  const retentionCutoff = nowMs - 24 * 60 * 60 * 1000;

  const existing = readRecords(filePath)
    .filter((r) => new Date(r.createdAt).getTime() >= retentionCutoff)
    .map((r) =>
      r.email === normalized && !r.usedAt && !r.revokedAt
        ? { ...r, revokedAt: nowIso }
        : r
    );

  const created: EmailVerificationTokenRecord = {
    id: `evt-${nowMs}-${Math.floor(1000 + Math.random() * 9000)}`,
    customerId: input.customerId,
    email: normalized,
    tokenHash: hashVerificationToken(rawToken),
    otpHash: hashVerificationOtp(normalized, rawOtp),
    purpose: input.purpose || 'REGISTRATION',
    redirectPath,
    expiresAt,
    otpExpiresAt,
    usedAt: null,
    revokedAt: null,
    createdAt: nowIso,
  };

  writeRecords([created, ...existing], filePath);
  return { token: rawToken, otp: rawOtp, expiresAt, otpExpiresAt, redirectPath };
}

export interface VerifyEmailTokenOutcome {
  valid: boolean;
  status: 'VERIFIED' | 'ALREADY_USED' | 'EXPIRED' | 'SUPERSEDED' | 'INVALID';
  customerId?: string;
  email?: string;
  redirectPath?: string;
  purpose?: VerificationTokenPurpose;
  error?: string;
}

export function verifyAndConsumeEmailVerificationOtp(
  email: string,
  rawOtp: string,
  filePath: string = EMAIL_VERIFICATION_TOKENS_PATH
): VerifyEmailTokenOutcome {
  const cleanEmail = normalizeEmail(email);
  const cleanOtp = String(rawOtp || '').trim().replace(/\D/g, '');

  if (!cleanEmail || cleanOtp.length !== 6) {
    return {
      valid: false,
      status: 'INVALID',
      error: 'Please enter a valid 6-digit verification code.',
    };
  }

  const targetHash = hashVerificationOtp(cleanEmail, cleanOtp);
  const records = readRecords(filePath);
  const matchingRecords = records.filter((r) => r.email === cleanEmail);

  if (matchingRecords.length === 0) {
    return {
      valid: false,
      status: 'INVALID',
      error: 'No pending verification was found for this email address.',
    };
  }

  const idx = records.findIndex((r) => r.email === cleanEmail && r.otpHash === targetHash);

  if (idx === -1) {
    const activePending = matchingRecords.find((r) => !r.usedAt && !r.revokedAt);
    if (activePending) {
      return {
        valid: false,
        status: 'INVALID',
        error: 'The 6-digit verification code entered is incorrect.',
      };
    }
    const latest = matchingRecords[0];
    if (latest?.usedAt) {
      return {
        valid: false,
        status: 'ALREADY_USED',
        customerId: latest.customerId,
        email: latest.email,
        redirectPath: latest.redirectPath,
        purpose: latest.purpose,
        error: 'Your email address has already been verified. You can sign in.',
      };
    }
    return {
      valid: false,
      status: 'INVALID',
      error: 'The 6-digit verification code entered is incorrect or expired.',
    };
  }

  const rec = records[idx];
  if (rec.usedAt) {
    return {
      valid: false,
      status: 'ALREADY_USED',
      customerId: rec.customerId,
      email: rec.email,
      redirectPath: rec.redirectPath,
      purpose: rec.purpose,
      error: 'This verification code has already been used. Your email is already verified.',
    };
  }

  if (rec.revokedAt) {
    return {
      valid: false,
      status: 'SUPERSEDED',
      customerId: rec.customerId,
      email: rec.email,
      redirectPath: rec.redirectPath,
      purpose: rec.purpose,
      error: 'This verification code was replaced by a newer request. Please check your latest email.',
    };
  }

  const effectiveExpiry = rec.otpExpiresAt || rec.expiresAt;
  if (new Date(effectiveExpiry).getTime() <= Date.now()) {
    return {
      valid: false,
      status: 'EXPIRED',
      customerId: rec.customerId,
      email: rec.email,
      redirectPath: rec.redirectPath,
      purpose: rec.purpose,
      error: 'This verification code has expired. Please request a new verification code.',
    };
  }

  const nowIso = new Date().toISOString();
  records[idx] = { ...rec, usedAt: nowIso };
  writeRecords(records, filePath);

  return {
    valid: true,
    status: 'VERIFIED',
    customerId: rec.customerId,
    email: rec.email,
    redirectPath: rec.redirectPath,
    purpose: rec.purpose,
  };
}

export function verifyAndConsumeEmailVerificationToken(
  rawToken: string,
  filePath: string = EMAIL_VERIFICATION_TOKENS_PATH
): VerifyEmailTokenOutcome {
  const clean = String(rawToken || '').trim();
  if (!clean || clean.length < 32) {
    return {
      valid: false,
      status: 'INVALID',
      error: 'Verification link is invalid or malformed.',
    };
  }

  const targetHash = hashVerificationToken(clean);
  const records = readRecords(filePath);
  const idx = records.findIndex((r) => r.tokenHash === targetHash);

  if (idx === -1) {
    return {
      valid: false,
      status: 'INVALID',
      error: 'Verification link is invalid or does not exist.',
    };
  }

  const rec = records[idx];
  if (rec.usedAt) {
    return {
      valid: false,
      status: 'ALREADY_USED',
      customerId: rec.customerId,
      email: rec.email,
      redirectPath: rec.redirectPath,
      purpose: rec.purpose,
      error: 'This verification link has already been used. Your email may already be verified.',
    };
  }

  if (rec.revokedAt) {
    return {
      valid: false,
      status: 'SUPERSEDED',
      customerId: rec.customerId,
      email: rec.email,
      redirectPath: rec.redirectPath,
      purpose: rec.purpose,
      error: 'This verification link was replaced by a newer request. Please use your latest verification email.',
    };
  }

  if (new Date(rec.expiresAt).getTime() <= Date.now()) {
    return {
      valid: false,
      status: 'EXPIRED',
      customerId: rec.customerId,
      email: rec.email,
      redirectPath: rec.redirectPath,
      purpose: rec.purpose,
      error: 'This verification link has expired. Please request a new verification email.',
    };
  }

  const nowIso = new Date().toISOString();
  records[idx] = { ...rec, usedAt: nowIso };
  writeRecords(records, filePath);

  return {
    valid: true,
    status: 'VERIFIED',
    customerId: rec.customerId,
    email: rec.email,
    redirectPath: rec.redirectPath,
    purpose: rec.purpose,
  };
}

