'use client';

// ==============================================================================
// InfiniCharm — Administrative Backup, Restore, Import & Export Hub
// Design: Warm Editorial Styling, Responsive across 10 viewports, Zero Fake Data
// ==============================================================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import {
  Database,
  Download,
  Upload,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  FileText,
  FileSpreadsheet,
  ShieldCheck,
  HardDrive,
  Clock,
  Layers,
  ArrowRight,
  Copy,
  Check,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Lock,
} from 'lucide-react';
import type { BackupArchiveMeta, BackupSectionKey, CollectionKey } from '@/lib/server/backup-service';

interface BackupSummary {
  totalBackups: number;
  totalStorageBytes: number;
  lastBackupAt: string | null;
  lastBackupType: string | null;
}

interface SectionInfo {
  key: BackupSectionKey;
  label: string;
  description: string;
  collections: CollectionKey[];
}

const AVAILABLE_COLLECTIONS: Array<{ key: CollectionKey; label: string }> = [
  { key: 'products', label: 'Products Catalogue' },
  { key: 'categories', label: 'Product Categories' },
  { key: 'customers', label: 'Customer Accounts' },
  { key: 'orders', label: 'Customer Orders' },
  { key: 'coupons', label: 'Discount Coupons' },
  { key: 'reviews', label: 'Customer Reviews' },
  { key: 'newsletter_subscribers', label: 'Newsletter Subscribers' },
  { key: 'email_templates', label: 'Email Templates' },
  { key: 'announcements', label: 'Announcement Bars' },
  { key: 'payment_gateways', label: 'Payment Gateways' },
  { key: 'social_and_share_settings', label: 'Social & Share Config' },
  { key: 'inquiries', label: 'Contact Inquiries' },
];

