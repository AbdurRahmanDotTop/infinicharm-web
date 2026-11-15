import type { NextRequest, NextResponse } from 'next/server';
import type { Customer } from '../../types/index.ts';
import {
  adminResetCustomerPassword,
  authenticateCustomer,
  createCustomer,
  getServerCustomerByEmail,
  getServerCustomerById,
  incrementCustomerSessionVersion,
  markCustomerEmailVerified,
  sanitizeCustomer,
  updateCustomer,
} from './customers-store.ts';
import { getAuthSettings } from './auth-settings-store.ts';
import {
  canRequestVerificationResend,
  createEmailVerificationToken,
  verifyAndConsumeEmailVerificationOtp,
  verifyAndConsumeEmailVerificationToken,
  type VerificationTokenPurpose,
  type VerifyEmailTokenOutcome,
} from './email-verification-store.ts';
import {
  canRequestPasswordReset,
  createPasswordResetToken,
  verifyAndConsumePasswordResetOtp,
  verifyAndConsumePasswordResetToken,
} from './password-reset-store.ts';
import { dispatchNotificationEvent } from './notification-dispatcher.ts';
import { appendServerAuditLog } from './server-audit-store.ts';
import {
  isValidEmail,
  normalizeEmail,
  sanitizeRedirectPath,
  validatePasswordAgainstPolicy,
} from '../validation/auth.ts';
import {
  getAppOrigin,
  getEmailVerificationUrl,
  getPasswordResetUrl,
} from '../utils/env-urls.ts';

export function resolvePublicOrigin(req?: Pick<NextRequest, 'headers' | 'nextUrl'>): string {
  return getAppOrigin(req);
}

export function setCustomerAuthCookies(
  response: NextResponse,
  customer: Pick<Customer, 'id' | 'sessionVersion'>,
  rememberMe: boolean = true
): void {
  const maxAge = rememberMe ? 604800 : 86400; // 7 days or 24 hours
  response.cookies.set('infinicharm_customer_session', 'active', {
    path: '/',
    maxAge,
    sameSite: 'lax',
    httpOnly: false,
  });
  response.cookies.set('infinicharm_customer_id', customer.id, {
    path: '/',
    maxAge,
    sameSite: 'lax',
    httpOnly: false,
  });
  response.cookies.set('infinicharm_customer_sv', String(customer.sessionVersion ?? 1), {
    path: '/',
    maxAge,
    sameSite: 'lax',
    httpOnly: true,
  });
}

export function clearCustomerAuthCookies(response: NextResponse): void {
  response.cookies.delete('infinicharm_customer_session');
  response.cookies.delete('infinicharm_customer_id');
  response.cookies.delete('infinicharm_customer_sv');
}

