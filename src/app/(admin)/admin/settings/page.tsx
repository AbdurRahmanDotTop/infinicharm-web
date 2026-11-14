'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { AdminAuthSettingsCard } from '@/components/admin/AdminAuthSettingsCard';
import { AdminSocialAndShareSettingsCard } from '@/components/admin/AdminSocialAndShareSettingsCard';
import { BRAND } from '@/lib/constants/brand';
import { logAdminAction } from '@/lib/services/audit';
import { getPlatformSettings, updatePlatformSettings } from '@/lib/services/settings';
import { StorefrontBadge } from '@/types';
import {
  Settings,
  ShieldCheck,
  Truck,
  RotateCcw,
  Save,
  Check,
  MapPin,
  Phone,
  Plus,
  Trash2,
  Edit2,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Clock,
  Award,
  FileCheck,
  ExternalLink,
  X,
} from 'lucide-react';

export default function AdminSettingsPage() {
  const [freeShippingThreshold, setFreeShippingThreshold] = useState('4999');
  const [standardDeliveryFee, setStandardDeliveryFee] = useState('60');
  const [expressDeliveryFee, setExpressDeliveryFee] = useState('150');
  const [freeShippingEnabled, setFreeShippingEnabled] = useState(true);
  const [fssaiLicense, setFssaiLicense] = useState('10423000001234');
  const [tawkPropertyId, setTawkPropertyId] = useState('6ae76c24e068a73c41821c1f');
  const [tawkWidgetId, setTawkWidgetId] = useState('1k6bvsse1');
  const [supportEmail, setSupportEmail] = useState<string>(BRAND.contact.supportEmail);
  const [addressLine, setAddressLine] = useState<string>(BRAND.contact.address.fullAddress);
  const [savedFeedback, setSavedFeedback] = useState(false);

  // Storefront Badges & Guarantees State
  const [badges, setBadges] = useState<StorefrontBadge[]>([]);
  const [isLoadingBadges, setIsLoadingBadges] = useState(true);
  const [editingBadge, setEditingBadge] = useState<StorefrontBadge | null>(null);
  const [isCreatingBadge, setIsCreatingBadge] = useState(false);
  const [badgeNotice, setBadgeNotice] = useState<string | null>(null);

  // New badge form state
  const [badgeTitle, setBadgeTitle] = useState('');
  const [badgeSubtitle, setBadgeSubtitle] = useState('');
  const [badgeIcon, setBadgeIcon] = useState('Truck');
  const [badgeThreshold, setBadgeThreshold] = useState('4999');
  const [badgeLinkUrl, setBadgeLinkUrl] = useState('/policies/shipping');
  const [badgeIsEnabled, setBadgeIsEnabled] = useState(true);

  // Load Platform Settings
  useEffect(() => {
    const s = getPlatformSettings();
    setFreeShippingThreshold((s.freeShippingThresholdPaise / 100).toString());
    setStandardDeliveryFee((s.standardShippingFeePaise / 100).toString());
    setExpressDeliveryFee((s.expressShippingFeePaise / 100).toString());
    setFssaiLicense(s.fssaiLicenseNumber);
    setTawkPropertyId(s.tawkPropertyId);
    setTawkWidgetId(s.tawkWidgetId);
    setSupportEmail(s.supportEmail);
    setAddressLine(s.registeredOfficeAddress);

    fetch('/api/admin/settings/shipping')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.settings) {
          if (data.settings.freeShippingThresholdRupees) {
            setFreeShippingThreshold(data.settings.freeShippingThresholdRupees.toString());
          }
          if (data.settings.standardShippingFeeRupees) {
            setStandardDeliveryFee(data.settings.standardShippingFeeRupees.toString());
          }
          if (data.settings.expressShippingFeeRupees) {
            setExpressDeliveryFee(data.settings.expressShippingFeeRupees.toString());
          }
          if (typeof data.settings.freeShippingEnabled === 'boolean') {
            setFreeShippingEnabled(data.settings.freeShippingEnabled);
          }
        }
      })
      .catch(() => {});
  }, []);

  // Fetch Storefront Badges from Server
  const loadBadges = useCallback(async () => {
    setIsLoadingBadges(true);
    try {
      const res = await fetch('/api/admin/settings/badges');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.badges)) {
          setBadges(data.badges);
        }
      }
    } catch (err) {
      console.error('Failed to load storefront badges:', err);
    } finally {
      setIsLoadingBadges(false);
    }
  }, []);

  useEffect(() => {
    loadBadges();
  }, [loadBadges]);

  const notifyChange = (msg: string) => {
    setBadgeNotice(msg);
    setTimeout(() => setBadgeNotice(null), 3500);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('infinicharm_badges_updated'));
    }
  };

  // Toggle Badge Enable / Disable
  const handleToggleBadge = async (badge: StorefrontBadge) => {
    const nextState = !badge.isEnabled;
    const updated = badges.map((b) => (b.id === badge.id ? { ...b, isEnabled: nextState } : b));
    setBadges(updated);

    try {
      const res = await fetch('/api/admin/settings/badges', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'TOGGLE', id: badge.id, isEnabled: nextState }),
      });
      if (res.ok) {
        notifyChange(`"${badge.title}" is now ${nextState ? 'ENABLED on PDP' : 'DISABLED from PDP'}.`);
      } else {
        await loadBadges();
      }
    } catch {
      await loadBadges();
    }
  };

  // Delete Badge
  const handleDeleteBadge = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to permanently delete badge "${title}"?`)) return;

    setBadges((prev) => prev.filter((b) => b.id !== id));
    try {
      const res = await fetch(`/api/admin/settings/badges?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        notifyChange(`Badge "${title}" deleted successfully.`);
      } else {
        await loadBadges();
      }
    } catch {
      await loadBadges();
    }
  };

  // Reorder Badge (Move UP / DOWN)
  const handleMoveBadge = async (id: string, direction: 'UP' | 'DOWN') => {
    const sorted = [...badges].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    const idx = sorted.findIndex((b) => b.id === id);
    if (idx < 0) return;

    const targetIdx = direction === 'UP' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= sorted.length) return;

    const temp = sorted[idx];
    sorted[idx] = sorted[targetIdx];
    sorted[targetIdx] = temp;

    const orderedIds = sorted.map((b) => b.id);
    const updated = sorted.map((b, i) => ({ ...b, displayOrder: i + 1 }));
    setBadges(updated);

    try {
      await fetch('/api/admin/settings/badges', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REORDER', orderedIds }),
      });
      notifyChange('Badges order updated successfully.');
    } catch {
      await loadBadges();
    }
  };

  // Save (Create or Update) Badge
  const handleSaveBadgeForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!badgeTitle.trim()) return;

    if (editingBadge) {
      // Update existing
      try {
        const res = await fetch('/api/admin/settings/badges', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingBadge.id,
            title: badgeTitle.trim(),
            subtitle: badgeSubtitle.trim() || undefined,
            icon: badgeIcon,
            thresholdRupees: badgeThreshold ? parseInt(badgeThreshold, 10) : undefined,
            linkUrl: badgeLinkUrl.trim() || undefined,
            isEnabled: badgeIsEnabled,
          }),
        });
        if (res.ok) {
          notifyChange(`Badge "${badgeTitle}" updated successfully.`);
          setEditingBadge(null);
          await loadBadges();
        }
      } catch (err) {
        console.error('Failed to update badge:', err);
      }
    } else {
      // Create new
      try {
        const res = await fetch('/api/admin/settings/badges', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: badgeTitle.trim(),
            subtitle: badgeSubtitle.trim() || undefined,
            icon: badgeIcon,
            thresholdRupees: badgeThreshold ? parseInt(badgeThreshold, 10) : undefined,
            linkUrl: badgeLinkUrl.trim() || undefined,
            isEnabled: badgeIsEnabled,
          }),
        });
        if (res.ok) {
          notifyChange(`New badge "${badgeTitle}" created successfully.`);
          setIsCreatingBadge(false);
          await loadBadges();
        }
      } catch (err) {
        console.error('Failed to create badge:', err);
      }
    }
  };

  // Open Edit Modal
  const openEditModal = (badge: StorefrontBadge) => {
    setEditingBadge(badge);
    setBadgeTitle(badge.title);
    setBadgeSubtitle(badge.subtitle || '');
    setBadgeIcon(badge.icon || 'Truck');
    setBadgeThreshold(badge.thresholdRupees ? badge.thresholdRupees.toString() : '');
    setBadgeLinkUrl(badge.linkUrl || '');
    setBadgeIsEnabled(badge.isEnabled !== false);
  };

  // Open Create Modal
  const openCreateModal = () => {
    setEditingBadge(null);
    setBadgeTitle('');
    setBadgeSubtitle('');
    setBadgeIcon('ShieldCheck');
    setBadgeThreshold('');
    setBadgeLinkUrl('/policies/shipping');
    setBadgeIsEnabled(true);
    setIsCreatingBadge(true);
  };

  // Render Icon helper
  const renderBadgeIcon = (iconName: string) => {
    switch (iconName) {
      case 'RotateCcw':
        return <RotateCcw className="w-4 h-4 text-accent" />;
      case 'ShieldCheck':
        return <ShieldCheck className="w-4 h-4 text-emerald-600" />;
      case 'Clock':
        return <Clock className="w-4 h-4 text-amber-600" />;
      case 'Award':
        return <Award className="w-4 h-4 text-purple-600" />;
      case 'Sparkles':
        return <Sparkles className="w-4 h-4 text-accent" />;
      case 'FileCheck':
        return <FileCheck className="w-4 h-4 text-emerald-600" />;
      case 'Truck':
      default:
        return <Truck className="w-4 h-4 text-accent" />;
    }
  };

  // Save General Platform & Shipping Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const thresholdRupees = parseFloat(freeShippingThreshold || '4999');
    const standardFeeRupees = parseFloat(standardDeliveryFee || '60');
    const expressFeeRupees = parseFloat(expressDeliveryFee || '150');

    updatePlatformSettings({
      freeShippingThresholdPaise: Math.round(thresholdRupees * 100),
      standardShippingFeePaise: Math.round(standardFeeRupees * 100),
      expressShippingFeePaise: Math.round(expressFeeRupees * 100),
      fssaiLicenseNumber: fssaiLicense,
      tawkPropertyId,
      tawkWidgetId,
      supportEmail,
      registeredOfficeAddress: addressLine,
    });

    try {
      await fetch('/api/admin/settings/shipping', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          freeShippingEnabled,
          freeShippingThresholdRupees: thresholdRupees,
          freeShippingThresholdPaise: Math.round(thresholdRupees * 100),
          standardShippingFeeRupees: standardFeeRupees,
          standardShippingFeePaise: Math.round(standardFeeRupees * 100),
          expressShippingFeeRupees: expressFeeRupees,
          expressShippingFeePaise: Math.round(expressFeeRupees * 100),
        }),
      });
      loadBadges();
    } catch (err) {
      console.warn('Failed syncing shipping settings with server:', err);
    }

    logAdminAction('UPDATE_SETTINGS', 'settings', 'platform-config', {
      freeShippingThreshold,
      standardDeliveryFee,
      expressDeliveryFee,
      freeShippingEnabled,
      fssaiLicense,
      supportEmail,
    });
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 3000);
  };

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <AdminHeader />

      <main className="flex-1 p-6 sm:p-8 max-w-5xl mx-auto w-full space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
          <div>
            <h1 className="font-display text-2xl font-bold text-primary tracking-tight">
              Platform & Compliance Settings
            </h1>
            <p className="text-xs text-muted mt-1">
              Configure shipping algorithms, replacement guarantees, storefront PDP badges, and legal metrology.
            </p>
          </div>

          {(savedFeedback || badgeNotice) && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl border border-emerald-200 animate-fade-in">
              <Check className="w-4 h-4 text-emerald-600" />
              {badgeNotice || 'Platform configuration updated.'}
            </span>
          )}
        </div>

        {/* Messaging, Email & Notification Configuration Links */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a
            href="/admin/settings/email-smtp"
            className="p-4 rounded-2xl bg-surface border border-border hover:border-accent/60 transition-colors flex flex-col justify-between gap-2 shadow-xs"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-accent">
              Settings &rarr; Relay
            </span>
            <div>
              <h2 className="font-display text-sm font-bold text-primary">
                Email &amp; SMTP Configuration
              </h2>
              <p className="text-xs text-muted mt-0.5">
                Configure Brevo &amp; custom SMTP relays for all transactional &amp; marketing emails.
              </p>
            </div>
          </a>
          <a
            href="/admin/email-notifications"
            className="p-4 rounded-2xl bg-surface border border-border hover:border-accent/60 transition-colors flex flex-col justify-between gap-2 shadow-xs"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-accent">
              Automation
            </span>
            <div>
              <h2 className="font-display text-sm font-bold text-primary">
                Email Notifications Hub
              </h2>
              <p className="text-xs text-muted mt-0.5">
                Control Admin, Customer &amp; Vendor event rules, toggles, and delivery logs.
              </p>
            </div>
          </a>
          <a
            href="/admin/email-templates"
            className="p-4 rounded-2xl bg-surface border border-border hover:border-accent/60 transition-colors flex flex-col justify-between gap-2 shadow-xs"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-accent">
              Blueprints
            </span>
            <div>
              <h2 className="font-display text-sm font-bold text-primary">
                Email Templates Library
              </h2>
              <p className="text-xs text-muted mt-0.5">
                Edit transactional order, enquiry alert, password PIN, and campaign templates.
              </p>
            </div>
          </a>
        </div>

        {/* 1. STOREFRONT BADGES, SHIPPING & REPLACEMENT GUARANTEE MANAGER (PDP) */}
        <div className="bg-surface rounded-3xl border border-border p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-accent/10 text-accent">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-display text-base font-bold text-primary">
                  Storefront Badges & Replacement Guarantees
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  Manage &ldquo;Free Shipping on Orders Above ₹4,999&rdquo;, &ldquo;Transit Damage Guarantee&rdquo;, and custom badges shown on the Product Details Page (PDP).
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-bold rounded-xl transition-all shadow-xs shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add New Badge</span>
            </button>
          </div>

          {/* Badges Table / Cards */}
          {isLoadingBadges ? (
            <div className="p-8 text-center text-xs text-muted">Loading storefront badges...</div>
          ) : badges.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted border border-dashed border-border rounded-2xl">
              No storefront badges configured. Click &ldquo;+ Add New Badge&rdquo; to create one.
            </div>
          ) : (
            <div className="space-y-3">
              {badges.map((b, idx) => (
                <div
                  key={b.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    b.isEnabled
                      ? 'bg-surface-dim/40 border-border'
                      : 'bg-zinc-50 border-zinc-200 opacity-60 dark:bg-neutral-900/40 dark:border-neutral-800'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-xl bg-surface border border-border shrink-0">
                      {renderBadgeIcon(b.icon)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-primary text-xs truncate">{b.title}</span>
                        <span
                          className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            b.isEnabled
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
                          }`}
                        >
                          {b.isEnabled ? 'Active on PDP' : 'Hidden from PDP'}
                        </span>
                        {b.thresholdRupees && (
                          <span className="text-[9px] bg-accent/10 text-accent font-bold px-2 py-0.5 rounded-full">
                            Threshold: ₹{b.thresholdRupees}
                          </span>
                        )}
                      </div>
                      {b.subtitle && <p className="text-[11px] text-muted mt-0.5">{b.subtitle}</p>}
                      {b.linkUrl && (
                        <span className="text-[10px] text-muted font-mono flex items-center gap-1 mt-0.5">
                          <span>Link: {b.linkUrl}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                    {/* Reorder Buttons */}
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveBadge(b.id, 'UP')}
                      className="p-1.5 rounded-lg border border-border bg-surface hover:text-accent disabled:opacity-30"
                      title="Move Up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === badges.length - 1}
                      onClick={() => handleMoveBadge(b.id, 'DOWN')}
                      className="p-1.5 rounded-lg border border-border bg-surface hover:text-accent disabled:opacity-30"
                      title="Move Down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>

                    {/* Toggle Active Button */}
                    <button
                      type="button"
                      onClick={() => handleToggleBadge(b)}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase transition-all ${
                        b.isEnabled
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-400'
                      }`}
                    >
                      {b.isEnabled ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                      <span>{b.isEnabled ? 'Enabled' : 'Disabled'}</span>
                    </button>

                    {/* Edit Button */}
                    <button
                      type="button"
                      onClick={() => openEditModal(b)}
                      className="p-1.5 rounded-lg border border-border bg-surface text-primary hover:text-accent hover:border-accent"
                      title="Edit Badge"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete Button */}
                    <button
                      type="button"
                      onClick={() => handleDeleteBadge(b.id, b.title)}
                      className="p-1.5 rounded-lg border border-border bg-surface text-rose-500 hover:text-rose-700 hover:border-rose-300"
                      title="Delete Badge"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Live PDP Preview Card */}
          <div className="pt-4 border-t border-border">
            <span className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-2">
              Live Preview (Storefront Product Details Page):
            </span>
            <div className="p-4 bg-surface-dim/70 rounded-2xl border border-border max-w-lg">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {badges.filter((b) => b.isEnabled).length === 0 ? (
                  <span className="text-xs text-muted col-span-2 italic">
                    All badges disabled. No badges will appear on the PDP.
                  </span>
                ) : (
                  badges
                    .filter((b) => b.isEnabled)
                    .map((b) => (
                      <div
                        key={b.id}
                        className="flex items-center gap-2.5 p-3 rounded-xl bg-surface text-xs text-muted border border-border/80 shadow-2xs"
                      >
                        {renderBadgeIcon(b.icon)}
                        <span className="font-medium text-[11px]">{b.title}</span>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 2. GENERAL PLATFORM & SHIPPING CONFIGURATION FORM */}
        <form onSubmit={handleSaveSettings} className="space-y-6">
          {/* Shipping & Delivery Engine */}
          <div className="bg-surface rounded-3xl border border-border p-6 sm:p-8 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <Truck className="w-5 h-5 text-accent" />
                <h2 className="font-display text-base font-bold text-primary">
                  Shipping &amp; Delivery Fee Rules
                </h2>
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-primary cursor-pointer">
                <input
                  type="checkbox"
                  checked={freeShippingEnabled}
                  onChange={(e) => setFreeShippingEnabled(e.target.checked)}
                  className="rounded text-accent focus:ring-accent"
                />
                <span>Enable Free Shipping Program</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-primary mb-1">
                  Free Shipping Minimum Cart Value (INR ₹)
                </label>
                <input
                  type="number"
                  value={freeShippingThreshold}
                  onChange={(e) => setFreeShippingThreshold(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent font-semibold"
                />
                <span className="text-[11px] text-muted mt-1 block">
                  Orders equal or above ₹{freeShippingThreshold} receive free delivery.
                </span>
              </div>

              <div>
                <label className="block font-semibold text-primary mb-1">
                  Standard Flat Shipping Fee (INR ₹)
                </label>
                <input
                  type="number"
                  value={standardDeliveryFee}
                  onChange={(e) => setStandardDeliveryFee(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent font-semibold"
                />
                <span className="text-[11px] text-muted mt-1 block">
                  Applied when order subtotal is below ₹{freeShippingThreshold}.
                </span>
              </div>

              <div>
                <label className="block font-semibold text-primary mb-1">
                  Express Courier Shipping Fee (INR ₹)
                </label>
                <input
                  type="number"
                  value={expressDeliveryFee}
                  onChange={(e) => setExpressDeliveryFee(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent font-semibold"
                />
                <span className="text-[11px] text-muted mt-1 block">
                  Priority expedited delivery option.
                </span>
              </div>
            </div>
          </div>

          {/* Legal Compliance & FSSAI */}
          <div className="bg-surface rounded-3xl border border-border p-6 sm:p-8 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-border">
              <ShieldCheck className="w-5 h-5 text-accent" />
              <h2 className="font-display text-base font-bold text-primary">
                FSSAI &amp; Statutory Disclosures
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-primary mb-1">
                  FSSAI License Number
                </label>
                <input
                  type="text"
                  value={fssaiLicense}
                  onChange={(e) => setFssaiLicense(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary font-mono focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block font-semibold text-primary mb-1">
                  Customer Care &amp; Grievance Email
                </label>
                <input
                  type="email"
                  value={supportEmail}
                  onChange={(e) => setSupportEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-primary mb-1">
                  Registered Dispatch Hub &amp; Operating Address
                </label>
                <input
                  type="text"
                  value={addressLine}
                  onChange={(e) => setAddressLine(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                />
              </div>
            </div>
          </div>

          {/* Live Support Widget Configuration */}
          <div className="bg-surface rounded-3xl border border-border p-6 sm:p-8 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-border">
              <Phone className="w-5 h-5 text-accent" />
              <h2 className="font-display text-base font-bold text-primary">
                Tawk.to Real-Time Care Integration
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-primary mb-1">
                  Tawk.to Property ID
                </label>
                <input
                  type="text"
                  value={tawkPropertyId}
                  onChange={(e) => setTawkPropertyId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary font-mono focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block font-semibold text-primary mb-1">
                  Tawk.to Widget ID
                </label>
                <input
                  type="text"
                  value={tawkWidgetId}
                  onChange={(e) => setTawkWidgetId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary font-mono focus:outline-none focus:border-accent"
                />
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="px-8 py-3.5 bg-accent hover:bg-accent-hover text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-colors uppercase tracking-wider shadow-md"
            >
              <Save className="w-4 h-4" />
              <span>Save Platform Settings</span>
            </button>
          </div>
        </form>

        {/* 3. CUSTOMER AUTHENTICATION & EMAIL VERIFICATION POLICY */}
        <AdminAuthSettingsCard />

        {/* 4. SOCIAL MEDIA LINKS & CONTENT SHARING POLICY */}
        <AdminSocialAndShareSettingsCard />

        {/* MODAL: ADD / EDIT STOREFRONT BADGE */}
        {(editingBadge || isCreatingBadge) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-surface rounded-3xl border border-border p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2 text-primary font-bold">
                  {renderBadgeIcon(badgeIcon)}
                  <span>{editingBadge ? 'Edit Storefront Badge' : 'Create Storefront Badge'}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingBadge(null);
                    setIsCreatingBadge(false);
                  }}
                  className="p-1 hover:text-accent text-muted"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveBadgeForm} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-primary mb-1">
                    Badge Title (Displayed on PDP) *
                  </label>
                  <input
                    type="text"
                    required
                    value={badgeTitle}
                    onChange={(e) => setBadgeTitle(e.target.value)}
                    placeholder="e.g. Free Shipping on orders above ₹4,999"
                    className="w-full px-3.5 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-primary mb-1">
                    Subtitle / Secondary Note (Optional)
                  </label>
                  <input
                    type="text"
                    value={badgeSubtitle}
                    onChange={(e) => setBadgeSubtitle(e.target.value)}
                    placeholder="e.g. 100% replacement for broken seals"
                    className="w-full px-3.5 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-primary mb-1">Visual Icon</label>
                    <select
                      value={badgeIcon}
                      onChange={(e) => setBadgeIcon(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary font-medium"
                    >
                      <option value="Truck">Truck (Shipping)</option>
                      <option value="RotateCcw">RotateCcw (Replacement/Refund)</option>
                      <option value="ShieldCheck">ShieldCheck (Guarantee/Purity)</option>
                      <option value="Clock">Clock (Fast Dispatch)</option>
                      <option value="Award">Award (Certified)</option>
                      <option value="Sparkles">Sparkles (Special Harvest)</option>
                      <option value="FileCheck">FileCheck (Lab Tested)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-primary mb-1">
                      Min Threshold (₹ Optional)
                    </label>
                    <input
                      type="number"
                      value={badgeThreshold}
                      onChange={(e) => setBadgeThreshold(e.target.value)}
                      placeholder="e.g. 4999"
                      className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-primary mb-1">
                    Destination Policy URL (Optional)
                  </label>
                  <input
                    type="text"
                    value={badgeLinkUrl}
                    onChange={(e) => setBadgeLinkUrl(e.target.value)}
                    placeholder="/policies/shipping or /policies/refunds"
                    className="w-full px-3.5 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent font-mono text-[11px]"
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-surface-dim rounded-xl border border-border">
                  <div>
                    <span className="font-semibold text-primary block">Active on Storefront PDP</span>
                    <span className="text-[11px] text-muted">Show this badge beneath Add to Bag on product pages</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBadgeIsEnabled(!badgeIsEnabled)}
                    className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all ${
                      badgeIsEnabled
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
                    }`}
                  >
                    {badgeIsEnabled ? 'ACTIVE' : 'INACTIVE'}
                  </button>
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingBadge(null);
                      setIsCreatingBadge(false);
                    }}
                    className="px-4 py-2 bg-surface-dim hover:bg-border text-primary rounded-xl font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-accent hover:bg-accent-hover text-white font-bold rounded-xl shadow-xs"
                  >
                    {editingBadge ? 'Save Changes' : 'Create Badge'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