export default function AdminBackupPage() {
  const [activeTab, setActiveTab] = useState<'create' | 'restore' | 'import_export' | 'history'>('create');
  const [backups, setBackups] = useState<BackupArchiveMeta[]>([]);
  const [sections, setSections] = useState<SectionInfo[]>([]);
  const [summary, setSummary] = useState<BackupSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedChecksum, setCopiedChecksum] = useState<string | null>(null);

  // Create Backup state
  const [backupNote, setBackupNote] = useState('');

  // Restore state
  const [restoreSource, setRestoreSource] = useState<'existing' | 'upload'>('existing');
  const [selectedBackupId, setSelectedBackupId] = useState<string>('');
  const [uploadedFileContent, setUploadedFileContent] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [validationReport, setValidationReport] = useState<any | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [restoreResult, setRestoreResult] = useState<any | null>(null);

  // Import / Export state
  const [selectedCollection, setSelectedCollection] = useState<CollectionKey>('products');
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('csv');
  const [importFormat, setImportFormat] = useState<'json' | 'csv'>('csv');
  const [importStrategy, setImportStrategy] = useState<'SKIP' | 'OVERWRITE' | 'MERGE'>('SKIP');
  const [importContent, setImportContent] = useState('');
  const [importPreview, setImportPreview] = useState<any | null>(null);
  const [isImportPreviewing, setIsImportPreviewing] = useState(false);
  const [importResult, setImportResult] = useState<any | null>(null);

  // Load backups list
  const loadBackups = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/backup', { cache: 'no-store' });
      if (res.status === 401) {
        window.location.href = `/admin/login?redirect=${encodeURIComponent(window.location.pathname)}`;
        return;
      }
      const data = await res.json();
      if (data.success) {
        setBackups(data.backups || []);
        setSections(data.sections || []);
        setSummary(data.summary || null);
        if (data.backups && data.backups.length > 0 && !selectedBackupId) {
          setSelectedBackupId(data.backups[0].backupId);
        }
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Failed to load backups.' });
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Network error connecting to backup service.' });
    } finally {
      setIsLoading(false);
    }
  }, [selectedBackupId]);

  useEffect(() => {
    loadBackups();
  }, [loadBackups]);

  const handleCopyChecksum = (checksum: string) => {
    navigator.clipboard.writeText(checksum);
    setCopiedChecksum(checksum);
    setTimeout(() => setCopiedChecksum(null), 2500);
  };

  // 1. Create Full or Section Backup
  const handleCreateBackup = async (type: 'FULL' | 'SECTION', sectionKey?: BackupSectionKey) => {
    setActionLoading(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/admin/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          section: sectionKey,
          note: backupNote.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMessage({ type: 'success', text: data.message });
        setBackupNote('');
        setActiveTab('history');
        await loadBackups();
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Failed to generate backup.' });
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Error dispatching backup generation request.' });
    } finally {
      setActionLoading(false);
    }
  };

  // 2. Delete Backup
  const handleDeleteBackup = async (id: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete backup archive ${id}?`)) {
      return;
    }
    setActionLoading(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/admin/backup/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMessage({ type: 'success', text: `Backup ${id} deleted successfully.` });
        await loadBackups();
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Failed to delete backup.' });
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Network error deleting backup.' });
    } finally {
      setActionLoading(false);
    }
  };

  // 3. Validate Backup Before Restore
  const handleValidateBackup = async () => {
    setIsValidating(true);
    setValidationReport(null);
    setRestoreResult(null);
    setStatusMessage(null);
    try {
      let body: any = {};
      if (restoreSource === 'upload') {
        if (!uploadedFileContent) {
          setStatusMessage({ type: 'error', text: 'Please select a valid .json backup file first.' });
          setIsValidating(false);
          return;
        }
        try {
          body.archive = JSON.parse(uploadedFileContent);
        } catch {
          setStatusMessage({ type: 'error', text: 'Uploaded file is not valid JSON.' });
          setIsValidating(false);
          return;
        }
      } else {
        if (!selectedBackupId) {
          setStatusMessage({ type: 'error', text: 'Please choose an existing backup archive.' });
          setIsValidating(false);
          return;
        }
        body.backupId = selectedBackupId;
      }

      const res = await fetch('/api/admin/backup/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok && data.success && data.report) {
        setValidationReport(data.report);
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Backup validation failed.' });
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Error contacting backup validation service.' });
    } finally {
      setIsValidating(false);
    }
  };

  // 4. Commit Restore
  const handleCommitRestore = async () => {
    setActionLoading(true);
    setStatusMessage(null);
    try {
      let body: any = {};
      if (restoreSource === 'upload') {
        body.archive = JSON.parse(uploadedFileContent!);
      } else {
        body.backupId = selectedBackupId;
      }

      const res = await fetch('/api/admin/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRestoreResult(data.result);
        setRestoreModalOpen(false);
        setStatusMessage({
          type: 'success',
          text: `${data.message} Rollback snapshot saved: ${data.result.rollbackSnapshotId || 'Yes'}`,
        });
        await loadBackups();
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'System restoration failed.' });
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Error communicating with restoration endpoint.' });
    } finally {
      setActionLoading(false);
    }
  };

  // 5. Handle File Upload for Restore
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setUploadedFileContent(content);
      setValidationReport(null);
      setRestoreResult(null);
    };
    reader.readAsText(file);
  };

  // 6. Handle Import File Selection
  const handleImportFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isCsv = file.name.endsWith('.csv');
    setImportFormat(isCsv ? 'csv' : 'json');
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setImportContent(content);
      setImportPreview(null);
      setImportResult(null);
    };
    reader.readAsText(file);
  };

  // 7. Preview Import
  const handlePreviewImport = async () => {
    if (!importContent.trim()) {
      setStatusMessage({ type: 'error', text: 'Please paste or upload data to import.' });
      return;
    }
    setIsImportPreviewing(true);
    setImportPreview(null);
    setImportResult(null);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/admin/backup/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collectionKey: selectedCollection,
          format: importFormat,
          content: importContent,
          strategy: importStrategy,
          dryRun: true,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.preview) {
        setImportPreview(data.preview);
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Failed to preview import.' });
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Network error validating import payload.' });
    } finally {
      setIsImportPreviewing(false);
    }
  };

  // 8. Commit Import
  const handleCommitImport = async () => {
    setActionLoading(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/admin/backup/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collectionKey: selectedCollection,
          format: importFormat,
          content: importContent,
          strategy: importStrategy,
          dryRun: false,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setImportResult(data.result);
        setStatusMessage({ type: 'success', text: data.message });
        setImportContent('');
        setImportPreview(null);
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Failed to commit import.' });
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Network error committing import data.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Format bytes to human readable
  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  return (
    <div className="min-h-screen bg-canvas text-primary pb-16">
      <AdminHeader />

      <Container className="py-6 sm:py-8 space-y-6 max-w-6xl">
        {/* Header Title & Status Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-accent/10 text-accent">
                <Database className="w-5 h-5" />
              </span>
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-primary">
                Backup, Restore &amp; Data Hub
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-muted">
              Authoritative full project archiving, granular section backups, SHA-256 integrity verification, and safe rollback restores.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadBackups}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-3 py-2 bg-surface hover:bg-surface-dim border border-border text-xs font-semibold rounded-xl transition-colors shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Global Feedback Alert */}
        {statusMessage && (
          <div
            className={`p-4 rounded-2xl border text-xs sm:text-sm flex items-start gap-3 shadow-xs animate-in fade-in duration-200 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 font-medium">{statusMessage.text}</div>
            <button
              type="button"
              onClick={() => setStatusMessage(null)}
              className="text-xs underline hover:no-underline font-semibold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* System Summary KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card level={1} className="p-4 sm:p-5 space-y-1.5">
            <div className="flex items-center justify-between text-muted">
              <span className="text-[11px] font-bold uppercase tracking-wider">Total Backups</span>
              <Database className="w-4 h-4 text-accent" />
            </div>
            <p className="text-xl sm:text-2xl font-bold font-mono text-primary">
              {summary ? summary.totalBackups : '—'}
            </p>
            <p className="text-[11px] text-muted">Stored on disk</p>
          </Card>

          <Card level={1} className="p-4 sm:p-5 space-y-1.5">
            <div className="flex items-center justify-between text-muted">
              <span className="text-[11px] font-bold uppercase tracking-wider">Storage Footprint</span>
              <HardDrive className="w-4 h-4 text-accent" />
            </div>
            <p className="text-xl sm:text-2xl font-bold font-mono text-primary">
              {summary ? formatBytes(summary.totalStorageBytes) : '—'}
            </p>
            <p className="text-[11px] text-muted">Total archive size</p>
          </Card>

          <Card level={1} className="p-4 sm:p-5 space-y-1.5">
            <div className="flex items-center justify-between text-muted">
              <span className="text-[11px] font-bold uppercase tracking-wider">Last Archive</span>
              <Clock className="w-4 h-4 text-accent" />
            </div>
            <p className="text-xs sm:text-sm font-bold font-mono text-primary truncate">
              {summary?.lastBackupAt ? new Date(summary.lastBackupAt).toLocaleDateString('en-IN') : 'None yet'}
            </p>
            <p className="text-[11px] text-muted truncate">
              {summary?.lastBackupType ? `Type: ${summary.lastBackupType}` : 'No backups recorded'}
            </p>
          </Card>

          <Card level={1} className="p-4 sm:p-5 space-y-1.5">
            <div className="flex items-center justify-between text-muted">
              <span className="text-[11px] font-bold uppercase tracking-wider">Security &amp; Privacy</span>
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-xs sm:text-sm font-bold text-emerald-700">Zero Secret Exposure</p>
            <p className="text-[11px] text-muted">Passwords &amp; tokens redacted</p>
          </Card>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-border gap-2 overflow-x-auto pb-px">
          {[
            { id: 'create', testId: 'tab-create', label: '1. Create Backup', icon: Database },
            { id: 'restore', testId: 'tab-restore', label: '2. Restore System', icon: RefreshCw },
            { id: 'import_export', testId: 'tab-import-export', label: '3. Import & Export', icon: FileSpreadsheet },
            { id: 'history', testId: 'tab-history', label: `4. Archive History (${backups.length})`, icon: Clock },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                data-testid={tab.testId}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold whitespace-nowrap border-b-2 transition-all ${
                  isActive
                    ? 'border-accent text-accent'
                    : 'border-transparent text-muted hover:text-primary hover:border-border'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: CREATE BACKUP */}
        {activeTab === 'create' && (
          <div className="space-y-6">
            {/* Full Website Backup Hero Banner */}
            <Card level={2} className="p-6 sm:p-8 bg-gradient-to-br from-surface via-surface to-surface-dim border-border space-y-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-2 max-w-2xl">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent text-[11px] font-bold uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Recommended Production Snapshot</span>
                  </span>
                  <h2 className="font-display text-xl sm:text-2xl font-bold text-primary">
                    Full Marketplace &amp; Project Backup
                  </h2>
                  <p className="text-xs sm:text-sm text-muted leading-relaxed">
                    Instantly archives all 22 single-source-of-truth collections across products, categories, orders, customers, coupons, reviews, announcements, CMS sections, email templates, and configurations. Media references are external URLs with zero server binary bloating.
                  </p>
                </div>

                <div className="shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <button
                    type="button"
                    data-testid="create-full-backup-btn"
                    onClick={() => handleCreateBackup('FULL')}
                    disabled={actionLoading}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-accent hover:bg-accent-hover text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-md disabled:opacity-50"
                  >
                    <Database className="w-4 h-4" />
                    <span>{actionLoading ? 'Creating Backup...' : 'Create Full Backup Now'}</span>
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-border flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <input
                  type="text"
                  placeholder="Optional note (e.g. Pre-deployment baseline snapshot)"
                  value={backupNote}
                  onChange={(e) => setBackupNote(e.target.value)}
                  className="flex-1 bg-canvas border border-border rounded-xl px-3.5 py-2 text-xs text-primary placeholder:text-muted focus:outline-none focus:border-accent"
                />
              </div>
            </Card>

            {/* Section-Wise Granular Backups */}
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="font-display text-lg font-bold text-primary">Section-Wise Granular Backups</h3>
                <p className="text-xs text-muted">
                  Create targeted backup packages for individual modules without downloading the entire website database.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sections.map((sec) => (
                  <Card key={sec.key} level={1} className="p-5 flex flex-col justify-between space-y-4 hover:border-accent/40 transition-colors">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="p-2 rounded-lg bg-surface-dim text-accent">
                          <Layers className="w-4 h-4" />
                        </span>
                        <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-surface-dim text-muted">
                          {sec.collections.length} tables
                        </span>
                      </div>
                      <h4 className="font-display text-sm font-bold text-primary">{sec.label}</h4>
                      <p className="text-xs text-muted leading-relaxed">{sec.description}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCreateBackup('SECTION', sec.key)}
                      disabled={actionLoading}
                      className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-4 bg-surface-dim hover:bg-surface-container border border-border text-xs font-bold text-primary rounded-xl transition-colors disabled:opacity-50"
                    >
                      <span>Backup {sec.label}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-accent" />
                    </button>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: RESTORE SYSTEM */}
        {activeTab === 'restore' && (
          <div className="space-y-6">
            <Card level={1} className="p-6 space-y-6">
              <div className="space-y-1">
                <h2 className="font-display text-lg font-bold text-primary">System Restoration Engine</h2>
                <p className="text-xs text-muted">
                  Safely restores your website database from an authorized backup archive. Every restoration includes automatic integrity verification and generates an instant rollback snapshot.
                </p>
              </div>

              {/* Source Picker */}
              <div className="flex gap-4 border-b border-border pb-4">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-primary">
                  <input
                    type="radio"
                    name="restoreSource"
                    checked={restoreSource === 'existing'}
                    onChange={() => setRestoreSource('existing')}
                    className="accent-accent"
                  />
                  <span>Select from Saved Archives</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-primary">
                  <input
                    type="radio"
                    name="restoreSource"
                    checked={restoreSource === 'upload'}
                    onChange={() => setRestoreSource('upload')}
                    className="accent-accent"
                  />
                  <span>Upload .json Backup File</span>
                </label>
              </div>

              {/* Selection Control */}
              {restoreSource === 'existing' ? (
                <div className="space-y-2 max-w-xl">
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted">
                    Choose Backup to Restore
                  </label>
                  {backups.length === 0 ? (
                    <p className="text-xs text-muted p-3 rounded-xl bg-surface-dim border border-border">
                      No backups saved yet. Create a backup first.
                    </p>
                  ) : (
                    <select
                      value={selectedBackupId}
                      onChange={(e) => {
                        setSelectedBackupId(e.target.value);
                        setValidationReport(null);
                        setRestoreResult(null);
                      }}
                      className="w-full bg-surface border border-border rounded-xl px-3.5 py-2.5 text-xs text-primary focus:outline-none focus:border-accent"
                    >
                      {backups.map((b) => (
                        <option key={b.backupId} value={b.backupId}>
                          {b.backupId} ({b.type}) — {new Date(b.createdAt).toLocaleString('en-IN')} — {b.totalRecords} records
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ) : (
                <div className="space-y-2 max-w-xl">
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted">
                    Upload Archive File (.json)
                  </label>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileUpload}
                    className="block w-full text-xs text-muted file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border file:border-border file:text-xs file:font-semibold file:bg-surface-dim file:text-primary hover:file:bg-surface-container cursor-pointer"
                  />
                  {uploadedFileName && (
                    <p className="text-xs font-mono text-accent">Selected: {uploadedFileName}</p>
                  )}
                </div>
              )}

              {/* Step 1: Validate Archive Button */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleValidateBackup}
                  disabled={isValidating || (restoreSource === 'existing' && !selectedBackupId) || (restoreSource === 'upload' && !uploadedFileContent)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50 shadow-xs"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isValidating ? 'Validating Archive...' : '1. Validate Archive Integrity'}</span>
                </button>
              </div>

              {/* Validation Report Card */}
              {validationReport && (
                <div className={`p-5 rounded-2xl border space-y-4 ${
                  validationReport.isValid
                    ? 'bg-emerald-500/5 border-emerald-500/30 text-emerald-950'
                    : 'bg-rose-500/5 border-rose-500/30 text-rose-950'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {validationReport.isValid ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-rose-600" />
                      )}
                      <h3 className="font-display text-sm font-bold">
                        {validationReport.isValid ? 'Integrity Verified: Ready for Restoration' : 'Archive Validation Failed'}
                      </h3>
                    </div>

                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                      validationReport.checksumValid ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {validationReport.checksumValid ? 'SHA-256 Valid' : 'Checksum Error'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div>
                      <span className="text-muted block text-[10px] uppercase">Archive ID</span>
                      <strong className="font-mono">{validationReport.backupId || '—'}</strong>
                    </div>
                    <div>
                      <span className="text-muted block text-[10px] uppercase">Type</span>
                      <strong>{validationReport.type || 'FULL'}</strong>
                    </div>
                    <div>
                      <span className="text-muted block text-[10px] uppercase">Total Records</span>
                      <strong className="font-mono">{validationReport.totalRecords || 0}</strong>
                    </div>
                    <div>
                      <span className="text-muted block text-[10px] uppercase">Collections</span>
                      <strong className="font-mono">{validationReport.collectionsPresent?.length || 0}</strong>
                    </div>
                  </div>

                  {validationReport.errors?.length > 0 && (
                    <div className="p-3 bg-rose-100/60 rounded-xl text-xs text-rose-900 space-y-1">
                      <p className="font-bold">Errors found:</p>
                      <ul className="list-disc pl-4 space-y-0.5">
                        {validationReport.errors.map((e: string, idx: number) => (
                          <li key={idx}>{e}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {validationReport.isValid && (
                    <div className="pt-2 flex items-center justify-between">
                      <p className="text-xs text-muted">
                        Restoration will automatically create a pre-restore rollback snapshot before updating tables.
                      </p>
                      <button
                        type="button"
                        onClick={() => setRestoreModalOpen(true)}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
                      >
                        <RefreshCw className="w-4 h-4" />
                        <span>2. Restore Database Now</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Restoration Success Summary */}
              {restoreResult && (
                <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <h3 className="font-display text-sm font-bold">Restoration Completed Successfully</h3>
                  </div>
                  <p className="text-xs leading-relaxed">{restoreResult.message}</p>
                  {restoreResult.rollbackSnapshotId && (
                    <p className="text-xs font-mono bg-emerald-100/70 p-2 rounded-lg">
                      Rollback Snapshot ID: <strong>{restoreResult.rollbackSnapshotId}</strong>
                    </p>
                  )}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* TAB 3: IMPORT & EXPORT */}
        {activeTab === 'import_export' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Export Module */}
            <Card level={1} className="p-6 space-y-5">
              <div className="space-y-1 border-b border-border pb-4">
                <div className="flex items-center gap-2">
                  <Download className="w-5 h-5 text-accent" />
                  <h2 className="font-display text-lg font-bold text-primary">Export Section Data</h2>
                </div>
                <p className="text-xs text-muted">
                  Download real records from any database collection in CSV or JSON format.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted">
                    Target Collection
                  </label>
                  <select
                    value={selectedCollection}
                    onChange={(e) => setSelectedCollection(e.target.value as CollectionKey)}
                    className="w-full bg-surface border border-border rounded-xl px-3.5 py-2.5 text-xs text-primary focus:outline-none focus:border-accent"
                  >
                    {AVAILABLE_COLLECTIONS.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.label} ({c.key})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted">
                    Export Format
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setExportFormat('csv')}
                      className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-colors ${
                        exportFormat === 'csv'
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-border bg-surface hover:bg-surface-dim text-muted'
                      }`}
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      <span>CSV (Spreadsheet)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setExportFormat('json')}
                      className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-colors ${
                        exportFormat === 'json'
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-border bg-surface hover:bg-surface-dim text-muted'
                      }`}
                    >
                      <FileText className="w-4 h-4" />
                      <span>JSON (Payload)</span>
                    </button>
                  </div>
                </div>

                <a
                  href={`/api/admin/backup/export?collection=${selectedCollection}&format=${exportFormat}`}
                  download
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-accent hover:bg-accent-hover text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
                >
                  <Download className="w-4 h-4" />
                  <span>Download {selectedCollection.toUpperCase()} ({exportFormat.toUpperCase()})</span>
                </a>
              </div>
            </Card>

            {/* Right: Import Module */}
            <Card level={1} className="p-6 space-y-5">
              <div className="space-y-1 border-b border-border pb-4">
                <div className="flex items-center gap-2">
                  <Upload className="w-5 h-5 text-accent" />
                  <h2 className="font-display text-lg font-bold text-primary">Import Section Data</h2>
                </div>
                <p className="text-xs text-muted">
                  Import CSV or JSON data with schema validation, conflict handling, and dry-run preview.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted">
                    Target Collection
                  </label>
                  <select
                    value={selectedCollection}
                    onChange={(e) => setSelectedCollection(e.target.value as CollectionKey)}
                    className="w-full bg-surface border border-border rounded-xl px-3.5 py-2.5 text-xs text-primary focus:outline-none focus:border-accent"
                  >
                    {AVAILABLE_COLLECTIONS.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.label} ({c.key})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted">
                    Conflict Strategy
                  </label>
                  <select
                    value={importStrategy}
                    onChange={(e) => setImportStrategy(e.target.value as any)}
                    className="w-full bg-surface border border-border rounded-xl px-3.5 py-2.5 text-xs text-primary focus:outline-none focus:border-accent"
                  >
                    <option value="SKIP">SKIP — Preserve existing records, insert only new ones</option>
                    <option value="OVERWRITE">OVERWRITE — Replace existing matching records entirely</option>
                    <option value="MERGE">MERGE — Combine matching record fields</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted">
                    Upload or Paste File Content
                  </label>
                  <input
                    type="file"
                    accept=".csv,.json"
                    onChange={handleImportFileSelect}
                    className="block w-full text-xs text-muted file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-border file:text-xs file:font-semibold file:bg-surface-dim file:text-primary hover:file:bg-surface-container cursor-pointer mb-2"
                  />
                  <textarea
                    rows={4}
                    placeholder="Or paste CSV / JSON content directly here..."
                    value={importContent}
                    onChange={(e) => {
                      setImportContent(e.target.value);
                      setImportPreview(null);
                      setImportResult(null);
                    }}
                    className="w-full bg-canvas border border-border rounded-xl p-3 text-xs font-mono text-primary placeholder:text-muted focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    data-testid="validate-preview-btn"
                    onClick={handlePreviewImport}
                    disabled={isImportPreviewing || !importContent.trim()}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
                  >
                    <span>{isImportPreviewing ? 'Previewing...' : '1. Validate & Preview'}</span>
                  </button>

                  {importPreview && importPreview.isValid && (
                    <button
                      type="button"
                      onClick={handleCommitImport}
                      disabled={actionLoading}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-accent hover:bg-accent-hover text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50 shadow-xs"
                    >
                      <span>{actionLoading ? 'Importing...' : '2. Commit Import'}</span>
                    </button>
                  )}
                </div>

                {/* Import Preview Feedback */}
                {importPreview && (
                  <div className={`p-4 rounded-xl border text-xs space-y-2 ${
                    importPreview.isValid
                      ? 'bg-emerald-500/5 border-emerald-500/30 text-emerald-950'
                      : 'bg-rose-500/5 border-rose-500/30 text-rose-950'
                  }`}>
                    <div className="flex items-center justify-between font-bold">
                      <span>Preview Summary:</span>
                      <span>Total: {importPreview.totalParsed} | New: {importPreview.newCount} | Conflicts: {importPreview.duplicateCount}</span>
                    </div>

                    {importPreview.previewRows?.length > 0 && (
                      <div className="space-y-1 pt-1 border-t border-border/60">
                        {importPreview.previewRows.map((r: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between font-mono text-[11px]">
                            <span className="truncate max-w-[200px]">{r.previewText}</span>
                            <span className={r.isDuplicate ? 'text-amber-600 font-bold' : 'text-emerald-600'}>
                              {r.isDuplicate ? 'Existing (Conflict)' : 'New'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Import Result Feedback */}
                {importResult && (
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs space-y-1">
                    <p className="font-bold">{importResult.message}</p>
                    <p className="text-[11px] text-muted">
                      Inserted: {importResult.insertedCount} • Updated: {importResult.updatedCount} • Skipped: {importResult.skippedCount}
                    </p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* TAB 4: ARCHIVE HISTORY */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="font-display text-lg font-bold text-primary">Saved Backup Archives</h2>
              <p className="text-xs text-muted">
                Inspect, verify integrity checksums, download, or delete physical backup archives stored on disk.
              </p>
            </div>

            {backups.length === 0 ? (
              <Card level={1} className="p-12 text-center space-y-3">
                <Database className="w-10 h-10 text-muted mx-auto" />
                <h3 className="font-display text-base font-bold text-primary">No Backup Archives Found</h3>
                <p className="text-xs text-muted max-w-sm mx-auto">
                  Create your first full marketplace snapshot or sectional backup to start tracking archives.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('create')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-accent text-white rounded-xl text-xs font-bold"
                >
                  Create Backup
                </button>
              </Card>
            ) : (
              <div className="space-y-3">
                {backups.map((b) => (
                  <Card key={b.backupId} level={1} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-mono text-sm sm:text-base font-bold text-primary">
                          {b.backupId}
                        </h3>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          b.type === 'FULL'
                            ? 'bg-accent/10 text-accent border border-accent/20'
                            : 'bg-surface-dim text-muted border border-border'
                        }`}>
                          {b.type} {b.section ? `• ${b.section}` : ''}
                        </span>
                        <span className="text-[11px] text-muted font-mono">
                          {formatBytes(b.fileSizeBytes)}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                        <span>Created: <strong className="text-primary font-medium">{new Date(b.createdAt).toLocaleString('en-IN')}</strong></span>
                        <span>By: <strong className="text-primary font-medium">{b.createdBy}</strong></span>
                        <span>Records: <strong className="font-mono text-primary">{b.totalRecords}</strong></span>
                        <span>Tables: <strong className="font-mono text-primary">{b.totalCollections}</strong></span>
                      </div>

                      {b.note && <p className="text-xs text-neutral-600 italic">“{b.note}”</p>}

                      {b.checksum && (
                        <div className="flex items-center gap-2 pt-1">
                          <span className="text-[10px] text-muted font-mono uppercase">SHA-256:</span>
                          <span className="text-[10px] font-mono text-neutral-500 truncate max-w-[200px] sm:max-w-xs">
                            {b.checksum}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyChecksum(b.checksum)}
                            title="Copy Checksum"
                            className="p-1 hover:bg-surface-dim rounded text-muted hover:text-primary transition-colors"
                          >
                            {copiedChecksum === b.checksum ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={`/api/admin/backup/${b.backupId}/download`}
                        download
                        className="p-2 sm:px-3 sm:py-2 bg-surface hover:bg-surface-dim border border-border rounded-xl text-xs font-semibold text-primary transition-colors inline-flex items-center gap-1.5 shadow-xs"
                        title="Download JSON Archive"
                      >
                        <Download className="w-3.5 h-3.5 text-accent" />
                        <span className="hidden sm:inline">Download</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedBackupId(b.backupId);
                          setRestoreSource('existing');
                          setActiveTab('restore');
                        }}
                        className="p-2 sm:px-3 sm:py-2 bg-surface hover:bg-surface-dim border border-border rounded-xl text-xs font-semibold text-primary transition-colors inline-flex items-center gap-1.5 shadow-xs"
                        title="Restore this backup"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="hidden sm:inline">Restore</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteBackup(b.backupId)}
                        disabled={actionLoading}
                        className="p-2 sm:px-3 sm:py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700 transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
                        title="Delete backup"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                        <span className="hidden sm:inline">Delete</span>
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Destructive Action Restore Confirmation Modal */}
        {restoreModalOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Confirm System Restoration"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs animate-in fade-in duration-200"
          >
            <div className="bg-surface border border-border rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex items-center gap-3 text-rose-600">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h3 className="font-display text-base font-bold text-primary">Confirm System Restoration</h3>
                  <p className="text-xs text-muted">Destructive operation</p>
                </div>
              </div>

              <div className="space-y-3 text-xs text-neutral-600 leading-relaxed bg-surface-dim p-4 rounded-2xl border border-border">
                <p>
                  You are about to restore system collections from archive{' '}
                  <strong className="font-mono text-primary">{validationReport?.backupId}</strong>.
                </p>
                <p>
                  • <strong>{validationReport?.totalRecords || 0} records</strong> will be applied across{' '}
                  <strong>{validationReport?.collectionsPresent?.length || 0} collections</strong>.
                </p>
                <p>
                  • <strong>Rollback Guarantee:</strong> An automatic full snapshot will be created before any changes are written.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRestoreModalOpen(false)}
                  disabled={actionLoading}
                  className="px-4 py-2.5 rounded-xl border border-border text-xs font-semibold text-primary hover:bg-surface-dim transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCommitRestore}
                  disabled={actionLoading}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors shadow-xs disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${actionLoading ? 'animate-spin' : ''}`} />
                  <span>{actionLoading ? 'Restoring System...' : 'Yes, Restore Now'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </Container>
    </div>
  );
}
