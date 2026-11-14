import fs from 'fs';
import path from 'path';
import type {
  Coupon,
  CouponApplicabilityType,
  CouponRedemptionRecord,
  CouponStatus,
  CouponUserEligibility,
} from '../../types/index.ts';

// ==============================================================================
// InfiniCharm — Server-Side Coupons & Promotions Authority
// Standards: Zero Mock Data, Integer Paise Authority, Atomic Persistence
// ==============================================================================

export interface CouponValidationCartItem {
  productId: string;
  variantId?: string;
  categoryId?: string;
  categorySlug?: string;
  priceInPaise: number;
  quantity: number;
}

export interface CouponValidationContext {
  code: string;
  items: CouponValidationCartItem[];
  subtotalInPaise?: number;
  customerId?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  isAuthenticated?: boolean;
  customerOrderCount?: number;
  now?: Date;
  filePath?: string;
}

export interface ServerCouponValidationResult {
  valid: boolean;
  message: string;
  coupon?: Coupon;
  discountInPaise: number;
  eligibleSubtotalInPaise?: number;
  errorCode?:
    | 'INVALID_CODE'
    | 'INACTIVE'
    | 'NOT_STARTED'
    | 'EXPIRED'
    | 'GLOBAL_LIMIT_REACHED'
    | 'USER_LIMIT_REACHED'
    | 'AUTH_REQUIRED'
    | 'NEW_CUSTOMER_ONLY'
    | 'USER_NOT_ELIGIBLE'
    | 'NOT_APPLICABLE_TO_ITEMS'
    | 'MIN_ORDER_NOT_MET';
}

export interface CreateCouponInput {
  code: string;
  description?: string;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue: number;
  minOrderInPaise: number;
  maxDiscountInPaise?: number;
  usageLimitTotal?: number;
  usageLimitPerCustomer?: number;
  validFrom: string;
  validUntil: string;
  applicabilityType?: CouponApplicabilityType;
  applicableCategoryIds?: string[];
  applicableProductIds?: string[];
  userEligibility?: CouponUserEligibility;
  eligibleCustomerIds?: string[];
  isActive?: boolean;
  status?: CouponStatus;
}

export type UpdateCouponInput = Partial<CreateCouponInput>;

function resolveCouponsFilePath(customPath?: string): string {
  if (customPath) return customPath;
  if (process.env.INFINICHARM_COUPONS_FILE) {
    return process.env.INFINICHARM_COUPONS_FILE;
  }
  const primary = path.join(process.cwd(), 'src', 'data', 'coupons.json');
  if (fs.existsSync(primary)) return primary;
  const alt = path.join(process.cwd(), 'data', 'coupons.json');
  if (fs.existsSync(alt)) return alt;
  return primary;
}

function readCouponsRaw(filePath?: string): Coupon[] {
  const target = resolveCouponsFilePath(filePath);
  if (!fs.existsSync(target)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(target, 'utf-8').trim();
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Error reading coupons store:', err);
    return [];
  }
}

function writeCouponsRaw(coupons: Coupon[], filePath?: string): void {
  const target = resolveCouponsFilePath(filePath);
  const dir = path.dirname(target);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(target, JSON.stringify(coupons, null, 2), 'utf-8');
}

export function resolveCouponStatus(coupon: Coupon, now = new Date()): CouponStatus {
  if (coupon.status === 'EXPIRED') {
    return 'EXPIRED';
  }
  if (coupon.validUntil) {
    const endMs = new Date(coupon.validUntil).getTime();
    if (!Number.isNaN(endMs) && endMs < now.getTime()) {
      return 'EXPIRED';
    }
  }
  if (!coupon.isActive || coupon.status === 'INACTIVE') {
    return 'INACTIVE';
  }
  return 'ACTIVE';
}

