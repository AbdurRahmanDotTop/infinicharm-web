'use client';

export function persistClientCustomerSession(customer: {
  id: string;
  email: string;
  fullName?: string;
  name?: string;
  phone?: string;
  status?: string;
  emailVerified?: boolean;
  preferences?: unknown;
  addresses?: unknown[];
  wishlistProductIds?: string[];
  createdAt?: string;
}) {
  if (typeof window === 'undefined' || !customer?.id) return;
  const profile = {
    id: customer.id,
    email: customer.email,
    name: customer.fullName || customer.name || '',
    fullName: customer.fullName || customer.name || '',
    phone: customer.phone || '',
    status: customer.status || 'ACTIVE',
    emailVerified: Boolean(customer.emailVerified),
    preferences: customer.preferences,
    addresses: customer.addresses || [],
    wishlist: customer.wishlistProductIds || [],
    loggedInAt: new Date().toISOString(),
    registeredAt: customer.createdAt,
  };
  localStorage.setItem('infinicharm_customer_user', JSON.stringify(profile));
  localStorage.setItem(
    'infinicharm_customer_addresses',
    JSON.stringify(customer.addresses || [])
  );
  window.dispatchEvent(new Event('infinicharm_customer_updated'));
}

export function clearClientCustomerSession() {
  if (typeof window === 'undefined') return;
  document.cookie =
    'infinicharm_customer_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT;';
  document.cookie =
    'infinicharm_customer_id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT;';
  localStorage.removeItem('infinicharm_customer_user');
  localStorage.removeItem('infinicharm_customer_addresses');
  window.dispatchEvent(new Event('infinicharm_customer_updated'));
}

