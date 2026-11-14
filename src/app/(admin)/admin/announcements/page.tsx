'use client';

// ==============================================================================
// InfiniCharm — Admin Announcement Bar Authority
// Features: Full CRUD, Master Toggle, Per-Item Visibility, Reorder, Live Preview
// Standards: 100% Real Server Data, DRY Architecture, WCAG 2.2 AA Contrast
// ==============================================================================

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { AnnouncementItem, AnnouncementConfig } from '@/lib/server/announcements-store';
import { logAdminAction } from '@/lib/services/audit';
import {
  Truck,
  Tag,
  Headphones,
  Compass,
  Plus,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Sparkles,
  Save,
  X,
  Layers,
  ChevronRight,
  Bell,
  RefreshCw,
} from 'lucide-react';

export default function AdminAnnouncementsPage() {
  const [config, setConfig] = useState<AnnouncementConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  // Modal States
  const [editingItem, setEditingItem] = useState<AnnouncementItem | null>(null);
  const [showItemModal, setShowItemModal] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);

  // Form Fields
  const [formType, setFormType] = useState<AnnouncementItem['type']>('delivery');
  const [formText, setFormText] = useState('');
  const [formSubtext, setFormSubtext] = useState('');
  const [formHref, setFormHref] = useState('');
  const [formPosition, setFormPosition] = useState<'left' | 'right'>('left');
  const [formDeliveryThreshold, setFormDeliveryThreshold] = useState('499');
  const [formCouponCode, setFormCouponCode] = useState('');
  const [formDiscountPercent, setFormDiscountPercent] = useState('10');
  const [formSupportEmail, setFormSupportEmail] = useState('support@infinicharm.com');
  const [formIsClickable, setFormIsClickable] = useState(true);
  const [formOpenInNewTab, setFormOpenInNewTab] = useState(false);
  const [formIsEnabled, setFormIsEnabled] = useState(true);

  const fetchConfig = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/announcements');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.config) {
          setConfig(data.config);
        }
      }
    } catch (err) {
      console.error('Failed fetching announcement config:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleToggleMaster = async () => {
    if (!config) return;
    const nextMaster = !config.isMasterEnabled;
    setConfig({ ...config, isMasterEnabled: nextMaster });

    try {
      const res = await fetch('/api/admin/announcements', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isMasterEnabled: nextMaster }),
      });
      if (res.ok) {
        logAdminAction('TOGGLE_ANNOUNCEMENT_MASTER', 'announcements', 'global', {
          isMasterEnabled: nextMaster,
        });
        showFeedback(nextMaster ? 'Announcement bar enabled.' : 'Announcement bar disabled.');
        window.dispatchEvent(new Event('infinicharm_announcements_updated'));
      }
    } catch {
      fetchConfig();
    }
  };

  const handleToggleItemVisibility = async (item: AnnouncementItem) => {
    if (!config) return;
    const nextEnabled = !item.isEnabled;

    try {
      const res = await fetch(`/api/admin/announcements/items/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled: nextEnabled }),
      });
      if (res.ok) {
        setConfig({
          ...config,
          items: config.items.map((i) => (i.id === item.id ? { ...i, isEnabled: nextEnabled } : i)),
        });
        logAdminAction('TOGGLE_ANNOUNCEMENT_ITEM', 'announcements', item.id, {
          isEnabled: nextEnabled,
        });
        showFeedback(`Item "${item.text}" visibility updated.`);
        window.dispatchEvent(new Event('infinicharm_announcements_updated'));
      }
    } catch (err) {
      console.error('Failed to toggle item visibility:', err);
    }
  };

  const handleMoveOrder = async (item: AnnouncementItem, direction: 'UP' | 'DOWN') => {
    if (!config) return;
    const items = [...config.items].sort((a, b) => a.displayOrder - b.displayOrder);
    const currentIndex = items.findIndex((i) => i.id === item.id);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'UP' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    // Swap items
    const temp = items[currentIndex];
    items[currentIndex] = items[targetIndex];
    items[targetIndex] = temp;

    const orderedIds = items.map((i) => i.id);

    try {
      const res = await fetch('/api/admin/announcements', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.config) setConfig(data.config);
        logAdminAction('REORDER_ANNOUNCEMENTS', 'announcements', 'global', { orderedIds });
        showFeedback('Announcement items reordered.');
        window.dispatchEvent(new Event('infinicharm_announcements_updated'));
      }
    } catch (err) {
      console.error('Failed to reorder items:', err);
    }
  };

  const openCreateModal = () => {
    setEditingItem(null);
    setFormType('delivery');
    setFormText('Free Express Delivery over ₹499');
    setFormSubtext('');
    setFormHref('/shop');
    setFormPosition('left');
    setFormDeliveryThreshold('499');
    setFormCouponCode('');
    setFormDiscountPercent('');
    setFormSupportEmail('');
    setFormIsClickable(true);
    setFormOpenInNewTab(false);
    setFormIsEnabled(true);
    setShowItemModal(true);
  };

  const openEditModal = (item: AnnouncementItem) => {
    setEditingItem(item);
    setFormType(item.type);
    setFormText(item.text);
    setFormSubtext(item.subtext || '');
    setFormHref(item.href || '');
    setFormPosition(item.position);
    setFormDeliveryThreshold(item.deliveryThresholdInRupees?.toString() || '');
    setFormCouponCode(item.couponCode || '');
    setFormDiscountPercent(item.discountPercent?.toString() || '');
    setFormSupportEmail(item.supportEmail || '');
    setFormIsClickable(item.isClickable);
    setFormOpenInNewTab(Boolean(item.openInNewTab));
    setFormIsEnabled(item.isEnabled);
    setShowItemModal(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formText.trim()) return;

    const payload = {
      type: formType,
      text: formText.trim(),
      subtext: formSubtext.trim() || undefined,
      href: formHref.trim() || undefined,
      position: formPosition,
      deliveryThresholdInRupees: formDeliveryThreshold ? Number(formDeliveryThreshold) : undefined,
      couponCode: formCouponCode.trim() || undefined,
      discountPercent: formDiscountPercent ? Number(formDiscountPercent) : undefined,
      supportEmail: formSupportEmail.trim() || undefined,
      isClickable: formIsClickable,
      openInNewTab: formOpenInNewTab,
      isEnabled: formIsEnabled,
    };

    try {
      if (editingItem) {
        // Update
        const res = await fetch(`/api/admin/announcements/items/${editingItem.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          logAdminAction('UPDATE_ANNOUNCEMENT_ITEM', 'announcements', editingItem.id, payload);
          showFeedback('Announcement item updated successfully.');
        }
      } else {
        // Create
        const res = await fetch('/api/admin/announcements/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          logAdminAction('CREATE_ANNOUNCEMENT_ITEM', 'announcements', 'new', payload);
          showFeedback('New announcement item created.');
        }
      }

      setShowItemModal(false);
      fetchConfig();
      window.dispatchEvent(new Event('infinicharm_announcements_updated'));
    } catch (err) {
      console.error('Failed to save announcement item:', err);
    }
  };

  const handleDeleteItem = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/announcements/items/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        logAdminAction('DELETE_ANNOUNCEMENT_ITEM', 'announcements', id, {});
        showFeedback('Announcement item deleted.');
        setDeletingItemId(null);
        fetchConfig();
        window.dispatchEvent(new Event('infinicharm_announcements_updated'));
      }
    } catch (err) {
      console.error('Failed to delete item:', err);
    }
  };

  const showFeedback = (msg: string) => {
    setSaveFeedback(msg);
    setTimeout(() => setSaveFeedback(null), 3500);
  };

  const items = config ? [...config.items].sort((a, b) => a.displayOrder - b.displayOrder) : [];
  const leftItems = items.filter((i) => i.position === 'left' && i.isEnabled);
  const rightItems = items.filter((i) => i.position === 'right' && i.isEnabled);

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <AdminHeader />

      <main className="flex-1 p-6 sm:p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Navigation Breadcrumb & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
          <div>
            <div className="flex items-center gap-2 text-xs text-muted mb-1">
              <Link href="/admin/cms" className="hover:text-primary transition-colors">
                Content &amp; CMS
              </Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-primary font-semibold">Top Announcement Bar</span>
            </div>
            <h1 className="font-display text-2xl font-bold text-primary tracking-tight">
              Top Announcement Bar Management
            </h1>
            <p className="text-xs text-muted mt-1">
              Configure promotional offers, delivery threshold notices, customer support links, and tracking shortcuts.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {saveFeedback && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl border border-emerald-200 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{saveFeedback}</span>
              </span>
            )}

            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-accent hover:bg-accent-hover text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add Announcement Item</span>
            </button>
          </div>
        </div>

        {/* Master Visibility & Status Card */}
        <div className="bg-surface rounded-3xl border border-border p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center text-accent shrink-0 border border-border">
              <Bell className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-base font-bold text-primary">Master Storefront Bar</h3>
                {config?.isMasterEnabled ? (
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Live Active
                  </span>
                ) : (
                  <span className="text-[10px] bg-neutral-200 text-neutral-700 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Globally Disabled
                  </span>
                )}
              </div>
              <p className="text-xs text-muted mt-0.5">
                Toggle master visibility of the entire top announcement bar across all public pages.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleToggleMaster}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 border ${
              config?.isMasterEnabled
                ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            {config?.isMasterEnabled ? (
              <>
                <EyeOff className="w-4 h-4" />
                <span>Disable Announcement Bar</span>
              </>
            ) : (
              <>
                <Eye className="w-4 h-4" />
                <span>Enable Announcement Bar</span>
              </>
            )}
          </button>
        </div>

        {/* Live Interactive Storefront Preview Card */}
        <div className="bg-surface rounded-3xl border border-border p-6 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent" />
              <h3 className="font-display text-sm font-bold text-primary">Live Storefront Preview</h3>
            </div>
            <span className="text-[11px] text-muted font-mono">
              {config?.isMasterEnabled ? 'Rendering on Storefront' : 'Hidden from Storefront (Disabled)'}
            </span>
          </div>

          {/* Render Actual Storefront Announcement Bar */}
          <div className="rounded-xl overflow-hidden border border-border shadow-xs">
            {config?.isMasterEnabled && (leftItems.length > 0 || rightItems.length > 0) ? (
              <div className="bg-primary text-white text-[11px] py-2 px-4 sm:px-6">
                <div className="flex items-center justify-between gap-3 overflow-x-auto scrollbar-none">
                  {/* Left */}
                  <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                    {leftItems.map((item, idx) => (
                      <React.Fragment key={item.id}>
                        {idx > 0 && <span className="h-3 w-px bg-white/20 shrink-0" />}
                        <span className="flex items-center gap-1.5 font-medium text-white/95 whitespace-nowrap">
                          {item.type === 'delivery' && <Truck className="w-3.5 h-3.5 text-accent shrink-0" />}
                          {item.type === 'coupon' && <Tag className="w-3.5 h-3.5 text-accent shrink-0" />}
                          {item.type === 'support' && <Headphones className="w-3.5 h-3.5 text-accent shrink-0" />}
                          {item.type === 'track_order' && <Compass className="w-3.5 h-3.5 text-accent shrink-0" />}
                          <span>{item.text}</span>
                        </span>
                      </React.Fragment>
                    ))}
                  </div>

                  {/* Right */}
                  <div className="flex items-center gap-3 sm:gap-5 shrink-0 text-white/90">
                    {rightItems.map((item, idx) => (
                      <React.Fragment key={item.id}>
                        {idx > 0 && <span className="h-3 w-px bg-white/20 shrink-0" />}
                        <span className="flex items-center gap-1.5 font-medium whitespace-nowrap">
                          {item.type === 'support' && <Headphones className="w-3.5 h-3.5 text-accent shrink-0" />}
                          {item.type === 'track_order' && <Compass className="w-3.5 h-3.5 text-accent shrink-0" />}
                          {item.type === 'delivery' && <Truck className="w-3.5 h-3.5 text-accent shrink-0" />}
                          {item.type === 'coupon' && <Tag className="w-3.5 h-3.5 text-accent shrink-0" />}
                          <span>{item.text}</span>
                        </span>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-surface-dim text-center text-xs text-muted">
                Announcement bar is currently disabled or has no active items.
              </div>
            )}
          </div>
        </div>

        {/* Announcement Items Table */}
        <div className="bg-surface rounded-3xl border border-border shadow-sm overflow-hidden">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <h3 className="font-display text-base font-bold text-primary">
              Configured Items ({items.length})
            </h3>
            <span className="text-xs text-muted">Drag or use arrow buttons to arrange priority</span>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-xs text-muted">Loading announcements...</div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <Bell className="w-8 h-8 text-muted mx-auto opacity-50" />
              <p className="text-xs font-semibold text-primary">No announcement items configured</p>
              <button
                type="button"
                onClick={openCreateModal}
                className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl"
              >
                Create First Item
              </button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className={`p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-colors ${
                    !item.isEnabled ? 'bg-surface-dim/40 opacity-70' : 'hover:bg-surface-dim/20'
                  }`}
                >
                  {/* Left: Reorder Controls & Details */}
                  <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                    {/* Reorder Buttons */}
                    <div className="flex flex-col gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => handleMoveOrder(item, 'UP')}
                        className="p-1 rounded hover:bg-surface-dim disabled:opacity-30 disabled:cursor-not-allowed text-primary"
                        title="Move Up"
                        aria-label="Move Up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={index === items.length - 1}
                        onClick={() => handleMoveOrder(item, 'DOWN')}
                        className="p-1 rounded hover:bg-surface-dim disabled:opacity-30 disabled:cursor-not-allowed text-primary"
                        title="Move Down"
                        aria-label="Move Down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Type Icon Badge */}
                    <div className="w-9 h-9 rounded-xl bg-surface-dim border border-border flex items-center justify-center text-accent shrink-0">
                      {item.type === 'delivery' && <Truck className="w-4 h-4" />}
                      {item.type === 'coupon' && <Tag className="w-4 h-4" />}
                      {item.type === 'support' && <Headphones className="w-4 h-4" />}
                      {item.type === 'track_order' && <Compass className="w-4 h-4" />}
                      {item.type === 'custom_link' && <ExternalLink className="w-4 h-4" />}
                      {item.type === 'text' && <Layers className="w-4 h-4" />}
                    </div>

                    {/* Text & Meta */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-sm text-primary">{item.text}</span>
                        <span className="text-[10px] font-semibold uppercase tracking-wider bg-surface-dim px-2 py-0.5 rounded-full border border-border text-muted">
                          {item.type}
                        </span>
                        <span className="text-[10px] font-semibold uppercase tracking-wider bg-surface-dim px-2 py-0.5 rounded-full border border-border text-muted">
                          Pos: {item.position}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted mt-1">
                        {item.href && (
                          <span className="font-mono text-[11px] text-accent">URL: {item.href}</span>
                        )}
                        {item.deliveryThresholdInRupees && (
                          <span>Min: ₹{item.deliveryThresholdInRupees}</span>
                        )}
                        {item.couponCode && <span>Code: {item.couponCode}</span>}
                        {item.discountPercent && <span>({item.discountPercent}% Off)</span>}
                        {item.supportEmail && <span>Email: {item.supportEmail}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    <button
                      type="button"
                      onClick={() => handleToggleItemVisibility(item)}
                      className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                        item.isEnabled
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          : 'bg-surface-dim text-muted border-border hover:text-primary'
                      }`}
                      title={item.isEnabled ? 'Disable item' : 'Enable item'}
                      aria-label="Toggle item status"
                    >
                      {item.isEnabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      <span className="hidden sm:inline">{item.isEnabled ? 'Active' : 'Disabled'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openEditModal(item)}
                      className="p-2 rounded-xl bg-surface-dim hover:bg-border text-primary border border-border transition-colors"
                      title="Edit item"
                      aria-label="Edit item"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeletingItemId(item.id)}
                      className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors"
                      title="Delete item"
                      aria-label="Delete item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal: Create / Edit Item */}
        {showItemModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs">
            <div className="bg-surface rounded-3xl border border-border max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <div>
                  <h3 className="font-display text-lg font-bold text-primary">
                    {editingItem ? 'Edit Announcement Item' : 'New Announcement Item'}
                  </h3>
                  <p className="text-xs text-muted mt-0.5">
                    Configure announcement text, click actions, and promotional settings.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowItemModal(false)}
                  className="p-1.5 rounded-full hover:bg-surface-dim text-muted hover:text-primary"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
                {/* Type Selection */}
                <div>
                  <label className="block font-bold text-primary mb-1">Item Category &amp; Purpose</label>
                  <select
                    value={formType}
                    onChange={(e) => {
                      const t = e.target.value as AnnouncementItem['type'];
                      setFormType(t);
                      if (t === 'delivery') {
                        setFormText(`Free Express Delivery over ₹${formDeliveryThreshold || '499'}`);
                        setFormHref('/shop');
                        setFormPosition('left');
                      } else if (t === 'coupon') {
                        setFormText(`Use Code '${formCouponCode || 'CHARM10'}' for ${formDiscountPercent || '10'}% Off`);
                        setFormHref('/deals');
                        setFormPosition('left');
                      } else if (t === 'support') {
                        setFormText(`24/7 Care: ${formSupportEmail || 'support@infinicharm.com'}`);
                        setFormHref(`mailto:${formSupportEmail || 'support@infinicharm.com'}`);
                        setFormPosition('right');
                      } else if (t === 'track_order') {
                        setFormText('Track Order');
                        setFormHref('/track-order');
                        setFormPosition('right');
                      }
                    }}
                    className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary font-semibold"
                  >
                    <option value="delivery">Delivery Threshold (Free Shipping)</option>
                    <option value="coupon">Promotional Coupon / Discount Code</option>
                    <option value="support">Customer Support Email</option>
                    <option value="track_order">Order GPS Tracking Shortcut</option>
                    <option value="custom_link">Custom Link</option>
                    <option value="text">Plain Text Announcement</option>
                  </select>
                </div>

                {/* Display Text */}
                <div>
                  <label className="block font-bold text-primary mb-1">Announcement Display Text *</label>
                  <input
                    type="text"
                    required
                    value={formText}
                    onChange={(e) => setFormText(e.target.value)}
                    placeholder="e.g. Free Express Delivery over ₹499"
                    className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:border-accent"
                  />
                </div>

                {/* Specific Fields depending on Type */}
                {formType === 'delivery' && (
                  <div>
                    <label className="block font-bold text-primary mb-1">
                      Free Shipping Threshold (in ₹)
                    </label>
                    <input
                      type="number"
                      value={formDeliveryThreshold}
                      onChange={(e) => {
                        setFormDeliveryThreshold(e.target.value);
                        setFormText(`Free Express Delivery over ₹${e.target.value}`);
                      }}
                      placeholder="499"
                      className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:border-accent"
                    />
                  </div>
                )}

                {formType === 'coupon' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-primary mb-1">Coupon Code</label>
                      <input
                        type="text"
                        value={formCouponCode}
                        onChange={(e) => {
                          setFormCouponCode(e.target.value);
                          setFormText(`Use Code '${e.target.value}' for ${formDiscountPercent}% Off`);
                        }}
                        placeholder="CHARM10"
                        className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary uppercase focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-primary mb-1">Discount %</label>
                      <input
                        type="number"
                        value={formDiscountPercent}
                        onChange={(e) => {
                          setFormDiscountPercent(e.target.value);
                          setFormText(`Use Code '${formCouponCode}' for ${e.target.value}% Off`);
                        }}
                        placeholder="10"
                        className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:border-accent"
                      />
                    </div>
                  </div>
                )}

                {formType === 'support' && (
                  <div>
                    <label className="block font-bold text-primary mb-1">Support Email Address</label>
                    <input
                      type="email"
                      value={formSupportEmail}
                      onChange={(e) => {
                        setFormSupportEmail(e.target.value);
                        setFormText(`24/7 Care: ${e.target.value}`);
                        setFormHref(`mailto:${e.target.value}`);
                      }}
                      placeholder="support@infinicharm.com"
                      className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:border-accent"
                    />
                  </div>
                )}

                {/* Target URL */}
                <div>
                  <label className="block font-bold text-primary mb-1">Destination URL / Deep-Link</label>
                  <input
                    type="text"
                    value={formHref}
                    onChange={(e) => setFormHref(e.target.value)}
                    placeholder="e.g. /shop, /deals, mailto:support@infinicharm.com"
                    className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:border-accent"
                  />
                </div>

                {/* Placement Position */}
                <div>
                  <label className="block font-bold text-primary mb-1">Top Bar Placement</label>
                  <select
                    value={formPosition}
                    onChange={(e) => setFormPosition(e.target.value as 'left' | 'right')}
                    className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary font-semibold"
                  >
                    <option value="left">Left Side (Promotions &amp; Value Propositions)</option>
                    <option value="right">Right Side (Care, Support &amp; Order Tracking)</option>
                  </select>
                </div>

                {/* Toggles */}
                <div className="pt-2 border-t border-border space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formIsEnabled}
                      onChange={(e) => setFormIsEnabled(e.target.checked)}
                      className="rounded border-border text-accent focus:ring-accent"
                    />
                    <span className="font-semibold text-primary">Enable this item on storefront</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formOpenInNewTab}
                      onChange={(e) => setFormOpenInNewTab(e.target.checked)}
                      className="rounded border-border text-accent focus:ring-accent"
                    />
                    <span className="font-semibold text-primary">Open destination in new tab</span>
                  </label>
                </div>

                {/* Modal Actions */}
                <div className="flex justify-end gap-2.5 pt-4 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setShowItemModal(false)}
                    className="px-4 py-2 bg-surface-dim hover:bg-border text-primary rounded-xl font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-accent hover:bg-accent-hover text-white rounded-xl font-bold flex items-center gap-1.5 shadow-sm"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{editingItem ? 'Save Changes' : 'Create Item'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Delete Confirmation */}
        {deletingItemId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs">
            <div className="bg-surface rounded-3xl border border-border max-w-sm w-full p-6 shadow-2xl space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="text-center">
                <h3 className="font-display text-base font-bold text-primary">Delete Announcement Item?</h3>
                <p className="text-xs text-muted mt-1">
                  This item will be permanently removed from the announcement bar.
                </p>
              </div>
              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingItemId(null)}
                  className="flex-1 py-2 bg-surface-dim hover:bg-border text-primary rounded-xl font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteItem(deletingItemId)}
                  className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

