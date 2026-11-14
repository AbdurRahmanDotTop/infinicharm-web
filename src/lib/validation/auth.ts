import type { AuthSettings } from '../../types/index.ts';

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const DEFAULT_AUTH_POLICY: Omit<AuthSettings, 'updatedAt' | 'updatedBy'> = {
  registrationEnabled: true,
  loginEnabled: true,
  checkoutRegistrationEnabled: true,
  checkoutInlineLoginEnabled: true,
  guestCheckoutEnabled: true,
  requireEmailVerification: true,
  verificationTokenTtlMinutes: 60,
  verificationResendCooldownSeconds: 30,
  verificationResendMaxPerHour: 5,
  resetTokenTtlMinutes: 30,
  resetRequestMaxPerHour: 5,
  minPasswordLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecialChar: false,
  verificationRedirectPath: '/account',
  autoRedirectAfterVerificationSeconds: 3,
  passwordResetMode: 'LINK_AND_OTP',
};

export function normalizeEmail(email: string): string {
  return String(email || '').trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  const clean = normalizeEmail(email);
  return clean.length > 0 && clean.length <= 254 && EMAIL_REGEX.test(clean);
}

/**
 * Prevent open redirect attacks: only allow safe internal app-relative paths.
 */
export function sanitizeRedirectPath(raw?: string | null, fallback = '/account'): string {
  if (!raw || typeof raw !== 'string') return fallback;
  const trimmed = raw.trim();
  if (!trimmed.startsWith('/')) return fallback;
  if (trimmed.startsWith('//') || trimmed.startsWith('/\\') || trimmed.includes('\r') || trimmed.includes('\n')) {
    return fallback;
  }
  return trimmed;
}

export interface PasswordValidationCheck {
  key: 'length' | 'uppercase' | 'lowercase' | 'number' | 'special';
  label: string;
  passed: boolean;
  required: boolean;
}

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
  score: number;
  strengthLabel: 'Weak' | 'Fair' | 'Good' | 'Strong';
  checks: PasswordValidationCheck[];
}

export function validatePasswordAgainstPolicy(
  password: string,
  policy?: Partial<AuthSettings>
): PasswordValidationResult {
  const value = String(password || '');
  const minLength = Math.max(6, Math.min(32, Number(policy?.minPasswordLength ?? DEFAULT_AUTH_POLICY.minPasswordLength)));
  const requireUppercase = policy?.requireUppercase ?? DEFAULT_AUTH_POLICY.requireUppercase;
  const requireLowercase = policy?.requireLowercase ?? DEFAULT_AUTH_POLICY.requireLowercase;
  const requireNumber = policy?.requireNumber ?? DEFAULT_AUTH_POLICY.requireNumber;
  const requireSpecialChar = policy?.requireSpecialChar ?? DEFAULT_AUTH_POLICY.requireSpecialChar;

  const checks: PasswordValidationCheck[] = [
    {
      key: 'length',
      label: `At least ${minLength} characters`,
      passed: value.length >= minLength && value.length <= 128,
      required: true,
    },
    {
      key: 'uppercase',
      label: 'One uppercase letter (A-Z)',
      passed: /[A-Z]/.test(value),
      required: requireUppercase,
    },
    {
      key: 'lowercase',
      label: 'One lowercase letter (a-z)',
      passed: /[a-z]/.test(value),
      required: requireLowercase,
    },
    {
      key: 'number',
      label: 'One numeric digit (0-9)',
      passed: /[0-9]/.test(value),
      required: requireNumber,
    },
    {
      key: 'special',
      label: 'One special character (!@#$%^&*)',
      passed: /[^A-Za-z0-9]/.test(value),
      required: requireSpecialChar,
    },
  ];

  const errors: string[] = [];
  if (value.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters long.`);
  } else if (value.length > 128) {
    errors.push('Password must not exceed 128 characters.');
  }
  if (requireUppercase && !checks[1].passed) {
    errors.push('Password must contain at least one uppercase letter.');
  }
  if (requireLowercase && !checks[2].passed) {
    errors.push('Password must contain at least one lowercase letter.');
  }
  if (requireNumber && !checks[3].passed) {
    errors.push('Password must contain at least one number.');
  }
  if (requireSpecialChar && !checks[4].passed) {
    errors.push('Password must contain at least one special character.');
  }

  const passedCount = checks.filter((c) => c.passed).length;
  const score = Math.round((passedCount / checks.length) * 100);
  let strengthLabel: PasswordValidationResult['strengthLabel'] = 'Weak';
  if (errors.length === 0 && passedCount >= 5) strengthLabel = 'Strong';
  else if (errors.length === 0 && passedCount >= 4) strengthLabel = 'Good';
  else if (passedCount >= 3) strengthLabel = 'Fair';

  return {
    valid: errors.length === 0,
    errors,
    score,
    strengthLabel,
    checks,
  };
}