export async function issueAndSendEmailVerification(input: {
  customer: Pick<Customer, 'id' | 'email' | 'fullName' | 'phone'>;
  purpose: VerificationTokenPurpose;
  redirectPath?: string | null;
  origin: string;
  bypassRateLimit?: boolean;
}): Promise<{
  sent: boolean;
  rateLimited?: boolean;
  retryAfterSeconds?: number;
  error?: string;
  expiresAt?: string;
}> {
  const settings = getAuthSettings();

  if (!input.bypassRateLimit) {
    const rate = canRequestVerificationResend(
      input.customer.email,
      settings.verificationResendCooldownSeconds,
      settings.verificationResendMaxPerHour
    );
    if (!rate.allowed) {
      return {
        sent: false,
        rateLimited: true,
        retryAfterSeconds: rate.retryAfterSeconds,
        error: rate.reason,
      };
    }
  }

  const safeRedirect = sanitizeRedirectPath(
    input.redirectPath,
    settings.verificationRedirectPath || '/account'
  );
  const { token, otp, expiresAt, otpExpiresAt } = createEmailVerificationToken({
    customerId: input.customer.id,
    email: input.customer.email,
    ttlMinutes: settings.verificationTokenTtlMinutes,
    purpose: input.purpose,
    redirectPath: safeRedirect,
  });

  const verificationUrl = getEmailVerificationUrl(token, safeRedirect, input.origin);

  updateCustomer(input.customer.id, {
    verificationSentAt: new Date().toISOString(),
  });

  let dispatched = false;
  try {
    const dispatchRes = await dispatchNotificationEvent({
      eventKey: 'CUSTOMER_EMAIL_VERIFICATION',
      customerEmail: input.customer.email,
      customerName: input.customer.fullName,
      entityType: 'CUSTOMER',
      entityId: input.customer.id,
      extraVars: {
        customer_name: input.customer.fullName || 'Valued Patron',
        customer_email: input.customer.email,
        customer_phone: input.customer.phone || 'Not provided',
        otp_code: otp,
        verification_code: otp,
        verification_link: verificationUrl,
        verification_url: verificationUrl,
        action_url: verificationUrl,
        otp_expires_in: `${settings.verificationTokenTtlMinutes} minutes`,
        link_expires_in: `${settings.verificationTokenTtlMinutes} minutes`,
        expiry_minutes: settings.verificationTokenTtlMinutes,
        site_name: 'InfiniCharm (TechilyFly India)',
        brand_name: 'InfiniCharm (TechilyFly India)',
        site_url: input.origin,
        store_url: input.origin,
        support_email: 'support@infinicharm.com',
        current_year: String(new Date().getFullYear()),
        activity_summary: `Email verification requested (${input.purpose}). 6-Digit OTP: ${otp}. Expires at ${expiresAt}.`,
      },
    });
    dispatched = dispatchRes.sentCount > 0;
  } catch (err) {
    console.error('[auth-service] Email verification dispatch error:', err);
  }

  appendServerAuditLog({
    actorId: input.customer.id,
    actorEmail: input.customer.email,
    action: 'EMAIL_VERIFICATION_DISPATCHED',
    resourceType: 'customer_auth',
    resourceId: input.customer.id,
    diff: {
      purpose: input.purpose,
      redirectPath: safeRedirect,
      smtpDispatched: dispatched,
      expiresAt,
      otpExpiresAt,
      hasOtp: true,
    },
  });

  return { sent: true, expiresAt };
}

export async function registerCustomerAccount(input: {
  fullName: string;
  email: string;
  phone?: string;
  password: string;
  customFields?: Record<string, any>;
  registrationSource?: 'REGISTER_PAGE' | 'CHECKOUT';
  redirectPath?: string | null;
  origin: string;
  ipAddress?: string;
}): Promise<{
  success: boolean;
  status: number;
  error?: string;
  code?: 'REGISTRATION_DISABLED' | 'INVALID_INPUT' | 'WEAK_PASSWORD' | 'EMAIL_EXISTS';
  customer?: Omit<Customer, 'passwordHash'>;
  requiresVerification?: boolean;
}> {
  const settings = getAuthSettings();
  const source = input.registrationSource === 'CHECKOUT' ? 'CHECKOUT' : 'REGISTER_PAGE';

  if (source === 'REGISTER_PAGE' && !settings.registrationEnabled) {
    return {
      success: false,
      status: 403,
      code: 'REGISTRATION_DISABLED',
      error: 'New customer registration is currently disabled by administration.',
    };
  }

  if (source === 'CHECKOUT' && !settings.checkoutRegistrationEnabled) {
    return {
      success: false,
      status: 403,
      code: 'REGISTRATION_DISABLED',
      error: 'Account creation during checkout is currently disabled by administration.',
    };
  }

  const fullName = String(input.fullName || '').trim();
  const email = normalizeEmail(input.email);
  const phone = String(input.phone || '').trim();
  const password = String(input.password || '');

  if (!fullName || !email || !isValidEmail(email)) {
    return {
      success: false,
      status: 400,
      code: 'INVALID_INPUT',
      error: 'Please enter a valid full name and email address.',
    };
  }

  const pwCheck = validatePasswordAgainstPolicy(password, settings);
  if (!pwCheck.valid) {
    return {
      success: false,
      status: 400,
      code: 'WEAK_PASSWORD',
      error: pwCheck.errors[0] || 'Password does not meet security requirements.',
    };
  }

  const existing = getServerCustomerByEmail(email);
  if (existing) {
    return {
      success: false,
      status: 409,
      code: 'EMAIL_EXISTS',
      error: 'An account with this email address already exists. Please sign in or reset your password.',
    };
  }

  const requiresVerification = Boolean(settings.requireEmailVerification);

  const newCust = createCustomer({
    email,
    fullName,
    phone,
    password,
    status: 'ACTIVE',
    role: 'CUSTOMER',
    emailVerified: !requiresVerification,
    emailVerifiedAt: !requiresVerification ? new Date().toISOString() : null,
    registrationSource: source,
    customFields: input.customFields,
  });

  if (requiresVerification) {
    await issueAndSendEmailVerification({
      customer: newCust,
      purpose: source === 'CHECKOUT' ? 'CHECKOUT_REGISTRATION' : 'REGISTRATION',
      redirectPath:
        input.redirectPath || (source === 'CHECKOUT' ? '/checkout' : settings.verificationRedirectPath),
      origin: input.origin,
      bypassRateLimit: true,
    });
  }

  try {
    await dispatchNotificationEvent({
      eventKey: 'CUSTOMER_REGISTERED',
      customerEmail: newCust.email,
      customerName: newCust.fullName,
      entityType: 'CUSTOMER',
      entityId: newCust.id,
      extraVars: {
        customer_name: newCust.fullName,
        customer_email: newCust.email,
        customer_phone: newCust.phone || 'Not provided',
        activity_summary: requiresVerification
          ? `New customer registered via ${source} (awaiting email verification): ${newCust.email}.`
          : `New customer registered via ${source}: ${newCust.email}.`,
      },
    });
  } catch (notifyErr) {
    console.error('[auth-service] non-blocking CUSTOMER_REGISTERED error:', notifyErr);
  }

  appendServerAuditLog({
    actorId: newCust.id,
    actorEmail: newCust.email,
    action: 'CUSTOMER_REGISTERED',
    resourceType: 'customer_auth',
    resourceId: newCust.id,
    ipAddress: input.ipAddress,
    diff: {
      source,
      emailVerified: newCust.emailVerified,
      requiresVerification,
    },
  });

  return {
    success: true,
    status: 201,
    customer: sanitizeCustomer(newCust),
    requiresVerification,
  };
}

