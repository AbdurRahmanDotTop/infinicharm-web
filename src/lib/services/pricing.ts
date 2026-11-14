// ==============================================================================
// InfiniCharm — Server-Side Cart Pricing & Financial Calculation Engine
// Governing PRDs: PRD 07 (Cart, Pricing & Coupons) & PRD 08 (Shipping & Tax Engine)
// Standard: Integer Paise Financial Standard (1 INR = 100 paise)
// ==============================================================================

import {
  validateCouponServerSide,
  type ServerCouponValidationResult,
} from '../server/coupons-store.ts';
import { calculateGST } from './tax.ts';
import type { GSTBreakdown } from './tax.ts';

export const FREE_SHIPPING_THRESHOLD_PAISE = 499900; // ₹4,999.00 (Governing Authority: PRD 08 & Shipping Policy)
export const STANDARD_SHIPPING_FEE_PAISE = 6000; // ₹60.00
export const EXPRESS_SHIPPING_FEE_PAISE = 15000; // ₹150.00

export interface CartCalculationItem {
  productId?: string;
  variantId: string;
  categoryId?: string;
  categorySlug?: string;
  priceInPaise: number;
  quantity: number;
}

export interface CalculatedItem {
  variantId: string;
  priceInPaise: number;
  quantity: number;
  lineTotalInPaise: number;
  gst: GSTBreakdown;
}

export interface CartCalculationResult {
  subtotalInPaise: number;
  discountInPaise: number;
  shippingInPaise: number;
  taxInPaise: number; // Inclusive GST
  totalInPaise: number;
  isFreeShipping: boolean;
  amountNeededForFreeShippingPaise: number;
  couponResult: ServerCouponValidationResult | null;
  items: CalculatedItem[];
  cgstInPaise: number;
  sgstInPaise: number;
  igstInPaise: number;
}

export interface CartTotalsOptions {
  couponsFilePath?: string;
  customerId?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  isAuthenticated?: boolean;
  customerOrderCount?: number;
  now?: Date;
  freeShippingThresholdPaise?: number;
  standardShippingFeePaise?: number;
}

/**
 * Authoritative financial calculation engine.
 * Computes exact integer paise totals, discounts, shipping, and tax breakdowns.
 */
export function calculateCartTotals(
  items: CartCalculationItem[],
  couponCode?: string | null,
  destinationState?: string | null,
  options?: CartTotalsOptions
): CartCalculationResult {
  let subtotalInPaise = 0;
  let totalTaxInPaise = 0;
  let cgstInPaise = 0;
  let sgstInPaise = 0;
  let igstInPaise = 0;

  const calculatedItems: CalculatedItem[] = items.map((item) => {
    const lineTotal = item.priceInPaise * Math.max(1, item.quantity);
    subtotalInPaise += lineTotal;

    const gst = calculateGST(
      lineTotal,
      item.categorySlug || 'general',
      destinationState
    );

    totalTaxInPaise += gst.totalTaxInPaise;
    cgstInPaise += gst.cgstInPaise;
    sgstInPaise += gst.sgstInPaise;
    igstInPaise += gst.igstInPaise;

    return {
      variantId: item.variantId,
      priceInPaise: item.priceInPaise,
      quantity: item.quantity,
      lineTotalInPaise: lineTotal,
      gst,
    };
  });

  // Server-side DB coupon calculation
  let discountInPaise = 0;
  let couponResult: ServerCouponValidationResult | null = null;

  if (couponCode && couponCode.trim().length > 0) {
    couponResult = validateCouponServerSide({
      code: couponCode,
      items: items.map((item) => ({
        productId: item.productId || item.variantId,
        variantId: item.variantId,
        categoryId: item.categoryId,
        categorySlug: item.categorySlug,
        priceInPaise: item.priceInPaise,
        quantity: item.quantity,
      })),
      subtotalInPaise,
      customerId: options?.customerId,
      customerEmail: options?.customerEmail,
      customerPhone: options?.customerPhone,
      isAuthenticated: options?.isAuthenticated,
      customerOrderCount: options?.customerOrderCount,
      now: options?.now,
      filePath: options?.couponsFilePath,
    });
    if (couponResult.valid) {
      discountInPaise = couponResult.discountInPaise;
    }
  }

  const effectiveFreeThreshold =
    typeof options?.freeShippingThresholdPaise === 'number'
      ? options.freeShippingThresholdPaise
      : FREE_SHIPPING_THRESHOLD_PAISE;
  const effectiveStandardFee =
    typeof options?.standardShippingFeePaise === 'number'
      ? options.standardShippingFeePaise
      : STANDARD_SHIPPING_FEE_PAISE;

  // Qualifying subtotal for shipping after discounts
  const qualifyingSubtotal = Math.max(0, subtotalInPaise - discountInPaise);
  const isFreeShipping =
    subtotalInPaise > 0 && qualifyingSubtotal >= effectiveFreeThreshold;

  const amountNeededForFreeShippingPaise = isFreeShipping
    ? 0
    : Math.max(0, effectiveFreeThreshold - qualifyingSubtotal);

  const shippingInPaise =
    subtotalInPaise === 0
      ? 0
      : isFreeShipping
        ? 0
        : effectiveStandardFee;

  // Final Total: Net subtotal + shipping (tax is already included in subtotal)
  const totalInPaise = qualifyingSubtotal + shippingInPaise;

  return {
    subtotalInPaise,
    discountInPaise,
    shippingInPaise,
    taxInPaise: totalTaxInPaise,
    totalInPaise,
    isFreeShipping,
    amountNeededForFreeShippingPaise,
    couponResult,
    items: calculatedItems,
    cgstInPaise,
    sgstInPaise,
    igstInPaise,
  };
}
