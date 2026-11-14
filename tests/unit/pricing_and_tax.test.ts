import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  calculateGST,
  getCategoryGSTRate,
  DISPATCH_ORIGIN_STATE,
} from '../../src/lib/services/tax.ts';
import {
  calculateCartTotals,
  FREE_SHIPPING_THRESHOLD_PAISE,
  STANDARD_SHIPPING_FEE_PAISE,
} from '../../src/lib/services/pricing.ts';
import {
  createServerCoupon,
} from '../../src/lib/server/coupons-store.ts';
import {
  getStockStatus,
  canFulfillQuantity,
} from '../../src/lib/services/inventory.ts';

describe('Indian GST Tax Engine (PRD 08)', () => {
  it('applies statutory 5% rate for Edible Oils and 18% for Attar Fragrances', () => {
    assert.strictEqual(getCategoryGSTRate('edible-oils', 59900), 5);
    assert.strictEqual(getCategoryGSTRate('honey', 49900), 5);
    assert.strictEqual(getCategoryGSTRate('spices-masala', 24900), 5);
    assert.strictEqual(getCategoryGSTRate('attar-fragrances', 149900), 18);
  });

  it('splits tax equally into CGST and SGST for Intra-State Bihar deliveries', () => {
    // ₹1,050 inclusive at 5% GST -> Taxable = 100000 paise, Tax = 5000 paise
    const result = calculateGST(105000, 'edible-oils', 'Bihar');
    assert.strictEqual(result.isInterState, false);
    assert.strictEqual(result.totalTaxInPaise, 5000);
    assert.strictEqual(result.cgstInPaise, 2500); // 2.5%
    assert.strictEqual(result.sgstInPaise, 2500); // 2.5%
    assert.strictEqual(result.igstInPaise, 0);
  });

  it('assigns full tax to IGST for Inter-State deliveries outside Bihar', () => {
    const result = calculateGST(105000, 'edible-oils', 'Maharashtra');
    assert.strictEqual(result.isInterState, true);
    assert.strictEqual(result.totalTaxInPaise, 5000);
    assert.strictEqual(result.igstInPaise, 5000); // 5% IGST
    assert.strictEqual(result.cgstInPaise, 0);
    assert.strictEqual(result.sgstInPaise, 0);
  });
});

describe('Server-Side Pricing & Cart Calculation Engine (PRD 07)', () => {
  it('charges standard shipping for orders below ₹4,999 threshold', () => {
    const items = [
      { variantId: 'v-oil', priceInPaise: 49900, quantity: 1, categorySlug: 'edible-oils' },
    ];
    const totals = calculateCartTotals(items, null, 'Bihar');

    assert.strictEqual(totals.subtotalInPaise, 49900);
    assert.strictEqual(totals.isFreeShipping, false);
    assert.strictEqual(totals.shippingInPaise, STANDARD_SHIPPING_FEE_PAISE);
    assert.strictEqual(totals.totalInPaise, 49900 + STANDARD_SHIPPING_FEE_PAISE);
  });

  it('unlocks free shipping when subtotal reaches ₹4,999 threshold', () => {
    const items = [
      { variantId: 'v-oil-bulk', priceInPaise: 500000, quantity: 1, categorySlug: 'edible-oils' },
    ];
    const totals = calculateCartTotals(items, null, 'Delhi');

    assert.strictEqual(totals.subtotalInPaise, 500000);
    assert.strictEqual(totals.isFreeShipping, true);
    assert.strictEqual(totals.shippingInPaise, 0);
    assert.strictEqual(totals.amountNeededForFreeShippingPaise, 0);
    assert.strictEqual(totals.totalInPaise, 500000);
  });

  it('correctly applies database coupon discount and recalculates net payable total', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'infinicharm-pricing-coupon-'));
    const tmpFile = path.join(tmpDir, 'coupons.json');
    try {
      createServerCoupon(
        {
          code: 'PURE10',
          discountType: 'PERCENTAGE',
          discountValue: 10,
          minOrderInPaise: 49900,
          maxDiscountInPaise: 20000,
          validFrom: '2026-01-01T00:00:00Z',
          validUntil: '2028-01-01T00:00:00Z',
        },
        tmpFile
      );

      // 10 x ₹600 = ₹6,000. Apply PURE10 (10% discount capped at ₹200) -> ₹200 discount
      const items = [
        { variantId: 'v-honey', priceInPaise: 60000, quantity: 10, categorySlug: 'honey' },
      ];
      const totals = calculateCartTotals(items, 'PURE10', 'Karnataka', {
        couponsFilePath: tmpFile,
        now: new Date('2026-11-12T10:00:00Z'),
      });

      assert.strictEqual(totals.subtotalInPaise, 600000);
      assert.strictEqual(totals.discountInPaise, 20000); // capped at ₹200
      assert.strictEqual(totals.isFreeShipping, true); // Net ₹5,800 >= ₹4,999
      assert.strictEqual(totals.totalInPaise, 580000); // ₹5,800.00
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('Atomic Inventory & Stock State Service (PRD 06)', () => {
  it('returns OUT_OF_STOCK when quantity is zero or negative', () => {
    const stock = getStockStatus(0);
    assert.strictEqual(stock.status, 'OUT_OF_STOCK');
    assert.strictEqual(stock.isAvailable, false);
  });

  it('triggers truthful LOW_STOCK urgency when quantity is at or below threshold', () => {
    const stock = getStockStatus(3, 5);
    assert.strictEqual(stock.status, 'LOW_STOCK');
    assert.strictEqual(stock.isAvailable, true);
    assert.ok(stock.label.includes('Only 3 Left'));
  });

  it('returns IN_STOCK when ample inventory exists', () => {
    const stock = getStockStatus(25, 5);
    assert.strictEqual(stock.status, 'IN_STOCK');
    assert.strictEqual(stock.isAvailable, true);
  });

  it('accurately validates fulfillable quantities against available stock', () => {
    assert.strictEqual(canFulfillQuantity(3, 10), true);
    assert.strictEqual(canFulfillQuantity(10, 10), true);
    assert.strictEqual(canFulfillQuantity(11, 10), false);
    assert.strictEqual(canFulfillQuantity(0, 10), false);
  });
});

