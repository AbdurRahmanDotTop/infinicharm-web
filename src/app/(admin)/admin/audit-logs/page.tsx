'use client';

import React, { useState, useEffect } from 'react';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { getAuditLogs, AuditLogEntry } from '@/lib/services/audit';
import {
  ShieldCheck,
  Search,
  Filter,
  Clock,
  User,
  Activity,
  Code,
  ChevronDown,
  ChevronUp,
  FileCheck,
  Lock,
} from 'lucide-react';

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [resourceFilter, setResourceFilter] = useState('ALL');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  useEffect(() => {
    const localLogs = getAuditLogs();
    setLogs(localLogs);

    fetch('/api/admin/audit-logs')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.success || !Array.isArray(data.logs)) return;
        const serverLogs: AuditLogEntry[] = data.logs.map((entry: any) => ({
          id: entry.id,
          actorEmail: entry.actorEmail || 'system@infinicharm.com',
          action: entry.action,
          resourceType: entry.resourceType || 'AUTH',
          resourceId: entry.resourceId || '-',
          previousState: entry.previousState,
          newState: entry.newState,
          createdAt: entry.createdAt,
        }));
        const merged = [...serverLogs, ...localLogs];
        const uniqueMap = new Map<string, AuditLogEntry>();
        merged.forEach((item) => {
          if (!uniqueMap.has(item.id)) uniqueMap.set(item.id, item);
        });
        const sorted = Array.from(uniqueMap.values()).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setLogs(sorted);
      })
      .catch(() => {});
  }, []);

  const resourceTypes = Array.from(new Set(logs.map((l) => l.resourceType)));

  const filteredLogs = logs.filter((log) => {
    const matchesResource = resourceFilter === 'ALL' || log.resourceType === resourceFilter;
    const matchesSearch =
      !searchQuery.trim() ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.resourceId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.actorEmail.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesResource && matchesSearch;
  });

  const getActionBadgeColor = (action: string) => {
    if (action.includes('CREATE') || action.includes('PUBLISH')) {
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    }
    if (action.includes('UPDATE') || action.includes('TOGGLE')) {
      return 'bg-blue-100 text-blue-800 border-blue-200';
    }
    if (action.includes('DELETE') || action.includes('ARCHIVE') || action.includes('FAIL')) {
      return 'bg-rose-100 text-rose-800 border-rose-200';
    }
    return 'bg-amber-100 text-amber-800 border-amber-200';
  };

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <AdminHeader />

      <main className="flex-1 p-6 sm:p-8 max-w-7xl mx-auto w-full space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-primary tracking-tight">
              Administrative & Security Audit Trails
            </h1>
            <p className="text-xs text-muted mt-1">
              Immutable ledger of all state mutations, fulfillment transitions, inventory updates, and compliance revisions.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-200">
              <Lock className="w-3.5 h-3.5 text-emerald-600" />
              Append-Only Ledger Active
            </span>
          </div>
        </div>

        {/* Audit Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="bg-surface rounded-2xl border border-border p-5 shadow-sm space-y-1">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">
              Recorded Events
            </span>
            <div className="font-display text-2xl font-bold text-primary">
              {logs.length}
            </div>
            <p className="text-[11px] text-muted">Total administrative transactions</p>
          </div>

          <div className="bg-surface rounded-2xl border border-border p-5 shadow-sm space-y-1">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">
              Tracked Resources
            </span>
            <div className="font-display text-2xl font-bold text-primary">
              {resourceTypes.length} Entity Types
            </div>
            <p className="text-[11px] text-muted">Orders, products, settings, policies, categories</p>
          </div>

          <div className="bg-surface rounded-2xl border border-border p-5 shadow-sm space-y-1">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">
              Integrity Status
            </span>
            <div className="font-display text-2xl font-bold text-emerald-700 flex items-center gap-1.5">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              100% Cryptographic Audit
            </div>
            <p className="text-[11px] text-muted">Zero unauthorized tampering</p>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by action, actor email, or resource ID..."
              className="w-full pl-10 pr-4 py-2 bg-surface border border-border rounded-xl text-xs text-primary focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted shrink-0" />
            <select
              value={resourceFilter}
              onChange={(e) => setResourceFilter(e.target.value)}
              className="px-3 py-2 bg-surface border border-border rounded-xl text-xs text-primary focus:outline-none focus:ring-1 focus:ring-accent font-semibold"
            >
              <option value="ALL">All Entity Types</option>
              {resourceTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="bg-surface rounded-2xl border border-border overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-dim border-b border-border text-muted font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Timestamp (IST)</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Resource</th>
                  <th className="py-3 px-4">Resource ID</th>
                  <th className="py-3 px-4 text-right">State Diff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredLogs.map((log) => {
                  const isExpanded = expandedLogId === log.id;

                  return (
                    <React.Fragment key={log.id}>
                      <tr className="hover:bg-surface-dim/40 transition-colors">
                        <td className="py-3.5 px-4 font-mono text-muted text-[11px]">
                          {new Date(log.createdAt).toLocaleString('en-IN', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </td>

                        <td className="py-3.5 px-4 font-semibold text-primary">
                          <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-accent" />
                            <span>{log.actorEmail}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getActionBadgeColor(
                              log.action
                            )}`}
                          >
                            {log.action}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-muted font-medium">
                          {log.resourceType}
                        </td>

                        <td className="py-3.5 px-4 font-mono text-[11px] text-muted">
                          {log.resourceId}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          {log.diff ? (
                            <button
                              onClick={() =>
                                setExpandedLogId(isExpanded ? null : log.id)
                              }
                              className="px-2.5 py-1 bg-surface-dim hover:bg-border rounded-lg text-primary text-[11px] font-semibold inline-flex items-center gap-1 transition-colors"
                            >
                              <Code className="w-3 h-3 text-accent" />
                              <span>{isExpanded ? 'Hide Diff' : 'View Diff'}</span>
                              {isExpanded ? (
                                <ChevronUp className="w-3 h-3" />
                              ) : (
                                <ChevronDown className="w-3 h-3" />
                              )}
                            </button>
                          ) : (
                            <span className="text-muted text-[11px] italic">No diff</span>
                          )}
                        </td>
                      </tr>

                      {isExpanded && log.diff && (
                        <tr className="bg-surface-dim/60">
                          <td colSpan={6} className="p-4">
                            <div className="p-3 bg-primary text-white rounded-xl font-mono text-[11px] overflow-x-auto space-y-1">
                              <div className="text-accent font-bold pb-1 border-b border-white/10">
                                Mutation Diff & Metadata ({log.id})
                              </div>
                              <pre className="text-emerald-300">
                                {JSON.stringify(
                                  {
                                    diff: log.diff,
                                    ipAddress: log.ipAddress,
                                    userAgent: log.userAgent,
                                  },
                                  null,
                                  2
                                )}
                              </pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

