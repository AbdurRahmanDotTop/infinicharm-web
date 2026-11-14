import fs from 'fs';
import path from 'path';
import type { AuthSettings, PublicAuthSettings } from '../../types/index.ts';
import { DEFAULT_AUTH_POLICY } from '../validation/auth.ts';

export const AUTH_SETTINGS_FILE_PATH = path.join(
  process.cwd(),
  'src',
  'data',
  'auth_settings.json'
);

function buildDefaultAuthSettings(): AuthSettings {
  return {
    ...DEFAULT_AUTH_POLICY,
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
  };
}

function clampInt(val: unknown, fallback: number, min: number, max: number): number {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

export function getAuthSettings(filePath: string = AUTH_SETTINGS_FILE_PATH): AuthSettings {
  const defaults = buildDefaultAuthSettings();
  try {
    if (!fs.existsSync(filePath)) {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(defaults, null, 2), 'utf8');
      return defaults;
    }
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!parsed || typeof parsed !== 'object') return defaults;
    return {
      ...defaults,
      ...parsed,
      minPasswordLength: clampInt(parsed.minPasswordLength, defaults.minPasswordLength, 6, 32),
      verificationTokenTtlMinutes: clampInt(
        parsed.verificationTokenTtlMinutes,
        defaults.verificationTokenTtlMinutes,
        5,
        1440
      ),
      verificationResendCooldownSeconds: clampInt(
        parsed.verificationResendCooldownSeconds,
        defaults.verificationResendCooldownSeconds,
        10,
        300
      ),
      verificationResendMaxPerHour: clampInt(
        parsed.verificationResendMaxPerHour,
        defaults.verificationResendMaxPerHour,
        1,
        30
      ),
      resetTokenTtlMinutes: clampInt(
        parsed.resetTokenTtlMinutes,
        defaults.resetTokenTtlMinutes,
        5,
        240
      ),
      resetRequestMaxPerHour: clampInt(
        parsed.resetRequestMaxPerHour,
        defaults.resetRequestMaxPerHour,
        1,
        30
      ),
      autoRedirectAfterVerificationSeconds: clampInt(
        parsed.autoRedirectAfterVerificationSeconds,
        defaults.autoRedirectAfterVerificationSeconds,
        0,
        15
      ),
    };
  } catch (err) {
    console.error('[auth-settings-store] Failed to read auth settings:', err);
    return defaults;
  }
}

export function getPublicAuthSettings(
  filePath: string = AUTH_SETTINGS_FILE_PATH
): PublicAuthSettings {
  const { updatedBy: _omit, ...pub } = getAuthSettings(filePath);
  return pub;
}

export function updateAuthSettings(
  patch: Partial<AuthSettings>,
  updatedBy: string = 'admin@infinicharm.com',
  filePath: string = AUTH_SETTINGS_FILE_PATH
): AuthSettings {
  const current = getAuthSettings(filePath);
  const next: AuthSettings = {
    ...current,
    registrationEnabled:
      typeof patch.registrationEnabled === 'boolean'
        ? patch.registrationEnabled
        : current.registrationEnabled,
    loginEnabled:
      typeof patch.loginEnabled === 'boolean' ? patch.loginEnabled : current.loginEnabled,
    checkoutRegistrationEnabled:
      typeof patch.checkoutRegistrationEnabled === 'boolean'
        ? patch.checkoutRegistrationEnabled
        : current.checkoutRegistrationEnabled,
    checkoutInlineLoginEnabled:
      typeof patch.checkoutInlineLoginEnabled === 'boolean'
        ? patch.checkoutInlineLoginEnabled
        : current.checkoutInlineLoginEnabled,
    guestCheckoutEnabled:
      typeof patch.guestCheckoutEnabled === 'boolean'
        ? patch.guestCheckoutEnabled
        : current.guestCheckoutEnabled,
    requireEmailVerification:
      typeof patch.requireEmailVerification === 'boolean'
        ? patch.requireEmailVerification
        : current.requireEmailVerification,
    verificationTokenTtlMinutes: clampInt(
      patch.verificationTokenTtlMinutes,
      current.verificationTokenTtlMinutes,
      5,
      1440
    ),
    verificationResendCooldownSeconds: clampInt(
      patch.verificationResendCooldownSeconds,
      current.verificationResendCooldownSeconds,
      10,
      300
    ),
    verificationResendMaxPerHour: clampInt(
      patch.verificationResendMaxPerHour,
      current.verificationResendMaxPerHour,
      1,
      30
    ),
    resetTokenTtlMinutes: clampInt(
      patch.resetTokenTtlMinutes,
      current.resetTokenTtlMinutes,
      5,
      240
    ),
    resetRequestMaxPerHour: clampInt(
      patch.resetRequestMaxPerHour,
      current.resetRequestMaxPerHour,
      1,
      30
    ),
    minPasswordLength: clampInt(patch.minPasswordLength, current.minPasswordLength, 6, 32),
    requireUppercase:
      typeof patch.requireUppercase === 'boolean'
        ? patch.requireUppercase
        : current.requireUppercase,
    requireLowercase:
      typeof patch.requireLowercase === 'boolean'
        ? patch.requireLowercase
        : current.requireLowercase,
    requireNumber:
      typeof patch.requireNumber === 'boolean' ? patch.requireNumber : current.requireNumber,
    requireSpecialChar:
      typeof patch.requireSpecialChar === 'boolean'
        ? patch.requireSpecialChar
        : current.requireSpecialChar,
    verificationRedirectPath:
      typeof patch.verificationRedirectPath === 'string' &&
      patch.verificationRedirectPath.startsWith('/') &&
      !patch.verificationRedirectPath.startsWith('//')
        ? patch.verificationRedirectPath
        : current.verificationRedirectPath,
    autoRedirectAfterVerificationSeconds: clampInt(
      patch.autoRedirectAfterVerificationSeconds,
      current.autoRedirectAfterVerificationSeconds,
      0,
      15
    ),
    passwordResetMode:
      patch.passwordResetMode === 'LINK_ONLY' || patch.passwordResetMode === 'LINK_AND_OTP'
        ? patch.passwordResetMode
        : current.passwordResetMode,
    updatedAt: new Date().toISOString(),
    updatedBy,
  };

  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = `${filePath}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2), 'utf8');
  fs.renameSync(tmp, filePath);
  return next;
}

