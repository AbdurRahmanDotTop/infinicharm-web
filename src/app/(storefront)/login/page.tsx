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
import { InlineOtpVerification } from '@/components/auth/InlineOtpVerification';
import {
  persistClientCustomerSession,
  clearClientCustomerSession,
  getClientCustomerUser,
} from '@/lib/auth/client-session';
import { sanitizeRedirectPath } from '@/lib/validation/auth';
import type { PublicAuthSettings } from '@/types';
import { AlertCircle, Sparkles, CheckCircle2, ShieldAlert, UserCheck } from 'lucide-react';

function LoginFormContent() {
  const searchParams = useSearchParams();
  const redirectPath = sanitizeRedirectPath(searchParams?.get('redirect'), '/account');
  const isVerifiedNotice = searchParams?.get('verified') === '1';
  const isResetNotice = searchParams?.get('reset') === '1';
  const isUnverifiedParam = searchParams?.get('unverified') === '1' || searchParams?.get('verify') === '1';
  const prefillEmail = searchParams?.get('email') || '';

  const [policy, setPolicy] = useState<PublicAuthSettings | null>(null);
  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [alreadyLoggedInUser, setAlreadyLoggedInUser] = useState<{
    id: string;
    email: string;
    fullName?: string;
  } | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Check for active session
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
        })
        .finally(() => {
          setIsCheckingAuth(false);
        });
    } else {
      setIsCheckingAuth(false);
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

  useEffect(() => {
    if (prefillEmail) {
      setEmail(prefillEmail);
      if (isUnverifiedParam) {
        setUnverifiedEmail(prefillEmail.toLowerCase().trim());
      }
    }
  }, [prefillEmail, isUnverifiedParam]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setUnverifiedEmail(null);
    setLoading(true);

    if (!email.trim() || !password) {
      setError('Please provide your registered email and password.');
      setLoading(false);
      return;
    }

    try {
      const normalized = email.trim().toLowerCase();
      const res = await fetch('/api/auth/customer/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: normalized,
          password,
          rememberMe,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (data?.code === 'EMAIL_NOT_VERIFIED' || data?.requiresVerification) {
          setUnverifiedEmail(normalized);
        }
        throw new Error(data.error || 'Authentication failed. Please check credentials.');
      }

      persistClientCustomerSession(data.customer);
      setSuccess(true);
      setTimeout(() => {
        window.location.href = redirectPath;
      }, 350);
    } catch (err: any) {
      setError(err?.message || 'Authentication failed. Please try again.');
      setLoading(false);
    }
  };

  const handleQuickFill = () => {
    setEmail('customer@infinicharm.com');
    setPassword('Customer@1234!');
    setError(null);
    setUnverifiedEmail(null);
  };

  if (policy && !policy.loginEnabled) {
    return (
      <Card level={1} className="p-8 space-y-4 bg-surface border border-border text-center">
        <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="font-display text-lg font-bold text-primary">
          Customer Sign-In Temporarily Paused
        </h2>
        <p className="text-xs text-muted leading-relaxed">
          Customer sign-in has been temporarily paused by store administration for maintenance. Please try again shortly or browse our catalog as a visitor.
        </p>
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
          You are currently signed in to your InfiniCharm account. You do not need to sign in again. You can proceed directly or switch to a different account below.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <Link
            href={redirectPath && redirectPath !== '/login' ? redirectPath : '/account'}
            className="w-full sm:flex-1 py-3 px-4 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl uppercase tracking-wider transition-colors text-center shadow-sm"
          >
            {redirectPath && redirectPath !== '/account' && redirectPath !== '/login'
              ? 'Continue to Destination'
              : 'Go to My Account'}
          </Link>
          <button
            type="button"
            onClick={handleSwitchAccount}
            className="w-full sm:w-auto py-3 px-4 bg-surface hover:bg-surface-dim text-muted hover:text-primary border border-border text-xs font-semibold rounded-xl transition-colors text-center"
          >
            Switch Account / Sign Out
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card level={1} className="p-6 sm:p-8 space-y-5 bg-surface border border-border">
      {isVerifiedNotice && (
        <div className="p-3 rounded-md bg-emerald-50 border border-emerald-200 flex items-start gap-2 text-xs text-emerald-800 font-medium">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
          <span>Your email address is verified! Sign in below to continue.</span>
        </div>
      )}

      {isResetNotice && (
        <div className="p-3 rounded-md bg-emerald-50 border border-emerald-200 flex items-start gap-2 text-xs text-emerald-800 font-medium">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
          <span>Your password has been updated. Sign in with your new password.</span>
        </div>
      )}

      {error && !unverifiedEmail && (
        <div
          role="alert"
          className="p-3 rounded-md bg-state-error/10 border border-state-error/20 flex items-start gap-2 text-xs text-state-error font-medium"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3 rounded-md bg-emerald-50 border border-emerald-200 flex items-start gap-2 text-xs text-emerald-800 font-medium">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
          <span>Signing in securely... Redirecting to your destination.</span>
        </div>
      )}

      {unverifiedEmail ? (
        <InlineOtpVerification
          email={unverifiedEmail}
          redirectPath={redirectPath}
          onSuccess={() => {
            setSuccess(true);
            setTimeout(() => {
              window.location.href = redirectPath;
            }, 400);
          }}
          onCancel={() => {
            setUnverifiedEmail(null);
            setError(null);
          }}
        />
      ) : (
        <form onSubmit={handleLogin} className="space-y-4">
          <Input
            label="Email Address"
            type="email"
            placeholder="Enter your email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />

          <PasswordInput
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />

          <div className="flex items-center justify-between text-xs gap-2">
            <label className="flex items-center gap-1.5 cursor-pointer text-muted hover:text-primary">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-border text-accent focus:ring-accent"
              />
              <span>Remember me for 7 days</span>
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-muted hover:text-accent underline"
            >
              Forgot password?
            </Link>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="md"
            className="w-full"
            isLoading={loading}
          >
            Sign In to Account
          </Button>
        </form>
      )}

      <div className="pt-4 border-t border-border text-center space-y-3">
        {(!policy || policy.registrationEnabled) && (
          <p className="text-xs text-muted">
            New to {BRAND.name}?{' '}
            <Link
              href={`/register${redirectPath !== '/account' ? `?redirect=${encodeURIComponent(redirectPath)}` : ''}`}
              className="text-accent font-semibold hover:underline"
            >
              Create an account
            </Link>
          </p>
        )}

        {/* Dev Test Credentials Card with 1-Click Fill - Strictly Development Only */}
        {process.env.NODE_ENV !== 'production' && (
          <div className="p-3 rounded-md bg-surface-dim border border-border/50 text-left text-[11px] text-muted space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-primary flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-accent" />
                Dev Test Customer Account:
              </span>
              <button
                type="button"
                onClick={handleQuickFill}
                className="text-[10px] text-accent font-bold hover:underline bg-white px-2 py-0.5 rounded border border-accent/20"
              >
                Auto-Fill Credentials
              </button>
            </div>
            <p className="font-mono text-primary/80">Email: customer@infinicharm.com</p>
            <p className="font-mono text-primary/80">Password: Customer@1234!</p>
          </div>
        )}
      </div>
    </Card>
  );
}

export default function CustomerLoginPage() {
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
                Customer Sign In
              </h1>
              <p className="text-xs text-muted mt-1">
                Access your order history, delivery addresses, and saved items.
              </p>
            </div>
          </div>

          <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
            <LoginFormContent />
          </Suspense>
        </div>
      </Container>
    </div>
  );
}
