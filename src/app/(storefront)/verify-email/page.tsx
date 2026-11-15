'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { ResendVerificationBox } from '@/components/auth/ResendVerificationBox';
import { OtpInput } from '@/components/auth/OtpInput';
import { sanitizeRedirectPath, isValidEmail } from '@/lib/validation/auth';
import { persistClientCustomerSession } from '@/lib/auth/client-session';
import { CheckCircle2, AlertCircle, Loader2, ArrowRight, ShieldCheck, MailCheck, KeyRound } from 'lucide-react';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams?.get('token') || '';
  const queryRedirect = searchParams?.get('redirect');
  const hasTriggeredRef = useRef(false);

  const [state, setState] = useState<{
    phase: 'LOADING' | 'VERIFIED' | 'ALREADY_USED' | 'EXPIRED' | 'SUPERSEDED' | 'INVALID';
    message: string;
    email?: string;
    redirectPath: string;
  }>({
    phase: 'LOADING',
    message: 'Verifying your single-use confirmation link...',
    redirectPath: sanitizeRedirectPath(queryRedirect, '/account'),
  });

  const [manualEmail, setManualEmail] = useState(searchParams?.get('email') || '');
  const [otp, setOtp] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);

  const handleVerifyManualOtp = async (codeToVerify?: string) => {
    const code = (codeToVerify || otp).trim();
    const targetEmail = (state.email || manualEmail).trim().toLowerCase();

    if (!isValidEmail(targetEmail)) {
      setOtpError('Please provide a valid email address.');
      return;
    }

    if (!code || code.length !== 6) {
      setOtpError('Please enter the full 6-digit verification code.');
      return;
    }

    setVerifyingOtp(true);
    setOtpError(null);
    try {
      let res = await fetch('/api/auth/customer/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: targetEmail,
          otp: code,
          token: token || undefined,
        }),
      });

      if (res.status === 404) {
        res = await fetch('/api/auth/customer/verify-email-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: targetEmail,
            otp: code,
            token: token || undefined,
          }),
        });
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Verification failed. Please check your 6-digit code.');
      }

      if (data?.customer) {
        persistClientCustomerSession(data.customer);
      }

      setState({
        phase: 'VERIFIED',
        message: data.message || 'Your email address has been verified. You can now sign in securely.',
        email: data.email || targetEmail,
        redirectPath: sanitizeRedirectPath(queryRedirect || data?.redirectPath, '/account'),
      });
    } catch (err: any) {
      setOtpError(err?.message || 'Invalid or expired verification code.');
    } finally {
      setVerifyingOtp(false);
    }
  };

  useEffect(() => {
    if (hasTriggeredRef.current) return;
    hasTriggeredRef.current = true;

    if (!token) {
      setState({
        phase: 'INVALID',
        message: 'Verification link is missing the security token.',
        redirectPath: sanitizeRedirectPath(queryRedirect, '/account'),
      });
      return;
    }

    (async () => {
      let res = await fetch('/api/auth/customer/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      if (res.status === 404) {
        res = await fetch('/api/auth/customer/verify-email-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
      }

      const data = await res.json().catch(() => ({}));
      const resolvedRedirect = sanitizeRedirectPath(
        queryRedirect || data?.redirectPath,
        '/account'
      );

      if (res.ok && data?.success) {
        if (data?.customer) {
          persistClientCustomerSession(data.customer);
        }
        setState({
          phase: 'VERIFIED',
          message:
            data.message ||
            'Your email address has been verified. You can now sign in securely.',
          email: data.email,
          redirectPath: resolvedRedirect,
        });
        return;
      }

      const errStatus =
        data?.status === 'EXPIRED' ||
        data?.status === 'ALREADY_USED' ||
        data?.status === 'SUPERSEDED'
          ? data.status
          : 'INVALID';

      setState({
        phase: errStatus,
        message:
          data?.error || 'This verification link is invalid, expired, or has already been used.',
        email: data?.email,
        redirectPath: resolvedRedirect,
      });
    })().catch(() => {
      setState({
        phase: 'INVALID',
        message: 'Network error verifying your email. Please try again.',
        redirectPath: sanitizeRedirectPath(queryRedirect, '/account'),
      });
    });
  }, [token, queryRedirect]);

  const loginUrl =
    state.redirectPath === '/checkout'
      ? `/checkout?verified=1${state.email ? `&email=${encodeURIComponent(state.email)}` : ''}`
      : `/login?verified=1${state.email ? `&email=${encodeURIComponent(state.email)}` : ''}&redirect=${encodeURIComponent(state.redirectPath)}`;

  return (
    <Card level={1} data-testid="verify-email-card" className="p-6 sm:p-8 space-y-5 bg-surface border border-border">
      {state.phase === 'LOADING' && (
        <div className="text-center py-6 space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-accent mx-auto" />
          <p className="text-xs font-semibold text-primary">{state.message}</p>
        </div>
      )}

      {state.phase === 'VERIFIED' && (
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h2 className="font-display text-xl font-bold text-primary">
              Email Verified Successfully
            </h2>
            <p className="text-xs text-muted leading-relaxed">
              {state.email ? (
                <>
                  Your email <strong className="text-primary">{state.email}</strong> is now verified and your account is active.
                </>
              ) : (
                state.message
              )}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 justify-center pt-2">
            <Link
              href={loginUrl}
              data-testid="verify-continue-btn"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold transition-colors"
            >
              <span>
                {state.redirectPath === '/checkout'
                  ? 'Return to Checkout & Sign In'
                  : 'Sign In to Your Account'}
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-surface-dim border border-border text-xs font-semibold text-primary hover:bg-border/40"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      )}

      {state.phase !== 'LOADING' && state.phase !== 'VERIFIED' && (
        <div className="space-y-4">
          <div className="text-center space-y-2.5">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="font-display text-xl font-bold text-primary">
              {state.phase === 'EXPIRED'
                ? 'Verification Link Expired'
                : state.phase === 'ALREADY_USED'
                  ? 'Verification Link Already Used'
                  : state.phase === 'SUPERSEDED'
                    ? 'Link Replaced by Newer Request'
                    : 'Invalid Verification Link'}
            </h2>
            <p className="text-xs text-muted leading-relaxed">{state.message}</p>
          </div>

          {/* Enter OTP Alternative Box */}
          <div className="p-4 sm:p-5 rounded-2xl border border-border bg-surface-dim/40 space-y-3">
            <div className="text-center space-y-0.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-accent block">
                Have a 6-digit code?
              </span>
              <p className="text-xs text-secondary">
                Enter your code below to verify immediately:
              </p>
            </div>

            {!state.email && (
              <input
                type="email"
                value={manualEmail}
                onChange={(e) => setManualEmail(e.target.value)}
                placeholder="your-email@example.com"
                aria-label="Email address for OTP verification"
                className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-surface text-primary focus:outline-none focus:border-accent"
              />
            )}

            <OtpInput
              value={otp}
              onChange={(val) => {
                setOtp(val);
                if (otpError) setOtpError(null);
              }}
              onComplete={(code) => handleVerifyManualOtp(code)}
              disabled={verifyingOtp}
              hasError={Boolean(otpError)}
            />

            {otpError && (
              <p className="text-xs text-rose-600 font-medium text-center">{otpError}</p>
            )}

            <button
              type="button"
              disabled={otp.length !== 6 || verifyingOtp}
              onClick={() => handleVerifyManualOtp()}
              className="w-full py-2.5 px-4 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
            >
              {verifyingOtp ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Verifying Code...</span>
                </>
              ) : (
                <span>Verify Code &amp; Activate</span>
              )}
            </button>
          </div>

          <ResendVerificationBox
            initialEmail={state.email || manualEmail}
            redirectPath={state.redirectPath}
            allowEditEmail={!state.email}
          />

          <div className="pt-3 border-t border-border flex items-center justify-between text-xs">
            <Link
              href={`/login?redirect=${encodeURIComponent(state.redirectPath)}`}
              className="text-accent font-semibold hover:underline"
            >
              Go to Sign In
            </Link>
            <Link href="/register" className="text-muted hover:text-primary font-medium">
              Register New Account
            </Link>
          </div>
        </div>
      )}
    </Card>
  );
}

export default function VerifyEmailPage() {
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
                Email Verification
              </h1>
              <p className="text-xs text-muted mt-1 flex items-center justify-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-accent" />
                <span>Single-use cryptographic confirmation</span>
              </p>
            </div>
          </div>

          <Suspense fallback={<Skeleton className="h-64 w-full rounded-2xl" />}>
            <VerifyEmailContent />
          </Suspense>
        </div>
      </Container>
    </div>
  );
}

