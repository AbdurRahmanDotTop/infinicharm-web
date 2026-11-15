'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import {
  User,
  Shield,
  ArrowLeft,
  CheckCircle2,
  Lock,
  Phone,
  Mail,
  AlertCircle,
  Bell,
  Globe,
  LogOut,
  Save,
} from 'lucide-react';
import { Customer, CustomerPreferences, PublicAuthSettings } from '@/types';
import { PasswordInput } from '@/components/auth/PasswordInput';
import { validatePasswordAgainstPolicy } from '@/lib/validation/auth';

export default function ProfilePage() {
  const router = useRouter();

  // Profile Form States
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [customFields, setCustomFields] = useState<Record<string, any>>({});
  const [preferences, setPreferences] = useState<CustomerPreferences>({
    newsletterSubscribed: true,
    smsAlerts: true,
    orderUpdatesWhatsapp: true,
    preferredCurrency: 'INR',
    language: 'en',
  });

  // Password Change States
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [authPolicy, setAuthPolicy] = useState<PublicAuthSettings | null>(null);

  // Status & Feedback States
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);
  const [profileErrorMsg, setProfileErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await fetch('/api/customers/me');
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.customer) {
            setFullName(data.customer.fullName || '');
            setEmail(data.customer.email || '');
            setPhone(data.customer.phone || '');
            if (data.customer.customFields) {
              setCustomFields(data.customer.customFields);
            }
            if (data.customer.preferences) {
              setPreferences({
                newsletterSubscribed: data.customer.preferences.newsletterSubscribed ?? true,
                smsAlerts: data.customer.preferences.smsAlerts ?? true,
                orderUpdatesWhatsapp: data.customer.preferences.orderUpdatesWhatsapp ?? true,
                preferredCurrency: data.customer.preferences.preferredCurrency || 'INR',
                language: data.customer.preferences.language || 'en',
              });
            }
          }
        } else {
          // Fallback to localStorage
          const stored = localStorage.getItem('infinicharm_customer_user');
          if (stored) {
            const u = JSON.parse(stored);
            setFullName(u.name || u.fullName || '');
            setEmail(u.email || '');
            setPhone(u.phone || '');
          }
        }
      } catch (err) {
        console.error('Error loading profile:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
    fetch('/api/auth/settings')
      .then((r) => r.json())
      .then((d) => {
        if (d?.success && d.settings) setAuthPolicy(d.settings);
      })
      .catch(() => {});
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileErrorMsg(null);
    setProfileSuccessMsg(null);
    setIsSavingProfile(true);

    if (!fullName.trim()) {
      setProfileErrorMsg('Full name cannot be empty.');
      setIsSavingProfile(false);
      return;
    }

    try {
      const res = await fetch('/api/customers/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          phone: phone.trim(),
          preferences,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update profile.');
      }

      setProfileSuccessMsg('Profile details and preferences saved successfully.');
      // Sync local storage & broadcast update
      const stored = localStorage.getItem('infinicharm_customer_user');
      const prev = stored ? JSON.parse(stored) : {};
      const updated = {
        ...prev,
        name: fullName.trim(),
        fullName: fullName.trim(),
        phone: phone.trim(),
        preferences,
      };
      localStorage.setItem('infinicharm_customer_user', JSON.stringify(updated));
      window.dispatchEvent(new Event('infinicharm_customer_updated'));

      setTimeout(() => setProfileSuccessMsg(null), 4000);
    } catch (err: any) {
      setProfileErrorMsg(err?.message || 'Error updating profile.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword || !newPassword) {
      setPasswordError('Please enter both your current and new password.');
      return;
    }

    const pwValidation = validatePasswordAgainstPolicy(newPassword, authPolicy || undefined);
    if (!pwValidation.valid) {
      setPasswordError(pwValidation.errors[0] || 'Password does not meet complexity requirements.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirm password do not match.');
      return;
    }

    setIsChangingPassword(true);

    try {
      const res = await fetch('/api/customers/me/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update password.');
      }

      setPasswordSuccess('Password changed successfully! Your account is now secured.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(null), 4000);
    } catch (err: any) {
      setPasswordError(err?.message || 'Password update failed.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/customer/logout', { method: 'POST' });
    } catch { }
    document.cookie =
      'infinicharm_customer_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT;';
    document.cookie =
      'infinicharm_customer_id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT;';
    localStorage.removeItem('infinicharm_customer_user');
    window.location.href = '/login';
  };

  return (
    <div className="py-10 bg-surface-dim/40 min-h-screen">
      <Container>
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 mb-6 text-xs text-muted">
          <Link href="/account" className="hover:text-primary flex items-center gap-1 font-semibold">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Customer Portal</span>
          </Link>
          <span>/</span>
          <span className="text-primary font-medium">Profile, Security & Preferences</span>
        </div>

        <div className="max-w-3xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
            <div>
              <h1 className="font-display text-2xl font-bold text-primary">
                Account Settings & Security
              </h1>
              <p className="text-xs text-muted mt-1">
                Manage your personal identity, contact notifications, and authentication credentials.
              </p>
            </div>

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-xl border border-rose-200 transition-colors shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>

          {/* Personal Information Form */}
          <Card level={1} className="p-6 sm:p-8 space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-border">
              <div className="w-10 h-10 rounded-full bg-accent/10 text-accent flex items-center justify-center shrink-0">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-primary">Personal Identity & Contact</h2>
                <p className="text-xs text-muted">Used for consignment labels, delivery alerts, and GST tax invoices.</p>
              </div>
            </div>

            {profileSuccessMsg && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-semibold">{profileSuccessMsg}</span>
              </div>
            )}

            {profileErrorMsg && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="font-semibold">{profileErrorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-primary mb-1.5">
                    Full Legal Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. AbdurRahman Ibn Ghufran"
                    className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-primary mb-1.5">
                    Mobile Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="10-digit mobile number"
                    className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-primary mb-1.5">
                  Registered Email Address (Immutable Identifier)
                </label>
                <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-border bg-surface-dim/70 text-muted">
                  <Mail className="w-4 h-4 text-muted/60 shrink-0" />
                  <span className="font-mono text-xs">{email}</span>
                </div>
                <p className="text-[11px] text-muted mt-1">
                  Primary identifier for single-source account verification & GST billing.
                </p>
              </div>

              {/* Account Preferences Subsection */}
              <div className="pt-4 border-t border-border space-y-4">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-accent" />
                  <h3 className="font-display text-sm font-bold text-primary">
                    Notification & Regional Preferences
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex items-center gap-3 p-3 rounded-xl bg-surface-dim/60 border border-border/80 cursor-pointer hover:border-accent/40 transition-colors">
                    <input
                      type="checkbox"
                      checked={preferences.orderUpdatesWhatsapp}
                      onChange={(e) =>
                        setPreferences({ ...preferences, orderUpdatesWhatsapp: e.target.checked })
                      }
                      className="w-4 h-4 text-accent rounded accent-accent"
                    />
                    <div>
                      <span className="block font-semibold text-primary text-xs">WhatsApp Dispatch Alerts</span>
                      <span className="block text-[11px] text-muted">AWB tracking and live courier updates</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-xl bg-surface-dim/60 border border-border/80 cursor-pointer hover:border-accent/40 transition-colors">
                    <input
                      type="checkbox"
                      checked={preferences.smsAlerts}
                      onChange={(e) =>
                        setPreferences({ ...preferences, smsAlerts: e.target.checked })
                      }
                      className="w-4 h-4 text-accent rounded accent-accent"
                    />
                    <div>
                      <span className="block font-semibold text-primary text-xs">SMS Delivery Alerts</span>
                      <span className="block text-[11px] text-muted">Out for delivery & OTP notifications</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-xl bg-surface-dim/60 border border-border/80 cursor-pointer hover:border-accent/40 transition-colors sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={preferences.newsletterSubscribed}
                      onChange={(e) =>
                        setPreferences({ ...preferences, newsletterSubscribed: e.target.checked })
                      }
                      className="w-4 h-4 text-accent rounded accent-accent"
                    />
                    <div>
                      <span className="block font-semibold text-primary text-xs">InfiniCharm Circle Newsletter</span>
                      <span className="block text-[11px] text-muted">
                        Receive monthly harvest extraction field reports and private batch announcements.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Additional Registration Information */}
              {Object.keys(customFields).length > 0 && (
                <div className="space-y-3 pt-4 border-t border-border">
                  <h3 className="font-display text-sm font-bold text-primary uppercase tracking-wider">
                    Additional Registration Information
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-surface-dim/40 p-4 rounded-2xl border border-border">
                    {Object.entries(customFields).map(([k, v]) => (
                      <div key={k} className="space-y-0.5 text-xs">
                        <span className="font-semibold text-muted capitalize block">
                          {k.replace(/([A-Z])/g, ' $1')}:
                        </span>
                        <span className="font-medium text-primary block">
                          {typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v || '-')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="px-6 py-2.5 bg-accent hover:bg-accent-hover text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingProfile ? 'Saving...' : 'Save Profile & Preferences'}</span>
                </button>
              </div>
            </form>
          </Card>

          {/* Account Security & Password Change */}
          <Card level={1} className="p-6 sm:p-8 space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-border">
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-base font-bold text-primary">Change Account Password</h2>
                <p className="text-xs text-muted">
                  Update your authentication credential to keep your customer records protected.
                </p>
              </div>
            </div>

            {passwordSuccess && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-semibold">{passwordSuccess}</span>
              </div>
            )}

            {passwordError && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="font-semibold">{passwordError}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4 text-xs">
              <PasswordInput
                label="Current Password *"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                <PasswordInput
                  label="New Password *"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  showStrengthMeter
                  policy={authPolicy}
                  placeholder={`Minimum ${authPolicy?.minPasswordLength ?? 8} characters`}
                />

                <PasswordInput
                  label="Confirm New Password *"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="px-6 py-2.5 bg-primary hover:bg-neutral-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <Lock className="w-3.5 h-3.5 text-accent" />
                  <span>{isChangingPassword ? 'Securing...' : 'Update Password'}</span>
                </button>
              </div>
            </form>
          </Card>
        </div>
      </Container>
    </div>
  );
}