export async function loginCustomerAccount(input: {
  email: string;
  password: string;
  ipAddress?: string;
}) {
  const email = normalizeEmail(input.email);
  const authResult = authenticateCustomer(email, String(input.password || ''));

  appendServerAuditLog({
    actorId: authResult.customer?.id || 'anonymous',
    actorEmail: email || 'unknown',
    action: authResult.customer ? 'CUSTOMER_LOGIN_SUCCESS' : 'CUSTOMER_LOGIN_FAILED',
    resourceType: 'customer_auth',
    resourceId: authResult.customer?.id || email || 'unknown',
    ipAddress: input.ipAddress,
    diff: authResult.customer
      ? { authenticated: true }
      : { authenticated: false, code: authResult.code || 'INVALID_CREDENTIALS' },
  });

  return authResult;
}

export function verifyEmailWithToken(rawToken: string, ipAddress?: string): VerifyEmailTokenOutcome & {
  customer?: Omit<Customer, 'passwordHash'>;
} {
  const outcome = verifyAndConsumeEmailVerificationToken(rawToken);
  if (!outcome.valid || !outcome.customerId) {
    appendServerAuditLog({
      actorId: outcome.customerId || 'anonymous',
      actorEmail: outcome.email || 'unknown',
      action: 'EMAIL_VERIFICATION_FAILED',
      resourceType: 'customer_auth',
      resourceId: outcome.customerId || 'token',
      ipAddress,
      diff: { method: 'DIRECT_LINK', status: outcome.status },
    });
    return outcome;
  }

  const verifiedRes = markCustomerEmailVerified(outcome.customerId);
  if (!verifiedRes.success || !verifiedRes.customer) {
    return {
      valid: false,
      status: 'INVALID',
      error: 'Associated customer account could not be found.',
    };
  }

  appendServerAuditLog({
    actorId: verifiedRes.customer.id,
    actorEmail: verifiedRes.customer.email,
    action: 'CUSTOMER_EMAIL_VERIFIED',
    resourceType: 'customer_auth',
    resourceId: verifiedRes.customer.id,
    ipAddress,
    diff: { method: 'DIRECT_LINK', purpose: outcome.purpose, redirectPath: outcome.redirectPath },
  });

  return {
    ...outcome,
    customer: verifiedRes.customer,
  };
}

