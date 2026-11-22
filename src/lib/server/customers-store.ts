import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { Customer, CustomerAddress, CustomerPreferences, CustomerStatus, CustomerSummary, Order, UserRole, UserPermission } from '../../types/index.ts';
import { getAuthSettings } from './auth-settings-store.ts';
import { validatePasswordAgainstPolicy } from '../validation/auth.ts';

const CUSTOMERS_FILE_PATH = path.join(process.cwd(), 'src', 'data', 'customers.json');
const ORDERS_FILE_PATH = path.join(process.cwd(), 'src', 'data', 'orders.json');

export function hashCustomerPassword(rawPassword: string): string {
  const clean = String(rawPassword || '');
  if (clean.startsWith('scrypt:')) return clean;
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(clean, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

export function verifyCustomerPassword(rawPassword: string, storedHash?: string): boolean {
  if (!storedHash || !rawPassword) return false;
  if (storedHash.startsWith('scrypt:')) {
    const parts = storedHash.split(':');
    if (parts.length !== 3) return false;
    const [, salt, hexHash] = parts;
    if (!salt || !hexHash) return false;
    try {
      const derived = crypto.scryptSync(rawPassword, salt, 64);
      const expected = Buffer.from(hexHash, 'hex');
      if (derived.length !== expected.length) return false;
      return crypto.timingSafeEqual(derived, expected);
    } catch {
      return false;
    }
  }
  // Legacy un-hashed seed password comparison (no hardcoded backdoor)
  const a = Buffer.from(rawPassword, 'utf8');
  const b = Buffer.from(storedHash, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function readRawOrders(): Order[] {
  try {
    if (!fs.existsSync(ORDERS_FILE_PATH)) return [];
    return JSON.parse(fs.readFileSync(ORDERS_FILE_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

function readRawCustomers(): Customer[] {
  try {
    if (!fs.existsSync(CUSTOMERS_FILE_PATH)) {
      return [];
    }
    const content = fs.readFileSync(CUSTOMERS_FILE_PATH, 'utf-8');
    return JSON.parse(content) as Customer[];
  } catch (err) {
    console.error('Failed to read customers file:', err);
    return [];
  }
}

function writeRawCustomers(customers: Customer[]): boolean {
  try {
    fs.writeFileSync(CUSTOMERS_FILE_PATH, JSON.stringify(customers, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Failed to write customers file:', err);
    return false;
  }
}

/**
 * Scrub sensitive password hashes from public/admin consumer objects
 */
export function sanitizeCustomer(cust: Customer): Omit<Customer, 'passwordHash'> {
  const { passwordHash, ...safe } = cust;
  return {
    ...safe,
    emailVerified: cust.emailVerified ?? cust.id === 'cust-01',
    sessionVersion: cust.sessionVersion ?? 1,
  };
}

/**
 * Checks if an account is the authoritative Super Administrator system account
 */
export function isSuperAdminAccount(cust: { id?: string; email?: string; role?: string } | null | undefined): boolean {
  if (!cust) return false;
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@infinicharm.com').toLowerCase();
  const email = (cust.email || '').toLowerCase().trim();
  return (
    cust.id === 'usr-admin-01' ||
    email === adminEmail ||
    cust.role === 'SUPER_ADMIN'
  );
}

/**
 * Check if account is protected from deletion (Super Admin)
 */
export function isProtectedAccount(cust: { id?: string; email?: string; role?: string } | null | undefined): boolean {
  if (!cust) return false;
  return isSuperAdminAccount(cust);
}

/**
 * Get all customers with dynamic spend and order aggregates from orders-store
 */
export function getServerCustomers(search?: string, status?: string, role?: string): CustomerSummary[] {
  const raw = readRawCustomers();
  const allOrders = readRawOrders();

  let filtered = raw;

  if (status && status !== 'ALL') {
    filtered = filtered.filter((c) => c.status === status);
  }

  if (role && role !== 'ALL') {
    filtered = filtered.filter((c) => (c.role || 'CUSTOMER') === role);
  }

  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    filtered = filtered.filter(
      (c) =>
        c.fullName.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.role && c.role.toLowerCase().includes(q)) ||
        c.addresses.some(
          (a) =>
            a.city.toLowerCase().includes(q) ||
            a.state.toLowerCase().includes(q) ||
            a.postalCode.includes(q) ||
            a.addressLine1.toLowerCase().includes(q)
        )
    );
  }

  return filtered.map((cust) => {
    // Match orders by customerId OR customerEmail OR customerPhone
    const customerOrders = allOrders.filter(
      (o) =>
        (o.customerId && o.customerId === cust.id) ||
        (o.customerEmail && o.customerEmail.toLowerCase() === cust.email.toLowerCase()) ||
        (o.customerPhone && o.customerPhone === cust.phone)
    );

    const totalOrders = customerOrders.length;
    const lifetimeSpendInPaise = customerOrders.reduce((acc, curr) => acc + curr.totalInPaise, 0);
    const lastOrderDate = customerOrders.length > 0
      ? customerOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0].createdAt
      : undefined;

    const isProtected = isSuperAdminAccount(cust);

    return {
      ...sanitizeCustomer(cust),
      totalOrders,
      lifetimeSpendInPaise,
      lastOrderDate,
      isProtected,
    };
  });
}

/**
 * Get customer by ID
 */
export function getServerCustomerById(id: string): Customer | null {
  const raw = readRawCustomers();
  const clean = decodeURIComponent(id).trim();
  return raw.find((c) => c.id === clean || c.email.toLowerCase() === clean.toLowerCase()) || null;
}

/**
 * Get customer by email
 */
export function getServerCustomerByEmail(email: string): Customer | null {
  const raw = readRawCustomers();
  return raw.find((c) => c.email.toLowerCase() === email.trim().toLowerCase()) || null;
}

/**
 * Resolve authenticated customer strictly from request cookies
 * Rejects unverified, suspended, inactive, or version-invalidated sessions.
 */
export function resolveAuthenticatedCustomer(req: {
  cookies: { get(name: string): { value: string } | undefined };
}): Customer | null {
  const customerIdCookie = req.cookies.get('infinicharm_customer_id')?.value;
  const sessionCookie = req.cookies.get('infinicharm_customer_session')?.value;
  const sessionVersionCookie = req.cookies.get('infinicharm_customer_sv')?.value;

  if (sessionCookie !== 'active' || !customerIdCookie) {
    return null;
  }

  const cust = getServerCustomerById(customerIdCookie);
  if (!cust) return null;

  if (cust.status === 'SUSPENDED' || cust.status === 'INACTIVE') {
    return null;
  }

  const authSettings = getAuthSettings();
  const isVerified = cust.emailVerified ?? cust.id === 'cust-01';
  if (authSettings.requireEmailVerification && !isVerified) {
    return null;
  }

  const currentVersion = cust.sessionVersion ?? 1;
  if (sessionVersionCookie && sessionVersionCookie !== String(currentVersion)) {
    return null;
  }
  if (!sessionVersionCookie && currentVersion > 1) {
    return null;
  }

  return cust;
}

export type AuthFailureCode =
  | 'LOGIN_DISABLED'
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_NOT_VERIFIED'
  | 'SUSPENDED'
  | 'INACTIVE';

/**
 * Authenticate customer credentials
 */
export function authenticateCustomer(
  email: string,
  pass: string
): { customer: Omit<Customer, 'passwordHash'> | null; error?: string; code?: AuthFailureCode } {
  const settings = getAuthSettings();
  if (!settings.loginEnabled) {
    return {
      customer: null,
      code: 'LOGIN_DISABLED',
      error: 'Customer sign-in is temporarily disabled by store administration.',
    };
  }

  const cust = getServerCustomerByEmail(email);
  if (!cust) {
    return {
      customer: null,
      code: 'INVALID_CREDENTIALS',
      error: 'No account registered with this email address.',
    };
  }

  if (cust.status === 'SUSPENDED') {
    return {
      customer: null,
      code: 'SUSPENDED',
      error: 'This account has been suspended by administration. Please contact support.',
    };
  }

  if (cust.status === 'INACTIVE') {
    return {
      customer: null,
      code: 'INACTIVE',
      error: 'This account is currently inactive. Please verify your email or contact support.',
    };
  }

  const isValid = verifyCustomerPassword(pass, cust.passwordHash);
  if (!isValid) {
    return {
      customer: null,
      code: 'INVALID_CREDENTIALS',
      error: 'Incorrect password entered.',
    };
  }

  const isVerified = cust.emailVerified ?? cust.id === 'cust-01';
  if (settings.requireEmailVerification && !isVerified) {
    return {
      customer: null,
      code: 'EMAIL_NOT_VERIFIED',
      error:
        'Please verify your email address before signing in. Check your inbox for the verification link or request a new one below.',
    };
  }

  const upgradedHash =
    cust.passwordHash && !cust.passwordHash.startsWith('scrypt:')
      ? hashCustomerPassword(pass)
      : undefined;

  const updated = updateCustomer(cust.id, {
    lastLoginAt: new Date().toISOString(),
    ...(upgradedHash ? { passwordHash: upgradedHash } : {}),
  });

  return { customer: sanitizeCustomer(updated || cust) };
}

/**
 * Mark a customer's email address verified
 */
export function markCustomerEmailVerified(
  id: string
): { success: boolean; alreadyVerified?: boolean; customer?: Omit<Customer, 'passwordHash'> } {
  const raw = readRawCustomers();
  const idx = raw.findIndex((c) => c.id === id);
  if (idx === -1) return { success: false };

  const cust = raw[idx];
  const alreadyVerified = cust.emailVerified === true;
  const nowIso = new Date().toISOString();
  const updated: Customer = {
    ...cust,
    emailVerified: true,
    emailVerifiedAt: cust.emailVerifiedAt || nowIso,
    status: cust.status === 'INACTIVE' ? 'ACTIVE' : cust.status,
    updatedAt: nowIso,
  };
  raw[idx] = updated;
  writeRawCustomers(raw);
  return { success: true, alreadyVerified, customer: sanitizeCustomer(updated) };
}

/**
 * Increment customer sessionVersion to invalidate all previously issued sessions
 */
export function incrementCustomerSessionVersion(id: string): number {
  const raw = readRawCustomers();
  const idx = raw.findIndex((c) => c.id === id);
  if (idx === -1) return 1;
  const nextVersion = (raw[idx].sessionVersion ?? 1) + 1;
  raw[idx] = {
    ...raw[idx],
    sessionVersion: nextVersion,
    updatedAt: new Date().toISOString(),
  };
  writeRawCustomers(raw);
  return nextVersion;
}

/**
 * Create a new customer
 */
export function createCustomer(data: {
  email: string;
  fullName: string;
  phone?: string;
  password?: string;
  status?: CustomerStatus;
  role?: UserRole;
  permissions?: UserPermission[];
  emailVerified?: boolean;
  emailVerifiedAt?: string | null;
  verificationSentAt?: string | null;
  registrationSource?: 'REGISTER_PAGE' | 'CHECKOUT' | 'ADMIN' | 'SEED' | 'INVITATION';
  notes?: string;
  addresses?: CustomerAddress[];
  preferences?: Partial<CustomerPreferences>;
  customFields?: Record<string, any>;
}): Customer {
  const raw = readRawCustomers();
  const existing = raw.find((c) => c.email.toLowerCase() === data.email.trim().toLowerCase());
  if (existing) {
    throw new Error('A customer with this email address already exists.');
  }

  const newId = `cust-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
  const now = new Date().toISOString();
  const registrationSource = data.registrationSource || 'ADMIN';
  const defaultVerified = registrationSource === 'ADMIN';
  const emailVerified = data.emailVerified ?? defaultVerified;

  const defaultPrefs: CustomerPreferences = {
    newsletterSubscribed: data.preferences?.newsletterSubscribed ?? true,
    smsAlerts: data.preferences?.smsAlerts ?? true,
    orderUpdatesWhatsapp: data.preferences?.orderUpdatesWhatsapp ?? true,
    preferredCurrency: data.preferences?.preferredCurrency ?? 'INR',
    language: data.preferences?.language ?? 'en',
  };

  const newCustomer: Customer = {
    id: newId,
    email: data.email.trim().toLowerCase(),
    passwordHash: data.password
      ? hashCustomerPassword(data.password)
      : hashCustomerPassword(crypto.randomBytes(16).toString('hex')),
    fullName: data.fullName.trim(),
    phone: data.phone?.trim() || '',
    status: data.status || 'ACTIVE',
    role: data.role || 'CUSTOMER',
    permissions: data.permissions || (data.role === 'ADMIN' || data.role === 'SUPER_ADMIN' ? ['manage_products', 'manage_orders', 'manage_payments', 'manage_users', 'manage_cms', 'manage_marketing', 'manage_reviews', 'manage_settings'] : []),
    emailVerified,
    emailVerifiedAt: emailVerified ? data.emailVerifiedAt || now : null,
    verificationSentAt: data.verificationSentAt ?? null,
    registrationSource,
    sessionVersion: 1,
    notes: data.notes || '',
    preferences: defaultPrefs,
    addresses: data.addresses || [],
    wishlistProductIds: [],
    customFields: data.customFields || {},
    createdAt: now,
    updatedAt: now,
    lastLoginAt: emailVerified ? now : undefined,
  };

  raw.push(newCustomer);
  writeRawCustomers(raw);

  return newCustomer;
}

/**
 * Update customer details
 */
export function updateCustomer(
  id: string,
  updates: Partial<Customer> & { password?: string }
): Customer | null {
  const raw = readRawCustomers();
  const index = raw.findIndex((c) => c.id === id);
  if (index === -1) return null;

  const existing = raw[index];

  // Protect system-critical Super Administrator account from status suspension or role demotion
  if (isSuperAdminAccount(existing)) {
    if (updates.status && updates.status !== 'ACTIVE') {
      throw new Error('Protected Super Administrator account cannot be suspended or deactivated.');
    }
    if (updates.role && updates.role !== 'SUPER_ADMIN') {
      throw new Error('Protected Super Administrator account role cannot be changed.');
    }
  }

  // Prevent unauthorized role escalation to SUPER_ADMIN
  if (updates.role === 'SUPER_ADMIN' && !isSuperAdminAccount(existing)) {
    throw new Error('SUPER_ADMIN role is reserved exclusively for the primary system administrator account.');
  }

  // If email is being changed, check for duplicates
  if (updates.email && updates.email.trim().toLowerCase() !== existing.email.toLowerCase()) {
    const duplicate = raw.find(
      (c) => c.id !== id && c.email.toLowerCase() === updates.email!.trim().toLowerCase()
    );
    if (duplicate) {
      throw new Error('A customer with this email address already exists.');
    }
  }

  // If admin provided a new password, hash and update passwordHash (+ invalidate prior sessions)
  let passwordHash = existing.passwordHash;
  let nextSessionVersion = existing.sessionVersion ?? 1;
  if (updates.password && updates.password.trim().length >= 6) {
    passwordHash = hashCustomerPassword(updates.password.trim());
    nextSessionVersion += 1;
  } else if (updates.passwordHash) {
    passwordHash = updates.passwordHash;
  }

  const { password, ...safeUpdates } = updates;

  const updated: Customer = {
    ...existing,
    ...safeUpdates,
    email: updates.email ? updates.email.trim().toLowerCase() : existing.email,
    passwordHash,
    sessionVersion: updates.sessionVersion ?? nextSessionVersion,
    preferences: {
      ...existing.preferences,
      ...(updates.preferences || {}),
    },
    updatedAt: new Date().toISOString(),
  };

  raw[index] = updated;
  writeRawCustomers(raw);
  return updated;
}

/**
 * Delete customer with cascading data cleanup and statutory order PII anonymization
 * In accordance with Indian statutory and tax regulations (GST, Companies Act),
 * invoice records are retained while personal identifying info is securely anonymized.
 */
export function deleteCustomer(id: string): boolean {
  const raw = readRawCustomers();
  const clean = decodeURIComponent(id).trim();
  const targetCust = raw.find((c) => c.id === clean || c.email.toLowerCase() === clean.toLowerCase());
  if (!targetCust) return true; // Idempotent: already deleted

  // Protect system-critical Super Administrator account from deletion
  if (isSuperAdminAccount(targetCust)) {
    throw new Error('Protected Super Administrator account cannot be deleted.');
  }

  // 1. Remove customer record from customers.json
  const filtered = raw.filter((c) => c.id !== targetCust.id && c.email.toLowerCase() !== targetCust.email.toLowerCase());
  writeRawCustomers(filtered);

  const cleanCustEmail = targetCust.email.trim().toLowerCase();
  const cleanCustPhone = (targetCust.phone || '').replace(/\D/g, '').slice(-10);
  const cleanCustName = (targetCust.fullName || '').trim().toLowerCase();

  // 2. Cascade delete customer-linked orders from active orders.json & archive statutory tax ledger to audit_logs.json
  try {
    const allOrders = readRawOrders();
    const remainingOrders: Order[] = [];
    const archivedTaxLedgers: any[] = [];

    for (const ord of allOrders) {
      const ordPhone1 = (ord.customerPhone || '').replace(/\D/g, '').slice(-10);
      const ordPhone2 = (ord.shippingAddress?.phone || '').replace(/\D/g, '').slice(-10);
      const ordPhone3 = (ord.billingAddress?.phone || '').replace(/\D/g, '').slice(-10);
      const ordEmail = (ord.customerEmail || '').trim().toLowerCase();
      const ordName1 = (ord.customerName || '').trim().toLowerCase();
      const ordName2 = (ord.shippingAddress?.fullName || '').trim().toLowerCase();
      const ordName3 = (ord.billingAddress?.fullName || '').trim().toLowerCase();

      const isDirectMatch =
        (ord.customerId && ord.customerId === targetCust.id) ||
        (ordEmail && cleanCustEmail && ordEmail === cleanCustEmail);

      const isGuestMatch =
        (!ord.customerId || ord.customerId === 'guest') &&
        cleanCustPhone.length >= 10 &&
        (ordPhone1 === cleanCustPhone || ordPhone2 === cleanCustPhone || ordPhone3 === cleanCustPhone) &&
        cleanCustName.length > 2 &&
        (ordName1 === cleanCustName || ordName2 === cleanCustName || ordName3 === cleanCustName);

      const isCustomerMatch = isDirectMatch || isGuestMatch;

      if (isCustomerMatch) {
        // Archive statutory financial transaction summary per Indian GST Act 2017 & Companies Act 2013 with PII removed
        archivedTaxLedgers.push({
          id: `audit-tax-${ord.id || ord.orderNumber}-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actor: 'SYSTEM_AUDIT',
          action: 'STATUTORY_TAX_LEDGER_ARCHIVED',
          module: 'orders',
          targetId: ord.orderNumber || ord.id,
          details: {
            orderNumber: ord.orderNumber || ord.id,
            originalOrderDate: ord.createdAt,
            totalInPaise: ord.totalInPaise,
            subtotalInPaise: ord.subtotalInPaise,
            taxInPaise: ord.taxInPaise,
            shippingInPaise: ord.shippingInPaise,
            discountInPaise: ord.discountInPaise,
            paymentMethod: ord.paymentMethod,
            paymentStatus: ord.paymentStatus,
            status: ord.status,
            retentionReason: 'Statutory financial audit compliance (GST Act 2017 Sec 36 / Companies Act 2013 Sec 128). Customer PII permanently erased.',
          },
        });
      } else {
        remainingOrders.push(ord);
      }
    }

    if (archivedTaxLedgers.length > 0) {
      fs.writeFileSync(ORDERS_FILE_PATH, JSON.stringify(remainingOrders, null, 2), 'utf-8');
      try {
        const auditPath = path.join(process.cwd(), 'src', 'data', 'audit_logs.json');
        if (fs.existsSync(auditPath)) {
          const rawAudit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
          const updatedAudit = Array.isArray(rawAudit) ? [...rawAudit, ...archivedTaxLedgers] : archivedTaxLedgers;
          fs.writeFileSync(auditPath, JSON.stringify(updatedAudit, null, 2), 'utf8');
        }
      } catch (auditErr) {
        console.warn('Failed to append tax ledger to audit logs:', auditErr);
      }
    }
  } catch (err) {
    console.error('Error cascading customer deletion to orders.json:', err);
  }

  // 3. Cascade delete all reviews submitted by this customer from reviews.json & recalculate ratings
  try {
    const reviewsPath = path.join(process.cwd(), 'src', 'data', 'reviews.json');
    if (fs.existsSync(reviewsPath)) {
      const allReviews = JSON.parse(fs.readFileSync(reviewsPath, 'utf8'));
      if (Array.isArray(allReviews)) {
        const remainingReviews = allReviews.filter((r) => {
          const isReviewerMatch =
            (r.customerId && r.customerId === targetCust.id) ||
            (r.customerEmail && r.customerEmail.toLowerCase() === cleanCustEmail);
          return !isReviewerMatch;
        });
        if (remainingReviews.length !== allReviews.length) {
          fs.writeFileSync(reviewsPath, JSON.stringify(remainingReviews, null, 2), 'utf8');

          // Recalculate product rating & review count in products.json
          try {
            const productsPath = path.join(process.cwd(), 'src', 'data', 'products.json');
            if (fs.existsSync(productsPath)) {
              const products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
              if (Array.isArray(products)) {
                for (const p of products) {
                  const pReviews = remainingReviews.filter((r: any) => r.productId === p.id && r.status === 'PUBLISHED');
                  p.reviewCount = pReviews.length;
                  p.rating = pReviews.length > 0 ? Number((pReviews.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / pReviews.length).toFixed(1)) : 0;
                }
                fs.writeFileSync(productsPath, JSON.stringify(products, null, 2), 'utf8');
              }
            }
          } catch {}
        }
      }
    }
  } catch (err) {
    console.error('Error cascading customer deletion to reviews.json:', err);
  }

  // 4. Cascade delete saved addresses from customer_addresses.json
  try {
    const addressesPath = path.join(process.cwd(), 'src', 'data', 'customer_addresses.json');
    if (fs.existsSync(addressesPath)) {
      const allAddresses = JSON.parse(fs.readFileSync(addressesPath, 'utf8'));
      if (Array.isArray(allAddresses)) {
        const remainingAddresses = allAddresses.filter((a) => a.customerId !== targetCust.id);
        fs.writeFileSync(addressesPath, JSON.stringify(remainingAddresses, null, 2), 'utf8');
      }
    }
  } catch (err) {
    console.error('Error cascading customer deletion to customer_addresses.json:', err);
  }

  // 5. Cascade delete customer inquiries if any (by email or phone)
  try {
    const inquiriesPath = path.join(process.cwd(), 'src', 'data', 'inquiries.json');
    if (fs.existsSync(inquiriesPath)) {
      const allInquiries = JSON.parse(fs.readFileSync(inquiriesPath, 'utf8'));
      if (Array.isArray(allInquiries)) {
        const remainingInquiries = allInquiries.filter((inq) => {
          const inqPhone = (inq.phone || '').replace(/\D/g, '').slice(-10);
          const emailMatch = inq.email?.toLowerCase() === cleanCustEmail;
          const phoneMatch = cleanCustPhone.length >= 10 && inqPhone === cleanCustPhone;
          return !emailMatch && !phoneMatch;
        });
        fs.writeFileSync(inquiriesPath, JSON.stringify(remainingInquiries, null, 2), 'utf8');
      }
    }
  } catch (err) {
    console.error('Error cascading customer deletion to inquiries.json:', err);
  }

  // 6. Cascade delete newsletter subscription if any
  try {
    const newsPath = path.join(process.cwd(), 'src', 'data', 'newsletter_subscribers.json');
    if (fs.existsSync(newsPath)) {
      const allNews = JSON.parse(fs.readFileSync(newsPath, 'utf8'));
      if (Array.isArray(allNews)) {
        const remainingNews = allNews.filter(
          (n) => n.email?.toLowerCase() !== cleanCustEmail
        );
        fs.writeFileSync(newsPath, JSON.stringify(remainingNews, null, 2), 'utf8');
      }
    }
  } catch (err) {
    console.error('Error cascading customer deletion to newsletter_subscribers.json:', err);
  }

  // 7. Invalidate password reset and email verification tokens
  try {
    const resetTokensPath = path.join(process.cwd(), 'src', 'data', 'password_reset_tokens.json');
    if (fs.existsSync(resetTokensPath)) {
      const allTokens = JSON.parse(fs.readFileSync(resetTokensPath, 'utf8'));
      if (Array.isArray(allTokens)) {
        const remaining = allTokens.filter((t) => t.email?.toLowerCase() !== cleanCustEmail);
        fs.writeFileSync(resetTokensPath, JSON.stringify(remaining, null, 2), 'utf8');
      }
    }
  } catch {}

  try {
    const emailVerifyTokensPath = path.join(process.cwd(), 'src', 'data', 'email_verification_tokens.json');
    if (fs.existsSync(emailVerifyTokensPath)) {
      const allTokens = JSON.parse(fs.readFileSync(emailVerifyTokensPath, 'utf8'));
      if (Array.isArray(allTokens)) {
        const remaining = allTokens.filter((t) => t.email?.toLowerCase() !== cleanCustEmail);
        fs.writeFileSync(emailVerifyTokensPath, JSON.stringify(remaining, null, 2), 'utf8');
      }
    }
  } catch {}

  // 8. Cascade delete / purge notification logs
  try {
    const notifPath = path.join(process.cwd(), 'src', 'data', 'notification_logs.json');
    if (fs.existsSync(notifPath)) {
      const allLogs = JSON.parse(fs.readFileSync(notifPath, 'utf8'));
      if (Array.isArray(allLogs)) {
        const remainingLogs = allLogs.filter((log) => {
          const emailMatch = log.recipientEmail?.toLowerCase() === cleanCustEmail;
          const entityMatch = log.contextPayload?.entityId === targetCust.id;
          return !emailMatch && !entityMatch;
        });
        fs.writeFileSync(notifPath, JSON.stringify(remainingLogs, null, 2), 'utf8');
      }
    }
  } catch (err) {
    console.error('Error cascading customer deletion to notification_logs.json:', err);
  }

  // 9. Cascade delete / purge email delivery logs
  try {
    const deliveryPath = path.join(process.cwd(), 'src', 'data', 'email_delivery_logs.json');
    if (fs.existsSync(deliveryPath)) {
      const allLogs = JSON.parse(fs.readFileSync(deliveryPath, 'utf8'));
      if (Array.isArray(allLogs)) {
        const remainingLogs = allLogs.filter((log) => {
          const emailMatch = log.recipientEmail?.toLowerCase() === cleanCustEmail;
          const subscriberMatch = log.subscriberId === targetCust.id;
          return !emailMatch && !subscriberMatch;
        });
        fs.writeFileSync(deliveryPath, JSON.stringify(remainingLogs, null, 2), 'utf8');
      }
    }
  } catch (err) {
    console.error('Error cascading customer deletion to email_delivery_logs.json:', err);
  }

  return true;
}

/**
 * Bulk delete customers with cascading cleanup
 */
export function bulkDeleteCustomers(ids: string[]): {
  success: boolean;
  deletedCount: number;
  failedCount: number;
  errors: string[];
} {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { success: false, deletedCount: 0, failedCount: 0, errors: ['No customer IDs provided.'] };
  }

  let deletedCount = 0;
  let failedCount = 0;
  const errors: string[] = [];

  for (const id of ids) {
    try {
      const cust = getServerCustomerById(id);
      if (!cust) {
        failedCount++;
        errors.push(`Customer ${id} not found.`);
        continue;
      }
      if (
        isSuperAdminAccount(cust) ||
        cust.role === 'ADMIN'
      ) {
        failedCount++;
        errors.push(`Account ${cust.email} is a protected administrator and cannot be bulk deleted.`);
        continue;
      }
      const ok = deleteCustomer(id);
      if (ok) {
        deletedCount++;
      } else {
        failedCount++;
        errors.push(`Failed to delete customer ${id}.`);
      }
    } catch (err: any) {
      failedCount++;
      errors.push(`Error deleting ${id}: ${err?.message || 'Unknown error'}`);
    }
  }

  return {
    success: deletedCount > 0,
    deletedCount,
    failedCount,
    errors,
  };
}

/**
 * Bulk update customers/users status or role
 */
export function bulkUpdateCustomers(
  ids: string[],
  updates: { status?: CustomerStatus; role?: UserRole }
): { success: boolean; updatedCount: number; errors: string[] } {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { success: false, updatedCount: 0, errors: ['No user IDs provided.'] };
  }

  let updatedCount = 0;
  const errors: string[] = [];
  const raw = readRawCustomers();

  for (const id of ids) {
    const cust = raw.find((c) => c.id === id);
    if (!cust) {
      errors.push(`User ${id} not found.`);
      continue;
    }
    // Prevent modifying protected Super Administrator status or role
    if (isSuperAdminAccount(cust)) {
      errors.push(`Protected Super Administrator account ${cust.email} cannot be bulk modified.`);
      continue;
    }
    if (updates.role === 'SUPER_ADMIN') {
      errors.push(`SUPER_ADMIN role cannot be assigned via bulk updates.`);
      continue;
    }
    if (updates.status) cust.status = updates.status;
    if (updates.role) cust.role = updates.role;
    cust.updatedAt = new Date().toISOString();
    updatedCount++;
  }

  writeRawCustomers(raw);
  return { success: updatedCount > 0, updatedCount, errors };
}

