'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { isValidEmail } from '@/lib/validation/auth';
import { Mail, ArrowLeft, CheckCircle2, AlertCircle, KeyRound } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sentMessage, setSentMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isValidEmail(email)) {
      setError('Please provide a valid email address.');
      return;
    }

    setIsSubmitting(true);
    const normalizedEmail = email.trim().toLowerCase();

    try {
      const res = await fetch('/api/auth/customer/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Unable to process password reset request.');
        setIsSubmitting(false);
        return;
      }

      setIsSubmitting(false);
      setSentMessage(
        data?.message ||
          'If an InfiniCharm account matches that email address, a single-use password reset link has been sent to your inbox.'
      );
    } catch {
      setError('Network error requesting password reset link.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="py-12 sm:py-16 bg-canvas min-h-[calc(100vh-200px)] flex items-center">
      <Container>
        <div className="max-w-md mx-auto space-y-6">
          <div className="text-center space-y-3">
            <div className="flex justify-center">
              <BrandLogo variant="light" size="md" href="/" showTagline={true} />
            </div>
            <h1 className="font-display text-2xl font-bold text-primary">
              Password Recovery
            </h1>
            <p className="text-xs text-muted">
              Enter your email address and we will send a single-use password reset link to your inbox.
            </p>
          </div>

          <Card level={1} className="p-6 sm:p-8 space-y-6">
            {sentMessage ? (
              <div data-testid="forgot-password-confirmation" className="text-center py-4 space-y-4">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="space-y-1.5">
                  <h2 className="font-display text-lg font-bold text-primary">
                    Check Your Inbox
                  </h2>
                  <p className="text-xs text-muted leading-relaxed">{sentMessage}</p>
                </div>
                <div className="pt-2 flex flex-col gap-2">
                  <Link
                    href={`/reset-password?email=${encodeURIComponent(email.trim().toLowerCase())}`}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-surface-dim border border-border text-xs font-semibold text-primary hover:border-accent/50"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-accent" />
                    <span>Have a 6-digit recovery PIN? Enter PIN instead</span>
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                {error && (
                  <div
                    role="alert"
                    className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-semibold flex items-center gap-2"
                  >
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div>
                  <label
                    htmlFor="forgot-email"
                    className="block font-semibold text-primary mb-1"
                  >
                    Registered Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                    <input
                      id="forgot-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. name@example.com"
                      className="w-full pl-9 pr-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-primary hover:bg-primary-hover text-white font-bold rounded-xl shadow-xs transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Dispatching Reset Link...' : 'Send Password Reset Link'}
                </button>
              </form>
            )}

            <div className="pt-4 border-t border-border flex items-center justify-between text-xs text-muted">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-muted hover:text-primary transition-colors font-semibold"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Login</span>
              </Link>

              <Link href="/contact" className="hover:text-accent underline">
                Need Help?
              </Link>
            </div>
          </Card>
        </div>
      </Container>
    </div>
  );
}
