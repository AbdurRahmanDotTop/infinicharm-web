'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { lookupPinCode } from '@/lib/utils/pincode';
import {
  MapPin,
  Plus,
  Trash2,
  Edit2,
  ArrowLeft,
  Check,
  AlertCircle,
  Phone,
  CheckCircle2,
  Building,
  Home,
  LogIn,
  Loader2,
} from 'lucide-react';
import { Customer, CustomerAddress, AddressType } from '@/types';

const STORAGE_KEY = 'infinicharm_customer_addresses';

export default function AccountAddressesPage() {
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUnauthenticated, setIsUnauthenticated] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingId, setIsUpdatingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form states
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [addressType, setAddressType] = useState<AddressType>('HOME');
  const [addressLabel, setAddressLabel] = useState('');
  const [isDefaultShipping, setIsDefaultShipping] = useState(false);
  const [isDefaultBilling, setIsDefaultBilling] = useState(false);

  const fetchAddressesAndProfile = useCallback(async () => {
    try {
      const [addrRes, meRes] = await Promise.all([
        fetch('/api/customers/me/addresses', { cache: 'no-store', credentials: 'include' }),
        fetch('/api/customers/me', { cache: 'no-store', credentials: 'include' }),
      ]);

      if (addrRes.status === 401 || meRes.status === 401) {
        setIsUnauthenticated(true);
        setIsLoading(false);
        return;
      }

      setIsUnauthenticated(false);

      let fetchedCustomer: Customer | null = null;
      let meOrders: any[] = [];
      if (meRes.ok) {
        const meData = await meRes.json();
        if (meData.success && meData.customer) {
          fetchedCustomer = meData.customer;
          setCustomer(meData.customer);
          if (Array.isArray(meData.orders)) {
            meOrders = meData.orders;
          }
          try {
            localStorage.setItem('infinicharm_customer_user', JSON.stringify(meData.customer));
          } catch {}
        }
      }

      let loadedAddresses: CustomerAddress[] = [];
      let addressFetchSuccessful = false;

      if (addrRes.ok) {
        const data = await addrRes.json();
        if (data.success && Array.isArray(data.addresses)) {
          addressFetchSuccessful = true;
          loadedAddresses = data.addresses;
        }
      }

      // If address API returned empty list, check if customer profile has addresses
      if (loadedAddresses.length === 0 && fetchedCustomer?.addresses && Array.isArray(fetchedCustomer.addresses) && fetchedCustomer.addresses.length > 0) {
        loadedAddresses = fetchedCustomer.addresses;
      }

      // Defense-in-depth: If address book is empty and addresses were never explicitly cleared down to 0, self-heal from customer orders
      if (loadedAddresses.length === 0 && !fetchedCustomer?.hasExplicitlyClearedAddresses) {
        let orderSource = meOrders;
        if (orderSource.length === 0 && typeof window !== 'undefined') {
          try {
            const stored = JSON.parse(localStorage.getItem('infinicharm_orders') || '[]');
            if (Array.isArray(stored) && stored.length > 0) {
              orderSource = stored;
            }
          } catch {}
        }
        if (orderSource.length > 0) {
          const orderWithAddr = orderSource.find(
            (o: any) => o.shippingAddress && o.shippingAddress.addressLine1 && o.shippingAddress.postalCode
          );
          if (orderWithAddr?.shippingAddress) {
            const s = orderWithAddr.shippingAddress;
            const synthesizedAddr: CustomerAddress = {
              id: s.id && !s.id.startsWith('addr-draft-') ? s.id : `addr-order-${orderWithAddr.orderNumber || Date.now()}`,
              customerId: fetchedCustomer?.id || orderWithAddr.customerId || 'cust',
              fullName: s.fullName || fetchedCustomer?.fullName || '',
              phone: s.phone || fetchedCustomer?.phone || orderWithAddr.customerPhone || '',
              addressLine1: s.addressLine1,
              addressLine2: s.addressLine2 || '',
              city: s.city,
              state: s.state,
              postalCode: s.postalCode,
              country: s.country || 'India',
              type: (s.type as AddressType) || 'HOME',
              label: s.label || 'Home',
              isDefaultShipping: true,
              isDefaultBilling: true,
            };
            loadedAddresses = [synthesizedAddr];
            // Persist the synthesized address back to server so it has a permanent record
            try {
              fetch('/api/customers/me/addresses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(synthesizedAddr),
              }).catch(() => {});
            } catch {}
          }
        }
      }

      if (addressFetchSuccessful || loadedAddresses.length > 0) {
        setAddresses(loadedAddresses);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(loadedAddresses));
        } catch {}
        return;
      }

      // Fallback to local storage if API call wasn't successful
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setAddresses(parsed);
          }
        }
      } catch {}
    } catch (err) {
      console.error('Error fetching addresses:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAddressesAndProfile();

    const handleSync = () => {
      fetchAddressesAndProfile();
    };

    window.addEventListener('infinicharm_customer_addresses_updated', handleSync);
    window.addEventListener('infinicharm_customer_updated', handleSync);
    window.addEventListener('storage', handleSync);

    return () => {
      window.removeEventListener('infinicharm_customer_addresses_updated', handleSync);
      window.removeEventListener('infinicharm_customer_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [fetchAddressesAndProfile]);

  const handlePinCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setPinCode(val);

    if (val.length === 6) {
      const info = lookupPinCode(val);
      if (info) {
        setCity(info.city);
        setStateName(info.state);
      }
    }
  };

  const openAddModal = () => {
    setEditingId(null);
    setFullName(customer?.fullName || '');
    setPhone(customer?.phone || '');
    setAddressLine1('');
    setAddressLine2('');
    setPinCode('');
    setCity('');
    setStateName('');
    setAddressType('HOME');
    setAddressLabel('Home');
    setIsDefaultShipping(addresses.length === 0);
    setIsDefaultBilling(addresses.length === 0);
    setErrorMsg(null);
    setShowModal(true);
  };

  const openEditModal = (addr: CustomerAddress) => {
    setEditingId(addr.id);
    setFullName(addr.fullName);
    setPhone(addr.phone);
    setAddressLine1(addr.addressLine1);
    setAddressLine2(addr.addressLine2 || '');
    setPinCode(addr.postalCode);
    setCity(addr.city);
    setStateName(addr.state);
    setAddressType((addr.type as AddressType) || 'HOME');
    setAddressLabel(addr.label || (addr.type === 'OFFICE' ? 'Office' : addr.type === 'OTHER' ? 'Other' : 'Home'));
    setIsDefaultShipping(addr.isDefaultShipping);
    setIsDefaultBilling(addr.isDefaultBilling);
    setErrorMsg(null);
    setShowModal(true);
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanName = fullName.trim();
    const cleanPhone = phone.replace(/\D/g, '');
    const cleanLine1 = addressLine1.trim();
    const cleanPin = pinCode.replace(/\D/g, '');
    const cleanCity = city.trim();
    const cleanState = stateName.trim();

    if (!cleanName || !cleanPhone || !cleanLine1 || cleanPin.length !== 6 || !cleanCity || !cleanState) {
      setErrorMsg('Please complete all mandatory address fields.');
      return;
    }

    if (cleanPhone.length < 10) {
      setErrorMsg('Please enter a valid 10-digit mobile number for delivery updates.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        fullName: cleanName,
        phone: cleanPhone,
        addressLine1: cleanLine1,
        addressLine2: addressLine2.trim() || '',
        city: cleanCity,
        state: cleanState,
        postalCode: cleanPin,
        country: 'India',
        type: addressType,
        label: addressLabel.trim() || (addressType === 'OFFICE' ? 'Office' : addressType === 'OTHER' ? 'Other' : 'Home'),
        isDefaultShipping,
        isDefaultBilling,
      };

      if (editingId) {
        const res = await fetch(`/api/customers/me/addresses/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to update address.');
        setAddresses(data.addresses);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data.addresses));
        } catch {}
      } else {
        const res = await fetch('/api/customers/me/addresses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to add address.');
        setAddresses(data.addresses);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data.addresses));
        } catch {}
      }

      window.dispatchEvent(new Event('infinicharm_customer_addresses_updated'));
      window.dispatchEvent(new Event('infinicharm_customer_updated'));

      setSuccessMsg(editingId ? 'Address updated successfully.' : 'New address saved to address book.');
      setTimeout(() => setSuccessMsg(null), 3500);
      setShowModal(false);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save address.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAddress = async (id: string) => {
    try {
      setErrorMsg(null);
      const res = await fetch(`/api/customers/me/addresses/${id}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to delete address.');

      setAddresses(data.addresses);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data.addresses));
      } catch {}
      window.dispatchEvent(new Event('infinicharm_customer_addresses_updated'));
      window.dispatchEvent(new Event('infinicharm_customer_updated'));

      setSuccessMsg('Address removed from address book.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error deleting address.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleSetDefaultShipping = async (id: string) => {
    try {
      setErrorMsg(null);
      setIsUpdatingId(id);
      const res = await fetch(`/api/customers/me/addresses/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'SET_DEFAULT_SHIPPING' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAddresses(data.addresses);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data.addresses));
        } catch {}
        window.dispatchEvent(new Event('infinicharm_customer_addresses_updated'));
        window.dispatchEvent(new Event('infinicharm_customer_updated'));
        setSuccessMsg('Default shipping address updated.');
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setErrorMsg(data.error || 'Failed to update default shipping address.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Network error updating default shipping address.');
    } finally {
      setIsUpdatingId(null);
    }
  };

  const handleSetDefaultBilling = async (id: string) => {
    try {
      setErrorMsg(null);
      setIsUpdatingId(id);
      const res = await fetch(`/api/customers/me/addresses/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'SET_DEFAULT_BILLING' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAddresses(data.addresses);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data.addresses));
        } catch {}
        window.dispatchEvent(new Event('infinicharm_customer_addresses_updated'));
        window.dispatchEvent(new Event('infinicharm_customer_updated'));
        setSuccessMsg('Default billing address updated.');
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setErrorMsg(data.error || 'Failed to update default billing address.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Network error updating default billing address.');
    } finally {
      setIsUpdatingId(null);
    }
  };

  if (isUnauthenticated) {
    return (
      <div className="py-12 bg-surface-dim/40 min-h-screen">
        <Container className="max-w-md">
          <div className="bg-surface rounded-3xl border border-border p-8 shadow-sm text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-accent/10 text-accent flex items-center justify-center mx-auto">
              <LogIn className="w-6 h-6" />
            </div>
            <h1 className="font-display text-xl font-bold text-primary">Sign In Required</h1>
            <p className="text-xs text-muted leading-relaxed">
              Please sign in to your verified InfiniCharm account to access and manage your saved delivery addresses.
            </p>
            <div className="pt-2">
              <Link
                href="/login?redirect=/account/addresses"
                className="inline-flex items-center justify-center gap-2 w-full px-5 py-3 bg-accent hover:bg-accent-hover text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
              >
                <span>Sign In to Account</span>
              </Link>
            </div>
          </div>
        </Container>
      </div>
    );
  }

  return (
    <div className="py-10 bg-surface-dim/40 min-h-screen">
      <Container className="max-w-4xl">
        <Link
          href="/account"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-primary transition-colors mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Account Overview</span>
        </Link>

        {/* Header Banner */}
        <div className="bg-surface rounded-3xl border border-border p-6 sm:p-8 shadow-sm mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-primary">Saved Delivery Addresses</h1>
            <p className="text-xs text-muted mt-1">
              Manage your residential and commercial shipping locations for rapid, automated checkout.
            </p>
          </div>

          <button
            onClick={openAddModal}
            className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-colors shadow-xs shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Address</span>
          </button>
        </div>

        {successMsg && (
          <div className="p-4 mb-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-4 mb-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-semibold">{errorMsg}</span>
          </div>
        )}

        {/* Addresses Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {isLoading && (
            <div className="md:col-span-2 text-center py-12 bg-surface rounded-3xl border border-border p-8 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-accent mx-auto" />
              <p className="text-xs text-muted">Loading your saved delivery addresses...</p>
            </div>
          )}

          {addresses.map((addr) => (
            <div
              key={addr.id}
              className={`bg-surface rounded-3xl border p-6 shadow-sm flex flex-col justify-between transition-all ${
                addr.isDefaultShipping ? 'border-accent ring-1 ring-accent/30' : 'border-border'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-surface-dim flex items-center justify-center text-accent">
                      {addr.type === 'OFFICE' ? <Building className="w-4 h-4" /> : addr.type === 'OTHER' ? <MapPin className="w-4 h-4" /> : <Home className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-primary text-sm">{addr.fullName}</h3>
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded-full">
                          <span>{addr.label || (addr.type === 'OFFICE' ? 'Office' : addr.type === 'OTHER' ? 'Other' : 'Home')}</span>
                        </span>
                      </div>
                      <p className="text-[11px] text-muted flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3 text-accent" />
                        <span>{addr.phone}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    {addr.isDefaultShipping && (
                      <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Default Shipping
                      </span>
                    )}
                    {addr.isDefaultBilling && (
                      <span className="bg-blue-100 text-blue-800 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Default Billing
                      </span>
                    )}
                  </div>
                </div>

                <div className="bg-surface-dim/70 p-4 rounded-2xl text-xs text-muted space-y-1">
                  <p className="text-primary font-medium">{addr.addressLine1}</p>
                  {addr.addressLine2 && <p>{addr.addressLine2}</p>}
                  <p>
                    {addr.city}, {addr.state} -{' '}
                    <strong className="text-primary font-semibold">{addr.postalCode}</strong>
                  </p>
                  <p className="text-[10px] text-muted/80">{addr.country || 'India'}</p>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="pt-4 mt-4 border-t border-border flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5">
                  {!addr.isDefaultShipping && (
                    <button
                      onClick={() => handleSetDefaultShipping(addr.id)}
                      disabled={isUpdatingId === addr.id}
                      className="px-2.5 py-1 bg-surface-dim hover:bg-border text-primary text-[11px] font-medium rounded-lg transition-colors disabled:opacity-50"
                      title="Make this your default shipping address"
                    >
                      {isUpdatingId === addr.id ? 'Setting...' : 'Set Shipping'}
                    </button>
                  )}
                  {!addr.isDefaultBilling && (
                    <button
                      onClick={() => handleSetDefaultBilling(addr.id)}
                      disabled={isUpdatingId === addr.id}
                      className="px-2.5 py-1 bg-surface-dim hover:bg-border text-primary text-[11px] font-medium rounded-lg transition-colors disabled:opacity-50"
                      title="Make this your default billing address"
                    >
                      {isUpdatingId === addr.id ? 'Setting...' : 'Set Billing'}
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 ml-auto">
                  <button
                    onClick={() => openEditModal(addr)}
                    className="p-2 hover:bg-surface-dim text-primary rounded-lg transition-colors"
                    title="Edit address"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDeletingId(addr.id)}
                    className="p-2 hover:bg-rose-50 text-rose-600 rounded-lg transition-colors"
                    title="Delete address"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {addresses.length === 0 && !isLoading && (
            <div className="md:col-span-2 text-center py-12 bg-surface rounded-3xl border border-dashed border-border p-8 space-y-3">
              <MapPin className="w-10 h-10 text-muted/40 mx-auto" />
              <h3 className="font-bold text-primary text-base">No saved addresses found</h3>
              <p className="text-xs text-muted max-w-sm mx-auto">
                Add your residential or commercial shipping location to enjoy 1-click checkout.
              </p>
              <button
                onClick={openAddModal}
                className="mt-2 px-5 py-2.5 bg-accent text-white text-xs font-bold rounded-xl"
              >
                Add Your First Address
              </button>
            </div>
          )}
        </div>

        {/* Add/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-surface rounded-3xl border border-border p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <h3 className="font-display text-lg font-bold text-primary">
                  {editingId ? 'Edit Delivery Address' : 'Add New Delivery Address'}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1 rounded-lg text-muted hover:text-primary"
                >
                  ✕
                </button>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleSaveAddress} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-primary mb-1">Full Recipient Name *</label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Recipient Full Name (e.g. Ramesh Kumar)"
                      className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-primary mb-1">Mobile Phone *</label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="10-digit Phone number"
                      maxLength={10}
                      className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                    <label className="block font-semibold text-primary">Address Category &amp; Nickname</label>
                    <div className="flex items-center gap-1.5" role="group" aria-label="Address Category">
                      <button
                        type="button"
                        onClick={() => {
                          setAddressType('HOME');
                          if (!addressLabel || addressLabel === 'Office' || addressLabel === 'Other') setAddressLabel('Home');
                        }}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
                          addressType === 'HOME'
                            ? 'bg-accent text-white border-accent'
                            : 'bg-surface-dim text-muted border-border hover:text-primary'
                        }`}
                      >
                        <Home className="w-3.5 h-3.5" />
                        <span>Home</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAddressType('OFFICE');
                          if (!addressLabel || addressLabel === 'Home' || addressLabel === 'Other') setAddressLabel('Office');
                        }}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
                          addressType === 'OFFICE'
                            ? 'bg-accent text-white border-accent'
                            : 'bg-surface-dim text-muted border-border hover:text-primary'
                        }`}
                      >
                        <Building className="w-3.5 h-3.5" />
                        <span>Office</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAddressType('OTHER');
                          if (!addressLabel || addressLabel === 'Home' || addressLabel === 'Office') setAddressLabel('Other');
                        }}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
                          addressType === 'OTHER'
                            ? 'bg-accent text-white border-accent'
                            : 'bg-surface-dim text-muted border-border hover:text-primary'
                        }`}
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        <span>Other</span>
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={addressLabel}
                    onChange={(e) => setAddressLabel(e.target.value)}
                    placeholder="e.g. My Apartment, Work HQ, Parents' Home"
                    className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-primary mb-1">
                    Street Address / Flat / Floor / Building *
                  </label>
                  <input
                    type="text"
                    required
                    value={addressLine1}
                    onChange={(e) => setAddressLine1(e.target.value)}
                    placeholder="House/Plot, Ward No., Street, Landmark"
                    className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-primary mb-1">
                    Locality / Area / Colony (Optional)
                  </label>
                  <input
                    type="text"
                    value={addressLine2}
                    onChange={(e) => setAddressLine2(e.target.value)}
                    placeholder="Near State Bank, Market Hub"
                    className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-primary mb-1">PIN Code *</label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={pinCode}
                      onChange={handlePinCodeChange}
                      placeholder="6-digit PIN"
                      className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-primary mb-1">City / District *</label>
                    <input
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="City"
                      className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-primary mb-1">State *</label>
                    <input
                      type="text"
                      required
                      value={stateName}
                      onChange={(e) => setStateName(e.target.value)}
                      placeholder="State"
                      className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>

                <div className="pt-2 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isDefaultShipping}
                      onChange={(e) => setIsDefaultShipping(e.target.checked)}
                      className="w-4 h-4 text-accent rounded accent-accent"
                    />
                    <span className="text-muted font-medium">Use as primary default shipping address</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isDefaultBilling}
                      onChange={(e) => setIsDefaultBilling(e.target.checked)}
                      className="w-4 h-4 text-accent rounded accent-accent"
                    />
                    <span className="text-muted font-medium">Use as primary default billing address</span>
                  </label>
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-5 py-2.5 bg-surface-dim hover:bg-border text-primary rounded-xl font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-6 py-2.5 bg-accent hover:bg-accent-hover text-white font-bold rounded-xl flex items-center gap-2 disabled:opacity-60"
                  >
                    {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{editingId ? 'Update Address' : 'Save Address'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deletingId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-sm">
            <div className="bg-surface rounded-3xl border border-border p-6 max-w-sm w-full shadow-2xl space-y-4">
              <h3 className="font-display text-base font-bold text-primary">Remove Address?</h3>
              <p className="text-xs text-muted leading-relaxed">
                Are you sure you want to remove this address from your address book? This will not affect orders already placed.
              </p>
              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingId(null)}
                  className="px-4 py-2 bg-surface-dim hover:bg-border text-primary rounded-xl font-medium text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteAddress(deletingId)}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs"
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </Container>
    </div>
  );
}