/**
 * Admin / Reset-token directly resets customer password
 */
export function adminResetCustomerPassword(
  id: string,
  newPass: string,
  options?: { enforcePolicy?: boolean }
): { success: boolean; error?: string } {
  const raw = readRawCustomers();
  const cust = raw.find((c) => c.id === id);
  if (!cust) return { success: false, error: 'Customer not found.' };

  if (options?.enforcePolicy) {
    const check = validatePasswordAgainstPolicy(newPass, getAuthSettings());
    if (!check.valid) {
      return { success: false, error: check.errors[0] || 'Password does not meet security policy.' };
    }
  } else if (!newPass || newPass.trim().length < 6) {
    return { success: false, error: 'Password must be at least 6 characters.' };
  }

  cust.passwordHash = hashCustomerPassword(newPass.trim());
  cust.sessionVersion = (cust.sessionVersion ?? 1) + 1;
  cust.updatedAt = new Date().toISOString();
  writeRawCustomers(raw);
  return { success: true };
}

/**
 * Change customer password
 */
export function updateCustomerPassword(
  id: string,
  oldPass: string,
  newPass: string
): { success: boolean; error?: string } {
  const raw = readRawCustomers();
  const cust = raw.find((c) => c.id === id);
  if (!cust) return { success: false, error: 'Customer not found.' };

  const isOldValid = verifyCustomerPassword(oldPass, cust.passwordHash);
  if (!isOldValid) {
    return { success: false, error: 'Current password does not match.' };
  }

  const check = validatePasswordAgainstPolicy(newPass, getAuthSettings());
  if (!check.valid) {
    return { success: false, error: check.errors[0] || 'New password does not meet policy requirements.' };
  }

  cust.passwordHash = hashCustomerPassword(newPass);
  cust.sessionVersion = (cust.sessionVersion ?? 1) + 1;
  cust.updatedAt = new Date().toISOString();
  writeRawCustomers(raw);
  return { success: true };
}

