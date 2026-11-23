'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { formatPaiseToRupees } from '@/lib/utils/currency';
import { lookupPinCode } from '@/lib/utils/pincode';
import type { CustomerSummary, Order, UserRole, UserPermission } from '@/types';
import {
  Users,
  Search,
  Mail,
  Phone,
  Shield,
  ShieldCheck,
  UserCheck,
  UserX,
  Plus,
  Edit2,
  Trash2,
  KeyRound,
  Lock,
  Unlock,
  CheckCircle2,
  AlertCircle,
  X,
  ChevronLeft,
  ChevronRight,
  Filter,
  Download,
  ShoppingBag,
  ExternalLink,
  MapPin,
  Calendar,
  Layers,
  Settings,
  RefreshCw,
} from 'lucide-react';

const ALL_ROLES: { key: UserRole; label: string; desc: string }[] = [
  { key: 'SUPER_ADMIN', label: 'Super Admin', desc: 'Root executive authority with unrestricted platform access' },
  { key: 'ADMIN', label: 'Administrator', desc: 'Full administrative access across operations, orders, and catalog' },
  { key: 'VENDOR', label: 'Vendor Partner', desc: 'Direct merchant sourcing and product inventory fulfillment' },
  { key: 'PRODUCT_MANAGER', label: 'Product Manager', desc: 'Catalog, taxonomy, pricing, and variant curation' },
  { key: 'ORDER_MANAGER', label: 'Order Manager', desc: 'Order fulfillment, shipments, and customer escalations' },
  { key: 'CONTENT_MANAGER', label: 'Content Manager', desc: 'Editorial blogs, static pages, and banner announcements' },
  { key: 'CUSTOMER', label: 'Storefront Patron', desc: 'Registered customer account with wishlist and order tracking' },
];

const ALL_PERMISSIONS: { key: UserPermission; label: string; category: string }[] = [
  { key: 'manage_products', label: 'Products & Inventory', category: 'Catalog' },
  { key: 'manage_orders', label: 'Orders & Fulfillment', category: 'Operations' },
  { key: 'manage_payments', label: 'Payments & UTR Verification', category: 'Finance' },
  { key: 'manage_users', label: 'User Directory & RBAC', category: 'Security' },
  { key: 'manage_cms', label: 'Editorial & CMS', category: 'Content' },
  { key: 'manage_marketing', label: 'Coupons & Campaigns', category: 'Marketing' },
  { key: 'manage_reviews', label: 'Patron Reviews Moderation', category: 'Community' },
  { key: 'manage_settings', label: 'System Settings & SMTP', category: 'System' },
];