export function verifyEmailWithOtp(
  email: string,
  rawOtp: string,
  ipAddress?: string
): VerifyEmailTokenOutcome & {
  customer?: Omit<Customer, 'passwordHash'>;
} {
  const outcome = verifyAndConsumeEmailVerificationOtp(email, rawOtp);
  if (!outcome.valid || !outcome.customerId) {
    appendServerAuditLog({
      actorId: outcome.customerId || 'anonymous',
      actorEmail: outcome.email || email,
      action: 'EMAIL_VERIFICATION_FAILED',
      resourceType: 'customer_auth',
      resourceId: outcome.customerId || 'otp',
      ipAddress,
      diff: { method: 'OTP', status: outcome.status, error: outcome.error },
    });
    return outcome;
  }

  const verifiedRes = markCustomerEmailVerified(outcome.customerId);
  if (!verifiedRes.success || !verifiedRes.customer) {
    return {
      valid: false,
      status: 'INVALID',
      error: 'Associated customer account could not be found.',
    };
  }

  appendServerAuditLog({
    actorId: verifiedRes.customer.id,
    actorEmail: verifiedRes.customer.email,
    action: 'CUSTOMER_EMAIL_VERIFIED',
    resourceType: 'customer_auth',
    resourceId: verifiedRes.customer.id,
    ipAddress,
    diff: { method: 'OTP', purpose: outcome.purpose, redirectPath: outcome.redirectPath },
  });

  return {
    ...outcome,
    customer: verifiedRes.customer,
  };
}

export function verifyEmailWithTokenOrOtp(input: {
  token?: string;
  email?: string;
  otp?: string;
  ipAddress?: string;
}): VerifyEmailTokenOutcome & {
  customer?: Omit<Customer, 'passwordHash'>;
} {
  if (input.token && input.token.trim()) {
    return verifyEmailWithToken(input.token.trim(), input.ipAddress);
  }
  if (input.email && input.otp) {
    return verifyEmailWithOtp(input.email.trim(), input.otp.trim(), input.ipAddress);
  }
  return {
    valid: false,
    status: 'INVALID',
    error: 'Either a verification link token or email with 6-digit verification code is required.',
  };
}

export async function requestVerificationResend(input: {
  email: string;
  redirectPath?: string | null;
  origin: string;
}): Promise<{
  success: boolean;
  status: number;
  message?: string;
  error?: string;
  retryAfterSeconds?: number;
}> {
  const settings = getAuthSettings();
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) {
    return { success: false, status: 400, error: 'Please enter a valid email address.' };
  }

  const rateCheck = canRequestVerificationResend(
    email,
    settings.verificationResendCooldownSeconds,
    settings.verificationResendMaxPerHour
  );
  if (!rateCheck.allowed) {
    return {
      success: false,
      status: 429,
      error: rateCheck.reason,
      retryAfterSeconds: rateCheck.retryAfterSeconds,
    };
  }

  const customer = getServerCustomerByEmail(email);
  if (!customer || customer.status === 'SUSPENDED' || customer.emailVerified) {
    // Anti-enumeration: identical safe response without leaking account status
    return {
      success: true,
      status: 200,
      message:
        'If an unverified active account matches this email address, a fresh verification email with a 6-digit OTP and instant link has been sent to your inbox.',
    };
  }

  await issueAndSendEmailVerification({
    customer,
    purpose: 'REGISTRATION',
    redirectPath: input.redirectPath,
    origin: input.origin,
    bypassRateLimit: true,
  });

  return {
    success: true,
    status: 200,
    message:
      'If an unverified active account matches this email address, a fresh verification email with a 6-digit OTP and instant link has been sent to your inbox.',
  };
}

export async function requestCustomerPasswordReset(input: {
  email: string;
  origin: string;
  ipAddress?: string;
}): Promise<{ success: boolean; message: string }> {
  const settings = getAuthSettings();
  const email = normalizeEmail(input.email);
  const customer = getServerCustomerByEmail(email);
  const rate = canRequestPasswordReset(email, settings.resetRequestMaxPerHour);

  if (customer && customer.status !== 'SUSPENDED' && rate.allowed) {
    const { token, otp, expiresAt } = createPasswordResetToken(
      customer.email,
      settings.resetTokenTtlMinutes
    );
    const resetUrl = getPasswordResetUrl(token, undefined, input.origin);

    try {
      await dispatchNotificationEvent({
        eventKey: 'PASSWORD_RESET_OTP',
        customerEmail: customer.email,
        customerName: customer.fullName,
        entityType: 'CUSTOMER',
        entityId: customer.id,
        extraVars: {
          otp_code: otp,
          reset_url: resetUrl,
          action_url: resetUrl,
          expiry_minutes: settings.resetTokenTtlMinutes,
          otp_expires_at: expiresAt,
          customer_name: customer.fullName,
          customer_email: customer.email,
          activity_summary: `A single-use password reset link was requested for ${customer.email}. Valid for ${settings.resetTokenTtlMinutes} minutes.`,
        },
      });
    } catch (err) {
      console.error('[auth-service] non-blocking password reset email failure:', err);
    }

    appendServerAuditLog({
      actorId: customer.id,
      actorEmail: customer.email,
      action: 'PASSWORD_RESET_REQUESTED',
      resourceType: 'customer_auth',
      resourceId: customer.id,
      ipAddress: input.ipAddress,
      diff: { expiresAt },
    });
  }

  return {
    success: true,
    message:
      'If an InfiniCharm account matches that email address, a single-use password reset link has been sent to your inbox.',
  };
}

