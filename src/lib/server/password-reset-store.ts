import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const TOKENS_FILE_PATH = path.join(process.cwd(), 'src', 'data', 'password_reset_tokens.json');

interface PasswordResetRecord {
  id: string;
  email: string;
  otpHash?: string;
  tokenHash?: string;
  expiresAt: string;
  usedAt: string | null;
  revokedAt?: string | null;
  createdAt: string;
}

function readRecords(filePath: string = TOKENS_FILE_PATH): PasswordResetRecord[] {
  try {
    if (!fs.existsSync(filePath)) return [];
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(parsed) ? (parsed as PasswordResetRecord[]) : [];
  } catch {
    return [];
  }
}

function writeRecords(records: PasswordResetRecord[], filePath: string = TOKENS_FILE_PATH): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = `${filePath}.${Date.now()}-${Math.floor(Math.random() * 1000)}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(records, null, 2), 'utf8');
  fs.renameSync(tmp, filePath);
}

function getPepper(): string {
  const custom = process.env.OTP_SALT;
  return custom ? custom : 'infinicharm_otp_pepper';
}

function hashOtp(email: string, otp: string): string {
  const normalized = email.trim().toLowerCase();
  return crypto
    .createHash('sha256')
    .update(`${normalized}:${otp.trim()}:${getPepper()}`)
    .digest('hex');
}

function hashResetToken(rawToken: string): string {
  return crypto
    .createHash('sha256')
    .update(`reset:${String(rawToken || '').trim()}:${getPepper()}`)
    .digest('hex');
}

export function canRequestPasswordReset(
  email: string,
  maxPerHour: number = 5,
  filePath: string = TOKENS_FILE_PATH
): { allowed: boolean; retryAfterSeconds: number } {
  const normalized = email.trim().toLowerCase();
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const recentCount = readRecords(filePath).filter(
    (r) => r.email === normalized && new Date(r.createdAt).getTime() >= oneHourAgo
  ).length;
  if (recentCount >= maxPerHour) {
    return { allowed: false, retryAfterSeconds: 300 };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

export function createPasswordResetOtp(
  email: string,
  filePath: string = TOKENS_FILE_PATH
): { otp: string; expiresAt: string } {
  const { otp, expiresAt } = createPasswordResetToken(email, 15, filePath);
  return { otp, expiresAt };
}

export function createPasswordResetToken(
  email: string,
  ttlMinutes: number = 30,
  filePath: string = TOKENS_FILE_PATH
): { token: string; otp: string; expiresAt: string } {
  const normalized = email.trim().toLowerCase();
  const otp = String(crypto.randomInt(100000, 999999));
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const clampedTtl = Math.max(5, Math.min(240, Number(ttlMinutes || 30)));
  const expiresAt = new Date(now + clampedTtl * 60 * 1000).toISOString();
  const retentionCutoff = now - 24 * 60 * 60 * 1000;

  // Keep hourly rate limit history for this email while revoking any prior unused tokens
  const existing = readRecords(filePath)
    .filter((r) => new Date(r.createdAt).getTime() >= retentionCutoff)
    .map((r) =>
      r.email === normalized && !r.usedAt && !r.revokedAt
        ? { ...r, revokedAt: nowIso }
        : r
    );

  const created: PasswordResetRecord = {
    id: `rst-${now}-${Math.floor(1000 + Math.random() * 9000)}`,
    email: normalized,
    otpHash: hashOtp(normalized, otp),
    tokenHash: hashResetToken(token),
    expiresAt,
    usedAt: null,
    revokedAt: null,
    createdAt: nowIso,
  };

  writeRecords([created, ...existing], filePath);
  return { token, otp, expiresAt };
}

export interface InspectResetTokenOutcome {
  valid: boolean;
  status: 'VALID' | 'EXPIRED' | 'ALREADY_USED' | 'SUPERSEDED' | 'INVALID';
  email?: string;
  error?: string;
}

export function inspectPasswordResetToken(
  rawToken: string,
  filePath: string = TOKENS_FILE_PATH
): InspectResetTokenOutcome {
  const clean = String(rawToken || '').trim();
  if (!clean || clean.length < 32) {
    return {
      valid: false,
      status: 'INVALID',
      error: 'Password reset link is invalid or malformed.',
    };
  }

  const targetHash = hashResetToken(clean);
  const records = readRecords(filePath);
  const rec = records.find((r) => r.tokenHash === targetHash);

  if (!rec) {
    return {
      valid: false,
      status: 'INVALID',
      error: 'Password reset link is invalid or does not exist.',
    };
  }

  if (rec.usedAt) {
    return {
      valid: false,
      status: 'ALREADY_USED',
      error: 'This password reset link has already been used. Please request a new reset link if needed.',
    };
  }

  if (rec.revokedAt) {
    return {
      valid: false,
      status: 'SUPERSEDED',
      error: 'A newer password reset link was requested. Please use the latest email link.',
    };
  }

  if (new Date(rec.expiresAt).getTime() <= Date.now()) {
    return {
      valid: false,
      status: 'EXPIRED',
      error: 'This password reset link has expired. Please request a new one.',
    };
  }

  return { valid: true, status: 'VALID', email: rec.email };
}

export function verifyAndConsumePasswordResetToken(
  rawToken: string,
  filePath: string = TOKENS_FILE_PATH
): InspectResetTokenOutcome {
  const clean = String(rawToken || '').trim();
  const inspection = inspectPasswordResetToken(clean, filePath);
  if (!inspection.valid) return inspection;

  const targetHash = hashResetToken(clean);
  const records = readRecords(filePath);
  const idx = records.findIndex((r) => r.tokenHash === targetHash && !r.usedAt && !r.revokedAt);
  if (idx === -1) {
    return {
      valid: false,
      status: 'INVALID',
      error: 'Password reset link is invalid or already consumed.',
    };
  }

  const nowIso = new Date().toISOString();
  const targetEmail = records[idx].email;
  const updated = records.map((r, i) => {
    if (i === idx) return { ...r, usedAt: nowIso };
    if (r.email === targetEmail && !r.usedAt && !r.revokedAt) return { ...r, revokedAt: nowIso };
    return r;
  });

  writeRecords(updated, filePath);
  return { valid: true, status: 'VALID', email: targetEmail };
}

export function verifyAndConsumePasswordResetOtp(
  email: string,
  otp: string,
  filePath: string = TOKENS_FILE_PATH
): { valid: boolean; error?: string } {
  const normalized = email.trim().toLowerCase();
  const records = readRecords(filePath);
  const now = Date.now();
  const targetHash = hashOtp(normalized, otp);

  const idx = records.findIndex(
    (r) =>
      r.email === normalized &&
      r.otpHash === targetHash &&
      !r.usedAt &&
      !r.revokedAt &&
      new Date(r.expiresAt).getTime() > now
  );

  if (idx === -1) {
    return { valid: false, error: 'Invalid or expired verification code. Please request a new code.' };
  }

  const nowIso = new Date(now).toISOString();
  records[idx] = { ...records[idx], usedAt: nowIso };
  writeRecords(records, filePath);
  return { valid: true };
}
