'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Share2,
  Plus,
  Trash2,
  Edit2,
  Save,
  Check,
  ArrowUp,
  ArrowDown,
  Globe,
  ExternalLink,
  X,
  AlertCircle,
  RefreshCw,
  Sliders,
  MessageCircle,
} from 'lucide-react';
import type {
  SocialMediaLink,
  ShareFeatureSettings,
  SocialPlatformKey,
  SocialAndShareSettings,
} from '@/types';
import { renderPlatformIcon } from '@/components/common/SocialIcons';

export function AdminSocialAndShareSettingsCard() {
  const [socialLinks, setSocialLinks] = useState<SocialMediaLink[]>([]);
  const [sharing, setSharing] = useState<ShareFeatureSettings>({
    enableProductSharing: true,
    enableBlogSharing: true,
    enableOrderTrackingSharing: true,
    channels: {
      whatsapp: true,
      twitter: true,
      facebook: true,
      linkedin: true,
      email: true,
      copyLink: true,
    },
    customShareMessage: '',
  });
  const [loading, setLoading] = useState(true);
  const [savingShare, setSavingShare] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal State for Add / Edit Social Link
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<SocialMediaLink | null>(null);
  const [formPlatform, setFormPlatform] = useState<SocialPlatformKey>('website');
  const [formLabel, setFormLabel] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formIsEnabled, setFormIsEnabled] = useState(true);
  const [isSubmittingLink, setIsSubmittingLink] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/settings/social-share');
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success && data?.settings) {
        setSocialLinks(data.settings.socialLinks || []);
        if (data.settings.sharing) {
          setSharing(data.settings.sharing);
        }
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err?.message || 'Failed to load social and share settings.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const notifyChange = (msg: string) => {
    setFeedback({ type: 'success', text: msg });
    setTimeout(() => setFeedback(null), 4000);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('infinicharm_social_updated'));
    }
  };

  // Open modal for Create
  const handleOpenCreateModal = () => {
    setEditingLink(null);
    setFormPlatform('website');
    setFormLabel('');
    setFormUrl('');
    setFormDescription('');
    setFormIsEnabled(true);
    setIsModalOpen(true);
  };

  // Open modal for Edit
  const handleOpenEditModal = (link: SocialMediaLink) => {
    setEditingLink(link);
    setFormPlatform(link.platform);
    setFormLabel(link.label);
    setFormUrl(link.url);
    setFormDescription(link.description || '');
    setFormIsEnabled(link.isEnabled !== false);
    setIsModalOpen(true);
  };

  // Submit Add or Edit Form
  const handleSubmitLinkForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formLabel.trim() || !formUrl.trim()) return;

    setIsSubmittingLink(true);
    try {
      if (editingLink) {
        // Update
        const res = await fetch(`/api/admin/settings/social-links/${editingLink.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            platform: formPlatform,
            label: formLabel.trim(),
            url: formUrl.trim(),
            description: formDescription.trim(),
            isEnabled: formIsEnabled,
          }),
        });
        const data = await res.json();
        if (res.ok && data?.success) {
          notifyChange(`Social channel "${formLabel}" updated.`);
          if (data.settings?.socialLinks) {
            setSocialLinks(data.settings.socialLinks);
          } else {
            loadSettings();
          }
          setIsModalOpen(false);
        } else {
          throw new Error(data?.error || 'Failed to update social link.');
        }
      } else {
        // Create
        const res = await fetch('/api/admin/settings/social-links', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            platform: formPlatform,
            label: formLabel.trim(),
            url: formUrl.trim(),
            description: formDescription.trim(),
            isEnabled: formIsEnabled,
          }),
        });
        const data = await res.json();
        if (res.ok && data?.success) {
          notifyChange(`Social channel "${formLabel}" added.`);
          if (data.settings?.socialLinks) {
            setSocialLinks(data.settings.socialLinks);
          } else {
            loadSettings();
          }
          setIsModalOpen(false);
        } else {
          throw new Error(data?.error || 'Failed to create social link.');
        }
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err?.message || 'Operation failed.',
      });
    } finally {
      setIsSubmittingLink(false);
    }
  };

  // Toggle Link Active Status
  const handleToggleLinkActive = async (link: SocialMediaLink) => {
    try {
      const nextState = !link.isEnabled;
      const res = await fetch(`/api/admin/settings/social-links/${link.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled: nextState }),
      });
      const data = await res.json();
      if (res.ok && data?.success) {
        notifyChange(`"${link.label}" is now ${nextState ? 'ACTIVE' : 'INACTIVE'}.`);
        if (data.settings?.socialLinks) {
          setSocialLinks(data.settings.socialLinks);
        } else {
          loadSettings();
        }
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Failed to toggle status.' });
    }
  };

  // Delete Link
  const handleDeleteLink = async (link: SocialMediaLink) => {
    if (!confirm(`Are you sure you want to remove "${link.label}"?`)) return;

    try {
      const res = await fetch(`/api/admin/settings/social-links/${link.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok && data?.success) {
        notifyChange(`Social channel "${link.label}" deleted.`);
        if (data.settings?.socialLinks) {
          setSocialLinks(data.settings.socialLinks);
        } else {
          loadSettings();
        }
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Failed to delete link.' });
    }
  };

  // Reorder Link Up / Down
  const handleMoveOrder = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= socialLinks.length) return;

    const reordered = [...socialLinks];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    const orderedIds = reordered.map((l) => l.id);
    try {
      const res = await fetch('/api/admin/settings/social-share', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds }),
      });
      const data = await res.json();
      if (res.ok && data?.success) {
        notifyChange('Display order updated.');
        if (data.settings?.socialLinks) {
          setSocialLinks(data.settings.socialLinks);
        } else {
          loadSettings();
        }
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Failed to reorder links.' });
    }
  };

  // Save Sharing Feature Configuration
  const handleSaveSharingSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingShare(true);
    try {
      const res = await fetch('/api/admin/settings/social-share', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sharing }),
      });
      const data = await res.json();
      if (res.ok && data?.success) {
        notifyChange('Content sharing feature configuration saved.');
        if (data.settings?.sharing) {
          setSharing(data.settings.sharing);
        }
      } else {
        throw new Error(data?.error || 'Failed to save sharing configuration.');
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Failed to save sharing settings.' });
    } finally {
      setSavingShare(false);
    }
  };

  return (
    <div className="bg-surface rounded-3xl border border-border p-6 sm:p-8 space-y-8 shadow-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-accent/10 text-accent rounded-2xl">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-primary">
              Social Media Links & Content Sharing Policy
            </h2>
            <p className="text-xs text-muted">
              Govern official public social channels (YouTube, Facebook, Instagram, The Crumb, Website) and Amazon-style content sharing
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenCreateModal}
          className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-colors shrink-0 shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Add Social Channel</span>
        </button>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border text-xs flex items-center justify-between animate-fade-in ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300'
              : 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <Check className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="p-1 hover:opacity-70"
            aria-label="Dismiss feedback"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* SECTION 1: PUBLIC SOCIAL MEDIA LINKS */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-primary">Official Brand Social Media Links</h3>
            <p className="text-xs text-muted">
              Configured channels appear dynamically in the storefront footer and public communication channels
            </p>
          </div>
          <button
            type="button"
            onClick={loadSettings}
            disabled={loading}
            className="p-1.5 text-muted hover:text-primary rounded-lg transition-colors"
            title="Reload settings"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-muted flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-accent" />
            <span>Loading social channels...</span>
          </div>
        ) : socialLinks.length === 0 ? (
          <div className="p-8 text-center bg-surface-dim rounded-2xl border border-border space-y-2">
            <p className="text-xs text-muted font-medium">No social media channels configured.</p>
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="text-xs text-accent font-bold hover:underline"
            >
              + Add first channel
            </button>
          </div>
        ) : (
          <div className="border border-border rounded-2xl overflow-hidden divide-y divide-border">
            {socialLinks.map((link, idx) => (
              <div
                key={link.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface hover:bg-surface-dim/40 transition-colors"
              >
                {/* Left: Icon, Label, URL */}
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-surface-dim border border-border flex items-center justify-center text-primary shrink-0">
                    {renderPlatformIcon(link.platform, 18)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-primary truncate">{link.label}</span>
                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-surface-dim border border-border text-muted">
                        {link.platform}
                      </span>
                    </div>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-muted hover:text-accent font-mono truncate flex items-center gap-1 mt-0.5"
                    >
                      <span className="truncate">{link.url}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  </div>
                </div>

                {/* Right: Order, Active Toggle, Edit, Delete */}
                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  {/* Move Up / Down */}
                  <div className="flex items-center border border-border rounded-lg overflow-hidden bg-surface-dim">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveOrder(idx, 'up')}
                      className="p-1 hover:bg-border text-muted hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move Up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === socialLinks.length - 1}
                      onClick={() => handleMoveOrder(idx, 'down')}
                      className="p-1 hover:bg-border text-muted hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move Down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Status Toggle */}
                  <button
                    type="button"
                    onClick={() => handleToggleLinkActive(link)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase transition-all ${
                      link.isEnabled
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
                    }`}
                  >
                    {link.isEnabled ? 'ACTIVE' : 'INACTIVE'}
                  </button>

                  {/* Edit */}
                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(link)}
                    className="p-1.5 rounded-lg hover:bg-surface-dim text-muted hover:text-primary transition-colors"
                    title="Edit Channel"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() => handleDeleteLink(link)}
                    className="p-1.5 rounded-lg hover:bg-rose-50 text-muted hover:text-rose-600 transition-colors"
                    title="Delete Channel"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 2: SHARING FEATURES & CHANNELS CONFIGURATION */}
      <form onSubmit={handleSaveSharingSettings} className="space-y-6 pt-6 border-t border-border">
        <div>
          <h3 className="text-sm font-bold text-primary">Content Sharing Experience Configuration</h3>
          <p className="text-xs text-muted">
            Configure Amazon-style sharing buttons across products, journal articles, and order consignments
          </p>
        </div>

        {/* Surface Placements */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <label className="flex items-start gap-3 p-4 rounded-2xl bg-surface-dim border border-border cursor-pointer hover:border-accent/40 transition-colors">
            <input
              type="checkbox"
              checked={sharing.enableProductSharing}
              onChange={(e) =>
                setSharing({ ...sharing, enableProductSharing: e.target.checked })
              }
              className="mt-0.5 rounded text-accent focus:ring-accent"
            />
            <div>
              <span className="text-xs font-bold text-primary block">Product Detail Pages (PDP)</span>
              <span className="text-[11px] text-muted">
                Display floating share on gallery & Amazon-style action button next to Wishlist
              </span>
            </div>
          </label>

          <label className="flex items-start gap-3 p-4 rounded-2xl bg-surface-dim border border-border cursor-pointer hover:border-accent/40 transition-colors">
            <input
              type="checkbox"
              checked={sharing.enableBlogSharing}
              onChange={(e) =>
                setSharing({ ...sharing, enableBlogSharing: e.target.checked })
              }
              className="mt-0.5 rounded text-accent focus:ring-accent"
            />
            <div>
              <span className="text-xs font-bold text-primary block">Journal & Articles</span>
              <span className="text-[11px] text-muted">
                Show share options in article header metadata and footer dispatch action bar
              </span>
            </div>
          </label>

          <label className="flex items-start gap-3 p-4 rounded-2xl bg-surface-dim border border-border cursor-pointer hover:border-accent/40 transition-colors">
            <input
              type="checkbox"
              checked={sharing.enableOrderTrackingSharing}
              onChange={(e) =>
                setSharing({ ...sharing, enableOrderTrackingSharing: e.target.checked })
              }
              className="mt-0.5 rounded text-accent focus:ring-accent"
            />
            <div>
              <span className="text-xs font-bold text-primary block">Consignment Tracking</span>
              <span className="text-[11px] text-muted">
                Enable sharing tracking link for family members or recipient dispatch coordination
              </span>
            </div>
          </label>
        </div>

        {/* Enabled Channels */}
        <div className="space-y-3">
          <span className="text-xs font-semibold text-primary block">Active Sharing Channels</span>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {[
              { key: 'whatsapp', label: 'WhatsApp', desc: 'Direct messaging' },
              { key: 'twitter', label: 'X (Twitter)', desc: 'Public tweet intent' },
              { key: 'facebook', label: 'Facebook', desc: 'Feed share dialog' },
              { key: 'linkedin', label: 'LinkedIn', desc: 'Professional share' },
              { key: 'email', label: 'Email', desc: 'Mailto intent' },
              { key: 'copyLink', label: 'Copy Link', desc: '1-click clipboard' },
            ].map((channel) => (
              <label
                key={channel.key}
                className="flex items-start gap-2.5 p-3 rounded-xl bg-surface-dim border border-border cursor-pointer hover:border-accent/40 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={sharing.channels[channel.key as keyof typeof sharing.channels]}
                  onChange={(e) =>
                    setSharing({
                      ...sharing,
                      channels: {
                        ...sharing.channels,
                        [channel.key]: e.target.checked,
                      },
                    })
                  }
                  className="mt-0.5 rounded text-accent focus:ring-accent"
                />
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-primary block truncate">
                    {channel.label}
                  </span>
                  <span className="text-[10px] text-muted block truncate">{channel.desc}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Custom Default Share Message */}
        <div>
          <label className="block text-xs font-semibold text-primary mb-1">
            Default Sharing Message Template (Optional)
          </label>
          <input
            type="text"
            value={sharing.customShareMessage || ''}
            onChange={(e) =>
              setSharing({ ...sharing, customShareMessage: e.target.value })
            }
            placeholder="Discover authentic, unadulterated essentials direct from single-origin harvesters at InfiniCharm."
            className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-xs text-primary focus:outline-none focus:border-accent"
          />
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={savingShare}
            className="px-6 py-3 bg-accent hover:bg-accent-hover text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-colors uppercase tracking-wider shadow-sm disabled:opacity-50"
          >
            {savingShare ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{savingShare ? 'Saving Settings...' : 'Save Sharing Settings'}</span>
          </button>
        </div>
      </form>

      {/* MODAL: ADD / EDIT SOCIAL LINK */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface rounded-3xl border border-border p-6 sm:p-8 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-5 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2 text-primary font-bold">
                {renderPlatformIcon(formPlatform, 20)}
                <span>{editingLink ? 'Edit Social Channel' : 'Add Social Channel'}</span>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 hover:text-accent text-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitLinkForm} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-primary mb-1">Platform *</label>
                <select
                  value={formPlatform}
                  onChange={(e) => setFormPlatform(e.target.value as SocialPlatformKey)}
                  className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary font-medium"
                >
                  <option value="youtube">YouTube</option>
                  <option value="facebook">Facebook</option>
                  <option value="instagram">Instagram</option>
                  <option value="thecrumb">The Crumb (thecrumb.co)</option>
                  <option value="website">Official Website</option>
                  <option value="twitter">X (Twitter)</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="whatsapp">WhatsApp Channel</option>
                  <option value="other">Other Link</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-primary mb-1">
                  Channel Display Label *
                </label>
                <input
                  type="text"
                  required
                  value={formLabel}
                  onChange={(e) => setFormLabel(e.target.value)}
                  placeholder="e.g. YouTube or The Crumb (TechilyFly)"
                  className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block font-semibold text-primary mb-1">
                  Target Destination URL *
                </label>
                <input
                  type="url"
                  required
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  placeholder="https://www.youtube.com/channel/..."
                  className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary font-mono text-[11px] focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block font-semibold text-primary mb-1">
                  Description / Tooltip Note (Optional)
                </label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="e.g. InfiniCharm Official YouTube Channel"
                  className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-surface-dim rounded-xl border border-border">
                <div>
                  <span className="font-semibold text-primary block">Active on Storefront</span>
                  <span className="text-[11px] text-muted">
                    Show this link in public footer and social rails
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setFormIsEnabled(!formIsEnabled)}
                  className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all ${
                    formIsEnabled
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
                  }`}
                >
                  {formIsEnabled ? 'ACTIVE' : 'INACTIVE'}
                </button>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-surface-dim hover:bg-border text-primary rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingLink}
                  className="px-5 py-2 bg-accent hover:bg-accent-hover text-white font-bold rounded-xl shadow-xs disabled:opacity-50"
                >
                  {isSubmittingLink
                    ? 'Saving...'
                    : editingLink
                    ? 'Save Changes'
                    : 'Add Channel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
