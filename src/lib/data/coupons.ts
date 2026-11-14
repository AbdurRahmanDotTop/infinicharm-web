import type { Coupon } from '../../types/index.ts';

export interface CouponValidationResult {
  valid: boolean;
  message: string;
  coupon?: Coupon;
  discountInPaise: number;
  eligibleSubtotalInPaise?: number;
  errorCode?: string;
}

export interface ClientCouponValidationItem {
  productId: string;
  variantId?: string;
  categoryId?: string;
  categorySlug?: string;
  priceInPaise: number;
  quantity: number;
}

/**
 * Validates a promotional coupon strictly on the server database via /api/coupons/validate.
 */
export async function validateCouponWithServer(params: {
  code: string;
  items: ClientCouponValidationItem[];
  subtotalInPaise?: number;
  customerEmail?: string;
  customerPhone?: string;
}): Promise<CouponValidationResult> {
  const normalizedCode = params.code.trim().toUpperCase();
  if (!normalizedCode) {
    return {
      valid: false,
      message: 'Please enter a coupon code.',
      discountInPaise: 0,
    };
  }

  try {
    const res = await fetch('/api/coupons/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({
        code: normalizedCode,
        items: params.items,
        subtotalInPaise: params.subtotalInPaise,
        customerEmail: params.customerEmail,
        customerPhone: params.customerPhone,
      }),
    });

    const data = await res.json();
    return {
      valid: Boolean(data.valid),
      message: data.message || (data.valid ? `Coupon ${normalizedCode} applied.` : 'Invalid coupon.'),
      coupon: data.coupon,
      discountInPaise: Number(data.discountInPaise) || 0,
      eligibleSubtotalInPaise: data.eligibleSubtotalInPaise,
      errorCode: data.errorCode,
    };
  } catch {
    return {
      valid: false,
      message: 'Unable to verify coupon right now. Please try again.',
      discountInPaise: 0,
    };
  }
}