function normalizeCouponRecord(coupon: Coupon, now = new Date()): Coupon {
  const effectiveStatus = resolveCouponStatus(coupon, now);
  return {
    ...coupon,
    code: String(coupon.code || '').trim().toUpperCase(),
    minOrderInPaise: Math.max(0, Math.round(Number(coupon.minOrderInPaise) || 0)),
    maxDiscountInPaise:
      coupon.maxDiscountInPaise !== undefined && coupon.maxDiscountInPaise !== null && Number(coupon.maxDiscountInPaise) > 0
        ? Math.round(Number(coupon.maxDiscountInPaise))
        : undefined,
    usageLimitTotal:
      coupon.usageLimitTotal !== undefined && coupon.usageLimitTotal !== null && Number(coupon.usageLimitTotal) > 0
        ? Math.round(Number(coupon.usageLimitTotal))
        : undefined,
    usageLimitPerCustomer: Math.max(0, Math.round(Number(coupon.usageLimitPerCustomer ?? 1))),
    usageCount: Math.max(0, Math.round(Number(coupon.usageCount) || 0)),
    redeemedBy: Array.isArray(coupon.redeemedBy) ? coupon.redeemedBy : [],
    applicabilityType: coupon.applicabilityType || 'ALL',
    applicableCategoryIds: Array.isArray(coupon.applicableCategoryIds) ? coupon.applicableCategoryIds : [],
    applicableProductIds: Array.isArray(coupon.applicableProductIds) ? coupon.applicableProductIds : [],
    userEligibility: coupon.userEligibility || 'ALL',
    eligibleCustomerIds: Array.isArray(coupon.eligibleCustomerIds) ? coupon.eligibleCustomerIds : [],
    isActive: effectiveStatus === 'ACTIVE',
    status: effectiveStatus,
  };
}

export function getServerCoupons(
  options?: { search?: string; status?: string; discountType?: string },
  filePath?: string
): Coupon[] {
  const now = new Date();
  let coupons = readCouponsRaw(filePath).map((c) => normalizeCouponRecord(c, now));

  if (options?.search) {
    const q = options.search.trim().toLowerCase();
    coupons = coupons.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q))
    );
  }

  if (options?.status && options.status !== 'ALL') {
    coupons = coupons.filter((c) => c.status === options.status);
  }

  if (options?.discountType && options.discountType !== 'ALL') {
    coupons = coupons.filter((c) => c.discountType === options.discountType);
  }

  return coupons;
}

export function getServerCouponById(id: string, filePath?: string): Coupon | null {
  const all = getServerCoupons(undefined, filePath);
  return all.find((c) => c.id === id) || null;
}

export function getServerCouponByCode(code: string, filePath?: string): Coupon | null {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;
  const all = getServerCoupons(undefined, filePath);
  return all.find((c) => c.code === normalized) || null;
}

function validateCouponPayload(
  payload: {
    code: string;
    discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
    discountValue: number;
    minOrderInPaise: number;
    maxDiscountInPaise?: number;
    usageLimitTotal?: number;
    usageLimitPerCustomer: number;
    validFrom: string;
    validUntil: string;
  }
): void {
  if (!payload.code || !/^[A-Z0-9_-]{2,40}$/.test(payload.code)) {
    throw new Error(
      'Coupon code must be 2–40 characters and contain only letters, numbers, hyphens, or underscores.'
    );
  }

  if (!Number.isFinite(payload.discountValue) || payload.discountValue <= 0) {
    throw new Error('Discount value must be greater than zero.');
  }

  if (payload.discountType === 'PERCENTAGE' && payload.discountValue > 100) {
    throw new Error('Percentage discount cannot exceed 100%.');
  }

  if (!Number.isFinite(payload.minOrderInPaise) || payload.minOrderInPaise < 0) {
    throw new Error('Minimum order value cannot be negative.');
  }

  if (payload.maxDiscountInPaise !== undefined && payload.maxDiscountInPaise < 0) {
    throw new Error('Maximum discount limit cannot be negative.');
  }

  if (payload.usageLimitTotal !== undefined && payload.usageLimitTotal < 0) {
    throw new Error('Total usage limit cannot be negative.');
  }

  if (payload.usageLimitPerCustomer < 0) {
    throw new Error('Per-customer usage limit cannot be negative.');
  }

  const fromDate = new Date(payload.validFrom);
  const untilDate = new Date(payload.validUntil);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(untilDate.getTime())) {
    throw new Error('Valid start date and end date are required.');
  }

  if (untilDate.getTime() < fromDate.getTime()) {
    throw new Error('Validity end date must be on or after the start date.');
  }
}