/**
 * Customer Address Management
 */
export function manageCustomerAddress(
  customerId: string,
  action: 'ADD' | 'UPDATE' | 'DELETE' | 'SET_DEFAULT_SHIPPING' | 'SET_DEFAULT_BILLING',
  addressData?: Partial<CustomerAddress> & { id?: string }
): CustomerAddress[] | null {
  const raw = readRawCustomers();
  const cust = raw.find((c) => c.id === customerId);
  if (!cust) return null;

  let addresses = [...cust.addresses];

  if (action === 'ADD') {
    const newAddr: CustomerAddress = {
      id: addressData?.id || `addr-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      customerId,
      fullName: addressData?.fullName || cust.fullName,
      phone: addressData?.phone || cust.phone,
      addressLine1: addressData?.addressLine1 || '',
      addressLine2: addressData?.addressLine2 || '',
      city: addressData?.city || '',
      state: addressData?.state || '',
      postalCode: addressData?.postalCode || '',
      country: addressData?.country || 'India',
      isDefaultShipping: addressData?.isDefaultShipping || addresses.length === 0,
      isDefaultBilling: addressData?.isDefaultBilling || addresses.length === 0,
    };

    if (newAddr.isDefaultShipping) {
      addresses = addresses.map((a) => ({ ...a, isDefaultShipping: false }));
    }
    if (newAddr.isDefaultBilling) {
      addresses = addresses.map((a) => ({ ...a, isDefaultBilling: false }));
    }

    addresses.push(newAddr);
  } else if (action === 'UPDATE' && addressData?.id) {
    const idx = addresses.findIndex((a) => a.id === addressData.id);
    if (idx !== -1) {
      if (addressData.isDefaultShipping) {
        addresses = addresses.map((a) => ({ ...a, isDefaultShipping: false }));
      }
      if (addressData.isDefaultBilling) {
        addresses = addresses.map((a) => ({ ...a, isDefaultBilling: false }));
      }

      addresses[idx] = {
        ...addresses[idx],
        ...addressData,
      } as CustomerAddress;
    }
  } else if (action === 'DELETE' && addressData?.id) {
    addresses = addresses.filter((a) => a.id !== addressData.id);
    // Ensure there is at least one default if addresses remain
    if (addresses.length > 0 && !addresses.some((a) => a.isDefaultShipping)) {
      addresses[0].isDefaultShipping = true;
    }
    if (addresses.length > 0 && !addresses.some((a) => a.isDefaultBilling)) {
      addresses[0].isDefaultBilling = true;
    }
  } else if (action === 'SET_DEFAULT_SHIPPING' && addressData?.id) {
    addresses = addresses.map((a) => ({
      ...a,
      isDefaultShipping: a.id === addressData.id,
    }));
  } else if (action === 'SET_DEFAULT_BILLING' && addressData?.id) {
    addresses = addresses.map((a) => ({
      ...a,
      isDefaultBilling: a.id === addressData.id,
    }));
  }

  cust.addresses = addresses;
  cust.updatedAt = new Date().toISOString();
  writeRawCustomers(raw);

  return addresses;
}

/**
 * Customer Wishlist Management
 */
export function manageCustomerWishlist(
  customerId: string,
  productId: string,
  action: 'ADD' | 'REMOVE' | 'TOGGLE'
): string[] {
  const raw = readRawCustomers();
  const cust = raw.find((c) => c.id === customerId);
  if (!cust) return [];

  let wishlist = Array.isArray(cust.wishlistProductIds) ? [...cust.wishlistProductIds] : [];
  const exists = wishlist.includes(productId);

  if (action === 'ADD' && !exists) {
    wishlist.push(productId);
  } else if (action === 'REMOVE' && exists) {
    wishlist = wishlist.filter((p) => p !== productId);
  } else if (action === 'TOGGLE') {
    if (exists) {
      wishlist = wishlist.filter((p) => p !== productId);
    } else {
      wishlist.push(productId);
    }
  }

  cust.wishlistProductIds = wishlist;
  cust.updatedAt = new Date().toISOString();
  writeRawCustomers(raw);
  return wishlist;
}