export default function AdminAllUsersPage() {
  const [users, setUsers] = useState<CustomerSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [verificationFilter, setVerificationFilter] = useState<'ALL' | 'VERIFIED' | 'UNVERIFIED'>('ALL');
  const [sortBy, setSortBy] = useState<'REGISTERED' | 'NAME' | 'ORDERS' | 'ROLE'>('REGISTERED');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Notifications
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Selection
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<CustomerSummary | null>(null);
  const [roleEditingUser, setRoleEditingUser] = useState<CustomerSummary | null>(null);
  const [inspectingUser, setInspectingUser] = useState<CustomerSummary | null>(null);
  const [inspectingUserOrders, setInspectingUserOrders] = useState<Order[]>([]);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

  // Form states
  const [formFullName, setFormFullName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('CUSTOMER');
  const [formStatus, setFormStatus] = useState<string>('ACTIVE');
  const [formEmailVerified, setFormEmailVerified] = useState(true);
  const [formPermissions, setFormPermissions] = useState<UserPermission[]>([]);
  const [formNotes, setFormNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch Users
  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (!res.ok || !data.success) {
        // Fallback to customers API if users route returns non-200
        const custRes = await fetch('/api/admin/customers');
        const custData = await custRes.json();
        if (custRes.ok && custData.customers) {
          setUsers(custData.customers);
          return;
        }
        throw new Error(data.error || 'Failed to fetch user directory.');
      }
      setUsers(data.users || []);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error fetching users.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const isAccountProtected = (u: CustomerSummary) =>
    Boolean(
      u.isProtected ||
      u.id === 'usr-admin-01' ||
      u.email.toLowerCase() === 'admin@infinicharm.com' ||
      u.role === 'SUPER_ADMIN'
    );

  // Filtered & Sorted Users
  const filteredUsers = useMemo(() => {
    let result = [...users];

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (u) =>
          u.fullName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.phone.includes(q) ||
          (u.role && u.role.toLowerCase().includes(q))
      );
    }

    if (roleFilter !== 'ALL') {
      result = result.filter((u) => (u.role || 'CUSTOMER') === roleFilter);
    }

    if (statusFilter !== 'ALL') {
      result = result.filter((u) => u.status === statusFilter);
    }

    if (verificationFilter !== 'ALL') {
      if (verificationFilter === 'VERIFIED') {
        result = result.filter((u) => u.emailVerified !== false);
      } else {
        result = result.filter((u) => u.emailVerified === false);
      }
    }

    result.sort((a, b) => {
      if (sortBy === 'REGISTERED') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === 'NAME') {
        return a.fullName.localeCompare(b.fullName);
      }
      if (sortBy === 'ORDERS') {
        return (b.totalOrders || 0) - (a.totalOrders || 0);
      }
      if (sortBy === 'ROLE') {
        return (a.role || 'CUSTOMER').localeCompare(b.role || 'CUSTOMER');
      }
      return 0;
    });

    return result;
  }, [users, searchQuery, roleFilter, statusFilter, verificationFilter, sortBy]);

  const selectableUsers = useMemo(() => {
    return filteredUsers.filter((u) => !isAccountProtected(u));
  }, [filteredUsers]);

  // Paginated Slices
  const totalPages = Math.ceil(filteredUsers.length / pageSize) || 1;
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, currentPage, pageSize]);

  // Toggle selection
  const toggleSelectUser = (id: string) => {
    const target = users.find((u) => u.id === id);
    if (target && isAccountProtected(target)) return;
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedUserIds.size === selectableUsers.length && selectableUsers.length > 0) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(selectableUsers.map((u) => u.id)));
    }
  };

  const clearSelection = () => {
    setSelectedUserIds(new Set());
  };

  // Status toggle
  const handleToggleStatus = async (user: CustomerSummary) => {
    if (isAccountProtected(user)) {
      setErrorMsg('Protected root founder account status cannot be modified.');
      return;
    }
    const nextStatus = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update user status.');
      }
      setSuccessMsg(`User status updated to ${nextStatus}.`);
      setTimeout(() => setSuccessMsg(null), 3000);
      fetchUsers();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error updating user status.');
    }
  };

  // Delete User
  const handleDeleteUser = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete user.');
      }
      setSuccessMsg('User account deleted successfully. Statutory order records anonymized.');
      setTimeout(() => setSuccessMsg(null), 3500);
      setDeletingUserId(null);
      if (inspectingUser?.id === id) setInspectingUser(null);
      fetchUsers();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error deleting user.');
    }
  };

  // Bulk Actions
  const handleBulkAction = async (action: 'SUSPEND' | 'ACTIVATE' | 'CHANGE_ROLE' | 'DELETE', targetRole?: UserRole) => {
    if (selectedUserIds.size === 0) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/users/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          userIds: Array.from(selectedUserIds),
          role: targetRole,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Bulk action failed.');
      }
      setSuccessMsg(data.message || 'Bulk operation completed.');
      setTimeout(() => setSuccessMsg(null), 3500);
      clearSelection();
      setShowBulkDeleteModal(false);
      fetchUsers();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Bulk action execution error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Inspect User
  const inspectUser = async (user: CustomerSummary) => {
    setInspectingUser(user);
    setInspectingUserOrders([]);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`);
      const data = await res.json();
      if (res.ok && data.orders) {
        setInspectingUserOrders(data.orders);
      }
    } catch {}
  };

  // Open Edit Modal
  const openEditModal = (user: CustomerSummary) => {
    setEditingUser(user);
    setFormFullName(user.fullName);
    setFormPhone(user.phone || '');
    setFormStatus(user.status);
    setFormPassword('');
    setFormNotes(user.notes || '');
  };

  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setIsSubmitting(true);
    try {
      const payload: any = {
        fullName: formFullName.trim(),
        phone: formPhone.trim(),
        status: formStatus,
        notes: formNotes.trim(),
      };
      if (formPassword.trim()) {
        payload.password = formPassword.trim();
      }
      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update user profile.');
      }
      setSuccessMsg('User profile saved successfully.');
      setTimeout(() => setSuccessMsg(null), 3500);
      setEditingUser(null);
      fetchUsers();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error saving user.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Role & Permissions Modal
  const openRoleModal = (user: CustomerSummary) => {
    setRoleEditingUser(user);
    setFormRole(user.role || 'CUSTOMER');
    setFormPermissions(user.permissions || (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' ? ALL_PERMISSIONS.map(p => p.key) : []));
  };

  const handleSaveRolePermissions = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleEditingUser) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/admin/users/${roleEditingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: formRole,
          permissions: formPermissions,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update role and permissions.');
      }
      setSuccessMsg(`Role updated to ${formRole} with ${formPermissions.length} active permissions.`);
      setTimeout(() => setSuccessMsg(null), 3500);
      setRoleEditingUser(null);
      fetchUsers();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error updating role.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Add New User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formFullName.trim() || !formEmail.trim()) {
      setErrorMsg('Full Name and Email Address are mandatory.');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: formFullName.trim(),
          email: formEmail.trim().toLowerCase(),
          phone: formPhone.trim(),
          password: formPassword.trim() || undefined,
          role: formRole,
          permissions: formPermissions,
          status: formStatus,
          emailVerified: formEmailVerified,
          notes: formNotes.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create user account.');
      }
      setSuccessMsg('New user account created successfully.');
      setTimeout(() => setSuccessMsg(null), 3500);
      setShowAddModal(false);
      // Reset form
      setFormFullName('');
      setFormEmail('');
      setFormPhone('');
      setFormPassword('');
      setFormRole('CUSTOMER');
      setFormPermissions([]);
      setFormNotes('');
      fetchUsers();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error creating user.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['User ID', 'Full Name', 'Email', 'Phone', 'Role', 'Status', 'Email Verified', 'Total Orders', 'Spend (INR)', 'Registered Date'];
    const rows = filteredUsers.map((u) => [
      u.id,
      `"${u.fullName.replace(/"/g, '""')}"`,
      u.email,
      u.phone || '',
      u.role || 'CUSTOMER',
      u.status,
      u.emailVerified !== false ? 'YES' : 'NO',
      u.totalOrders || 0,
      ((u.lifetimeSpendInPaise || 0) / 100).toFixed(2),
      new Date(u.createdAt).toISOString().split('T')[0],
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `infinicharm_users_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Metrics Summary
  const stats = useMemo(() => {
    return {
      total: users.length,
      active: users.filter((u) => u.status === 'ACTIVE').length,
      suspended: users.filter((u) => u.status === 'SUSPENDED').length,
      superAdmins: users.filter((u) => u.role === 'SUPER_ADMIN').length,
      admins: users.filter((u) => u.role === 'ADMIN').length,
      vendors: users.filter((u) => u.role === 'VENDOR').length,
      customers: users.filter((u) => !u.role || u.role === 'CUSTOMER').length,
    };
  }, [users]);

  const getRoleBadgeClass = (role?: UserRole) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'bg-purple-100 text-purple-900 border-purple-200';
      case 'ADMIN':
        return 'bg-blue-100 text-blue-900 border-blue-200';
      case 'VENDOR':
        return 'bg-amber-100 text-amber-900 border-amber-200';
      case 'PRODUCT_MANAGER':
      case 'ORDER_MANAGER':
      case 'CONTENT_MANAGER':
        return 'bg-teal-100 text-teal-900 border-teal-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <div className="min-h-screen bg-surface-dim font-sans text-primary pb-16">
      <AdminHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-primary tracking-tight font-display">
                All Registered Users
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-accent/10 text-accent uppercase tracking-wider">
                RBAC Central
              </span>
            </div>
            <p className="text-xs sm:text-sm text-muted mt-1 max-w-2xl">
              Centralized platform user directory, role-based access control, operational permissions, and administrative authorities grounded strictly in live database records.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-surface hover:bg-surface-dim border border-border text-primary rounded-xl text-xs font-semibold shadow-xs transition-colors"
              title="Export all visible user records to CSV"
            >
              <Download className="w-3.5 h-3.5 text-muted" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={() => {
                setFormFullName('');
                setFormEmail('');
                setFormPhone('');
                setFormPassword('');
                setFormRole('CUSTOMER');
                setFormPermissions([]);
                setFormNotes('');
                setShowAddModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add New User</span>
            </button>
          </div>
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-xs text-rose-800">
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span className="font-semibold break-words">{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="p-1 hover:bg-rose-100 rounded text-rose-600">
              <X className="w-3.5 h-3.5" />
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
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-surface rounded-2xl border border-border p-4 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">Total Accounts</span>
            <span className="text-2xl font-extrabold text-primary block mt-1">{stats.total}</span>
            <span className="text-[11px] text-muted block mt-0.5">Authentic registered users</span>
          </div>

          <div className="bg-surface rounded-2xl border border-border p-4 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">Active Patrons</span>
            <span className="text-2xl font-extrabold text-emerald-600 block mt-1">{stats.active}</span>
            <span className="text-[11px] text-muted block mt-0.5">Verified & active standing</span>
          </div>

          <div className="bg-surface rounded-2xl border border-border p-4 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 block">Suspended / Held</span>
            <span className="text-2xl font-extrabold text-rose-600 block mt-1">{stats.suspended}</span>
            <span className="text-[11px] text-muted block mt-0.5">Access restricted</span>
          </div>

          <div className="bg-surface rounded-2xl border border-border p-4 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 block">Staff & Admins</span>
            <span className="text-2xl font-extrabold text-purple-600 block mt-1">
              {stats.superAdmins + stats.admins + stats.vendors}
            </span>
            <span className="text-[11px] text-muted block mt-0.5">
              {stats.superAdmins} Super • {stats.admins} Admin • {stats.vendors} Vendor
            </span>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="bg-surface rounded-2xl border border-border p-4 shadow-sm space-y-3 text-xs">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search by name, email, phone, role..."
                className="w-full pl-10 pr-4 py-2 bg-surface-dim border border-border rounded-xl text-xs text-primary focus:outline-none focus:border-accent"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-1.5 bg-surface-dim border border-border rounded-xl text-primary text-xs focus:outline-none focus:border-accent"
              >
                <option value="REGISTERED">Sort: Latest Registered</option>
                <option value="NAME">Sort: Name (A-Z)</option>
                <option value="ORDERS">Sort: Most Orders</option>
                <option value="ROLE">Sort: Role</option>
              </select>

              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-3 py-1.5 bg-surface-dim border border-border rounded-xl text-primary text-xs focus:outline-none focus:border-accent"
              >
                <option value={10}>10 per page</option>
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
              </select>

              <button
                onClick={fetchUsers}
                className="p-2 hover:bg-surface-dim text-muted hover:text-primary rounded-xl border border-border transition-colors"
                title="Refresh user list"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/60">
            <span className="text-[11px] font-bold text-muted uppercase tracking-wider mr-1">Role:</span>
            {['ALL', 'SUPER_ADMIN', 'ADMIN', 'VENDOR', 'CUSTOMER'].map((r) => (
              <button
                key={r}
                onClick={() => {
                  setRoleFilter(r);
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-colors ${
                  roleFilter === r ? 'bg-primary text-white shadow-xs' : 'bg-surface-dim text-muted hover:text-primary'
                }`}
              >
                {r === 'SUPER_ADMIN' ? 'Super Admin' : r === 'ALL' ? 'All Roles' : r}
              </button>
            ))}

            <div className="h-4 w-px bg-border mx-1 hidden sm:block" />

            <span className="text-[11px] font-bold text-muted uppercase tracking-wider mr-1">Status:</span>
            {['ALL', 'ACTIVE', 'SUSPENDED'].map((st) => (
              <button
                key={st}
                onClick={() => {
                  setStatusFilter(st);
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-colors ${
                  statusFilter === st ? 'bg-accent text-white shadow-xs' : 'bg-surface-dim text-muted hover:text-primary'
                }`}
              >
                {st}
              </button>
            ))}

            <div className="h-4 w-px bg-border mx-1 hidden sm:block" />

            <span className="text-[11px] font-bold text-muted uppercase tracking-wider mr-1">Email:</span>
            {[
              { key: 'ALL' as const, label: 'All' },
              { key: 'VERIFIED' as const, label: 'Verified' },
              { key: 'UNVERIFIED' as const, label: 'Unverified' },
            ].map((vf) => (
              <button
                key={vf.key}
                onClick={() => {
                  setVerificationFilter(vf.key);
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-colors ${
                  verificationFilter === vf.key ? 'bg-zinc-800 text-white shadow-xs' : 'bg-surface-dim text-muted hover:text-primary'
                }`}
              >
                {vf.label}
              </button>
            ))}
          </div>
        </div>

        {/* Floating Bulk Action Bar */}
        {selectedUserIds.size > 0 && (
          <div className="p-3 bg-primary text-white rounded-2xl shadow-lg flex flex-wrap items-center justify-between gap-3 text-xs animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-white/20 font-bold text-[11px]">
                {selectedUserIds.size} selected
              </span>
              <span className="text-white/80">Protected founder accounts skipped automatically.</span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => handleBulkAction('ACTIVATE')}
                disabled={isSubmitting}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
              >
                Bulk Activate
              </button>
              <button
                onClick={() => handleBulkAction('SUSPEND')}
                disabled={isSubmitting}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
              >
                Bulk Suspend
              </button>
              <button
                onClick={() => setShowBulkDeleteModal(true)}
                disabled={isSubmitting}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
              >
                Bulk Delete
              </button>
              <button
                onClick={clearSelection}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Directory Content */}
        {filteredUsers.length === 0 ? (
          <div className="bg-surface border border-border rounded-2xl p-12 text-center max-w-xl mx-auto space-y-4 shadow-sm">
            <div className="w-14 h-14 bg-accent/10 text-accent rounded-full flex items-center justify-center mx-auto">
              <Users className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="font-display text-lg font-bold text-primary">
                {users.length === 0 ? 'No Registered Accounts Found' : 'No Matching User Accounts'}
              </h3>
              <p className="text-xs text-muted max-w-md mx-auto leading-relaxed">
                {users.length === 0
                  ? 'All records rendered here come from verified authentic database accounts. Click + Add New User to register one.'
                  : 'Try modifying your search keywords or resetting active role and status filters.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Mobile / Tablet Cards (< lg) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:hidden">
              {paginatedUsers.map((u) => {
                const isProt = isAccountProtected(u);
                return (
                  <div key={u.id} className="bg-surface rounded-2xl border border-border p-4 shadow-sm space-y-3 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 min-w-0">
                        {isProt ? (
                          <span title="Protected Super Administrator Account cannot be selected or deleted">
                            <input
                              type="checkbox"
                              disabled
                              checked={false}
                              className="mt-1 rounded border-border text-accent opacity-30 cursor-not-allowed"
                            />
                          </span>
                        ) : (
                          <input
                            type="checkbox"
                            checked={selectedUserIds.has(u.id)}
                            onChange={() => toggleSelectUser(u.id)}
                            className="mt-1 rounded border-border text-accent focus:ring-accent"
                          />
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="font-bold text-primary text-sm truncate">{u.fullName}</h3>
                            {isProt && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                <Shield className="w-2.5 h-2.5 text-purple-600" /> Super Admin
                              </span>
                            )}
                          </div>
                          <p className="text-muted font-mono text-[11px] flex items-center gap-1 break-all mt-0.5">
                            <Mail className="w-3 h-3 text-accent shrink-0" />
                            <span>{u.email}</span>
                          </p>
                          {u.phone && (
                            <p className="text-muted text-[11px] flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3 text-accent shrink-0" />
                              <span>{u.phone}</span>
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0 space-y-1">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${getRoleBadgeClass(u.role)}`}>
                          {u.role || 'CUSTOMER'}
                        </span>
                        <span className={`block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                          u.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {u.status}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/60">
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-muted block">Orders / Spend</span>
                        <span className="font-extrabold text-primary text-sm">
                          {formatPaiseToRupees(u.lifetimeSpendInPaise || 0)}
                        </span>
                        <span className="text-muted text-[11px] block">
                          {u.totalOrders || 0} {(u.totalOrders || 0) === 1 ? 'order' : 'orders'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-muted block">Registered</span>
                        <span className="text-primary font-medium block">
                          {new Date(u.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-border/60 flex flex-wrap items-center justify-between gap-2">
                      {isProt ? (
                        <span className="text-[10px] text-muted italic">Permanent Active</span>
                      ) : (
                        <button
                          onClick={() => handleToggleStatus(u)}
                          className="text-[10px] font-semibold text-accent hover:underline"
                        >
                          {u.status === 'ACTIVE' ? 'Suspend Account' : 'Activate Account'}
                        </button>
                      )}

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => inspectUser(u)}
                          className="px-2 py-1 bg-surface-dim hover:bg-border text-primary rounded-lg font-semibold text-[11px]"
                        >
                          Details
                        </button>
                        <button
                          onClick={() => openRoleModal(u)}
                          className="p-1.5 hover:bg-surface-dim text-accent rounded-lg"
                          title="Manage Role & Permissions"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openEditModal(u)}
                          className="p-1.5 hover:bg-surface-dim text-primary rounded-lg"
                          title="Edit user profile"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {isProt ? (
                          <span
                            className="p-1.5 text-amber-600/70 cursor-not-allowed rounded-lg inline-flex items-center justify-center bg-amber-50/50 border border-amber-200/50"
                            title="Protected Super Administrator Account cannot be deleted"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                          </span>
                        ) : (
                          <button
                            onClick={() => setDeletingUserId(u.id)}
                            className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg"
                            title="Delete user"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table (lg+) */}
            <div className="hidden lg:block bg-surface rounded-2xl border border-border overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-dim border-b border-border text-muted font-bold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-4 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={selectedUserIds.size === selectableUsers.length && selectableUsers.length > 0}
                          onChange={toggleSelectAll}
                          className="rounded border-border text-accent focus:ring-accent"
                          aria-label="Select all eligible users"
                        />
                      </th>
                      <th className="py-3 px-4">User & Contact</th>
                      <th className="py-3 px-4">Role & Authority</th>
                      <th className="py-3 px-4">Account Status</th>
                      <th className="py-3 px-4">Orders & Lifetime Spend</th>
                      <th className="py-3 px-4">Registered Date</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {paginatedUsers.map((u) => {
                      const isProt = isAccountProtected(u);
                      return (
                        <tr key={u.id} className={`hover:bg-surface-dim/40 transition-colors ${selectedUserIds.has(u.id) ? 'bg-accent/5' : ''}`}>
                          <td className="py-4 px-4 w-10 text-center">
                            {isProt ? (
                              <span title="Protected Super Administrator Account cannot be selected or deleted">
                                <input
                                  type="checkbox"
                                  disabled
                                  checked={false}
                                  className="rounded border-border text-accent opacity-30 cursor-not-allowed"
                                />
                              </span>
                            ) : (
                              <input
                                type="checkbox"
                                checked={selectedUserIds.has(u.id)}
                                onChange={() => toggleSelectUser(u.id)}
                                className="rounded border-border text-accent focus:ring-accent"
                              />
                            )}
                          </td>

                          <td className="py-4 px-4">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-primary block text-sm">
                                  {u.fullName}
                                </span>
                                {isProt && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                    <Shield className="w-2.5 h-2.5 text-purple-600" /> Super Admin
                                  </span>
                                )}
                              </div>
                              <span className="text-muted flex items-center gap-1 font-mono text-[11px]">
                                <Mail className="w-3 h-3 text-accent" />
                                <span>{u.email}</span>
                              </span>
                              {u.phone && (
                                <span className="text-muted flex items-center gap-1 text-[11px]">
                                  <Phone className="w-3 h-3 text-accent" />
                                  <span>{u.phone}</span>
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-4 px-4">
                            <div className="space-y-1">
                              <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${getRoleBadgeClass(u.role)}`}>
                                {u.role || 'CUSTOMER'}
                              </span>
                              <div>
                                <button
                                  onClick={() => openRoleModal(u)}
                                  className="text-[10px] text-accent hover:underline font-medium flex items-center gap-1"
                                >
                                  <ShieldCheck className="w-3 h-3" />
                                  <span>{u.permissions?.length || (u.role === 'ADMIN' || u.role === 'SUPER_ADMIN' ? 8 : 0)} perms</span>
                                </button>
                              </div>
                            </div>
                          </td>

                          <td className="py-4 px-4">
                            <div className="space-y-1">
                              <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                u.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                              }`}>
                                {u.status}
                              </span>
                              <span className={`block w-fit px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                                u.emailVerified !== false ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800'
                              }`}>
                                {u.emailVerified !== false ? 'Email Verified' : 'Unverified'}
                              </span>
                              {isProt ? (
                                <span className="text-[10px] text-muted italic block">Permanent Active</span>
                              ) : (
                                <button
                                  onClick={() => handleToggleStatus(u)}
                                  className="text-[10px] font-semibold text-accent hover:underline block"
                                >
                                  {u.status === 'ACTIVE' ? 'Suspend User' : 'Activate User'}
                                </button>
                              )}
                            </div>
                          </td>

                          <td className="py-4 px-4">
                            <div className="space-y-0.5">
                              <span className="font-extrabold text-primary block">
                                {formatPaiseToRupees(u.lifetimeSpendInPaise || 0)}
                              </span>
                              <span className="text-muted text-[11px]">
                                {u.totalOrders || 0} {(u.totalOrders || 0) === 1 ? 'order' : 'orders'} placed
                              </span>
                            </div>
                          </td>

                          <td className="py-4 px-4 text-muted text-[11px]">
                            <span>{new Date(u.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                          </td>

                          <td className="py-4 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => inspectUser(u)}
                                className="px-2.5 py-1.5 bg-surface-dim hover:bg-border text-primary rounded-lg font-semibold text-[11px] transition-colors"
                                title="Inspect user profile and orders"
                              >
                                Details
                              </button>
                              <button
                                onClick={() => openRoleModal(u)}
                                className="p-1.5 hover:bg-surface-dim text-accent rounded-lg transition-colors"
                                title="Manage Role & Permissions"
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => openEditModal(u)}
                                className="p-1.5 hover:bg-surface-dim text-primary rounded-lg transition-colors"
                                title="Edit user profile"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              {isProt ? (
                                <span
                                  className="p-1.5 text-amber-600/70 cursor-not-allowed rounded-lg inline-flex items-center justify-center bg-amber-50/50 border border-amber-200/50"
                                  title="Protected Super Administrator Account cannot be deleted"
                                >
                                  <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                                </span>
                              ) : (
                                <button
                                  onClick={() => setDeletingUserId(u.id)}
                                  className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg transition-colors"
                                  title="Delete user"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              <div className="px-4 py-3 bg-surface-dim/40 border-t border-border flex items-center justify-between text-xs text-muted">
                <span>
                  Showing {Math.min((currentPage - 1) * pageSize + 1, filteredUsers.length)} to{' '}
                  {Math.min(currentPage * pageSize, filteredUsers.length)} of {filteredUsers.length} user accounts
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    disabled={currentPage === 1}
                    className="p-1 rounded hover:bg-surface-dim disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-2 font-semibold text-primary">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="p-1 rounded hover:bg-surface-dim disabled:opacity-40"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Add New User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-surface border border-border rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-display font-bold text-lg text-primary">Add New User Account</h3>
                <p className="text-xs text-muted">Register a new authentic database user account.</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-1 text-muted hover:text-primary rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={formFullName}
                  onChange={(e) => setFormFullName(e.target.value)}
                  placeholder="e.g. Ayesha Rahman"
                  className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="e.g. admin@infinicharm.com"
                  className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="e.g. 8825164657"
                    className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1">
                    Initial Password
                  </label>
                  <input
                    type="password"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder="Defaults to secure temporary password"
                    className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1">
                    System Role
                  </label>
                  <select
                    value={formRole}
                    onChange={(e) => {
                      const newRole = e.target.value as UserRole;
                      setFormRole(newRole);
                      if (newRole === 'ADMIN' || newRole === 'SUPER_ADMIN') {
                        setFormPermissions(ALL_PERMISSIONS.map(p => p.key));
                      }
                    }}
                    className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                  >
                    {ALL_ROLES.filter(r => r.key !== 'SUPER_ADMIN').map((r) => (
                      <option key={r.key} value={r.key}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1">
                    Account Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="add-email-verified"
                  checked={formEmailVerified}
                  onChange={(e) => setFormEmailVerified(e.target.checked)}
                  className="rounded border-border text-accent focus:ring-accent"
                />
                <label htmlFor="add-email-verified" className="text-xs text-primary font-medium">
                  Mark email as verified upon creation
                </label>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1">
                  Administrative Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Internal notes regarding this user account..."
                  className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                />
              </div>

              <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-surface-dim hover:bg-border text-primary rounded-xl font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-accent hover:bg-accent-hover text-white rounded-xl font-bold transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-surface border border-border rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-display font-bold text-lg text-primary">Edit User Profile</h3>
                <p className="text-xs text-muted">{editingUser.email}</p>
              </div>
              <button onClick={() => setEditingUser(null)} className="p-1 text-muted hover:text-primary rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditUser} className="space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={formFullName}
                  onChange={(e) => setFormFullName(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1">
                    Account Status
                  </label>
                  <select
                    disabled={isAccountProtected(editingUser)}
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent disabled:opacity-50"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1">
                  Reset Password Directly (Optional)
                </label>
                <input
                  type="password"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder="Leave empty to keep existing password"
                  className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1">
                  Administrative Notes
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                />
              </div>

              <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 bg-surface-dim hover:bg-border text-primary rounded-xl font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-accent hover:bg-accent-hover text-white rounded-xl font-bold transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Role & Permissions Modal */}
      {roleEditingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-surface border border-border rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-display font-bold text-lg text-primary">Role-Based Access Control</h3>
                <p className="text-xs text-muted">{roleEditingUser.fullName} ({roleEditingUser.email})</p>
              </div>
              <button onClick={() => setRoleEditingUser(null)} className="p-1 text-muted hover:text-primary rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRolePermissions} className="space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1">
                  Assign System Role
                </label>
                {isAccountProtected(roleEditingUser) ? (
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-purple-900 font-semibold">
                    Permanent Super Administrator Account. Role cannot be modified.
                  </div>
                ) : (
                  <select
                    value={formRole}
                    onChange={(e) => {
                      const newRole = e.target.value as UserRole;
                      setFormRole(newRole);
                      if (newRole === 'ADMIN') {
                        setFormPermissions(ALL_PERMISSIONS.map(p => p.key));
                      }
                    }}
                    className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary font-semibold focus:outline-none focus:border-accent"
                  >
                    {ALL_ROLES.filter(r => r.key !== 'SUPER_ADMIN').map((r) => (
                      <option key={r.key} value={r.key}>
                        {r.label} ({r.key})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-2">
                  Granular Operational Permissions ({formPermissions.length} active)
                </label>
                <div className="space-y-2 border border-border rounded-xl p-3 bg-surface-dim/40 max-h-56 overflow-y-auto">
                  {ALL_PERMISSIONS.map((perm) => {
                    const isChecked = formPermissions.includes(perm.key);
                    const isLocked = isAccountProtected(roleEditingUser);
                    return (
                      <label
                        key={perm.key}
                        className={`flex items-start gap-2.5 p-2 rounded-lg border transition-colors ${
                          isChecked ? 'bg-accent/5 border-accent/30' : 'bg-surface border-border/60'
                        } ${isLocked ? 'opacity-80 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <input
                          type="checkbox"
                          disabled={isLocked}
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormPermissions([...formPermissions, perm.key]);
                            } else {
                              setFormPermissions(formPermissions.filter(p => p !== perm.key));
                            }
                          }}
                          className="mt-0.5 rounded border-border text-accent focus:ring-accent"
                        />
                        <div className="min-w-0">
                          <span className="font-bold text-primary block text-[11px]">{perm.label}</span>
                          <span className="text-[10px] text-muted block font-mono">{perm.key} • {perm.category}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRoleEditingUser(null)}
                  className="px-4 py-2 bg-surface-dim hover:bg-border text-primary rounded-xl font-semibold transition-colors"
                >
                  Cancel
                </button>
                {!isAccountProtected(roleEditingUser) && (
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 bg-accent hover:bg-accent-hover text-white rounded-xl font-bold transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? 'Saving...' : 'Update Authorities'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* User Inspector Drawer */}
      {inspectingUser && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs">
          <div className="bg-surface border-l border-border w-full max-w-xl h-full overflow-y-auto shadow-2xl p-6 space-y-6 animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-accent block">User Profile Inspector</span>
                <h3 className="font-display font-bold text-xl text-primary mt-0.5">{inspectingUser.fullName}</h3>
                <span className="text-xs text-muted font-mono">{inspectingUser.id}</span>
              </div>
              <button onClick={() => setInspectingUser(null)} className="p-2 text-muted hover:text-primary rounded-xl hover:bg-surface-dim">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Account Details Card */}
            <div className="bg-surface-dim/40 border border-border rounded-2xl p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-primary text-sm flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-accent" />
                  <span>Account Credentials & Security</span>
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${getRoleBadgeClass(inspectingUser.role)}`}>
                  {inspectingUser.role || 'CUSTOMER'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <span className="text-[10px] text-muted block uppercase font-bold">Email Address</span>
                  <span className="font-mono text-primary break-all">{inspectingUser.email}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted block uppercase font-bold">Phone Number</span>
                  <span className="font-mono text-primary">{inspectingUser.phone || 'None registered'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted block uppercase font-bold">Account Standing</span>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase mt-0.5 ${
                    inspectingUser.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {inspectingUser.status}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-muted block uppercase font-bold">Email Verification</span>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase mt-0.5 ${
                    inspectingUser.emailVerified !== false ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {inspectingUser.emailVerified !== false ? 'Verified' : 'Pending'}
                  </span>
                </div>
              </div>
            </div>

            {/* Lifetime Spend & Orders */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-surface-dim/40 border border-border rounded-2xl p-4 text-xs">
                <span className="text-[10px] text-muted uppercase font-bold block">Lifetime Financial GMV</span>
                <span className="text-xl font-extrabold text-primary block mt-1">
                  {formatPaiseToRupees(inspectingUser.lifetimeSpendInPaise || 0)}
                </span>
              </div>
              <div className="bg-surface-dim/40 border border-border rounded-2xl p-4 text-xs">
                <span className="text-[10px] text-muted uppercase font-bold block">Orders Fulfilled</span>
                <span className="text-xl font-extrabold text-primary block mt-1">
                  {inspectingUser.totalOrders || 0}
                </span>
              </div>
            </div>

            {/* Saved Addresses */}
            <div className="space-y-2 text-xs">
              <span className="font-bold text-primary block">Saved Addresses ({inspectingUser.addresses?.length || 0})</span>
              {(!inspectingUser.addresses || inspectingUser.addresses.length === 0) ? (
                <p className="text-muted italic bg-surface-dim/30 p-3 rounded-xl border border-border/50">
                  No delivery addresses saved for this account.
                </p>
              ) : (
                <div className="space-y-2">
                  {inspectingUser.addresses.map((addr) => (
                    <div key={addr.id} className="p-3 bg-surface-dim/40 border border-border rounded-xl">
                      <span className="font-bold text-primary block">{addr.fullName} • {addr.phone}</span>
                      <span className="text-muted block text-[11px] mt-0.5">{addr.addressLine1}, {addr.city}, {addr.state} - {addr.postalCode}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Linked Orders */}
            <div className="space-y-2 text-xs">
              <span className="font-bold text-primary block">Order History ({inspectingUserOrders.length})</span>
              {inspectingUserOrders.length === 0 ? (
                <p className="text-muted italic bg-surface-dim/30 p-3 rounded-xl border border-border/50">
                  No orders recorded for this patron.
                </p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {inspectingUserOrders.map((ord) => (
                    <div key={ord.id} className="p-3 bg-surface-dim/40 border border-border rounded-xl flex items-center justify-between">
                      <div>
                        <span className="font-bold text-primary font-mono block">{ord.orderNumber}</span>
                        <span className="text-muted text-[11px] block">{new Date(ord.createdAt).toLocaleDateString()} • {ord.status}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-primary block">{formatPaiseToRupees(ord.totalInPaise)}</span>
                        <span className="text-[10px] text-accent uppercase font-semibold">{ord.paymentStatus}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Drawer Actions */}
            <div className="pt-4 border-t border-border flex items-center gap-2">
              <button
                onClick={() => {
                  setInspectingUser(null);
                  openEditModal(inspectingUser);
                }}
                className="flex-1 py-2 bg-accent hover:bg-accent-hover text-white rounded-xl font-bold text-xs transition-colors"
              >
                Edit Profile
              </button>
              <button
                onClick={() => setInspectingUser(null)}
                className="px-4 py-2 bg-surface-dim hover:bg-border text-primary rounded-xl font-semibold text-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-surface border border-border rounded-2xl max-w-md w-full shadow-2xl p-6 space-y-4">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-display font-bold text-lg text-primary">Permanently Delete User Account?</h3>
              <p className="text-xs text-muted leading-relaxed">
                This action is irreversible. All linked addresses, wishlists, and session credentials will be permanently deleted.
                Per Indian statutory and tax regulations (GST & DPDP Act 2023), financial invoices are retained with personal identifying details securely anonymized.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setDeletingUserId(null)}
                className="px-4 py-2 bg-surface-dim hover:bg-border text-primary rounded-xl font-semibold text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteUser(deletingUserId)}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs transition-colors"
              >
                Confirm Deletion
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Modal */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-surface border border-border rounded-2xl max-w-md w-full shadow-2xl p-6 space-y-4">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-display font-bold text-lg text-primary">Bulk Delete {selectedUserIds.size} User Account(s)?</h3>
              <p className="text-xs text-muted leading-relaxed">
                Selected non-protected accounts will be permanently deleted. Protected root founder accounts are protected and skipped automatically.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setShowBulkDeleteModal(false)}
                className="px-4 py-2 bg-surface-dim hover:bg-border text-primary rounded-xl font-semibold text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleBulkAction('DELETE')}
                disabled={isSubmitting}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Deleting...' : 'Confirm Bulk Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