export function createServerCoupon(input: CreateCouponInput, filePath?: string): Coupon {
  const existing = readCouponsRaw(filePath);
  const normalizedCode = String(input.code || '').trim().toUpperCase();

  if (existing.some((c) => c.code.trim().toUpperCase() === normalizedCode)) {
    throw new Error(`A coupon with code "${normalizedCode}" already exists.`);
  }

  const nowIso = new Date().toISOString();
  const desiredStatus: CouponStatus =
    input.status || (input.isActive === false ? 'INACTIVE' : 'ACTIVE');

  const candidate: Coupon = {
    id: `coup-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    code: normalizedCode,
    description: input.description?.trim() || '',
    discountType: input.discountType,
    discountValue:
      input.discountType === 'PERCENTAGE'
        ? Number(input.discountValue)
        : Math.round(Number(input.discountValue)),
    minOrderInPaise: Math.round(Number(input.minOrderInPaise) || 0),
    maxDiscountInPaise:
      input.maxDiscountInPaise && Number(input.maxDiscountInPaise) > 0
        ? Math.round(Number(input.maxDiscountInPaise))
        : undefined,
    usageLimitTotal:
      input.usageLimitTotal && Number(input.usageLimitTotal) > 0
        ? Math.round(Number(input.usageLimitTotal))
        : undefined,
    usageLimitPerCustomer:
      input.usageLimitPerCustomer !== undefined ? Math.max(0, Math.round(Number(input.usageLimitPerCustomer))) : 1,
    usageCount: 0,
    redeemedBy: [],
    validFrom: input.validFrom || nowIso,
    validUntil: input.validUntil,
    applicabilityType: input.applicabilityType || 'ALL',
    applicableCategoryIds: input.applicableCategoryIds || [],
    applicableProductIds: input.applicableProductIds || [],
    userEligibility: input.userEligibility || 'ALL',
    eligibleCustomerIds: input.eligibleCustomerIds || [],
    isActive: desiredStatus === 'ACTIVE',
    status: desiredStatus,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  validateCouponPayload({
    code: candidate.code,
    discountType: candidate.discountType,
    discountValue: candidate.discountValue,
    minOrderInPaise: candidate.minOrderInPaise,
    maxDiscountInPaise: candidate.maxDiscountInPaise,
    usageLimitTotal: candidate.usageLimitTotal,
    usageLimitPerCustomer: candidate.usageLimitPerCustomer,
    validFrom: candidate.validFrom,
    validUntil: candidate.validUntil,
  });

  const normalized = normalizeCouponRecord(candidate);
  const next = [normalized, ...existing];
  writeCouponsRaw(next, filePath);
  return normalized;
}

export function updateServerCoupon(
  id: string,
  patch: UpdateCouponInput,
  filePath?: string
): Coupon {
  const existing = readCouponsRaw(filePath);
  const idx = existing.findIndex((c) => c.id === id);
  if (idx === -1) {
    throw new Error('Coupon not found.');
  }

  const current = existing[idx];
  const nextCode =
    patch.code !== undefined ? String(patch.code).trim().toUpperCase() : current.code.trim().toUpperCase();

  if (existing.some((c, i) => i !== idx && c.code.trim().toUpperCase() === nextCode)) {
    throw new Error(`Another coupon with code "${nextCode}" already exists.`);
  }

  const nextType = patch.discountType ?? current.discountType;
  const nextValueRaw = patch.discountValue ?? current.discountValue;
  const nextValue = nextType === 'PERCENTAGE' ? Number(nextValueRaw) : Math.round(Number(nextValueRaw));

  let desiredStatus: CouponStatus | undefined = patch.status;
  if (!desiredStatus && patch.isActive !== undefined) {
    desiredStatus = patch.isActive ? 'ACTIVE' : 'INACTIVE';
  }
  if (!desiredStatus) {
    desiredStatus = current.status;
  }

  // If admin explicitly reactivates an EXPIRED coupon without specifying an older status, clear manual EXPIRED flag
  const merged: Coupon = {
    ...current,
    code: nextCode,
    description: patch.description !== undefined ? patch.description.trim() : current.description,
    discountType: nextType,
    discountValue: nextValue,
    minOrderInPaise:
      patch.minOrderInPaise !== undefined
        ? Math.round(Number(patch.minOrderInPaise))
        : current.minOrderInPaise,
    maxDiscountInPaise:
      patch.maxDiscountInPaise !== undefined
        ? Number(patch.maxDiscountInPaise) > 0
          ? Math.round(Number(patch.maxDiscountInPaise))
          : undefined
        : current.maxDiscountInPaise,
    usageLimitTotal:
      patch.usageLimitTotal !== undefined
        ? Number(patch.usageLimitTotal) > 0
          ? Math.round(Number(patch.usageLimitTotal))
          : undefined
        : current.usageLimitTotal,
    usageLimitPerCustomer:
      patch.usageLimitPerCustomer !== undefined
        ? Math.max(0, Math.round(Number(patch.usageLimitPerCustomer)))
        : current.usageLimitPerCustomer,
    validFrom: patch.validFrom ?? current.validFrom,
    validUntil: patch.validUntil ?? current.validUntil,
    applicabilityType: patch.applicabilityType ?? current.applicabilityType ?? 'ALL',
    applicableCategoryIds: patch.applicableCategoryIds ?? current.applicableCategoryIds ?? [],
    applicableProductIds: patch.applicableProductIds ?? current.applicableProductIds ?? [],
    userEligibility: patch.userEligibility ?? current.userEligibility ?? 'ALL',
    eligibleCustomerIds: patch.eligibleCustomerIds ?? current.eligibleCustomerIds ?? [],
    isActive: desiredStatus === 'ACTIVE',
    status: desiredStatus,
    updatedAt: new Date().toISOString(),
  };

  validateCouponPayload({
    code: merged.code,
    discountType: merged.discountType,
    discountValue: merged.discountValue,
    minOrderInPaise: merged.minOrderInPaise,
    maxDiscountInPaise: merged.maxDiscountInPaise,
    usageLimitTotal: merged.usageLimitTotal,
    usageLimitPerCustomer: merged.usageLimitPerCustomer,
    validFrom: merged.validFrom,
    validUntil: merged.validUntil,
  });

  const normalized = normalizeCouponRecord(merged);
  const next = [...existing];
  next[idx] = normalized;
  writeCouponsRaw(next, filePath);
  return normalized;
}

export function deleteServerCoupon(id: string, filePath?: string): boolean {
  const existing = readCouponsRaw(filePath);
  const filtered = existing.filter((c) => c.id !== id);
  if (filtered.length === existing.length) {
    return false;
  }
  writeCouponsRaw(filtered, filePath);
  return true;
}

function countCustomerRedemptions(
  coupon: Coupon,
  customerId?: string | null,
  customerEmail?: string | null,
  customerPhone?: string | null
): number {
  const records = coupon.redeemedBy || [];
  const cleanId = customerId && customerId !== 'guest' ? customerId.trim() : null;
  const cleanEmail = customerEmail ? customerEmail.trim().toLowerCase() : null;
  const cleanPhone = customerPhone ? customerPhone.replace(/\D/g, '') : null;

  if (!cleanId && !cleanEmail && !cleanPhone) return 0;

  return records.filter((rec) => {
    if (cleanId && rec.customerId && rec.customerId === cleanId) return true;
    if (cleanEmail && rec.customerEmail && rec.customerEmail.toLowerCase() === cleanEmail) return true;
    if (cleanPhone && rec.customerPhone && rec.customerPhone.replace(/\D/g, '') === cleanPhone) return true;
    return false;
  }).length;
}

export function validateCouponServerSide(
  ctx: CouponValidationContext
): ServerCouponValidationResult {
  const normalizedCode = String(ctx.code || '').trim().toUpperCase();
  if (!normalizedCode) {
    return {
      valid: false,
      message: 'Please enter a coupon code.',
      discountInPaise: 0,
      errorCode: 'INVALID_CODE',
    };
  }

  const now = ctx.now || new Date();
  const rawCoupons = readCouponsRaw(ctx.filePath);
  const foundRaw = rawCoupons.find((c) => c.code.trim().toUpperCase() === normalizedCode);

  if (!foundRaw) {
    return {
      valid: false,
      message: `Coupon code "${normalizedCode}" is invalid or does not exist.`,
      discountInPaise: 0,
      errorCode: 'INVALID_CODE',
    };
  }

  const coupon = normalizeCouponRecord(foundRaw, now);

  // 1. Validity period check before status message if date expired
  const fromMs = new Date(coupon.validFrom).getTime();
  const untilMs = new Date(coupon.validUntil).getTime();

  if (!Number.isNaN(untilMs) && now.getTime() > untilMs) {
    return {
      valid: false,
      message: `Coupon ${coupon.code} has expired.`,
      discountInPaise: 0,
      errorCode: 'EXPIRED',
    };
  }

  if (coupon.status === 'EXPIRED') {
    return {
      valid: false,
      message: `Coupon ${coupon.code} has expired.`,
      discountInPaise: 0,
      errorCode: 'EXPIRED',
    };
  }

  if (!coupon.isActive || coupon.status === 'INACTIVE') {
    return {
      valid: false,
      message: `Coupon ${coupon.code} is currently inactive.`,
      discountInPaise: 0,
      errorCode: 'INACTIVE',
    };
  }

  if (!Number.isNaN(fromMs) && now.getTime() < fromMs) {
    return {
      valid: false,
      message: `Coupon ${coupon.code} is scheduled for a future date and not active yet.`,
      discountInPaise: 0,
      errorCode: 'NOT_STARTED',
    };
  }

  // 2. Global usage limit
  if (coupon.usageLimitTotal && coupon.usageLimitTotal > 0 && coupon.usageCount >= coupon.usageLimitTotal) {
    return {
      valid: false,
      message: `Coupon ${coupon.code} has reached its maximum redemption limit.`,
      discountInPaise: 0,
      errorCode: 'GLOBAL_LIMIT_REACHED',
    };
  }

  // 3. User eligibility
  const isAuthenticated = Boolean(
    ctx.isAuthenticated || (ctx.customerId && ctx.customerId !== 'guest')
  );
  const eligibility = coupon.userEligibility || 'ALL';

  if (eligibility === 'LOGGED_IN' && !isAuthenticated) {
    return {
      valid: false,
      message: `Please sign in to your account to use coupon ${coupon.code}.`,
      discountInPaise: 0,
      errorCode: 'AUTH_REQUIRED',
    };
  }

  if (eligibility === 'NEW_CUSTOMERS') {
    if (!isAuthenticated && !ctx.customerEmail && !ctx.customerPhone) {
      return {
        valid: false,
        message: `Coupon ${coupon.code} is exclusive to new customers. Please sign in or enter your contact details at checkout.`,
        discountInPaise: 0,
        errorCode: 'AUTH_REQUIRED',
      };
    }
    if ((ctx.customerOrderCount ?? 0) > 0) {
      return {
        valid: false,
        message: `Coupon ${coupon.code} is valid only for first-time customers.`,
        discountInPaise: 0,
        errorCode: 'NEW_CUSTOMER_ONLY',
      };
    }
  }

  if (eligibility === 'SPECIFIC_CUSTOMERS') {
    const allowedIds = coupon.eligibleCustomerIds || [];
    if (!ctx.customerId || ctx.customerId === 'guest' || !allowedIds.includes(ctx.customerId)) {
      return {
        valid: false,
        message: `Your account is not eligible for coupon ${coupon.code}.`,
        discountInPaise: 0,
        errorCode: 'USER_NOT_ELIGIBLE',
      };
    }
  }

  // 4. Per-customer usage limit
  if (coupon.usageLimitPerCustomer > 0) {
    const usedByUser = countCustomerRedemptions(
      coupon,
      ctx.customerId,
      ctx.customerEmail,
      ctx.customerPhone
    );
    if (usedByUser >= coupon.usageLimitPerCustomer) {
      return {
        valid: false,
        message: `You have already used coupon ${coupon.code} the maximum allowed number of times.`,
        discountInPaise: 0,
        errorCode: 'USER_LIMIT_REACHED',
      };
    }
  }

  // 5. Product & Category applicability
  const applicability = coupon.applicabilityType || 'ALL';
  const items = Array.isArray(ctx.items) ? ctx.items : [];

  let eligibleSubtotalInPaise = 0;

  if (items.length === 0) {
    if (applicability !== 'ALL') {
      return {
        valid: false,
        message: `Coupon ${coupon.code} applies to specific items. Add qualifying products to your cart first.`,
        discountInPaise: 0,
        errorCode: 'NOT_APPLICABLE_TO_ITEMS',
      };
    }
    eligibleSubtotalInPaise = Math.max(0, Math.round(ctx.subtotalInPaise || 0));
  } else if (applicability === 'ALL') {
    eligibleSubtotalInPaise = items.reduce(
      (sum, item) => sum + Math.max(0, Math.round(item.priceInPaise)) * Math.max(1, item.quantity),
      0
    );
  } else if (applicability === 'CATEGORIES') {
    const catIds = new Set(coupon.applicableCategoryIds || []);
    for (const item of items) {
      const matchById = item.categoryId && catIds.has(item.categoryId);
      const matchBySlug = item.categorySlug && catIds.has(item.categorySlug);
      if (matchById || matchBySlug) {
        eligibleSubtotalInPaise +=
          Math.max(0, Math.round(item.priceInPaise)) * Math.max(1, item.quantity);
      }
    }
    if (eligibleSubtotalInPaise === 0) {
      return {
        valid: false,
        message: `Coupon ${coupon.code} is not valid for the categories in your bag.`,
        discountInPaise: 0,
        errorCode: 'NOT_APPLICABLE_TO_ITEMS',
      };
    }
  } else if (applicability === 'PRODUCTS') {
    const prodIds = new Set(coupon.applicableProductIds || []);
    for (const item of items) {
      if (item.productId && prodIds.has(item.productId)) {
        eligibleSubtotalInPaise +=
          Math.max(0, Math.round(item.priceInPaise)) * Math.max(1, item.quantity);
      }
    }
    if (eligibleSubtotalInPaise === 0) {
      return {
        valid: false,
        message: `Coupon ${coupon.code} does not apply to the products in your bag.`,
        discountInPaise: 0,
        errorCode: 'NOT_APPLICABLE_TO_ITEMS',
      };
    }
  }

  // 6. Minimum order value on eligible subtotal
  if (eligibleSubtotalInPaise < coupon.minOrderInPaise) {
    const minRupees = (coupon.minOrderInPaise / 100).toLocaleString('en-IN', {
      maximumFractionDigits: 2,
    });
    return {
      valid: false,
      message: `Coupon ${coupon.code} requires a minimum qualifying spend of ₹${minRupees}.`,
      discountInPaise: 0,
      eligibleSubtotalInPaise,
      errorCode: 'MIN_ORDER_NOT_MET',
    };
  }

  // 7. Discount calculation in integer paise
  let discountInPaise = 0;
  if (coupon.discountType === 'PERCENTAGE') {
    discountInPaise = Math.round((eligibleSubtotalInPaise * coupon.discountValue) / 100);
    if (coupon.maxDiscountInPaise && discountInPaise > coupon.maxDiscountInPaise) {
      discountInPaise = coupon.maxDiscountInPaise;
    }
  } else {
    discountInPaise = coupon.discountValue;
  }

  discountInPaise = Math.max(0, Math.min(discountInPaise, eligibleSubtotalInPaise));

  return {
    valid: true,
    message: `Coupon ${coupon.code} applied successfully!`,
    coupon,
    discountInPaise,
    eligibleSubtotalInPaise,
  };
}

export function recordCouponRedemption(
  code: string,
  record: CouponRedemptionRecord,
  filePath?: string
): Coupon | null {
  const normalizedCode = String(code || '').trim().toUpperCase();
  if (!normalizedCode) return null;

  const existing = readCouponsRaw(filePath);
  const idx = existing.findIndex((c) => c.code.trim().toUpperCase() === normalizedCode);
  if (idx === -1) return null;

  const target = existing[idx];
  const redeemedBy = Array.isArray(target.redeemedBy) ? [...target.redeemedBy] : [];
  redeemedBy.push(record);

  const updated = normalizeCouponRecord({
    ...target,
    usageCount: (target.usageCount || 0) + 1,
    redeemedBy,
    updatedAt: new Date().toISOString(),
  });

  const next = [...existing];
  next[idx] = updated;
  writeCouponsRaw(next, filePath);
  return updated;
}

