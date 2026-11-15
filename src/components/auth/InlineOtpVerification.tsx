'use client';

import React, { useState } from 'react';
import { KeyRound, AlertCircle, CheckCircle2 } from 'lucide-react';
import { OtpInput } from '@/components/auth/OtpInput';
import { ResendVerificationBox } from '@/components/auth/ResendVerificationBox';
import { Button } from '@/components/ui/Button';
import { persistClientCustomerSession } from '@/lib/auth/client-session';

export interface InlineOtpVerificationProps {
  email: string;
  redirectPath?: string;
  compact?: boolean;
  autoRedirect?: boolean;
  onSuccess?: (customer?: any) => void;
  onCancel?: () => void;
  className?: string;
}

export function InlineOtpVerification({
  email,
  redirectPath = '/account',
  compact = false,
  autoRedirect = true,
  onSuccess,
  onCancel,
  className = '',
}: InlineOtpVerificationProps) {
  const [otp, setOtp] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [verifiedSuccess, setVerifiedSuccess] = useState(false);

  const handleVerify = async (codeToVerify?: string) => {
    const code = (codeToVerify || otp).trim();
    if (!code || code.length !== 6) {
      setOtpError('Please enter the full 6-digit verification code.');
      return;
    }

    const targetEmail = email.trim().toLowerCase();
    if (!targetEmail) {
      setOtpError('No email specified for verification.');
      return;
    }

    setVerifying(true);
    setOtpError(null);

    try {
      let res = await fetch('/api/auth/customer/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: targetEmail,
          otp: code,
        }),
      });

      if (res.status === 404) {
        res = await fetch('/api/auth/customer/verify-email-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: targetEmail,
            otp: code,
          }),
        });
      }

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        throw new Error(data?.error || 'Invalid or expired verification code. Please check or request a fresh code.');
      }

      setVerifiedSuccess(true);

      if (data.customer) {
        persistClientCustomerSession(data.customer);
      }

      if (onSuccess) {
        onSuccess(data.customer);
      }

      if (autoRedirect) {
        const destination = data.redirectPath || redirectPath || '/account';
        setTimeout(() => {
          window.location.href = destination;
        }, 500);
      }
    } catch (err: any) {
      setOtpError(err?.message || 'Invalid or expired verification code.');
    } finally {
      setVerifying(false);
    }
  };

  if (verifiedSuccess) {
    return (
      <div
        data-testid="inline-otp-success"
        className={`p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-2.5 ${className}`}
      >
        <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-5 h-5" />
        </div>
        <h4 className="font-display text-sm font-bold text-emerald-950">
          Email Verified Successfully!
        </h4>
        <p className="text-xs text-emerald-800">
          Your account is active. {autoRedirect ? 'Redirecting you securely...' : 'You can now proceed.'}
        </p>
      </div>
    );
  }

  return (
    <div
      data-testid="inline-otp-verification-card"
      className={`rounded-2xl border-2 border-accent/25 bg-surface p-4 sm:p-5.5 space-y-4 shadow-sm ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-accent/10 text-accent flex items-center justify-center shrink-0 mt-0.5">
          <KeyRound className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-0.5">
          <h3 className="font-display text-sm sm:text-base font-bold text-primary">
            Enter 6-Digit Verification Code
          </h3>
          <p className="text-xs text-muted leading-relaxed">
            We sent a verification code to <strong className="text-primary font-medium">{email}</strong>. Enter it below to sign in:
          </p>
        </div>
      </div>

      <div className="space-y-3 pt-1">
        <OtpInput
          value={otp}
          onChange={(val) => {
            setOtp(val);
            if (otpError) setOtpError(null);
          }}
          onComplete={(code) => handleVerify(code)}
          disabled={verifying}
          hasError={Boolean(otpError)}
          autoFocus={true}
        />

        {otpError && (
          <div
            role="alert"
            data-testid="inline-otp-error"
            className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2 font-medium"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
            <span>{otpError}</span>
          </div>
        )}

        <Button
          type="button"
          variant="primary"
          size="md"
          className="w-full"
          isLoading={verifying}
          disabled={otp.length !== 6 || verifying}
          onClick={() => handleVerify(otp)}
          data-testid="login-verify-otp-btn"
        >
          Verify & Sign In to Account
        </Button>
      </div>

      <div className="pt-2 border-t border-border/60">
        <ResendVerificationBox
          initialEmail={email}
          redirectPath={redirectPath}
          compact={compact || true}
        />
      </div>

      {onCancel && (
        <div className="text-center pt-0.5">
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-muted hover:text-primary underline cursor-pointer"
          >
            Sign in with a different email
          </button>
        </div>
      )}
    </div>
  );
}
