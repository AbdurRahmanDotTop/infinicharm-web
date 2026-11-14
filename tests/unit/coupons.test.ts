import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  createServerCoupon,
  deleteServerCoupon,
  getServerCoupons,
  recordCouponRedemption,
  updateServerCoupon,
  validateCouponServerSide,
} from '../../src/lib/server/coupons-store.ts';

describe('Database-Driven Coupons CRUD & Server Validation Engine', () => {
  let tempDir: string;
  let couponsFile: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'infinicharm-coupons-test-'));
    couponsFile = path.join(tempDir, 'coupons.json');
    fs.writeFileSync(couponsFile, '[]', 'utf-8');
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('starts empty with zero mock/demo coupons', () => {
    const initial = getServerCoupons(undefined, couponsFile);
    assert.strictEqual(initial.length, 0);

    const welcomeResult = validateCouponServerSide({
      code: 'WELCOME10',
      items: [{ productId: 'p1', priceInPaise: 100000, quantity: 1 }],
      filePath: couponsFile,
    });
    assert.strictEqual(welcomeResult.valid, false);
    assert.strictEqual(welcomeResult.discountInPaise, 0);
  });

  it('supports create, edit/update, percentage cap calculation, and permanent delete', () => {
    const now = new Date('2026-11-12T10:00:00Z');
    const created = createServerCoupon(
      {
        code: 'HARVEST15',
        description: 'Seasonal harvest savings',
        discountType: 'PERCENTAGE',
        discountValue: 15,
        minOrderInPaise: 50000,
        maxDiscountInPaise: 20000,
        usageLimitPerCustomer: 2,
        validFrom: '2026-01-01T00:00:00Z',
        validUntil: '2027-12-31T23:59:59Z',
      },
      couponsFile
    );

    assert.strictEqual(created.code, 'HARVEST15');
    assert.strictEqual(created.status, 'ACTIVE');

    // Within cap: 15% of ₹1,000 = ₹150 (15000 paise)
    const ok = validateCouponServerSide({
      code: 'harvest15',
      items: [{ productId: 'p1', priceInPaise: 100000, quantity: 1 }],
      now,
      filePath: couponsFile,
    });
    assert.strictEqual(ok.valid, true);
    assert.strictEqual(ok.discountInPaise, 15000);

    // Exceeds cap: 15% of ₹3,000 = ₹450 -> capped at ₹200 (20000 paise)
    const capped = validateCouponServerSide({
      code: 'HARVEST15',
      items: [{ productId: 'p1', priceInPaise: 300000, quantity: 1 }],
      now,
      filePath: couponsFile,
    });
    assert.strictEqual(capped.valid, true);
    assert.strictEqual(capped.discountInPaise, 20000);

    // Edit to fixed ₹100 off with ₹999 min
    const updated = updateServerCoupon(
      created.id,
      {
        discountType: 'FIXED_AMOUNT',
        discountValue: 10000,
        minOrderInPaise: 99900,
        maxDiscountInPaise: 0,
      },
      couponsFile
    );
    assert.strictEqual(updated.discountType, 'FIXED_AMOUNT');
    assert.strictEqual(updated.discountValue, 10000);

    const belowMin = validateCouponServerSide({
      code: 'HARVEST15',
      items: [{ productId: 'p1', priceInPaise: 70000, quantity: 1 }],
      now,
      filePath: couponsFile,
    });
    assert.strictEqual(belowMin.valid, false);
    assert.strictEqual(belowMin.errorCode, 'MIN_ORDER_NOT_MET');

    // Permanently delete
    const deleted = deleteServerCoupon(created.id, couponsFile);
    assert.strictEqual(deleted, true);
    assert.strictEqual(getServerCoupons(undefined, couponsFile).length, 0);
  });

  it('enforces expiry dates, inactive toggle, and global/per-customer usage limits', () => {
    const expired = createServerCoupon(
      {
        code: 'OLD2025',
        discountType: 'FIXED_AMOUNT',
        discountValue: 5000,
        minOrderInPaise: 0,
        validFrom: '2025-01-01T00:00:00Z',
        validUntil: '2025-12-31T23:59:59Z',
      },
      couponsFile
    );
    assert.strictEqual(expired.status, 'EXPIRED');

    const expCheck = validateCouponServerSide({
      code: 'OLD2025',
      items: [{ productId: 'p1', priceInPaise: 50000, quantity: 1 }],
      now: new Date('2026-06-01T00:00:00Z'),
      filePath: couponsFile,
    });
    assert.strictEqual(expCheck.valid, false);
    assert.strictEqual(expCheck.errorCode, 'EXPIRED');

    const limited = createServerCoupon(
      {
        code: 'LIMITED1',
        discountType: 'FIXED_AMOUNT',
        discountValue: 10000,
        minOrderInPaise: 0,
        usageLimitTotal: 2,
        usageLimitPerCustomer: 1,
        validFrom: '2026-01-01T00:00:00Z',
        validUntil: '2028-01-01T00:00:00Z',
      },
      couponsFile
    );

    recordCouponRedemption(
      limited.code,
      {
        customerId: 'cust-1',
        orderNumber: 'ORD-101',
        discountInPaise: 10000,
        redeemedAt: '2026-11-12T10:00:00Z',
      },
      couponsFile
    );

    // Same user blocked by per-user limit = 1
    const sameUserCheck = validateCouponServerSide({
      code: 'LIMITED1',
      items: [{ productId: 'p1', priceInPaise: 50000, quantity: 1 }],
      customerId: 'cust-1',
      isAuthenticated: true,
      now: new Date('2026-11-12T10:05:00Z'),
      filePath: couponsFile,
    });
    assert.strictEqual(sameUserCheck.valid, false);
    assert.strictEqual(sameUserCheck.errorCode, 'USER_LIMIT_REACHED');

    // Different user succeeds for 2nd redemption
    const secondUserCheck = validateCouponServerSide({
      code: 'LIMITED1',
      items: [{ productId: 'p1', priceInPaise: 50000, quantity: 1 }],
      customerId: 'cust-2',
      isAuthenticated: true,
      now: new Date('2026-11-12T10:05:00Z'),
      filePath: couponsFile,
    });
    assert.strictEqual(secondUserCheck.valid, true);

    recordCouponRedemption(
      limited.code,
      {
        customerId: 'cust-2',
        orderNumber: 'ORD-102',
        discountInPaise: 10000,
        redeemedAt: '2026-11-12T10:06:00Z',
      },
      couponsFile
    );

    // 3rd user blocked by global usageLimitTotal = 2
    const globalLimitCheck = validateCouponServerSide({
      code: 'LIMITED1',
      items: [{ productId: 'p1', priceInPaise: 50000, quantity: 1 }],
      customerId: 'cust-3',
      isAuthenticated: true,
      now: new Date('2026-11-12T10:10:00Z'),
      filePath: couponsFile,
    });
    assert.strictEqual(globalLimitCheck.valid, false);
    assert.strictEqual(globalLimitCheck.errorCode, 'GLOBAL_LIMIT_REACHED');
  });

  it('enforces category applicability and user eligibility rules', () => {
    createServerCoupon(
      {
        code: 'HONEYFIRST',
        discountType: 'PERCENTAGE',
        discountValue: 10,
        minOrderInPaise: 50000,
        applicabilityType: 'CATEGORIES',
        applicableCategoryIds: ['cat-honey'],
        userEligibility: 'NEW_CUSTOMERS',
        validFrom: '2026-01-01T00:00:00Z',
        validUntil: '2028-01-01T00:00:00Z',
      },
      couponsFile
    );

    // Returning customer rejected
    const returning = validateCouponServerSide({
      code: 'HONEYFIRST',
      items: [{ productId: 'p-honey', categoryId: 'cat-honey', priceInPaise: 100000, quantity: 1 }],
      customerId: 'cust-returning',
      isAuthenticated: true,
      customerOrderCount: 1,
      now: new Date('2026-11-12T10:00:00Z'),
      filePath: couponsFile,
    });
    assert.strictEqual(returning.valid, false);
    assert.strictEqual(returning.errorCode, 'NEW_CUSTOMER_ONLY');

    // Mixed cart calculates 10% ONLY on eligible honey item (₹1,000), ignoring non-eligible oil item (₹2,000)
    const mixed = validateCouponServerSide({
      code: 'HONEYFIRST',
      items: [
        { productId: 'p-honey', categoryId: 'cat-honey', priceInPaise: 100000, quantity: 1 },
        { productId: 'p-oil', categoryId: 'cat-oils', priceInPaise: 200000, quantity: 1 },
      ],
      customerId: 'cust-new',
      isAuthenticated: true,
      customerOrderCount: 0,
      now: new Date('2026-11-12T10:00:00Z'),
      filePath: couponsFile,
    });
    assert.strictEqual(mixed.valid, true);
    assert.strictEqual(mixed.eligibleSubtotalInPaise, 100000);
    assert.strictEqual(mixed.discountInPaise, 10000);
  });
});
