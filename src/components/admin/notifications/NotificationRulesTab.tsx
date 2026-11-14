'use client';

import React, { useMemo, useState } from 'react';
import {
  EmailRecipientRole,
  EmailTemplate,
  NotificationCategory,
  NotificationEventRule,
  SanitizedSmtpConfig,
} from '@/types';
import {
  Plus,
  Search,
  Edit3,
  Copy,
  Trash2,
  Eye,
  Send,
  X,
  Loader2,
  ShieldAlert,
  UserCheck,
  Store,
  CheckCircle2,
  Power,
} from 'lucide-react';

interface NotificationRulesTabProps {
  rules: NotificationEventRule[];
  templates: EmailTemplate[];
  smtpConfigs: SanitizedSmtpConfig[];
  onRefresh: () => Promise<void>;
  onNotify: (type: 'success' | 'error', msg: string) => void;
}

const CATEGORIES: (NotificationCategory | 'ALL')[] = [
  'ALL',
  'ENQUIRY',
  'ORDER',
  'PAYMENT',
  'ACCOUNT',
  'REVIEW',
  'WISHLIST',
  'INVENTORY',
  'VENDOR',
  'SYSTEM',
];

export function NotificationRulesTab({
  rules,
  templates,
  smtpConfigs,
  onRefresh,
  onNotify,
}: NotificationRulesTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<NotificationCategory | 'ALL'>('ALL');
  const [roleFilter, setRoleFilter] = useState<EmailRecipientRole | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ENABLED' | 'DISABLED'>('ALL');

  const [busyId, setBusyId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<NotificationEventRule | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<NotificationEventRule | null>(null);

  const [previewModal, setPreviewModal] = useState<{
    rule: NotificationEventRule;
    subject: string;
    htmlContent: string;
    textContent: string;
  } | null>(null);
  const [testTargetEmail, setTestTargetEmail] = useState('admin@infinicharm.com');
  const [sendingTest, setSendingTest] = useState(false);

  // Form State
  const [formEventKey, setFormEventKey] = useState('ORDER_PLACED');
  const [formCategory, setFormCategory] = useState<NotificationCategory>('ORDER');
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formEnabled, setFormEnabled] = useState(true);
  const [formSendToAdmin, setFormSendToAdmin] = useState(true);
  const [formSendToCustomer, setFormSendToCustomer] = useState(false);
  const [formSendToVendor, setFormSendToVendor] = useState(false);
  const [formAdminEmails, setFormAdminEmails] = useState('');
  const [formCustomEmails, setFormCustomEmails] = useState('');
  const [formVendorEmails, setFormVendorEmails] = useState('');
  const [formTemplateId, setFormTemplateId] = useState<string>('');
  const [formSubjectOverride, setFormSubjectOverride] = useState('');
  const [formSmtpId, setFormSmtpId] = useState<string>('');

  const filteredRules = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return rules.filter((r) => {
      if (categoryFilter !== 'ALL' && r.category !== categoryFilter) return false;
      if (roleFilter === 'ADMIN' && !r.sendToAdmin) return false;
      if (roleFilter === 'CUSTOMER' && !r.sendToCustomer) return false;
      if (roleFilter === 'VENDOR' && !r.sendToVendor) return false;
      if (roleFilter === 'CUSTOM' && (r.customEmails || []).length === 0) return false;
      if (statusFilter === 'ENABLED' && !r.isEnabled) return false;
      if (statusFilter === 'DISABLED' && r.isEnabled) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        String(r.eventKey).toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q)
      );
    });
  }, [rules, searchQuery, categoryFilter, roleFilter, statusFilter]);

  const stats = useMemo(
    () => ({
      total: rules.length,
      active: rules.filter((r) => r.isEnabled).length,
      admin: rules.filter((r) => r.sendToAdmin && r.isEnabled).length,
      customer: rules.filter((r) => r.sendToCustomer && r.isEnabled).length,
      vendor: rules.filter((r) => r.sendToVendor && r.isEnabled).length,
    }),
    [rules]
  );

  const openCreateModal = () => {
    setEditingRule(null);
    setFormEventKey('CUSTOM_NOTIFICATION');
    setFormCategory('ORDER');
    setFormName('');
    setFormDescription('');
    setFormEnabled(true);
    setFormSendToAdmin(true);
    setFormSendToCustomer(false);
    setFormSendToVendor(false);
    setFormAdminEmails('');
    setFormCustomEmails('');
    setFormVendorEmails('');
    setFormTemplateId(templates[0]?.id || '');
    setFormSubjectOverride('');
    setFormSmtpId('');
    setEditorOpen(true);
  };

  const openEditModal = (rule: NotificationEventRule) => {
    setEditingRule(rule);
    setFormEventKey(String(rule.eventKey));
    setFormCategory(rule.category);
    setFormName(rule.name);
    setFormDescription(rule.description || '');
    setFormEnabled(rule.isEnabled);
    setFormSendToAdmin(rule.sendToAdmin);
    setFormSendToCustomer(rule.sendToCustomer);
    setFormSendToVendor(rule.sendToVendor);
    setFormAdminEmails((rule.adminEmails || []).join(', '));
    setFormCustomEmails((rule.customEmails || []).join(', '));
    setFormVendorEmails((rule.vendorEmails || []).join(', '));
    setFormTemplateId(rule.templateId || '');
    setFormSubjectOverride(rule.subjectOverride || '');
    setFormSmtpId(rule.smtpConfigId || '');
    setEditorOpen(true);
  };

  const parseEmails = (text: string) =>
    text
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      onNotify('error', 'Rule title is required.');
      return;
    }

    const payload = {
      eventKey: formEventKey.trim().toUpperCase(),
      category: formCategory,
      name: formName.trim(),
      description: formDescription.trim(),
      isEnabled: formEnabled,
      sendToAdmin: formSendToAdmin,
      sendToCustomer: formSendToCustomer,
      sendToVendor: formSendToVendor,
      adminEmails: parseEmails(formAdminEmails),
      customEmails: parseEmails(formCustomEmails),
      vendorEmails: parseEmails(formVendorEmails),
      templateId: formTemplateId || null,
      subjectOverride: formSubjectOverride.trim(),
      smtpConfigId: formSmtpId || null,
    };

    setSaving(true);
    try {
      const url = editingRule
        ? `/api/admin/notifications/rules/${editingRule.id}`
        : '/api/admin/notifications/rules';
      const method = editingRule ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data?.rule) {
        onNotify('error', data?.error || 'Could not save notification rule.');
        return;
      }
      onNotify(
        'success',
        editingRule
          ? `Updated notification rule "${data.rule.name}".`
          : `Created notification rule "${data.rule.name}".`
      );
      setEditorOpen(false);
      await onRefresh();
    } catch {
      onNotify('error', 'Network error saving notification rule.');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickPatch = async (
    rule: NotificationEventRule,
    updates: Partial<NotificationEventRule>,
    successMsg: string
  ) => {
    setBusyId(rule.id);
    try {
      const res = await fetch(`/api/admin/notifications/rules/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok || !data?.rule) {
        onNotify('error', data?.error || 'Failed to update rule.');
        return;
      }
      onNotify('success', successMsg);
      await onRefresh();
    } catch {
      onNotify('error', 'Network error updating notification rule.');
    } finally {
      setBusyId(null);
    }
  };

  const handleRoleQuickToggle = async (
    rule: NotificationEventRule,
    role: 'ADMIN' | 'CUSTOMER' | 'VENDOR'
  ) => {
    const fieldMap = {
      ADMIN: 'sendToAdmin',
      CUSTOMER: 'sendToCustomer',
      VENDOR: 'sendToVendor',
    } as const;
    const key = fieldMap[role];
    const nextFlag = !rule[key];
    await handleQuickPatch(
      rule,
      { [key]: nextFlag },
      `${rule.name}: ${role.toLowerCase()} notifications ${nextFlag ? 'enabled' : 'paused'}.`
    );
  };

  const handleDuplicate = async (rule: NotificationEventRule) => {
    setBusyId(rule.id);
    try {
      const res = await fetch(`/api/admin/notifications/rules/${rule.id}/duplicate`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok || !data?.rule) {
        onNotify('error', data?.error || 'Could not duplicate rule.');
        return;
      }
      onNotify('success', `Duplicated "${rule.name}" as "${data.rule.name}".`);
      await onRefresh();
    } catch {
      onNotify('error', 'Failed to duplicate rule.');
    } finally {
      setBusyId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    try {
      const res = await fetch(`/api/admin/notifications/rules/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        onNotify('error', data?.error || 'Could not delete rule.');
        return;
      }
      onNotify('success', `Deleted rule "${deleteTarget.name}".`);
      setDeleteTarget(null);
      await onRefresh();
    } catch {
      onNotify('error', 'Network error deleting rule.');
    } finally {
      setBusyId(null);
    }
  };

  const openPreview = async (rule: NotificationEventRule) => {
    setBusyId(rule.id);
    try {
      const res = await fetch(`/api/admin/notifications/rules/${rule.id}/test`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok || !data?.preview) {
        onNotify('error', data?.error || 'Unable to generate rule preview.');
        return;
      }
      setPreviewModal({
        rule,
        subject: data.preview.subject,
        htmlContent: data.preview.htmlContent,
        textContent: data.preview.textContent,
      });
    } catch {
      onNotify('error', 'Error loading preview.');
    } finally {
      setBusyId(null);
    }
  };

  const handleSendTest = async (mode: 'TEST_EMAIL' | 'LIVE_EVENT') => {
    if (!previewModal) return;
    setSendingTest(true);
    try {
      const res = await fetch(
        `/api/admin/notifications/rules/${previewModal.rule.id}/test`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode,
            targetEmail: testTargetEmail.trim(),
            customerEmail: testTargetEmail.trim(),
            customerName: 'Verification Tester',
            vendorEmails: [testTargetEmail.trim()],
          }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data?.success) {
        onNotify(
          'error',
          data?.error || 'Test dispatch reported a delivery issue — see Delivery Logs.'
        );
      } else {
        onNotify(
          'success',
          mode === 'TEST_EMAIL'
            ? `Test preview email dispatched to ${testTargetEmail.trim()}.`
            : `Live rule event triggered for "${previewModal.rule.name}".`
        );
      }
      await onRefresh();
    } catch {
      onNotify('error', 'Failed to send test notification.');
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* KPI Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-surface border border-border rounded-2xl p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Total Rules</p>
          <p className="font-display text-2xl font-bold text-primary mt-1">{stats.total}</p>
        </div>
        <div className="bg-surface border border-border rounded-2xl p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Active Rules</p>
          <p className="font-display text-2xl font-bold text-emerald-700 mt-1">{stats.active}</p>
        </div>
        <div className="bg-surface border border-border rounded-2xl p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Admin Alerts</p>
          <p className="font-display text-2xl font-bold text-primary mt-1">{stats.admin}</p>
        </div>
        <div className="bg-surface border border-border rounded-2xl p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Customer Alerts</p>
          <p className="font-display text-2xl font-bold text-primary mt-1">{stats.customer}</p>
        </div>
        <div className="bg-surface border border-border rounded-2xl p-4 col-span-2 sm:col-span-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Vendor Alerts</p>
          <p className="font-display text-2xl font-bold text-primary mt-1">{stats.vendor}</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-surface border border-border rounded-2xl p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search event key, rule name, or category..."
              className="w-full pl-9 pr-3.5 py-2.5 text-xs bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter by role"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as EmailRecipientRole | 'ALL')}
              className="px-3 py-2 text-xs bg-surface-dim border border-border rounded-xl text-primary font-semibold"
            >
              <option value="ALL">All Recipients</option>
              <option value="ADMIN">Admin Notifications</option>
              <option value="CUSTOMER">Customer Notifications</option>
              <option value="VENDOR">Vendor Notifications</option>
              <option value="CUSTOM">Custom Recipients</option>
            </select>

            <select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'ENABLED' | 'DISABLED')}
              className="px-3 py-2 text-xs bg-surface-dim border border-border rounded-xl text-primary font-semibold"
            >
              <option value="ALL">All States</option>
              <option value="ENABLED">Enabled Only</option>
              <option value="DISABLED">Disabled Only</option>
            </select>

            <button
              type="button"
              onClick={openCreateModal}
              data-testid="create-notification-rule-btn"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              New Rule
            </button>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold cursor-pointer border transition-colors ${
                categoryFilter === cat
                  ? 'bg-primary text-surface border-primary'
                  : 'bg-canvas text-secondary border-border hover:text-primary'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Rules List */}
      <div className="space-y-3">
        {filteredRules.length === 0 ? (
          <div className="bg-surface border border-border rounded-2xl p-10 text-center space-y-2">
            <p className="font-display text-base font-bold text-primary">
              No Notification Rules Match Filter
            </p>
            <p className="text-xs text-muted">
              Adjust your search filters or create a new custom notification rule.
            </p>
          </div>
        ) : (
          filteredRules.map((rule) => {
            const tplName =
              templates.find((t) => t.id === rule.templateId)?.name || 'Dynamic Default Blueprint';
            const smtpName = rule.smtpConfigId
              ? smtpConfigs.find((s) => s.id === rule.smtpConfigId)?.name || 'Custom Relay'
              : 'System Default SMTP';
            const isBusy = busyId === rule.id;

            return (
              <div
                key={rule.id}
                data-testid={`notification-rule-${rule.id}`}
                className={`bg-surface border rounded-2xl p-4 sm:p-5 transition-colors shadow-xs ${
                  rule.isEnabled ? 'border-border' : 'border-border/70 opacity-80 bg-surface-dim/40'
                }`}
              >
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-canvas border border-border text-[10px] font-bold uppercase tracking-wider text-primary">
                        {rule.category}
                      </span>
                      <span className="font-mono text-[11px] text-accent font-semibold">
                        {rule.eventKey}
                      </span>
                      {rule.isSystemDefault && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold">
                          System Event
                        </span>
                      )}
                      {rule.isEnabled ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
                          <CheckCircle2 className="w-3 h-3" /> Active
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-neutral-200/80 text-neutral-700 text-[10px] font-bold">
                          Disabled
                        </span>
                      )}
                    </div>

                    <h3 className="font-display text-base font-bold text-primary">
                      {rule.name}
                    </h3>
                    <p className="text-xs text-secondary">{rule.description}</p>
                    <p className="text-[11px] text-muted">
                      Template: <strong className="text-primary">{tplName}</strong> &bull; Relay:{' '}
                      <strong className="text-primary">{smtpName}</strong>
                      {rule.subjectOverride ? ` • Subject: "${rule.subjectOverride}"` : ''}
                    </p>
                  </div>

                  {/* Role Quick Toggles + CRUD Actions */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 shrink-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleRoleQuickToggle(rule, 'ADMIN')}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border cursor-pointer transition-colors ${
                          rule.sendToAdmin
                            ? 'bg-primary text-surface border-primary'
                            : 'bg-canvas text-muted border-border hover:text-primary'
                        }`}
                        title="Toggle Admin Recipient"
                      >
                        <ShieldAlert className="w-3 h-3" /> Admin
                      </button>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleRoleQuickToggle(rule, 'CUSTOMER')}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border cursor-pointer transition-colors ${
                          rule.sendToCustomer
                            ? 'bg-accent text-white border-accent'
                            : 'bg-canvas text-muted border-border hover:text-primary'
                        }`}
                        title="Toggle Customer Recipient"
                      >
                        <UserCheck className="w-3 h-3" /> Customer
                      </button>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleRoleQuickToggle(rule, 'VENDOR')}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border cursor-pointer transition-colors ${
                          rule.sendToVendor
                            ? 'bg-amber-700 text-white border-amber-700'
                            : 'bg-canvas text-muted border-border hover:text-primary'
                        }`}
                        title="Toggle Vendor Recipient"
                      >
                        <Store className="w-3 h-3" /> Vendor
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        disabled={isBusy}
                        data-testid={`toggle-rule-${rule.id}`}
                        onClick={() =>
                          handleQuickPatch(
                            rule,
                            { isEnabled: !rule.isEnabled },
                            `"${rule.name}" is now ${!rule.isEnabled ? 'enabled' : 'disabled'}.`
                          )
                        }
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold border cursor-pointer ${
                          rule.isEnabled
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-canvas text-primary border-border hover:bg-surface-dim'
                        }`}
                      >
                        <Power className="w-3.5 h-3.5" />
                        {rule.isEnabled ? 'Disable' : 'Enable'}
                      </button>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => openPreview(rule)}
                        className="p-2 rounded-lg border border-border text-primary hover:bg-surface-dim cursor-pointer"
                        title="Preview & Test Send"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => openEditModal(rule)}
                        className="p-2 rounded-lg border border-border text-primary hover:bg-surface-dim cursor-pointer"
                        title="Edit Rule"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleDuplicate(rule)}
                        className="p-2 rounded-lg border border-border text-primary hover:bg-surface-dim cursor-pointer"
                        title="Duplicate Rule"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => setDeleteTarget(rule)}
                        className="p-2 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 cursor-pointer"
                        title="Delete Rule"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create / Edit Rule Modal */}
      {editorOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2 className="font-display text-lg font-bold text-primary">
                  {editingRule ? 'Edit Notification Rule' : 'Create Notification Rule'}
                </h2>
                <p className="text-xs text-muted">
                  Configure event key, recipient roles, template, and dedicated SMTP routing.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="p-2 rounded-lg border border-border text-muted hover:text-primary cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRule} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-primary mb-1">Rule Name *</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. High-Value Order Admin Alert"
                    className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary"
                  />
                </div>
                <div>
                  <label className="block font-bold text-primary mb-1">Event Key *</label>
                  <input
                    type="text"
                    required
                    value={formEventKey}
                    onChange={(e) => setFormEventKey(e.target.value)}
                    placeholder="ORDER_PLACED"
                    className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl font-mono text-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-primary mb-1">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as NotificationCategory)}
                    className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary font-semibold"
                  >
                    {CATEGORIES.filter((c) => c !== 'ALL').map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl w-full cursor-pointer font-bold text-primary">
                    <input
                      type="checkbox"
                      checked={formEnabled}
                      onChange={(e) => setFormEnabled(e.target.checked)}
                    />
                    Rule Active (Deliver Automated Emails)
                  </label>
                </div>
              </div>

              <div>
                <label className="block font-bold text-primary mb-1">Description</label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Describe when this notification dispatches..."
                  className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary"
                />
              </div>

              <div>
                <label className="block font-bold text-primary mb-1.5">Recipient Roles</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setFormSendToAdmin((v) => !v)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer ${
                      formSendToAdmin
                        ? 'bg-primary text-surface border-primary'
                        : 'bg-canvas text-secondary border-border'
                    }`}
                  >
                    ADMIN
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormSendToCustomer((v) => !v)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer ${
                      formSendToCustomer
                        ? 'bg-accent text-white border-accent'
                        : 'bg-canvas text-secondary border-border'
                    }`}
                  >
                    CUSTOMER
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormSendToVendor((v) => !v)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer ${
                      formSendToVendor
                        ? 'bg-amber-700 text-white border-amber-700'
                        : 'bg-canvas text-secondary border-border'
                    }`}
                  >
                    VENDOR
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-primary mb-1">
                    Admin Overrides
                  </label>
                  <input
                    type="text"
                    value={formAdminEmails}
                    onChange={(e) => setFormAdminEmails(e.target.value)}
                    placeholder="Uses global default"
                    className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary"
                  />
                </div>
                <div>
                  <label className="block font-bold text-primary mb-1">
                    Vendor Recipients
                  </label>
                  <input
                    type="text"
                    value={formVendorEmails}
                    onChange={(e) => setFormVendorEmails(e.target.value)}
                    placeholder="partner@vendor.in"
                    className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary"
                  />
                </div>
                <div>
                  <label className="block font-bold text-primary mb-1">
                    Custom CC / Extras
                  </label>
                  <input
                    type="text"
                    value={formCustomEmails}
                    onChange={(e) => setFormCustomEmails(e.target.value)}
                    placeholder="ops@infinicharm.com"
                    className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-primary mb-1">Email Template</label>
                  <select
                    value={formTemplateId}
                    onChange={(e) => setFormTemplateId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary"
                  >
                    <option value="">Dynamic Role Default Template</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        [{t.purpose}] {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-primary mb-1">SMTP Relay Override</label>
                  <select
                    value={formSmtpId}
                    onChange={(e) => setFormSmtpId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary"
                  >
                    <option value="">Use Global Default SMTP Relay</option>
                    {smtpConfigs.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.senderEmail})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-primary mb-1">
                  Subject Override (optional — supports {'{{order_number}}'}, {'{{customer_name}}'})
                </label>
                <input
                  type="text"
                  value={formSubjectOverride}
                  onChange={(e) => setFormSubjectOverride(e.target.value)}
                  placeholder="Leave blank to use template subject"
                  className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setEditorOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border text-primary font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white font-bold cursor-pointer disabled:opacity-50"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {editingRule ? 'Save Rule Changes' : 'Create Notification Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview & Test Send Modal */}
      {previewModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-accent">
                  {previewModal.rule.eventKey}
                </span>
                <h3 className="font-display text-lg font-bold text-primary">
                  Preview: {previewModal.subject}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewModal(null)}
                className="p-2 rounded-lg border border-border text-muted hover:text-primary cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="border border-border rounded-2xl overflow-hidden bg-white">
              <iframe
                title="Notification Email Preview"
                srcDoc={previewModal.htmlContent}
                className="w-full h-80 border-0"
              />
            </div>

            <div className="bg-surface-dim border border-border rounded-2xl p-4 space-y-3">
              <p className="text-xs font-bold text-primary">Send Test / Trigger Live Event</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  value={testTargetEmail}
                  onChange={(e) => setTestTargetEmail(e.target.value)}
                  placeholder="Recipient test email..."
                  className="flex-1 px-3.5 py-2 text-xs bg-surface border border-border rounded-xl text-primary"
                />
                <button
                  type="button"
                  disabled={sendingTest}
                  onClick={() => handleSendTest('TEST_EMAIL')}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {sendingTest ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  Send Preview Email
                </button>
                <button
                  type="button"
                  disabled={sendingTest}
                  onClick={() => handleSendTest('LIVE_EVENT')}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-surface text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  Trigger Rule Dispatch
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="font-display text-lg font-bold text-primary">
              Delete Notification Rule?
            </h3>
            <p className="text-xs text-secondary leading-relaxed">
              Are you sure you want to permanently remove{' '}
              <strong className="text-primary">{deleteTarget.name}</strong> (
              <span className="font-mono">{deleteTarget.eventKey}</span>)? Past delivery logs will
              remain intact for audit history.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl border border-border text-xs font-bold text-primary cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busyId === deleteTarget.id}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                Delete Rule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
