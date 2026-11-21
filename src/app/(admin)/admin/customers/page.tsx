'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { formatPaiseToRupees } from '@/lib/utils/currency';
import { lookupPinCode } from '@/lib/utils/pincode';
import { getAllProducts } from '@/lib/data/products';
import { Customer, CustomerAddress, CustomerStatus, CustomerSummary, Order, UserRole } from '@/types';
import {
  Users,
  Search,
  Mail,
  Phone,
  MapPin,
  ShoppingBag,
  Calendar,
  ExternalLink,
  ShieldCheck,
  ChevronRight,
  X,
  CreditCard,
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  CheckCircle2,
  UserCheck,
  UserX,
  Ban,
  Clock,
  Shield,
  FileText,
  Save,
  Filter,
  Heart,
  KeyRound,
  Loader2,
  CheckSquare,
  Square,
} from 'lucide-react';

export default function AdminCustomersPage() {
  const allProducts = getAllProducts();
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [verificationFilter, setVerificationFilter] = useState<'ALL' | 'VERIFIED' | 'UNVERIFIED'>('ALL');
  const [verifyingCustomerId, setVerifyingCustomerId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'REGISTERED' | 'ORDERS' | 'SPEND' | 'NAME'>('REGISTERED');

  // Modal & Drawer States
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSummary | null>(null);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerSummary | null>(null);
  const [deletingCustomerId, setDeletingCustomerId] = useState<string | null>(null);
  const [addressModalCustomer, setAddressModalCustomer] = useState<CustomerSummary | null>(null);

  // Bulk Actions State
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Notifications
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Add / Edit Form States
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formStatus, setFormStatus] = useState<CustomerStatus>('ACTIVE');
  const [formRole, setFormRole] = useState<UserRole>('CUSTOMER');
  const [formNotes, setFormNotes] = useState('');
  const [formPassword, setFormPassword] = useState('');

  // Address Management Form States
  const [addrFullName, setAddrFullName] = useState('');
  const [addrPhone, setAddrPhone] = useState('');
  const [addrLine1, setAddrLine1] = useState('');
  const [addrLine2, setAddrLine2] = useState('');
  const [addrPin, setAddrPin] = useState('');
  const [addrCity, setAddrCity] = useState('');
  const [addrState, setAddrState] = useState('');
  const [addrIsDefault, setAddrIsDefault] = useState(false);
  const [editingAddrId, setEditingAddrId] = useState<string | null>(null);

  const fetchCustomers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/customers');
      if (res.status === 401) {
        window.location.href = `/admin/login?redirect=${encodeURIComponent(window.location.pathname)}`;
        return;
      }
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.customers)) {
          setCustomers(data.customers);
          return;
        }
      }
    } catch (err) {
      console.error('Failed to fetch customers:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const viewCustomerDetails = async (cust: CustomerSummary) => {
    setSelectedCustomer(cust);
    try {
      const res = await fetch(`/api/admin/customers/${cust.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setCustomerOrders(data.orders || []);
          if (data.customer) {
            setSelectedCustomer((prev) => (prev ? { ...prev, ...data.customer } : prev));
          }
        }
      }
    } catch {
      setCustomerOrders([]);
    }
  };

  const openAddCustomerModal = () => {
    setFormName('');
    setFormEmail('');
    setFormPhone('');
    setFormStatus('ACTIVE');
    setFormRole('CUSTOMER');
    setFormNotes('');
    setFormPassword('');
    setErrorMsg(null);
    setShowAddModal(true);
  };

  const openEditCustomerModal = (cust: CustomerSummary) => {
    setEditingCustomer(cust);
    setFormName(cust.fullName);
    setFormEmail(cust.email);
    setFormPhone(cust.phone);
    setFormStatus(cust.status);
    setFormRole(cust.role || 'CUSTOMER');
    setFormNotes(cust.notes || '');
    setFormPassword('');
    setErrorMsg(null);
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!formName.trim() || !formEmail.trim()) {
      setErrorMsg('Full name and email address are required.');
      return;
    }

    try {
      const res = await fetch('/api/admin/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: formName.trim(),
          email: formEmail.trim().toLowerCase(),
          phone: formPhone.trim(),
          status: formStatus,
          role: formRole,
          notes: formNotes.trim(),
          password:
            formPassword ||
            (process.env.NODE_ENV !== 'production'
              ? 'Customer@1234!'
              : Math.random().toString(36).slice(-10) + 'A1!'),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create customer account.');
      }

      setSuccessMsg('Customer profile registered successfully.');
      setTimeout(() => setSuccessMsg(null), 3500);
      setShowAddModal(false);
      fetchCustomers();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error creating customer.');
    }
  };

  const handleUpdateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/admin/customers/${editingCustomer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: formName.trim(),
          email: formEmail.trim().toLowerCase(),
          phone: formPhone.trim(),
          status: formStatus,
          role: formRole,
          notes: formNotes.trim(),
          password: formPassword.trim() ? formPassword.trim() : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update customer account.');
      }

      setSuccessMsg('Customer profile updated successfully.');
      setTimeout(() => setSuccessMsg(null), 3500);
      setEditingCustomer(null);
      if (selectedCustomer?.id === editingCustomer.id) {
        setSelectedCustomer((prev) => (prev ? { ...prev, ...data.customer } : prev));
      }
      fetchCustomers();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error updating customer.');
    }
  };

  const handleRemoveWishlistItem = async (customerId: string, productId: string) => {
    try {
      const res = await fetch(`/api/admin/customers/${customerId}/wishlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REMOVE', productId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg('Product removed from customer wishlist.');
        setTimeout(() => setSuccessMsg(null), 3000);
        if (selectedCustomer && selectedCustomer.id === customerId) {
          setSelectedCustomer({
            ...selectedCustomer,
            wishlistProductIds: data.wishlistProductIds,
          });
        }
        fetchCustomers();
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error updating wishlist.');
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/customers/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to delete customer.');

      setSuccessMsg('Customer account deleted successfully.');
      setTimeout(() => setSuccessMsg(null), 3500);
      setDeletingCustomerId(null);
      if (selectedCustomer?.id === id) setSelectedCustomer(null);
      fetchCustomers();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error deleting customer.');
    }
  };

  const isAccountProtected = (c: CustomerSummary) =>
    Boolean(
      c.isProtected ||
      c.id === 'cust-founder-01' ||
      c.email.toLowerCase() === 'abdurrahmanibnghufran@gmail.com' ||
      c.role === 'SUPER_ADMIN'
    );

  const handleBulkDelete = async () => {
    if (selectedCustomerIds.size === 0) return;
    setIsBulkDeleting(true);
    try {
      const res = await fetch('/api/admin/customers/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerIds: Array.from(selectedCustomerIds) }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to complete bulk deletion.');
      }
      setSuccessMsg(`Successfully deleted ${data.deletedCount} customer account(s).`);
      setTimeout(() => setSuccessMsg(null), 3500);
      setShowBulkDeleteModal(false);
      clearSelection();
      fetchCustomers();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error processing bulk customer deletion.');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleToggleStatus = async (cust: CustomerSummary) => {
    const nextStatus: CustomerStatus = cust.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      const res = await fetch(`/api/admin/customers/${cust.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        setSuccessMsg(`Customer status changed to ${nextStatus}.`);
        setTimeout(() => setSuccessMsg(null), 3000);
        fetchCustomers();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCustomerVerificationAction = async (
    cust: CustomerSummary,
    action: 'VERIFY' | 'UNVERIFY' | 'RESEND'
  ) => {
    setVerifyingCustomerId(cust.id);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/admin/customers/${cust.id}/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Verification update failed.');
      }
      setSuccessMsg(data.message || 'Verification status updated.');
      setTimeout(() => setSuccessMsg(null), 3500);
      if (data.customer && selectedCustomer?.id === cust.id) {
        setSelectedCustomer((prev) => (prev ? { ...prev, ...data.customer } : prev));
      }
      await fetchCustomers();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to update email verification.');
    } finally {
      setVerifyingCustomerId(null);
    }
  };

  // Address Management in Admin
  const openAddressModal = (cust: CustomerSummary) => {
    setAddressModalCustomer(cust);
    setEditingAddrId(null);
    setAddrFullName(cust.fullName);
    setAddrPhone(cust.phone);
    setAddrLine1('');
    setAddrLine2('');
    setAddrPin('');
    setAddrCity('');
    setAddrState('');
    setAddrIsDefault((cust.addresses?.length || 0) === 0);
  };

  const handleAddrPinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setAddrPin(val);
    if (val.length === 6) {
      const info = lookupPinCode(val);
      if (info) {
        setAddrCity(info.city);
        setAddrState(info.state);
      }
    }
  };

  const handleSaveCustomerAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addressModalCustomer) return;

    try {
      const res = await fetch(`/api/admin/customers/${addressModalCustomer.id}/addresses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: editingAddrId ? 'UPDATE' : 'ADD',
          addressData: {
            id: editingAddrId || undefined,
            fullName: addrFullName.trim(),
            phone: addrPhone.trim(),
            addressLine1: addrLine1.trim(),
            addressLine2: addrLine2.trim() || undefined,
            city: addrCity.trim(),
            state: addrState.trim(),
            postalCode: addrPin.trim(),
            country: 'India',
            isDefaultShipping: addrIsDefault,
            isDefaultBilling: addrIsDefault,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to save address.');

      setSuccessMsg('Address updated on customer profile.');
      setTimeout(() => setSuccessMsg(null), 3500);
      setAddressModalCustomer(null);
      fetchCustomers();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error updating address.');
    }
  };

  const handleDeleteCustomerAddress = async (customerId: string, addressId: string) => {
    try {
      const res = await fetch(`/api/admin/customers/${customerId}/addresses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'DELETE',
          addressData: { id: addressId },
        }),
      });
      if (res.ok) {
        setSuccessMsg('Address removed from customer profile.');
        setTimeout(() => setSuccessMsg(null), 3000);
        fetchCustomers();
        // Update local modal state if open
        if (addressModalCustomer) {
          setAddressModalCustomer({
            ...addressModalCustomer,
            addresses: (addressModalCustomer.addresses || []).filter((a) => a.id !== addressId),
          });
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Filter & Sort
  const filteredCustomers = customers
    .filter((c) => {
      const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
      const isVerified = c.emailVerified !== false;
      const matchesVerification =
        verificationFilter === 'ALL' ||
        (verificationFilter === 'VERIFIED' ? isVerified : !isVerified);
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        c.fullName.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.addresses || []).some(
          (a) =>
            a.city.toLowerCase().includes(q) ||
            a.state.toLowerCase().includes(q) ||
            a.postalCode.includes(q)
        );
      return matchesStatus && matchesVerification && matchesSearch;
    })
    .sort((a, b) => {
      if (sortBy === 'ORDERS') return b.totalOrders - a.totalOrders;
      if (sortBy === 'SPEND') return b.lifetimeSpendInPaise - a.lifetimeSpendInPaise;
      if (sortBy === 'NAME') return a.fullName.localeCompare(b.fullName);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const totalLifetimePaise = customers.reduce((acc, curr) => acc + curr.lifetimeSpendInPaise, 0);
  const activeCount = customers.filter((c) => c.status === 'ACTIVE').length;
  const suspendedCount = customers.filter((c) => c.status === 'SUSPENDED').length;

  const selectableCustomers = filteredCustomers.filter((c) => !isAccountProtected(c));

  const toggleSelectCustomer = (id: string) => {
    const cust = customers.find((c) => c.id === id);
    if (cust && isAccountProtected(cust)) return;
    setSelectedCustomerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedCustomerIds.size === selectableCustomers.length && selectableCustomers.length > 0) {
      setSelectedCustomerIds(new Set());
    } else {
      setSelectedCustomerIds(new Set(selectableCustomers.map((c) => c.id)));
    }
  };

  const clearSelection = () => {
    setSelectedCustomerIds(new Set());
  };

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <AdminHeader />

      <main className="flex-1 p-6 sm:p-8 max-w-7xl mx-auto w-full space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-primary tracking-tight">
              Customer Directory & Relationship Insights
            </h1>
            <p className="text-xs text-muted mt-1">
              Grounded strictly in verified storefront order history and registered accounts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-primary bg-surface border border-border">
              <ShieldCheck className="w-4 h-4 text-accent" />
              <span>DPDP Act 2023 Compliant</span>
            </span>

            <button
              onClick={openAddCustomerModal}
              className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add New Customer</span>
            </button>
          </div>
        </div>

        {successMsg && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-semibold">{errorMsg}</span>
          </div>
        )}

        {/* Aggregate Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-surface rounded-2xl border border-border p-5 shadow-sm space-y-1">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">
              Total Accounts
            </span>
            <div className="font-display text-2xl font-bold text-primary">{customers.length}</div>
            <p className="text-[11px] text-muted">
              {activeCount} Active • {suspendedCount} Suspended
            </p>
          </div>

          <div className="bg-surface rounded-2xl border border-border p-5 shadow-sm space-y-1">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">
              Cumulative GMV
            </span>
            <div className="font-display text-2xl font-bold text-primary">
              {formatPaiseToRupees(totalLifetimePaise)}
            </div>
            <p className="text-[11px] text-muted">Total customer lifetime value</p>
          </div>

          <div className="bg-surface rounded-2xl border border-border p-5 shadow-sm space-y-1">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">
              Average LTV
            </span>
            <div className="font-display text-2xl font-bold text-primary">
              {customers.length > 0
                ? formatPaiseToRupees(Math.round(totalLifetimePaise / customers.length))
                : '₹0.00'}
            </div>
            <p className="text-[11px] text-muted">Average revenue per customer</p>
          </div>

          <div className="bg-surface rounded-2xl border border-border p-5 shadow-sm space-y-1">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">
              Active Buyers
            </span>
            <div className="font-display text-2xl font-bold text-emerald-600">{activeCount}</div>
            <p className="text-[11px] text-muted">Verified order fulfillment ready</p>
          </div>
        </div>

        {/* Controls: Search, Status Filter & Sorting */}
        <div className="bg-surface rounded-2xl border border-border p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 text-xs">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, phone, city, or PIN code..."
              className="w-full pl-10 pr-4 py-2 bg-surface-dim border border-border rounded-xl text-xs text-primary focus:outline-none focus:border-accent"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="flex flex-wrap items-center gap-1 bg-surface-dim p-1 rounded-xl border border-border w-full sm:w-auto">
              {['ALL', 'ACTIVE', 'INACTIVE', 'SUSPENDED'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 sm:px-3 py-1 rounded-lg font-semibold text-[11px] transition-colors ${statusFilter === st
                      ? 'bg-accent text-white shadow-xs'
                      : 'text-muted hover:text-primary'
                    }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1 bg-surface-dim p-1 rounded-xl border border-border w-full sm:w-auto">
              {[
                { key: 'ALL' as const, label: 'All Emails' },
                { key: 'VERIFIED' as const, label: 'Verified' },
                { key: 'UNVERIFIED' as const, label: 'Unverified' },
              ].map((vf) => (
                <button
                  key={vf.key}
                  type="button"
                  data-testid={`filter-verification-${vf.key.toLowerCase()}`}
                  onClick={() => setVerificationFilter(vf.key)}
                  className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-colors ${
                    verificationFilter === vf.key
                      ? 'bg-primary text-white shadow-xs'
                      : 'text-muted hover:text-primary'
                  }`}
                >
                  {vf.label}
                </button>
              ))}
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full sm:w-auto px-3 py-1.5 bg-surface-dim border border-border rounded-xl text-primary text-xs focus:outline-none focus:border-accent"
            >
              <option value="REGISTERED">Sort: Latest Registered</option>
              <option value="ORDERS">Sort: Most Orders</option>
              <option value="SPEND">Sort: Highest Spend</option>
              <option value="NAME">Sort: Name (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Customer Directory Table */}
        {filteredCustomers.length === 0 ? (
          <div className="bg-surface border border-border rounded-2xl p-12 text-center max-w-xl mx-auto space-y-4 shadow-sm">
            <div className="w-14 h-14 bg-accent/10 text-accent rounded-full flex items-center justify-center mx-auto">
              <Users className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="font-display text-lg font-bold text-primary">
                {customers.length === 0
                  ? 'No Customer Records Registered Yet'
                  : 'No Matching Customers Found'}
              </h3>
              <p className="text-xs text-muted max-w-md mx-auto leading-relaxed">
                {customers.length === 0
                  ? 'Register customer profiles or allow storefront patrons to create accounts to manage them here.'
                  : 'Try modifying your search query or reset the status filter to inspect records.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Mobile & Tablet Responsive Cards (< lg) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:hidden">
              {filteredCustomers.map((cust) => {
                const primaryAddr = cust.addresses?.find((a) => a.isDefaultShipping) || cust.addresses?.[0];
                return (
                  <div
                    key={cust.id}
                    className="bg-surface rounded-2xl border border-border p-4 shadow-sm space-y-3 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 min-w-0">
                        {isAccountProtected(cust) ? (
                          <span title="Protected Root Founder Account cannot be selected or deleted">
                            <input
                              type="checkbox"
                              disabled
                              checked={false}
                              className="mt-1 rounded border-border text-accent focus:ring-accent opacity-30 cursor-not-allowed"
                              aria-label="Protected root founder account cannot be selected"
                            />
                          </span>
                        ) : (
                          <input
                            type="checkbox"
                            checked={selectedCustomerIds.has(cust.id)}
                            onChange={() => toggleSelectCustomer(cust.id)}
                            className="mt-1 rounded border-border text-accent focus:ring-accent"
                            aria-label={`Select ${cust.fullName}`}
                          />
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="font-bold text-primary text-sm truncate">{cust.fullName}</h3>
                            {isAccountProtected(cust) && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                <Shield className="w-2.5 h-2.5 text-purple-600" /> Root Founder
                              </span>
                            )}
                          </div>
                          <p className="text-muted font-mono text-[11px] flex items-center gap-1 break-all mt-0.5">
                            <Mail className="w-3 h-3 text-accent shrink-0" />
                            <span>{cust.email}</span>
                          </p>
                          {cust.phone && (
                            <p className="text-muted text-[11px] flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3 text-accent shrink-0" />
                              <span>{cust.phone}</span>
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0 space-y-1">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            cust.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : cust.status === 'SUSPENDED'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-zinc-100 text-zinc-800'
                          }`}
                        >
                          {cust.status}
                        </span>
                        <span
                          className={`block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                            cust.emailVerified !== false
                              ? 'bg-sky-100 text-sky-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {cust.emailVerified !== false ? 'Email Verified' : 'Pending Verification'}
                        </span>
                        {isAccountProtected(cust) ? (
                          <span className="block text-[10px] text-muted italic ml-auto">Permanent Active</span>
                        ) : (
                          <button
                            onClick={() => handleToggleStatus(cust)}
                            className="block text-[10px] font-semibold text-accent hover:underline ml-auto"
                          >
                            {cust.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/60">
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-muted block">Lifetime Spend</span>
                        <span className="font-extrabold text-primary text-sm">
                          {formatPaiseToRupees(cust.lifetimeSpendInPaise)}
                        </span>
                        <span className="text-muted text-[11px] block">
                          {cust.totalOrders} {cust.totalOrders === 1 ? 'order' : 'orders'}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] uppercase tracking-wider text-muted block">Primary Address</span>
                        {primaryAddr ? (
                          <span className="text-primary font-medium block truncate">
                            {primaryAddr.city}, {primaryAddr.state} ({primaryAddr.postalCode})
                          </span>
                        ) : (
                          <span className="text-muted italic text-[11px]">No addresses</span>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-border/60 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] text-muted">
                        {cust.lastOrderDate
                          ? `Last order ${new Date(cust.lastOrderDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
                          : `Registered ${new Date(cust.createdAt).toLocaleDateString()}`}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => viewCustomerDetails(cust)}
                          className="px-2.5 py-1.5 bg-surface-dim hover:bg-border text-primary rounded-lg font-semibold text-[11px]"
                        >
                          Details
                        </button>
                        <button
                          onClick={() => openAddressModal(cust)}
                          className="p-1.5 hover:bg-surface-dim text-accent rounded-lg"
                          title="Manage addresses"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openEditCustomerModal(cust)}
                          className="p-1.5 hover:bg-surface-dim text-primary rounded-lg"
                          title="Edit profile & status"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {isAccountProtected(cust) ? (
                          <span
                            className="p-1.5 text-amber-600/70 cursor-not-allowed rounded-lg inline-flex items-center justify-center bg-amber-50/50 border border-amber-200/50"
                            title="Protected Root Founder Account cannot be deleted"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                          </span>
                        ) : (
                          <button
                            onClick={() => setDeletingCustomerId(cust.id)}
                            className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg"
                            title="Delete customer"
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
                        checked={selectedCustomerIds.size === selectableCustomers.length && selectableCustomers.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-border text-accent focus:ring-accent"
                        aria-label="Select all customers"
                      />
                    </th>
                    <th className="py-3 px-4">Customer Name & Contact</th>
                    <th className="py-3 px-4">Status & Security</th>
                    <th className="py-3 px-4">Primary Address</th>
                    <th className="py-3 px-4">Orders & Lifetime Spend</th>
                    <th className="py-3 px-4">Last Activity</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredCustomers.map((cust) => {
                    const primaryAddr = cust.addresses?.find((a) => a.isDefaultShipping) || cust.addresses?.[0];
                    return (
                      <tr key={cust.id} className={`hover:bg-surface-dim/40 transition-colors ${selectedCustomerIds.has(cust.id) ? 'bg-accent/5' : ''}`}>
                        <td className="py-4 px-4 w-10 text-center">
                          {isAccountProtected(cust) ? (
                            <span title="Protected Root Founder Account cannot be selected or deleted">
                              <input
                                type="checkbox"
                                disabled
                                checked={false}
                                className="rounded border-border text-accent focus:ring-accent opacity-30 cursor-not-allowed"
                                aria-label="Protected root founder account cannot be selected"
                              />
                            </span>
                          ) : (
                            <input
                              type="checkbox"
                              checked={selectedCustomerIds.has(cust.id)}
                              onChange={() => toggleSelectCustomer(cust.id)}
                              className="rounded border-border text-accent focus:ring-accent"
                              aria-label={`Select ${cust.fullName}`}
                            />
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-primary block text-sm">
                                {cust.fullName}
                              </span>
                              {isAccountProtected(cust) && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                  <Shield className="w-2.5 h-2.5 text-purple-600" /> Root Founder
                                </span>
                              )}
                            </div>
                            <span className="text-muted flex items-center gap-1 font-mono text-[11px]">
                              <Mail className="w-3 h-3 text-accent" />
                              <span>{cust.email}</span>
                            </span>
                            {cust.phone && (
                              <span className="text-muted flex items-center gap-1 text-[11px]">
                                <Phone className="w-3 h-3 text-accent" />
                                <span>{cust.phone}</span>
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-4 px-4">
                          <div className="space-y-1.5">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${cust.status === 'ACTIVE'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : cust.status === 'SUSPENDED'
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-zinc-100 text-zinc-800'
                                }`}
                            >
                              {cust.status}
                            </span>
                            <span
                              data-testid={`customer-email-badge-${cust.id}`}
                              className={`block w-fit px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                                cust.emailVerified !== false
                                  ? 'bg-sky-100 text-sky-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {cust.emailVerified !== false ? 'Email Verified' : 'Unverified Email'}
                            </span>
                            <div className="flex flex-wrap items-center gap-2">
                              {isAccountProtected(cust) ? (
                                <span className="text-[10px] text-muted italic">Permanent Active</span>
                              ) : (
                                <button
                                  onClick={() => handleToggleStatus(cust)}
                                  className="text-[10px] font-semibold text-accent hover:underline"
                                >
                                  {cust.status === 'ACTIVE' ? 'Suspend Account' : 'Activate Account'}
                                </button>
                              )}
                              {cust.emailVerified === false ? (
                                <>
                                  <button
                                    type="button"
                                    disabled={verifyingCustomerId === cust.id}
                                    data-testid={`admin-verify-customer-${cust.id}`}
                                    onClick={() => handleCustomerVerificationAction(cust, 'VERIFY')}
                                    className="text-[10px] font-bold text-emerald-700 hover:underline disabled:opacity-50"
                                  >
                                    Verify Email
                                  </button>
                                  <button
                                    type="button"
                                    disabled={verifyingCustomerId === cust.id}
                                    data-testid={`admin-resend-customer-${cust.id}`}
                                    onClick={() => handleCustomerVerificationAction(cust, 'RESEND')}
                                    className="text-[10px] font-semibold text-amber-700 hover:underline disabled:opacity-50"
                                  >
                                    Resend Link
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  disabled={verifyingCustomerId === cust.id}
                                  data-testid={`admin-unverify-customer-${cust.id}`}
                                  onClick={() => handleCustomerVerificationAction(cust, 'UNVERIFY')}
                                  className="text-[10px] font-semibold text-muted hover:text-rose-700 hover:underline disabled:opacity-50"
                                >
                                  Revoke Verification
                                </button>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-4">
                          {primaryAddr ? (
                            <div className="space-y-0.5 max-w-xs">
                              <span className="text-primary font-medium block truncate">
                                {primaryAddr.city}, {primaryAddr.state}
                              </span>
                              <span className="text-muted text-[11px] block truncate">
                                {primaryAddr.addressLine1}
                              </span>
                              <span className="text-muted font-mono text-[10px]">
                                PIN: {primaryAddr.postalCode}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted italic text-[11px]">No addresses saved</span>
                          )}
                        </td>

                        <td className="py-4 px-4">
                          <div className="space-y-0.5">
                            <span className="font-extrabold text-primary block">
                              {formatPaiseToRupees(cust.lifetimeSpendInPaise)}
                            </span>
                            <span className="text-muted text-[11px]">
                              {cust.totalOrders} {cust.totalOrders === 1 ? 'order' : 'orders'} placed
                            </span>
                          </div>
                        </td>

                        <td className="py-4 px-4 text-muted text-[11px]">
                          {cust.lastOrderDate ? (
                            <span>
                              {new Date(cust.lastOrderDate).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </span>
                          ) : (
                            <span>Registered {new Date(cust.createdAt).toLocaleDateString()}</span>
                          )}
                        </td>

                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => viewCustomerDetails(cust)}
                              className="px-2.5 py-1.5 bg-surface-dim hover:bg-border text-primary rounded-lg font-semibold text-[11px] transition-colors"
                              title="View full customer file and order records"
                            >
                              Details
                            </button>
                            <button
                              onClick={() => openAddressModal(cust)}
                              className="p-1.5 hover:bg-surface-dim text-accent rounded-lg transition-colors"
                              title="Manage addresses"
                            >
                              <MapPin className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => openEditCustomerModal(cust)}
                              className="p-1.5 hover:bg-surface-dim text-primary rounded-lg transition-colors"
                              title="Edit profile & status"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            {isAccountProtected(cust) ? (
                              <span
                                className="p-1.5 text-amber-600/70 cursor-not-allowed rounded-lg inline-flex items-center justify-center bg-amber-50/50 border border-amber-200/50"
                                title="Protected Root Founder Account cannot be deleted"
                              >
                                <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                              </span>
                            ) : (
                              <button
                                onClick={() => setDeletingCustomerId(cust.id)}
                                className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg transition-colors"
                                title="Delete customer"
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
            </div>
          </div>
        )}

        {/* Customer Detail Drawer / Modal */}
        {selectedCustomer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-sm">
            <div className="bg-surface rounded-3xl border border-border p-6 sm:p-8 max-w-2xl w-full shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-accent text-white flex items-center justify-center font-bold text-lg">
                    {selectedCustomer.fullName.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-bold text-primary">
                      {selectedCustomer.fullName}
                    </h3>
                    <p className="text-xs text-muted">{selectedCustomer.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="p-1.5 text-muted hover:text-primary rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Stat badges */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-surface-dim rounded-xl border border-border">
                  <span className="text-[10px] text-muted uppercase font-bold">Lifetime Value</span>
                  <p className="font-bold text-primary text-sm mt-0.5">
                    {formatPaiseToRupees(selectedCustomer.lifetimeSpendInPaise)}
                  </p>
                </div>
                <div className="p-3 bg-surface-dim rounded-xl border border-border">
                  <span className="text-[10px] text-muted uppercase font-bold">Total Orders</span>
                  <p className="font-bold text-primary text-sm mt-0.5">
                    {selectedCustomer.totalOrders}
                  </p>
                </div>
                <div className="p-3 bg-surface-dim rounded-xl border border-border space-y-1">
                  <span className="text-[10px] text-muted uppercase font-bold">
                    Account &amp; Email Verification
                  </span>
                  <p className="font-bold text-emerald-600 text-sm">
                    {selectedCustomer.status} •{' '}
                    <span
                      className={
                        selectedCustomer.emailVerified !== false ? 'text-sky-700' : 'text-amber-700'
                      }
                    >
                      {selectedCustomer.emailVerified !== false ? 'Verified' : 'Pending'}
                    </span>
                  </p>
                  <div className="flex flex-wrap gap-2 pt-0.5">
                    {selectedCustomer.emailVerified === false ? (
                      <>
                        <button
                          type="button"
                          disabled={verifyingCustomerId === selectedCustomer.id}
                          onClick={() => handleCustomerVerificationAction(selectedCustomer, 'VERIFY')}
                          className="text-[10px] font-bold text-emerald-700 hover:underline"
                        >
                          Verify Now
                        </button>
                        <button
                          type="button"
                          disabled={verifyingCustomerId === selectedCustomer.id}
                          onClick={() => handleCustomerVerificationAction(selectedCustomer, 'RESEND')}
                          className="text-[10px] font-bold text-amber-700 hover:underline"
                        >
                          Resend Link
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={verifyingCustomerId === selectedCustomer.id}
                        onClick={() => handleCustomerVerificationAction(selectedCustomer, 'UNVERIFY')}
                        className="text-[10px] font-semibold text-rose-700 hover:underline"
                      >
                        Revoke Verification
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Saved Addresses */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-primary text-xs uppercase tracking-wider">
                    Saved Address Book ({selectedCustomer.addresses?.length || 0})
                  </h4>
                  <button
                    onClick={() => {
                      setSelectedCustomer(null);
                      openAddressModal(selectedCustomer);
                    }}
                    className="text-[11px] font-bold text-accent hover:underline"
                  >
                    + Manage Addresses
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {(selectedCustomer.addresses || []).map((a) => (
                    <div key={a.id} className="p-3.5 rounded-xl border border-border bg-surface-dim/50 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-primary">{a.fullName}</span>
                        {a.isDefaultShipping && (
                          <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-full">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-muted text-[11px]">{a.addressLine1}</p>
                      <p className="text-muted text-[11px]">
                        {a.city}, {a.state} - {a.postalCode}
                      </p>
                      <p className="text-muted text-[10px] flex items-center gap-1">
                        <Phone className="w-3 h-3 text-accent" />
                        <span>{a.phone}</span>
                      </p>
                    </div>
                  ))}
                  {(!selectedCustomer.addresses || selectedCustomer.addresses.length === 0) && (
                    <p className="text-muted italic text-xs col-span-2">No addresses on file.</p>
                  )}
                </div>
              </div>

              {/* Order History */}
              <div className="space-y-3">
                <h4 className="font-bold text-primary text-xs uppercase tracking-wider">
                  Associated Consignments & Orders ({customerOrders.length})
                </h4>

                <div className="divide-y divide-border border border-border rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                  {customerOrders.length === 0 ? (
                    <p className="p-4 text-center text-xs text-muted">No orders linked to this customer yet.</p>
                  ) : (
                    customerOrders.map((ord) => (
                      <div key={ord.id} className="p-3 flex items-center justify-between text-xs bg-surface hover:bg-surface-dim/40">
                        <div>
                          <span className="font-mono font-bold text-primary">{ord.orderNumber}</span>
                          <p className="text-[11px] text-muted">
                            {new Date(ord.createdAt).toLocaleDateString()} • {ord.items.length} items
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-primary">
                            {formatPaiseToRupees(ord.totalInPaise)}
                          </span>
                          <span className="block text-[10px] font-bold uppercase text-accent">
                            {ord.status}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Customer Saved Wishlist */}
              <div className="space-y-3">
                <h4 className="font-bold text-primary text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Heart className="w-3.5 h-3.5 text-accent" />
                  <span>Saved Wishlist ({selectedCustomer.wishlistProductIds?.length || 0})</span>
                </h4>

                {(!selectedCustomer.wishlistProductIds || selectedCustomer.wishlistProductIds.length === 0) ? (
                  <p className="p-4 rounded-xl border border-border bg-surface-dim/30 text-center text-xs text-muted">
                    No items saved in customer wishlist.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {selectedCustomer.wishlistProductIds.map((pId) => {
                      const prod = allProducts.find((p) => p.id === pId);
                      return (
                        <div key={pId} className="p-3 rounded-xl border border-border bg-surface-dim/40 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-3">
                            {prod?.media?.[0]?.externalUrl && (
                              <img src={prod.media[0].externalUrl} alt="" className="w-8 h-8 rounded-lg object-cover border border-border shrink-0" />
                            )}
                            <div>
                              <span className="font-semibold text-primary">{prod?.title || pId}</span>
                              {prod && (
                                <p className="text-[11px] text-accent font-bold">
                                  {formatPaiseToRupees(prod.variants[0]?.priceInPaise || 0)}
                                </p>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveWishlistItem(selectedCustomer.id, pId)}
                            className="p-1.5 text-muted hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Remove from customer wishlist"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Custom Registration Fields */}
              {selectedCustomer.customFields && Object.keys(selectedCustomer.customFields).length > 0 && (
                <div className="space-y-2 pt-3 border-t border-border">
                  <h4 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-accent" />
                    <span>Custom Registration Information</span>
                  </h4>
                  <div className="bg-surface-dim/80 p-3.5 rounded-xl border border-border space-y-2 text-xs">
                    {Object.entries(selectedCustomer.customFields).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between text-[11px] py-1 border-b border-border/40 last:border-none">
                        <span className="font-semibold text-muted capitalize">{k.replace(/([A-Z])/g, ' $1')}:</span>
                        <span className="font-bold text-primary">{typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v || '-')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Customer Actions & Governance */}
              <div className="pt-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    openEditCustomerModal(selectedCustomer);
                  }}
                  className="w-full sm:w-auto px-4 py-2 bg-surface-dim hover:bg-border text-primary rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Profile & Password</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeletingCustomerId(selectedCustomer.id);
                  }}
                  className="w-full sm:w-auto px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Permanently Delete Account</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Customer Modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-surface rounded-3xl border border-border p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <h3 className="font-display text-lg font-bold text-primary">Add New Customer</h3>
                <button onClick={() => setShowAddModal(false)} className="p-1 rounded-lg text-muted hover:text-primary">
                  ✕
                </button>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleCreateCustomer} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-primary mb-1">Full Legal Name *</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Vikram Sharma"
                    className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-primary mb-1">Email Address *</label>
                    <input
                      type="email"
                      required
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      placeholder="customer@example.com"
                      className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-primary mb-1">Mobile Phone</label>
                    <input
                      type="tel"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      placeholder="10-digit phone"
                      className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-primary mb-1">Account Status</label>
                    <select
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="INACTIVE">INACTIVE</option>
                      <option value="SUSPENDED">SUSPENDED</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-primary mb-1">Role</label>
                    <select
                      value={formRole}
                      onChange={(e) => setFormRole(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    >
                      <option value="CUSTOMER">Customer</option>
                      <option value="ADMIN">Admin Staff</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-primary mb-1">Initial Password</label>
                    <input
                      type="text"
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      placeholder="Enter initial password (min. 8 characters)"
                      className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-primary mb-1">Internal Admin Notes</label>
                  <textarea
                    rows={2}
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="e.g. VIP bulk buyer, phone verified"
                    className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-5 py-2.5 bg-surface-dim hover:bg-border text-primary rounded-xl font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-accent hover:bg-accent-hover text-white font-bold rounded-xl"
                  >
                    Register Account
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Customer Modal */}
        {editingCustomer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-surface rounded-3xl border border-border p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div>
                  <h3 className="font-display text-lg font-bold text-primary">Edit Customer Profile</h3>
                  <p className="text-xs text-muted">Manage profile details, credentials, and access permissions.</p>
                </div>
                <button onClick={() => setEditingCustomer(null)} className="p-1 rounded-lg text-muted hover:text-primary">
                  ✕
                </button>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleUpdateCustomer} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-primary mb-1">Full Legal Name *</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-primary mb-1">Email Address *</label>
                    <input
                      type="email"
                      required
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-primary mb-1">Mobile Phone</label>
                    <input
                      type="tel"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-primary mb-1">Account Status</label>
                    <select
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    >
                      <option value="ACTIVE">ACTIVE (Authorized to order)</option>
                      <option value="INACTIVE">INACTIVE (Unverified)</option>
                      <option value="SUSPENDED">SUSPENDED (Blocked)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-primary mb-1">Role</label>
                    <select
                      value={formRole}
                      onChange={(e) => setFormRole(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    >
                      <option value="CUSTOMER">Customer</option>
                      <option value="ADMIN">Admin Staff</option>
                    </select>
                  </div>
                </div>

                {/* Password Reset Field */}
                <div className="p-3.5 rounded-xl border border-border bg-surface-dim/40 space-y-1.5">
                  <label className="block font-semibold text-primary text-[11px] flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-accent" />
                    <span>Admin Password Reset (Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder="Enter new password (min. 6 chars) or leave blank to keep unchanged"
                    className="w-full px-3.5 py-2 bg-surface border border-border rounded-lg text-primary focus:outline-none focus:border-accent text-xs"
                  />
                  <p className="text-[10px] text-muted">
                    If specified, the user&apos;s password will be immediately updated to this value without requiring their current password.
                  </p>
                </div>

                <div>
                  <label className="block font-semibold text-primary mb-1">Internal Admin Notes</label>
                  <textarea
                    rows={2}
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setEditingCustomer(null)}
                    className="px-5 py-2.5 bg-surface-dim hover:bg-border text-primary rounded-xl font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-accent hover:bg-accent-hover text-white font-bold rounded-xl"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Manage Addresses Modal for Customer */}
        {addressModalCustomer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-surface rounded-3xl border border-border p-6 sm:p-8 max-w-xl w-full shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div>
                  <h3 className="font-display text-lg font-bold text-primary">
                    Manage Addresses: {addressModalCustomer.fullName}
                  </h3>
                  <p className="text-xs text-muted">Add, update, or remove customer delivery locations.</p>
                </div>
                <button onClick={() => setAddressModalCustomer(null)} className="p-1 rounded-lg text-muted hover:text-primary">
                  ✕
                </button>
              </div>

              {/* Existing Addresses list */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                  Current Addresses ({addressModalCustomer.addresses?.length || 0})
                </span>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {(addressModalCustomer.addresses || []).map((addr) => (
                    <div key={addr.id} className="p-3 rounded-xl border border-border bg-surface-dim/50 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-primary">{addr.fullName}</span>
                        <p className="text-[11px] text-muted">{addr.addressLine1}, {addr.city} ({addr.postalCode})</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteCustomerAddress(addressModalCustomer.id, addr.id)}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Delete this address"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Add New Address Form */}
              <form onSubmit={handleSaveCustomerAddress} className="space-y-3 pt-3 border-t border-border text-xs">
                <span className="font-bold text-primary block">Add New Delivery Location</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    placeholder="Recipient Name *"
                    value={addrFullName}
                    onChange={(e) => setAddrFullName(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                  />
                  <input
                    type="tel"
                    required
                    placeholder="Phone Number *"
                    value={addrPhone}
                    onChange={(e) => setAddrPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                  />
                </div>

                <input
                  type="text"
                  required
                  placeholder="Street / Flat / House Address *"
                  value={addrLine1}
                  onChange={(e) => setAddrLine1(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                />

                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="PIN Code *"
                    value={addrPin}
                    onChange={handleAddrPinChange}
                    className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                  />
                  <input
                    type="text"
                    required
                    placeholder="City *"
                    value={addrCity}
                    onChange={(e) => setAddrCity(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                  />
                  <input
                    type="text"
                    required
                    placeholder="State *"
                    value={addrState}
                    onChange={(e) => setAddrState(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                  />
                </div>

                <label className="flex items-center gap-2 pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addrIsDefault}
                    onChange={(e) => setAddrIsDefault(e.target.checked)}
                    className="w-4 h-4 text-accent rounded accent-accent"
                  />
                  <span className="text-muted text-[11px]">Set as primary default delivery location</span>
                </label>

                <div className="flex justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setAddressModalCustomer(null)}
                    className="px-4 py-2 bg-surface-dim hover:bg-border text-primary rounded-xl font-medium"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-accent hover:bg-accent-hover text-white font-bold rounded-xl"
                  >
                    Save Address
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deletingCustomerId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-surface rounded-3xl border border-border p-6 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex items-center gap-3 text-rose-600">
                <div className="p-2.5 rounded-2xl bg-rose-50 border border-rose-200">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display text-base font-bold text-primary">Permanent Account Deletion</h3>
                  <p className="text-[11px] text-muted">Irreversible customer deletion with cascading cleanup</p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-rose-100 bg-rose-50/50 text-[11px] text-rose-900 space-y-2 leading-relaxed">
                <p className="font-semibold">Notice of Data Anonymization & Cleanup:</p>
                <ul className="list-disc pl-4 space-y-1 text-muted text-[11px]">
                  <li>Customer profile, contact details, active sessions, and authentication credentials will be permanently erased.</li>
                  <li>Address book records, reviews, inquiries, newsletter entries, and saved wishlist items will be immediately purged across the application.</li>
                  <li>In accordance with Indian tax (GST) and statutory audit requirements, financial invoice records will be retained with customer personal identifying information (PII) anonymized (DPDP Act compliant).</li>
                  <li>The customer will be permanently blocked from future logins.</li>
                </ul>
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setDeletingCustomerId(null)}
                  className="px-4 py-2 bg-surface-dim hover:bg-border text-primary rounded-xl font-medium text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteCustomer(deletingCustomerId)}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-sm transition-colors"
                >
                  Confirm Permanent Deletion
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Floating / Sticky Bulk Action Bar */}
        {selectedCustomerIds.size > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-neutral-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-4 border border-neutral-700 animate-slide-up max-w-[95vw]">
            <div className="flex items-center gap-2 text-xs font-bold whitespace-nowrap">
              <span className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse" />
              <span>{selectedCustomerIds.size} customer{selectedCustomerIds.size === 1 ? '' : 's'} selected</span>
            </div>
            <div className="h-4 w-px bg-neutral-700 shrink-0" />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowBulkDeleteModal(true)}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs whitespace-nowrap"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Selected</span>
              </button>
              <button
                type="button"
                onClick={clearSelection}
                className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs font-medium transition-colors whitespace-nowrap"
              >
                Deselect All
              </button>
            </div>
          </div>
        )}

        {/* Bulk Delete Confirmation Modal */}
        {showBulkDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-surface rounded-3xl border border-border p-6 max-w-lg w-full shadow-2xl space-y-4">
              <div className="flex items-center gap-3 text-rose-600">
                <div className="p-2.5 rounded-2xl bg-rose-50 border border-rose-200">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display text-base font-bold text-primary">
                    Bulk Delete {selectedCustomerIds.size} Customer Accounts
                  </h3>
                  <p className="text-[11px] text-muted">
                    Irreversible deletion with statutory order PII anonymization
                  </p>
                </div>
              </div>

              <div className="p-3.5 bg-rose-50/50 border border-rose-200/60 rounded-2xl text-xs space-y-2 text-rose-950">
                <p className="font-semibold text-rose-800">
                  You are about to delete {selectedCustomerIds.size} customer account(s).
                </p>
                <ul className="list-disc pl-4 text-[11px] text-muted space-y-1">
                  <li>Profiles, saved addresses, wishlist items, active sessions, and carts will be permanently erased.</li>
                  <li>In accordance with Indian tax (GST) and statutory audit requirements, invoice records will be retained with customer personal details anonymized (DPDP Act compliant).</li>
                  <li>Administrator accounts cannot be deleted.</li>
                </ul>
              </div>

              <div className="max-h-36 overflow-y-auto space-y-1.5 bg-surface-dim p-2.5 rounded-xl border border-border text-xs">
                {filteredCustomers
                  .filter((c) => selectedCustomerIds.has(c.id))
                  .slice(0, 5)
                  .map((c) => (
                    <div key={c.id} className="flex items-center justify-between py-1 px-2 rounded bg-surface border border-border/50 text-[11px]">
                      <span className="font-semibold text-primary">{c.fullName}</span>
                      <span className="text-muted font-mono">{c.email}</span>
                    </div>
                  ))}
                {selectedCustomerIds.size > 5 && (
                  <p className="text-[10px] text-center text-muted italic">
                    ... and {selectedCustomerIds.size - 5} more selected accounts
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowBulkDeleteModal(false)}
                  disabled={isBulkDeleting}
                  className="px-4 py-2 bg-surface-dim hover:bg-border text-primary rounded-xl font-medium text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  disabled={isBulkDeleting}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-sm transition-colors flex items-center gap-2"
                >
                  {isBulkDeleting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Deleting Accounts...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Confirm Delete {selectedCustomerIds.size} Account(s)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
