'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { BRAND } from '@/lib/constants/brand';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ShieldCheck, Lock, AlertCircle } from 'lucide-react';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!email || !password) {
      setError('Please provide both administrative email and password.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setError(
          data?.error ||
            'Invalid administrative credentials. Access restricted to authorized personnel.'
        );
        setLoading(false);
        return;
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem(
          'infinicharm_admin_user',
          JSON.stringify({
            email: data.admin?.email || email.trim().toLowerCase(),
            name: data.admin?.name || 'Operations Administrator',
            role: data.admin?.role || 'SUPER_ADMIN',
            loginAt: new Date().toISOString(),
          })
        );
      }
      window.location.href = '/admin/dashboard';
    } catch {
      setError('Network error authenticating administrative session.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-canvas">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <BrandLogo variant="light" size="lg" href="/" showTagline={true} />
          </div>
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary text-white text-[10px] font-semibold tracking-wider uppercase">
              <Lock className="w-3 h-3 text-accent" />
              <span>Administrative Operations Portal</span>
            </span>
          </div>
        </div>

        <Card level={2} className="p-8 space-y-6">
          <div className="space-y-1">
            <h1 className="font-display text-xl font-bold text-primary">
              Sign In to Admin Center
            </h1>
            <p className="text-xs text-muted">
              Enter your authorized staff credentials to manage the platform.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-md bg-state-error/10 border border-state-error/20 flex items-start gap-2 text-xs text-state-error font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              label="Staff Email"
              type="email"
              placeholder="staff@infinicharm.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Input
              label="Password"
              type="password"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <Button
              type="submit"
              variant="primary"
              size="md"
              className="w-full"
              isLoading={loading}
            >
              Authenticate & Enter
            </Button>
          </form>

          {/* Development / Test Accounts Governance Banner - Strictly Dev/Test Only */}
          {process.env.NODE_ENV !== 'production' && (
            <div className="pt-4 border-t border-border text-xs text-muted space-y-2">
              <div className="p-3 rounded-md bg-surface-dim border border-border/80">
                <span className="font-semibold text-primary block mb-1">
                  Development Test Account:
                </span>
                <p className="text-[11px] font-mono text-muted">
                  Email: admin@infinicharm.com
                  <br />
                  Password: Admin@1234!
                </p>
              </div>
              <p className="text-[10px] text-muted text-center">
                Protected by Server-Side Role Enforcement (RBAC) & Audit Logging.
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

