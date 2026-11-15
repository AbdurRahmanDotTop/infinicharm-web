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
import type { PublicAuthSettings } from '@/types';
import { AlertCircle, CheckCircle2, MailCheck, ShieldAlert, Loader2, ArrowRight, UserCheck } from 'lucide-react';

function RegisterFormContent() {
  const searchParams = useSearchParams();
  const redirectTarget = sanitizeRedirectPath(searchParams?.get('redirect'), '/account');

  const [policy, setPolicy] = useState<PublicAuthSettings | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

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

    if (!agreedToTerms) {
      setError('Please accept the Terms of Service and Privacy Policy to proceed.');
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
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-accent text-white text-xs font-bold hover:bg-accent-hover"
          >
            Go to Sign In
          </Link>
        </div>
      </Card>
    );
  }

  const handleVerifyOtp = async (codeToVerify?: string) => {
    const code = (codeToVerify || otp).trim();
    if (!code || code.length !== 6) {
      setOtpError('Please enter the full 6-digit code received in your email.');
      return;
    }
    if (!pendingVerificationEmail) return;

    setVerifyingOtp(true);
    setOtpError(null);
    try {
      const res = await fetch('/api/auth/customer/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: pendingVerificationEmail,
          otp: code,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Verification failed. Please check the 6-digit code.');
      }

      setOtpSuccess(true);
      if (data.customer) {
        persistClientCustomerSession(data.customer);
      }
      setTimeout(() => {
        window.location.href = data.redirectPath || redirectTarget;
      }, 900);
    } catch (err: any) {
      setOtpError(err?.message || 'Invalid or expired verification code.');
    } finally {
      setVerifyingOtp(false);
    }
  };

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
        <Input
          label="Full Name"
          type="text"
          placeholder="Aarav Sharma"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoComplete="name"
        />

        <Input
          label="Email Address"
          type="email"
          placeholder="aarav@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />

        <Input
          label="Mobile Phone (Optional)"
          type="tel"
          placeholder="+91 98765 43210"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoComplete="tel"
        />

        <PasswordInput
          label="Password"
          placeholder="Create a strong password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
          showStrengthMeter={true}
          policy={policy}
        />

        <PasswordInput
          label="Confirm Password"
          placeholder="Re-enter your password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          autoComplete="new-password"
          error={
            confirmPassword.length > 0 && confirmPassword !== password
              ? 'Passwords do not match.'
              : undefined
          }
        />

        <div className="pt-1">
          <label className="flex items-start gap-2 cursor-pointer text-xs text-muted">
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-0.5 rounded border-border text-accent focus:ring-accent"
            />
            <span>
              I agree to the{' '}
              <Link href="/policies/terms" className="text-accent underline hover:text-accent-hover">
                Terms of Service
              </Link>{' '}
              and acknowledge the{' '}
              <Link href="/policies/privacy" className="text-accent underline hover:text-accent-hover">
                Privacy Policy (DPDP Act)
              </Link>
              .
            </span>
          </label>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="md"
          className="w-full"
          isLoading={loading}
        >
          Create InfiniCharm Account
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
                Create Your Account
              </h1>
              <p className="text-xs text-muted mt-1">
                Join the InfiniCharm Circle for pure batch living, expedited checkout, and tracking.
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