export async function completeCustomerPasswordReset(input: {
  token?: string;
  email?: string;
  otp?: string;
  newPassword: string;
  ipAddress?: string;
}): Promise<{ success: boolean; status: number; error?: string; message?: string }> {
  const settings = getAuthSettings();
  const pwCheck = validatePasswordAgainstPolicy(input.newPassword, settings);
  if (!pwCheck.valid) {
    return {
      success: false,
      status: 400,
      error: pwCheck.errors[0] || 'New password does not meet security requirements.',
    };
  }

  let targetEmail: string | undefined;

  if (input.token && input.token.trim().length > 0) {
    const tokenRes = verifyAndConsumePasswordResetToken(input.token);
    if (!tokenRes.valid || !tokenRes.email) {
      return {
        success: false,
        status: 400,
        error: tokenRes.error || 'Password reset link is invalid or expired.',
      };
    }
    targetEmail = tokenRes.email;
  } else if (input.email && input.otp) {
    const cleanEmail = normalizeEmail(input.email);
    const otpRes = verifyAndConsumePasswordResetOtp(cleanEmail, input.otp);
    if (!otpRes.valid) {
      return {
        success: false,
        status: 400,
        error: otpRes.error || 'Verification PIN is invalid or expired.',
      };
    }
    targetEmail = cleanEmail;
  } else {
    return {
      success: false,
      status: 400,
      error: 'A valid password reset link or verification PIN is required.',
    };
  }

  const customer = getServerCustomerByEmail(targetEmail);
  if (!customer || customer.status === 'SUSPENDED') {
    return {
      success: false,
      status: 400,
      error: 'Unable to reset password for this account.',
    };
  }

  const updateRes = adminResetCustomerPassword(customer.id, input.newPassword, {
    enforcePolicy: true,
  });
  if (!updateRes.success) {
    return {
      success: false,
      status: 400,
      error: updateRes.error || 'Unable to update customer password.',
    };
  }

  // Note: adminResetCustomerPassword already increments sessionVersion to invalidate all old sessions.
  try {
    await dispatchNotificationEvent({
      eventKey: 'PASSWORD_CHANGED',
      customerEmail: customer.email,
      customerName: customer.fullName,
      entityType: 'CUSTOMER',
      entityId: customer.id,
      extraVars: {
        customer_name: customer.fullName,
        customer_email: customer.email,
        activity_summary:
          'Your InfiniCharm account password was reset and all previous active sessions were signed out.',
      },
    });
  } catch (err) {
    console.error('[auth-service] non-blocking PASSWORD_CHANGED email error:', err);
  }

  appendServerAuditLog({
    actorId: customer.id,
    actorEmail: customer.email,
    action: 'CUSTOMER_PASSWORD_RESET_COMPLETED',
    resourceType: 'customer_auth',
    resourceId: customer.id,
    ipAddress: input.ipAddress,
    diff: { via: input.token ? 'TOKEN_LINK' : 'OTP', sessionsInvalidated: true },
  });

  return {
    success: true,
    status: 200,
    message: 'Your password has been updated. Please sign in with your new password.',
  };
}

export function logoutCustomerById(customerId?: string, ipAddress?: string): void {
  if (!customerId) return;
  const cust = getServerCustomerById(customerId);
  if (!cust) return;
  const nextVersion = incrementCustomerSessionVersion(cust.id);
  appendServerAuditLog({
    actorId: cust.id,
    actorEmail: cust.email,
    action: 'CUSTOMER_LOGOUT',
    resourceType: 'customer_auth',
    resourceId: cust.id,
    ipAddress,
    diff: { newSessionVersion: nextVersion },
  });
}

