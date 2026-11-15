'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { BRAND } from '@/lib/constants/brand';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { PasswordInput } from '@/components/auth/PasswordInput';
import { ResendVerificationBox } from '@/components/auth/ResendVerificationBox';
import { OtpInput } from '@/components/auth/OtpInput';
import {
  persistClientCustomerSession,
  clearClientCustomerSession,
  getClientCustomerUser,
} from '@/lib/auth/client-session';
import {
  isValidEmail,
  sanitizeRedirectPath,
  validatePasswordAgainstPolicy,
} from '@/lib/validation/auth';
import type { PublicAuthSettings, RegistrationFormSettings, RegistrationFormField } from '@/types';
import { AlertCircle, CheckCircle2, MailCheck, ShieldAlert, Loader2, ArrowRight, UserCheck } from 'lucide-react';

function RegisterFormContent() {
  const searchParams = useSearchParams();
  const redirectTarget = sanitizeRedirectPath(searchParams?.get('redirect'), '/account');

  const [policy, setPolicy] = useState<PublicAuthSettings | null>(null);
  const [formSettings, setFormSettings] = useState<RegistrationFormSettings | null>(null);

  // System field states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Dynamic custom fields state
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});

  const [agreedToTerms, setAgreedToTerms] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);
  const [activatedSuccess, setActivatedSuccess] = useState(false);
  const [otp, setOtp] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpSuccess, setOtpSuccess] = useState(false);
  const [alreadyLoggedInUser, setAlreadyLoggedInUser] = useState<{
    id: string;
    email: string;
    fullName?: string;
  } | null>(null);

  // Detect active session
  useEffect(() => {
    const hasSessionCookie =
      typeof document !== 'undefined' &&
      document.cookie.includes('infinicharm_customer_session=active');
    const localUser = getClientCustomerUser();

    if (hasSessionCookie || (localUser && localUser.id)) {
      fetch('/api/customers/me', { cache: 'no-store' })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.success && data?.customer) {
            setAlreadyLoggedInUser(data.customer);
          } else if (localUser && localUser.id) {
            setAlreadyLoggedInUser(localUser);
          } else {
            setAlreadyLoggedInUser(null);
          }
        })
        .catch(() => {
          if (localUser && localUser.id) {
            setAlreadyLoggedInUser(localUser);
          }
        });
    }
  }, []);

  const handleSwitchAccount = async () => {
    try {
      await fetch('/api/auth/customer/logout', { method: 'POST' });
    } catch {}
    clearClientCustomerSession();
    setAlreadyLoggedInUser(null);
  };

  useEffect(() => {
    fetch('/api/auth/settings', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (d?.success && d.settings) setPolicy(d.settings);
      })
      .catch(() => {});

    // Fetch dynamic registration form settings
    fetch('/api/settings/registration-form', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.success && d.settings) {
          setFormSettings(d.settings);
          // Initialize default values for custom fields
          const defaults: Record<string, any> = {};
          if (Array.isArray(d.settings.fields)) {
            d.settings.fields.forEach((f: RegistrationFormField) => {
              if (!f.isSystemField && f.defaultValue !== undefined) {
                defaults[f.key] = f.defaultValue;
              }
            });
          }
          setCustomFieldValues((prev) => ({ ...defaults, ...prev }));
        }
      })
      .catch((err) => console.error('Failed to load registration form settings:', err));
  }, []);

  const handleCustomFieldChange = (key: string, value: any) => {
    setCustomFieldValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleVerifyOtp = async (codeToVerify?: string) => {
    const finalOtp = (codeToVerify || otp).trim();
    if (finalOtp.length !== 6) {
      setOtpError('Please enter a complete 6-digit code.');
      return;
    }

    setVerifyingOtp(true);
    setOtpError(null);

    try {
      const res = await fetch('/api/auth/customer/verify-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: pendingVerificationEmail,
          otp: finalOtp,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Verification failed. Please re-enter the code.');
      }

      setOtpSuccess(true);
      if (data.customer) {
        persistClientCustomerSession(data.customer);
      }

      setTimeout(() => {
        window.location.href = redirectTarget;
      }, 700);
    } catch (err: any) {
      setOtpError(err?.message || 'Invalid or expired code. Please try again.');
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 1. Validate System Fields
    if (!name.trim()) {
      setError('Please provide your full name.');
      return;
    }

    if (!isValidEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    const pwCheck = validatePasswordAgainstPolicy(password, policy || undefined);
    if (!pwCheck.valid) {
      setError(pwCheck.errors[0] || 'Please choose a stronger password.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    // 2. Validate Dynamic Custom Fields
    if (formSettings && Array.isArray(formSettings.fields)) {
      for (const field of formSettings.fields) {
        if (!field.isEnabled) continue;

        if (field.key === 'phone') {
          if (field.required && !phone.trim()) {
            setError(`Please provide your ${field.label}.`);
            return;
          }
          if (phone.trim() && field.validation?.pattern) {
            try {
              const regex = new RegExp(field.validation.pattern);
              if (!regex.test(phone.trim())) {
                setError(`Please enter a valid ${field.label}.`);
                return;
              }
            } catch {}
          }
        } else if (!field.isSystemField) {
          const val = customFieldValues[field.key];
          const strVal = typeof val === 'string' ? val.trim() : '';

          if (field.required) {
            if (val === undefined || val === null || val === '' || val === false) {
              setError(`Please complete the required field: "${field.label}".`);
              return;
            }
          }

          if (strVal && field.validation?.minLength && strVal.length < field.validation.minLength) {
            setError(`"${field.label}" must be at least ${field.validation.minLength} characters.`);
            return;
          }

          if (strVal && field.validation?.maxLength && strVal.length > field.validation.maxLength) {
            setError(`"${field.label}" cannot exceed ${field.validation.maxLength} characters.`);
            return;
          }

          if (strVal && field.validation?.pattern) {
            try {
              const regex = new RegExp(field.validation.pattern);
              if (!regex.test(strVal)) {
                setError(`"${field.label}" format is invalid.`);
                return;
              }
            } catch {}
          }
        }
      }
    }

    // 3. Terms Agreement Check
    const termsRequired = formSettings ? formSettings.termsAgreementRequired !== false : true;
    if (termsRequired && !agreedToTerms) {
      setError('Please accept the Terms of Service and acknowledge the Privacy Policy to proceed.');
      return;
    }

    setLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const res = await fetch('/api/auth/customer/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: name.trim(),
          email: normalizedEmail,
          phone: phone.trim() || '',
          password,
          customFields: customFieldValues,
          source: 'REGISTER_PAGE',
          redirectPath: redirectTarget,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Registration failed.');
      }

      if (data.requiresVerification) {
        setPendingVerificationEmail(normalizedEmail);
        setLoading(false);
        return;
      }

      persistClientCustomerSession(data.customer);
      setActivatedSuccess(true);
      setTimeout(() => {
        window.location.href = redirectTarget;
      }, 450);
    } catch (err: any) {
      setError(err?.message || 'Registration failed. Please try again.');
      setLoading(false);
    }
  };

  if (policy && !policy.registrationEnabled) {
    return (
      <Card level={1} className="p-8 space-y-4 bg-surface border border-border text-center">
        <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="font-display text-lg font-bold text-primary">
          New Registrations Temporarily Paused
        </h2>
        <p className="text-xs text-muted leading-relaxed">
          Customer account registration has been paused by store administration. Existing customers can still sign in below.
        </p>
        <div className="pt-2">
          <Link
            href={`/login?redirect=${encodeURIComponent(redirectTarget)}`}
            className="inline-flex items-center justify-center px-5 py-2.5 bg-accent hover:bg-accent-hover text-white text-xs font-bold rounded-xl transition-colors uppercase tracking-wider"
          >
            Sign In to Existing Account
          </Link>
        </div>
      </Card>
    );
  }

  if (pendingVerificationEmail) {
    return (
      <Card
        level={1}
        data-testid="register-verification-pending"
        className="p-6 sm:p-8 space-y-6 bg-surface border border-border"
      >
        <div className="text-center space-y-2.5">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
            <MailCheck className="w-6 h-6" />
          </div>
          <h2 className="font-display text-xl sm:text-2xl font-bold text-primary">
            Verify Your Email Address
          </h2>
          <p className="text-xs text-muted leading-relaxed max-w-md mx-auto">
            We&apos;ve sent a 6-digit code and instant verification link to{' '}
            <strong className="text-primary">{pendingVerificationEmail}</strong>. Use either method to activate your account.
          </p>
        </div>

        {otpSuccess ? (
          <div className="text-center py-6 space-y-3 bg-emerald-50/80 border border-emerald-200 rounded-2xl p-6">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="font-display text-base font-bold text-emerald-900">
              Email Verified Successfully!
            </h3>
            <p className="text-xs text-emerald-700">
              Your account is active. Redirecting you securely...
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* 1. Enter 6-Digit OTP */}
            <div className="p-4 sm:p-5 rounded-2xl border border-border bg-surface-dim/40 space-y-3.5">
              <div className="text-center space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-accent block">
                  Method 1: Enter 6-Digit Code
                </span>
                <p className="text-xs text-secondary">
                  Type or paste the 6-digit code from your email:
                </p>
              </div>

              <OtpInput
                value={otp}
                onChange={(val) => {
                  setOtp(val);
                  if (otpError) setOtpError(null);
                }}
                onComplete={(code) => handleVerifyOtp(code)}
                disabled={verifyingOtp}
                hasError={Boolean(otpError)}
                autoFocus={true}
              />

              {otpError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 p-2.5 rounded-xl text-center justify-center font-medium"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <span>{otpError}</span>
                </div>
              )}

              <Button
                type="button"
                data-testid="verify-otp-submit-btn"
                disabled={otp.length !== 6 || verifyingOtp}
                onClick={() => handleVerifyOtp()}
                className="w-full justify-center bg-accent hover:bg-accent-hover text-white font-bold py-2.5 rounded-xl transition-all shadow-xs"
              >
                {verifyingOtp ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Verifying Code...
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    Verify Code &amp; Continue <ArrowRight className="w-4 h-4" />
                  </span>
                )}
              </Button>
            </div>

            {/* Divider */}
            <div className="relative text-center my-3">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <span className="relative bg-surface px-3 text-[11px] font-bold text-muted uppercase tracking-wider">
                Or Verify With One Click
              </span>
            </div>

            <p className="text-[11px] text-muted text-center leading-relaxed">
              Prefer not to enter a code? You can simply open your inbox and click the{' '}
              <strong className="text-primary font-semibold">Verify Email Address</strong> button in the email we sent you.
            </p>

            {/* Resend Box */}
            <ResendVerificationBox
              initialEmail={pendingVerificationEmail}
              redirectPath={redirectTarget}
            />
          </div>
        )}

        <div className="pt-3 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
          <Link
            href={`/login?email=${encodeURIComponent(pendingVerificationEmail)}&redirect=${encodeURIComponent(redirectTarget)}`}
            className="text-accent font-semibold hover:underline"
          >
            Verified already? Sign in here &rarr;
          </Link>
          <button
            type="button"
            onClick={() => {
              setPendingVerificationEmail(null);
              setOtp('');
              setOtpError(null);
            }}
            className="text-muted hover:text-primary font-medium cursor-pointer"
          >
            Use a different email
          </button>
        </div>
      </Card>
    );
  }

  if (alreadyLoggedInUser) {
    return (
      <Card level={1} className="p-6 sm:p-8 space-y-6 bg-surface border border-border">
        <div className="flex items-center gap-3.5 border-b border-border pb-4">
          <div className="w-12 h-12 rounded-2xl bg-accent/15 text-accent flex items-center justify-center font-bold text-lg">
            <UserCheck className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-200">
                Active Session
              </span>
            </div>
            <h2 className="font-display text-base font-bold text-primary">
              Signed in as {alreadyLoggedInUser.fullName || 'Valued Patron'}
            </h2>
            <p className="text-xs text-muted font-mono">{alreadyLoggedInUser.email}</p>
          </div>
        </div>

        <p className="text-xs text-muted leading-relaxed">
          You are already signed in to your InfiniCharm account. To manage your profile or view your past orders, proceed to your account. To create an account with different credentials, sign out below.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <Link
            href={redirectTarget && redirectTarget !== '/register' ? redirectTarget : '/account'}
            className="w-full sm:flex-1 py-3 px-4 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl uppercase tracking-wider transition-colors text-center shadow-sm"
          >
            {redirectTarget && redirectTarget !== '/account' && redirectTarget !== '/register'
              ? 'Continue to Destination'
              : 'Go to My Account'}
          </Link>
          <button
            type="button"
            onClick={handleSwitchAccount}
            className="w-full sm:w-auto py-3 px-4 bg-surface hover:bg-surface-dim text-muted hover:text-primary border border-border text-xs font-semibold rounded-xl transition-colors text-center"
          >
            Sign Out to Register Another
          </button>
        </div>
      </Card>
    );
  }

  // Sort fields by order
  const activeFields: RegistrationFormField[] = formSettings?.fields
    ? formSettings.fields.filter((f) => f.isEnabled).sort((a, b) => a.order - b.order)
    : [
        { id: '1', key: 'fullName', label: 'Full Name', type: 'text', placeholder: 'Aarav Sharma', required: true, isEnabled: true, order: 1, isSystemField: true },
        { id: '2', key: 'email', label: 'Email Address', type: 'email', placeholder: 'aarav@example.com', required: true, isEnabled: true, order: 2, isSystemField: true },
        { id: '3', key: 'phone', label: 'Mobile Phone (Optional)', type: 'phone', placeholder: '+91 98765 43210', required: false, isEnabled: true, order: 3, isSystemField: false },
        { id: '4', key: 'password', label: 'Password', type: 'password', placeholder: 'Create a strong password', required: true, isEnabled: true, order: 4, isSystemField: true },
        { id: '5', key: 'confirmPassword', label: 'Confirm Password', type: 'password', placeholder: 'Re-enter your password', required: true, isEnabled: true, order: 5, isSystemField: true },
      ];

  const termsRequired = formSettings ? formSettings.termsAgreementRequired !== false : true;
  const termsText = formSettings?.termsText || 'I agree to the Terms of Service and acknowledge the Privacy Policy (DPDP Act).';
  const termsLink = formSettings?.termsLink || '/policies/terms';
  const privacyLink = formSettings?.privacyLink || '/policies/privacy';
  const submitButtonText = formSettings?.submitButtonText || 'Create InfiniCharm Account';

  return (
    <Card level={1} className="p-6 sm:p-8 space-y-5 bg-surface border border-border">
      {error && (
        <div
          role="alert"
          className="p-3 rounded-md bg-state-error/10 border border-state-error/20 flex items-start gap-2 text-xs text-state-error font-medium"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {activatedSuccess && (
        <div className="p-3 rounded-md bg-emerald-50 border border-emerald-200 flex items-start gap-2 text-xs text-emerald-800 font-medium">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
          <span>Account created successfully! Welcome to {BRAND.name}. Redirecting...</span>
        </div>
      )}

      <form onSubmit={handleRegister} className="space-y-4">
        {activeFields.map((field) => {
          // System field: fullName
          if (field.key === 'fullName') {
            return (
              <div key={field.key} className="space-y-1">
                <Input
                  label={field.label || 'Full Name'}
                  type="text"
                  placeholder={field.placeholder || 'Aarav Sharma'}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required={field.required}
                  autoComplete="name"
                />
                {field.description && (
                  <p className="text-[10px] text-muted">{field.description}</p>
                )}
              </div>
            );
          }

          // System field: email
          if (field.key === 'email') {
            return (
              <div key={field.key} className="space-y-1">
                <Input
                  label={field.label || 'Email Address'}
                  type="email"
                  placeholder={field.placeholder || 'aarav@example.com'}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required={field.required}
                  autoComplete="email"
                />
                {field.description && (
                  <p className="text-[10px] text-muted">{field.description}</p>
                )}
              </div>
            );
          }

          // System field: phone
          if (field.key === 'phone') {
            return (
              <div key={field.key} className="space-y-1">
                <Input
                  label={field.label || 'Mobile Phone'}
                  type="tel"
                  placeholder={field.placeholder || '+91 98765 43210'}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required={field.required}
                  autoComplete="tel"
                />
                {field.description && (
                  <p className="text-[10px] text-muted">{field.description}</p>
                )}
              </div>
            );
          }

          // System field: password
          if (field.key === 'password') {
            return (
              <div key={field.key} className="space-y-1">
                <PasswordInput
                  label={field.label || 'Password'}
                  placeholder={field.placeholder || 'Create a strong password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required={field.required}
                  autoComplete="new-password"
                  showStrengthMeter={true}
                  policy={policy}
                />
                {field.description && (
                  <p className="text-[10px] text-muted">{field.description}</p>
                )}
              </div>
            );
          }

          // System field: confirmPassword
          if (field.key === 'confirmPassword') {
            return (
              <div key={field.key} className="space-y-1">
                <PasswordInput
                  label={field.label || 'Confirm Password'}
                  placeholder={field.placeholder || 'Re-enter your password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required={field.required}
                  autoComplete="new-password"
                  error={
                    confirmPassword.length > 0 && confirmPassword !== password
                      ? 'Passwords do not match.'
                      : undefined
                  }
                />
                {field.description && (
                  <p className="text-[10px] text-muted">{field.description}</p>
                )}
              </div>
            );
          }

          // Dynamic Custom Fields: Select
          if (field.type === 'select') {
            return (
              <div key={field.key} className="space-y-1">
                <label className="block text-xs font-semibold text-primary">
                  {field.label} {field.required && <span className="text-rose-500">*</span>}
                </label>
                <select
                  value={customFieldValues[field.key] || ''}
                  onChange={(e) => handleCustomFieldChange(field.key, e.target.value)}
                  required={field.required}
                  className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary text-xs focus:outline-none focus:border-accent"
                >
                  <option value="">{field.placeholder || 'Select an option...'}</option>
                  {field.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {field.description && (
                  <p className="text-[10px] text-muted">{field.description}</p>
                )}
              </div>
            );
          }

          // Dynamic Custom Fields: Textarea
          if (field.type === 'textarea') {
            return (
              <div key={field.key} className="space-y-1">
                <label className="block text-xs font-semibold text-primary">
                  {field.label} {field.required && <span className="text-rose-500">*</span>}
                </label>
                <textarea
                  value={customFieldValues[field.key] || ''}
                  onChange={(e) => handleCustomFieldChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  required={field.required}
                  rows={3}
                  className="w-full px-3.5 py-2 bg-surface-dim border border-border rounded-xl text-primary text-xs focus:outline-none focus:border-accent resize-y"
                />
                {field.description && (
                  <p className="text-[10px] text-muted">{field.description}</p>
                )}
              </div>
            );
          }

          // Dynamic Custom Fields: Radio
          if (field.type === 'radio') {
            return (
              <div key={field.key} className="space-y-1.5">
                <label className="block text-xs font-semibold text-primary">
                  {field.label} {field.required && <span className="text-rose-500">*</span>}
                </label>
                <div className="space-y-1.5">
                  {field.options?.map((opt) => (
                    <label key={opt.value} className="flex items-center gap-2 text-xs text-secondary cursor-pointer">
                      <input
                        type="radio"
                        name={field.key}
                        value={opt.value}
                        checked={customFieldValues[field.key] === opt.value}
                        onChange={() => handleCustomFieldChange(field.key, opt.value)}
                        required={field.required}
                        className="text-accent focus:ring-accent"
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
                {field.description && (
                  <p className="text-[10px] text-muted">{field.description}</p>
                )}
              </div>
            );
          }

          // Dynamic Custom Fields: Checkbox
          if (field.type === 'checkbox') {
            return (
              <div key={field.key} className="pt-1">
                <label className="flex items-start gap-2 cursor-pointer text-xs text-primary">
                  <input
                    type="checkbox"
                    checked={Boolean(customFieldValues[field.key])}
                    onChange={(e) => handleCustomFieldChange(field.key, e.target.checked)}
                    required={field.required}
                    className="mt-0.5 rounded border-border text-accent focus:ring-accent"
                  />
                  <div>
                    <span className="font-semibold">{field.label}</span> {field.required && <span className="text-rose-500">*</span>}
                    {field.description && (
                      <p className="text-[10px] text-muted">{field.description}</p>
                    )}
                  </div>
                </label>
              </div>
            );
          }

          // Dynamic Custom Fields: Default (text, number, date, etc.)
          return (
            <div key={field.key} className="space-y-1">
              <Input
                label={field.label}
                type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                placeholder={field.placeholder}
                value={customFieldValues[field.key] || ''}
                onChange={(e) => handleCustomFieldChange(field.key, e.target.value)}
                required={field.required}
              />
              {field.description && (
                <p className="text-[10px] text-muted">{field.description}</p>
              )}
            </div>
          );
        })}

        {termsRequired && (
          <div className="pt-1">
            <label className="flex items-start gap-2 cursor-pointer text-xs text-muted">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-0.5 rounded border-border text-accent focus:ring-accent"
              />
              <span>
                {termsText.includes('Terms of Service') ? (
                  <>
                    I agree to the{' '}
                    <Link href={termsLink} className="text-accent underline hover:text-accent-hover">
                      Terms of Service
                    </Link>{' '}
                    and acknowledge the{' '}
                    <Link href={privacyLink} className="text-accent underline hover:text-accent-hover">
                      Privacy Policy (DPDP Act)
                    </Link>
                    .
                  </>
                ) : (
                  termsText
                )}
              </span>
            </label>
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          size="md"
          className="w-full font-bold uppercase tracking-wider"
          isLoading={loading}
        >
          {submitButtonText}
        </Button>
      </form>

      <div className="pt-4 border-t border-border text-center space-y-2">
        <p className="text-xs text-muted">
          Already have an account?{' '}
          <Link
            href={`/login${redirectTarget !== '/account' ? `?redirect=${encodeURIComponent(redirectTarget)}` : ''}`}
            className="text-accent font-semibold hover:underline"
          >
            Sign in here
          </Link>
        </p>
      </div>
    </Card>
  );
}

export default function CustomerRegisterPage() {
  const [pageTitle, setPageTitle] = useState('Create Your Account');
  const [pageSubtitle, setPageSubtitle] = useState(
    'Join the InfiniCharm Circle for pure batch living, expedited checkout, and tracking.'
  );

  useEffect(() => {
    fetch('/api/settings/registration-form', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.success && d.settings) {
          if (d.settings.title) setPageTitle(d.settings.title);
          if (d.settings.subtitle) setPageSubtitle(d.settings.subtitle);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="py-12 sm:py-16 bg-canvas min-h-[calc(100vh-200px)] flex items-center">
      <Container>
        <div className="max-w-md mx-auto space-y-6">
          <div className="text-center space-y-3">
            <div className="flex justify-center">
              <BrandLogo variant="light" size="md" href="/" showTagline={true} />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-primary">
                {pageTitle}
              </h1>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                {pageSubtitle}
              </p>
            </div>
          </div>

          <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
            <RegisterFormContent />
          </Suspense>
        </div>
      </Container>
    </div>
  );
}
