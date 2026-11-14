'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { getAllProducts } from '@/lib/data/products';
import { logAdminAction } from '@/lib/services/audit';
import {
  Image as ImageIcon,
  Plus,
  Copy,
  Check,
  ExternalLink,
  Globe,
  Trash2,
  Edit3,
  Video,
  FileText,
  Music,
  Search,
  Filter,
  Eye,
  ShieldCheck,
  Sparkles,
  Info,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
} from 'lucide-react';
import type { ExternalMedia, MediaProvider, MediaType, MediaRole } from '@/types';
import {
  ExternalMediaRenderer,
  ExternalImage,
  ExternalVideo,
  ExternalDocument,
} from '@/components/media';
import {
  validateAndNormalizeMediaUrl,
  detectProviderAdapter,
} from '@/lib/media/providers';

export default function AdminMediaPage() {
  const initialProducts = useMemo(() => getAllProducts(), []);
  const fallbackMedia: ExternalMedia[] = useMemo(() => {
    return initialProducts.flatMap((p) => p.media);
  }, [initialProducts]);

  const [mediaList, setMediaList] = useState<ExternalMedia[]>(fallbackMedia);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMedia, setEditingMedia] = useState<ExternalMedia | null>(null);
  const [deletingMedia, setDeletingMedia] = useState<ExternalMedia | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // New Media Form States
  const [inputUrl, setInputUrl] = useState('');
  const [detectedProvider, setDetectedProvider] = useState<MediaProvider | null>(null);
  const [detectedType, setDetectedType] = useState<MediaType>('IMAGE');
  const [normalizedPreviewUrl, setNormalizedPreviewUrl] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newAlt, setNewAlt] = useState('');
  const [newCaption, setNewCaption] = useState('');
  const [newRole, setNewRole] = useState<MediaRole>('PRIMARY');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch media from server API
  const fetchMedia = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/admin/media');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.assets)) {
          setMediaList(data.assets);
          setStats(data.stats);
          return;
        }
      }
    } catch {
      // fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMedia();
  }, []);

  // Handle URL change in Add Modal with live auto-detection and validation
  const handleUrlChange = (val: string) => {
    setInputUrl(val);
    setValidationError(null);

    if (!val.trim()) {
      setDetectedProvider(null);
      setNormalizedPreviewUrl('');
      return;
    }

    const adapter = detectProviderAdapter(val);
    if (adapter) {
      setDetectedProvider(adapter.provider);
      const validation = adapter.validate(val);
      if (validation.isValid && validation.normalized) {
        setDetectedType(validation.normalized.mediaType);
        setNormalizedPreviewUrl(validation.normalized.normalizedUrl);
        if (!newTitle && validation.normalized.suggestedTitle) {
          setNewTitle(validation.normalized.suggestedTitle);
        }
        if (!newAlt && validation.normalized.suggestedAlt) {
          setNewAlt(validation.normalized.suggestedAlt);
        }
      } else {
        setValidationError(validation.reason || 'Invalid URL format');
        setNormalizedPreviewUrl('');
      }
    } else {
      const genericVal = validateAndNormalizeMediaUrl(val);
      if (genericVal.isValid && genericVal.normalized) {
        setDetectedProvider(genericVal.normalized.provider);
        setDetectedType(genericVal.normalized.mediaType);
        setNormalizedPreviewUrl(genericVal.normalized.normalizedUrl);
      } else {
        setDetectedProvider(null);
        setNormalizedPreviewUrl('');
        setValidationError(
          genericVal.reason ||
            'Host not supported. Use Blogger, YouTube, Google Drive, ImageKit, or Cloudinary.'
        );
      }
    }
  };

  const handleCopy = (id: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRegisterMedia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim() || !newAlt.trim()) return;

    setIsSubmitting(true);
    setValidationError(null);

    try {
      const payload = {
        url: inputUrl.trim(),
        altText: newAlt.trim(),
        title: newTitle.trim(),
        caption: newCaption.trim(),
        role: newRole,
        provider: detectedProvider || 'EXTERNAL_HTTPS',
        mediaType: detectedType,
      };

      const res = await fetch('/api/admin/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setValidationError(data.error || 'Failed to register external media asset');
        setIsSubmitting(false);
        return;
      }

      // Add to list and close modal
      setMediaList((prev) => [data.asset, ...prev]);
      setShowAddModal(false);
      resetAddForm();
      fetchMedia();
    } catch (err: any) {
      setValidationError(err?.message || 'Network error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetAddForm = () => {
    setInputUrl('');
    setNewTitle('');
    setNewAlt('');
    setNewCaption('');
    setNewRole('PRIMARY');
    setDetectedProvider(null);
    setDetectedType('IMAGE');
    setNormalizedPreviewUrl('');
    setValidationError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMedia) return;

    try {
      setIsSubmitting(true);
      const res = await fetch(`/api/admin/media/${editingMedia.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingMedia),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setMediaList((prev) =>
          prev.map((item) => (item.id === editingMedia.id ? data.asset : item))
        );
        setEditingMedia(null);
        fetchMedia();
      } else {
        alert(data.error || 'Failed to update media asset');
      }
    } catch {
      alert('Error updating media asset');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingMedia) return;

    try {
      setIsSubmitting(true);
      const res = await fetch(`/api/admin/media/${deletingMedia.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setMediaList((prev) => prev.filter((m) => m.id !== deletingMedia.id));
        setDeletingMedia(null);
        fetchMedia();
      } else {
        alert(data.error || 'Failed to delete media asset');
      }
    } catch {
      alert('Error deleting media reference');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (media: ExternalMedia) => {
    const nextStatus = media.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    const nextIsActive = nextStatus === 'ACTIVE';

    try {
      const res = await fetch(`/api/admin/media/${media.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: nextStatus,
          isActive: nextIsActive,
        }),
      });

      if (res.ok) {
        setMediaList((prev) =>
          prev.map((m) =>
            m.id === media.id ? { ...m, status: nextStatus, isActive: nextIsActive } : m
          )
        );
      }
    } catch {
      // ignore
    }
  };

  // Filtered List
  const filteredMedia = useMemo(() => {
    return mediaList.filter((m) => {
      // Provider filter
      if (selectedProvider !== 'ALL' && m.provider !== selectedProvider) {
        return false;
      }
      // Type filter
      if (selectedType !== 'ALL') {
        const type = m.mediaType || 'IMAGE';
        if (type !== selectedType) return false;
      }
      // Status filter
      if (selectedStatus !== 'ALL') {
        const currentStatus = m.status || (m.isActive ? 'ACTIVE' : 'DISABLED');
        if (currentStatus !== selectedStatus) return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches =
          m.altText.toLowerCase().includes(q) ||
          (m.title && m.title.toLowerCase().includes(q)) ||
          m.externalUrl.toLowerCase().includes(q) ||
          (m.caption && m.caption.toLowerCase().includes(q));
        if (!matches) return false;
      }
      return true;
    });
  }, [mediaList, selectedProvider, selectedType, selectedStatus, searchQuery]);

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <AdminHeader />

      <main className="flex-1 p-3 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6 overflow-x-hidden min-w-0">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6 min-w-0">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-xl sm:text-2xl font-bold text-primary tracking-tight break-words">
                External Media Library & CDN Registry
              </h1>
              <span className="text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2.5 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                PRD 05 Compliant
              </span>
            </div>
            <p className="text-xs text-muted mt-1 leading-relaxed break-words">
              Zero-binary architecture: media is physically hosted on Blogger, YouTube, Google
              Drive, ImageKit, or Cloudinary. Only lightweight metadata and public HTTPS URLs are
              stored.
            </p>
          </div>

          <button
            onClick={() => {
              resetAddForm();
              setShowAddModal(true);
            }}
            className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-colors uppercase tracking-wider shadow-sm self-start sm:self-auto shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Register External Asset</span>
          </button>
        </div>

        {/* Analytics & Metrics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 min-w-0">
          <div className="bg-surface rounded-2xl border border-border p-3 sm:p-4 shadow-sm min-w-0">
            <span className="text-[10px] sm:text-[11px] font-bold text-muted uppercase tracking-wider block truncate">
              Total Assets
            </span>
            <span className="text-xl sm:text-2xl font-bold text-primary mt-1 block">
              {stats?.totalAssets ?? mediaList.length}
            </span>
          </div>

          <div className="bg-surface rounded-2xl border border-border p-3 sm:p-4 shadow-sm min-w-0">
            <span className="text-[10px] sm:text-[11px] font-bold text-emerald-600 uppercase tracking-wider block truncate">
              Active Assets
            </span>
            <span className="text-xl sm:text-2xl font-bold text-emerald-700 mt-1 block">
              {stats?.activeAssets ?? mediaList.filter((m) => m.isActive).length}
            </span>
          </div>

          <div className="bg-surface rounded-2xl border border-border p-3 sm:p-4 shadow-sm min-w-0">
            <span className="text-[10px] sm:text-[11px] font-bold text-sky-600 uppercase tracking-wider block truncate">
              Images
            </span>
            <span className="text-xl sm:text-2xl font-bold text-sky-700 mt-1 block">
              {stats?.imageCount ??
                mediaList.filter((m) => (m.mediaType || 'IMAGE') === 'IMAGE').length}
            </span>
          </div>

          <div className="bg-surface rounded-2xl border border-border p-3 sm:p-4 shadow-sm min-w-0">
            <span className="text-[10px] sm:text-[11px] font-bold text-rose-600 uppercase tracking-wider block truncate">
              YouTube Videos
            </span>
            <span className="text-xl sm:text-2xl font-bold text-rose-700 mt-1 block">
              {stats?.videoCount ??
                mediaList.filter((m) => m.mediaType === 'VIDEO').length}
            </span>
          </div>

          <div className="bg-surface rounded-2xl border border-border p-3 sm:p-4 shadow-sm min-w-0">
            <span className="text-[10px] sm:text-[11px] font-bold text-indigo-600 uppercase tracking-wider block truncate">
              Drive Certificates
            </span>
            <span className="text-xl sm:text-2xl font-bold text-indigo-700 mt-1 block">
              {stats?.documentCount ??
                mediaList.filter((m) => m.mediaType === 'DOCUMENT' || m.mediaType === 'PDF').length}
            </span>
          </div>

          <div className="bg-surface rounded-2xl border border-border p-3 sm:p-4 shadow-sm min-w-0">
            <span className="text-[10px] sm:text-[11px] font-bold text-amber-600 uppercase tracking-wider block truncate">
              Supported CDNs
            </span>
            <span className="text-xl sm:text-2xl font-bold text-amber-700 mt-1 block">
              {stats?.providerDistribution ? Object.keys(stats.providerDistribution).length : 5}
            </span>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="bg-surface rounded-2xl border border-border p-3 sm:p-4 shadow-sm space-y-3 min-w-0">
          <div className="flex flex-col lg:flex-row gap-2.5 sm:gap-3 min-w-0">
            {/* Search Input */}
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search title, alt, or URL..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-surface-dim border border-border rounded-xl text-xs text-primary placeholder:text-muted focus:outline-none focus:border-accent"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-primary"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Provider Filter */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1 sm:gap-2 w-full lg:w-auto min-w-0">
              <label className="text-[11px] font-semibold text-muted shrink-0">Provider:</label>
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                className="w-full sm:w-auto px-2.5 py-1.5 bg-surface-dim border border-border rounded-xl text-xs text-primary font-medium focus:outline-none focus:border-accent truncate"
              >
                <option value="ALL">All Providers</option>
                <option value="BLOGGER">Blogger</option>
                <option value="YOUTUBE">YouTube</option>
                <option value="GOOGLE_DRIVE">Google Drive</option>
                <option value="IMAGEKIT">ImageKit</option>
                <option value="CLOUDINARY">Cloudinary</option>
                <option value="EXTERNAL_HTTPS">Other CDNs</option>
              </select>
            </div>

            {/* Media Type Filter */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1 sm:gap-2 w-full lg:w-auto min-w-0">
              <label className="text-[11px] font-semibold text-muted shrink-0">Type:</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full sm:w-auto px-2.5 py-1.5 bg-surface-dim border border-border rounded-xl text-xs text-primary font-medium focus:outline-none focus:border-accent"
              >
                <option value="ALL">All Types</option>
                <option value="IMAGE">Images</option>
                <option value="VIDEO">Videos</option>
                <option value="DOCUMENT">Documents</option>
                <option value="AUDIO">Audio</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1 sm:gap-2 w-full lg:w-auto min-w-0">
              <label className="text-[11px] font-semibold text-muted shrink-0">Status:</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full sm:w-auto px-2.5 py-1.5 bg-surface-dim border border-border rounded-xl text-xs text-primary font-medium focus:outline-none focus:border-accent"
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="DISABLED">Disabled</option>
              </select>
            </div>
          </div>
        </div>

        {/* Media Grid */}
        {filteredMedia.length === 0 ? (
          <div className="bg-surface rounded-3xl border border-dashed border-border p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-surface-dim text-muted mx-auto flex items-center justify-center">
              <ImageIcon className="w-6 h-6" />
            </div>
            <h3 className="font-display font-bold text-base text-primary">No External Media Found</h3>
            <p className="text-xs text-muted max-w-sm mx-auto">
              {searchQuery || selectedProvider !== 'ALL' || selectedType !== 'ALL'
                ? 'No media assets matched the selected filters. Try clearing filters or entering another keyword.'
                : 'No external media assets are currently registered in the database.'}
            </p>
            {(searchQuery || selectedProvider !== 'ALL' || selectedType !== 'ALL') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedProvider('ALL');
                  setSelectedType('ALL');
                  setSelectedStatus('ALL');
                }}
                className="px-4 py-2 bg-surface-dim hover:bg-border text-primary text-xs font-bold rounded-xl transition-colors"
              >
                Clear All Filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredMedia.map((media) => {
              const isMediaVideo = media.mediaType === 'VIDEO';
              const isMediaDoc = media.mediaType === 'DOCUMENT' || media.mediaType === 'PDF';
              const isMediaAudio = media.mediaType === 'AUDIO';

              return (
                <div
                  key={media.id}
                  className={`bg-surface rounded-2xl border transition-all overflow-hidden shadow-sm flex flex-col justify-between group ${
                    media.isActive ? 'border-border' : 'border-rose-300 dark:border-rose-900/50 opacity-80'
                  }`}
                >
                  <div>
                    {/* Media Preview Box */}
                    <div className="relative aspect-video w-full bg-surface-dim overflow-hidden border-b border-border">
                      {isMediaVideo ? (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-black/90 p-3 text-center">
                          <Video className="w-8 h-8 text-rose-500 mb-1" />
                          <span className="text-[11px] font-bold text-white truncate max-w-[90%]">
                            {media.title || 'YouTube Demonstration'}
                          </span>
                        </div>
                      ) : isMediaDoc ? (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-emerald-500/10 p-3 text-center">
                          <FileText className="w-8 h-8 text-emerald-600 mb-1" />
                          <span className="text-[11px] font-bold text-primary truncate max-w-[90%]">
                            {media.title || 'Purity NMR Report (PDF)'}
                          </span>
                        </div>
                      ) : isMediaAudio ? (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-accent/10 p-3 text-center">
                          <Music className="w-8 h-8 text-accent mb-1" />
                          <span className="text-[11px] font-bold text-primary truncate max-w-[90%]">
                            {media.title || 'Field Audio Guide'}
                          </span>
                        </div>
                      ) : (
                        <ExternalImage
                          src={media.externalUrl}
                          alt={media.altText}
                          aspectRatio="video"
                          className="w-full h-full group-hover:scale-105 transition-transform duration-300"
                        />
                      )}

                      {/* Provider Badge */}
                      <span className="absolute top-2.5 left-2.5 bg-black/75 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                        <Globe className="w-2.5 h-2.5 text-accent" />
                        <span>{media.provider}</span>
                      </span>

                      {/* Role Badge */}
                      <span className="absolute top-2.5 right-2.5 bg-white/95 dark:bg-stone-900/90 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                        {media.role}
                      </span>
                    </div>

                    {/* Metadata Content */}
                    <div className="p-4 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-primary truncate" title={media.title || media.altText}>
                          {media.title || media.altText}
                        </p>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                            media.isActive
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {media.isActive ? 'Active' : 'Disabled'}
                        </span>
                      </div>

                      <p className="text-[11px] text-muted line-clamp-1" title={media.altText}>
                        Alt: {media.altText}
                      </p>

                      <p className="font-mono text-[10px] text-muted truncate" title={media.externalUrl}>
                        {media.externalUrl}
                      </p>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="p-4 pt-0">
                    <div className="pt-3 border-t border-border flex items-center justify-between text-xs">
                      {/* Copy URL */}
                      <button
                        onClick={() => handleCopy(media.id, media.externalUrl)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
                        title="Copy direct external HTTPS URL"
                      >
                        {copiedId === media.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span className="text-emerald-700">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy URL</span>
                          </>
                        )}
                      </button>

                      {/* Edit, Toggle, and Delete */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleToggleStatus(media)}
                          className={`p-1.5 rounded text-xs transition-colors ${
                            media.isActive
                              ? 'text-muted hover:text-amber-600'
                              : 'text-emerald-600 hover:text-emerald-700'
                          }`}
                          title={media.isActive ? 'Disable asset' : 'Activate asset'}
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => setEditingMedia(media)}
                          className="p-1.5 text-muted hover:text-primary rounded transition-colors"
                          title="Edit metadata"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => setDeletingMedia(media)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors"
                          title="Delete external asset reference"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ========================================================================= */}
        {/* Register External Media Asset Modal */}
        {/* ========================================================================= */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-sm overflow-y-auto">
            <div className="bg-surface rounded-3xl border border-border p-6 sm:p-8 max-w-lg w-full shadow-2xl my-8">
              <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
                <div>
                  <h3 className="font-display text-lg font-bold text-primary">
                    Register External Media Asset
                  </h3>
                  <p className="text-xs text-muted mt-0.5">
                    Zero Media Binaries Architecture: Paste a public HTTPS link from an approved provider.
                  </p>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-1.5 text-muted hover:text-primary rounded-xl"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleRegisterMedia} className="space-y-4 text-xs">
                {/* External URL Input */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-primary">External HTTPS URL *</label>
                    {detectedProvider && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                        <span>Detected: {detectedProvider}</span>
                      </span>
                    )}
                  </div>
                  <input
                    type="url"
                    required
                    value={inputUrl}
                    onChange={(e) => handleUrlChange(e.target.value)}
                    placeholder="https://blogger.googleusercontent.com/... or https://youtu.be/..."
                    className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent font-mono text-[11px]"
                  />
                  {validationError && (
                    <p className="text-[11px] text-rose-600 mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      <span>{validationError}</span>
                    </p>
                  )}
                </div>

                {/* Live Preview Container */}
                {normalizedPreviewUrl && (
                  <div className="p-3 bg-surface-dim rounded-2xl border border-border space-y-2">
                    <span className="text-[10px] font-bold text-muted uppercase tracking-wider block">
                      Live Normalized Preview
                    </span>
                    <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-border bg-black/5 flex items-center justify-center">
                      {detectedType === 'VIDEO' ? (
                        <ExternalVideo url={normalizedPreviewUrl} title={newTitle || 'Preview'} />
                      ) : detectedType === 'DOCUMENT' || detectedType === 'PDF' ? (
                        <ExternalDocument url={normalizedPreviewUrl} title={newTitle || 'Lab Certificate'} />
                      ) : (
                        <ExternalImage
                          src={normalizedPreviewUrl}
                          alt={newAlt || 'Preview'}
                          aspectRatio="video"
                          className="w-full h-full"
                        />
                      )}
                    </div>
                  </div>
                )}

                {/* Title */}
                <div>
                  <label className="block font-semibold text-primary mb-1">Asset Title</label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. 100% Kashmiri Honey Raw Batch Extraction"
                    className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                  />
                </div>

                {/* Alt Text */}
                <div>
                  <label className="block font-semibold text-primary mb-1">Descriptive Alt Text *</label>
                  <input
                    type="text"
                    required
                    value={newAlt}
                    onChange={(e) => setNewAlt(e.target.value)}
                    placeholder="e.g. Kashmiri Honey pure taste glass jar in sunlight"
                    className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                  />
                </div>

                {/* Caption */}
                <div>
                  <label className="block font-semibold text-primary mb-1">Caption / Story Note</label>
                  <textarea
                    rows={2}
                    value={newCaption}
                    onChange={(e) => setNewCaption(e.target.value)}
                    placeholder="Optional editorial story note or source description..."
                    className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent resize-none"
                  />
                </div>

                {/* Role and Media Type Selection */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-primary mb-1">Media Role</label>
                    <select
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value as MediaRole)}
                      className="w-full px-3 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    >
                      <option value="PRIMARY">PRIMARY (Main Product Card)</option>
                      <option value="GALLERY">GALLERY (Carousel Thumbnail)</option>
                      <option value="VIDEO">VIDEO (Product Demonstration)</option>
                      <option value="CERTIFICATE">CERTIFICATE (Purity Report)</option>
                      <option value="DOCUMENT">DOCUMENT (PDF Specification)</option>
                      <option value="BANNER">BANNER (Header/Feature)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-primary mb-1">Media Type</label>
                    <select
                      value={detectedType}
                      onChange={(e) => setDetectedType(e.target.value as MediaType)}
                      className="w-full px-3 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    >
                      <option value="IMAGE">IMAGE</option>
                      <option value="VIDEO">VIDEO</option>
                      <option value="DOCUMENT">DOCUMENT / PDF</option>
                      <option value="AUDIO">AUDIO</option>
                    </select>
                  </div>
                </div>

                {/* Submission Actions */}
                <div className="flex justify-end gap-2.5 pt-4 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-5 py-2.5 bg-surface-dim hover:bg-border text-primary rounded-xl font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !!validationError || !inputUrl.trim()}
                    className="px-6 py-2.5 bg-accent hover:bg-accent-hover text-white font-bold rounded-xl disabled:opacity-50 transition-colors shadow-sm"
                  >
                    {isSubmitting ? 'Registering...' : 'Register Asset'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* Edit Media Metadata Modal */}
        {/* ========================================================================= */}
        {editingMedia && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-sm">
            <div className="bg-surface rounded-3xl border border-border p-6 sm:p-8 max-w-md w-full shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
                <h3 className="font-display text-base font-bold text-primary">
                  Edit Media Metadata
                </h3>
                <button
                  onClick={() => setEditingMedia(null)}
                  className="p-1.5 text-muted hover:text-primary rounded-xl"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-primary mb-1">Asset Title</label>
                  <input
                    type="text"
                    value={editingMedia.title || ''}
                    onChange={(e) =>
                      setEditingMedia({ ...editingMedia, title: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-primary mb-1">Alt Text *</label>
                  <input
                    type="text"
                    required
                    value={editingMedia.altText}
                    onChange={(e) =>
                      setEditingMedia({ ...editingMedia, altText: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-primary mb-1">Caption</label>
                  <textarea
                    rows={2}
                    value={editingMedia.caption || ''}
                    onChange={(e) =>
                      setEditingMedia({ ...editingMedia, caption: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-primary mb-1">Media Role</label>
                    <select
                      value={editingMedia.role}
                      onChange={(e) =>
                        setEditingMedia({ ...editingMedia, role: e.target.value as MediaRole })
                      }
                      className="w-full px-3 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    >
                      <option value="PRIMARY">PRIMARY</option>
                      <option value="GALLERY">GALLERY</option>
                      <option value="VIDEO">VIDEO</option>
                      <option value="CERTIFICATE">CERTIFICATE</option>
                      <option value="DOCUMENT">DOCUMENT</option>
                      <option value="BANNER">BANNER</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-primary mb-1">Status</label>
                    <select
                      value={editingMedia.status || (editingMedia.isActive ? 'ACTIVE' : 'DISABLED')}
                      onChange={(e) =>
                        setEditingMedia({
                          ...editingMedia,
                          status: e.target.value as any,
                          isActive: e.target.value === 'ACTIVE',
                        })
                      }
                      className="w-full px-3 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="DISABLED">DISABLED</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setEditingMedia(null)}
                    className="px-4 py-2 bg-surface-dim hover:bg-border text-primary rounded-xl font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 bg-accent hover:bg-accent-hover text-white font-bold rounded-xl"
                  >
                    {isSubmitting ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* Delete Confirmation Modal (Section 12.4) */}
        {/* ========================================================================= */}
        {deletingMedia && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-sm">
            <div className="bg-surface rounded-3xl border border-border p-6 max-w-sm w-full shadow-2xl space-y-4">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-600 flex items-center justify-center">
                <Trash2 className="w-6 h-6" />
              </div>

              <div>
                <h3 className="font-display text-base font-bold text-primary mb-1">
                  Remove External Asset Reference?
                </h3>
                <p className="text-xs text-muted leading-relaxed">
                  Deleting this reference removes it from InfiniCharm. Notice:{' '}
                  <span className="font-semibold text-primary">
                    The original file on Blogger/YouTube/Drive remains completely untouched.
                  </span>
                </p>
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setDeletingMedia(null)}
                  className="px-4 py-2 bg-surface-dim hover:bg-border text-primary rounded-xl font-medium text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-sm"
                >
                  {isSubmitting ? 'Removing...' : 'Confirm Remove'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
