'use client';

import React, { useState, useEffect } from 'react';
import { AdminHeader } from '@/components/admin/AdminHeader';
import {
  UserCog,
  Shield,
  ShieldCheck,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Save,
  Lock,
  Mail,
  Phone,
  Building,
  MapPin,
  RefreshCw,
} from 'lucide-react';

export default function AdminProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  // Form states
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Alerts
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchProfile = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/profile');
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to load administrator profile.');
      }
      setProfile(data.profile);
      setFullName(data.profile.fullName || data.profile.name || '');
      setPhone(data.profile.phone || '');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error loading profile.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/admin/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, phone }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update profile.');
      }
      setSuccessMsg('Administrator profile details updated successfully.');
      setTimeout(() => setSuccessMsg(null), 3500);
      fetchProfile();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error saving profile.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      setErrorMsg('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('New password and confirmation do not match.');
      return;
    }
    setIsSavingPassword(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/admin/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update password.');
      }
      setSuccessMsg('Administrative credentials updated successfully.');
      setTimeout(() => setSuccessMsg(null), 3500);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error updating password.');
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-dim font-sans text-primary pb-16">
      <AdminHeader />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-primary tracking-tight font-display">
                Administrator Profile & Account
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-200 uppercase tracking-wider">
                Root Executive
              </span>
            </div>
            <p className="text-xs sm:text-sm text-muted mt-1">
              Manage your personal credentials, contact details, authentication policies, and platform leadership settings.
            </p>
          </div>

          <button
            onClick={fetchProfile}
            className="self-start sm:self-auto p-2 bg-surface hover:bg-surface-dim border border-border text-muted hover:text-primary rounded-xl transition-colors"
            title="Refresh profile"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-xs text-rose-800">
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span className="font-semibold break-words">{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="p-1 hover:bg-rose-100 rounded text-rose-600">
              ×
            </button>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-800">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span className="font-semibold break-words">{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="p-1 hover:bg-emerald-100 rounded text-emerald-600">
              ×
            </button>
          </div>
        )}

        {/* Identity & Status Card */}
        <div className="bg-surface rounded-2xl border border-border p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-accent/10 text-accent rounded-2xl flex items-center justify-center font-extrabold text-lg">
                AR
              </div>
              <div>
                <h3 className="font-bold text-primary text-base">{fullName || 'AbdurRahman Ibn Ghufran'}</h3>
                <p className="text-xs text-muted">Founder &amp; CEO &bull; Techily Fly</p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-900 border border-purple-200">
                <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                <span>Super Administrator</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                <span>Active Authority</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="flex items-center gap-2 text-muted">
              <Mail className="w-4 h-4 text-accent shrink-0" />
              <span className="font-mono text-primary truncate">{profile?.email || 'admin@infinicharm.com'}</span>
            </div>
            <div className="flex items-center gap-2 text-muted">
              <Phone className="w-4 h-4 text-accent shrink-0" />
              <span className="font-mono text-primary">{profile?.phone || '8825164657'}</span>
            </div>
            <div className="flex items-center gap-2 text-muted">
              <MapPin className="w-4 h-4 text-accent shrink-0" />
              <span className="text-primary truncate">East Champaran, Bihar - 845427</span>
            </div>
          </div>
        </div>

        {/* Profile Details Form */}
        <div className="bg-surface rounded-2xl border border-border p-5 shadow-sm space-y-4">
          <div className="border-b border-border/60 pb-3">
            <h3 className="font-display font-bold text-base text-primary">Personal & Executive Details</h3>
            <p className="text-xs text-muted">Update your administrative display name and primary mobile number.</p>
          </div>

          <form onSubmit={handleUpdateProfile} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1">
                  Mobile Number
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSavingProfile}
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-accent hover:bg-accent-hover text-white rounded-xl font-bold transition-colors disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSavingProfile ? 'Saving...' : 'Save Profile Changes'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Security & Password Form */}
        <div className="bg-surface rounded-2xl border border-border p-5 shadow-sm space-y-4">
          <div className="border-b border-border/60 pb-3">
            <h3 className="font-display font-bold text-base text-primary">Administrative Password & Credentials</h3>
            <p className="text-xs text-muted">Update administrative password used to access the Operations Hub.</p>
          </div>

          <form onSubmit={handleUpdatePassword} className="space-y-4 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1">
                Current Administrative Password
              </label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="w-full sm:max-w-md px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1">
                  New Password (min 8 chars)
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new secure password"
                  className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSavingPassword}
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold transition-colors disabled:opacity-50"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>{isSavingPassword ? 'Updating Password...' : 'Update Administrative Password'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Assigned System Authorities */}
        <div className="bg-surface rounded-2xl border border-border p-5 shadow-sm space-y-3 text-xs">
          <div className="border-b border-border/60 pb-3">
            <h3 className="font-display font-bold text-base text-primary">Active Executive Authorities</h3>
            <p className="text-muted">As Super Administrator (Operations Authority), all 8 platform permissions are permanently active.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {[
              'manage_products • Products, Inventory & Taxonomy',
              'manage_orders • Order Fulfillment, Shipments & AWBs',
              'manage_payments • UPI Direct, Gateway & UTR Verification',
              'manage_users • User Directory, Roles & RBAC',
              'manage_cms • Editorial Blog, Articles & Static Pages',
              'manage_marketing • Coupons, Discounts & Newsletters',
              'manage_reviews • Customer Reviews Moderation',
              'manage_settings • SMTP, Legal Disclosures & Finance',
            ].map((auth) => (
              <div key={auth} className="p-2.5 bg-surface-dim/40 border border-border/60 rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="font-mono text-[11px] text-primary">{auth}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
