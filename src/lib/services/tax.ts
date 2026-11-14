// ==============================================================================
// InfiniCharm — Indian Goods and Services Tax (GST) Calculation Engine
// Governing PRD: PRD 08 (Checkout Architecture, Indian Shipping & GST Tax Engine)
// Standards: All prices inclusive of GST; Central dispatch: East Champaran, Bihar
// ==============================================================================

export const DISPATCH_ORIGIN_STATE = 'Bihar';
export const DISPATCH_ORIGIN_PINCODE = '845427';

export interface GSTBreakdown {
  taxableAmountInPaise: number;
  totalTaxInPaise: number;
  ratePercentage: number;
  cgstInPaise: number;
  sgstInPaise: number;
  igstInPaise: number;
  isInterState: boolean;
}

/**
 * Returns the statutory GST rate percentage based on category classification.
 * Complies with Indian GST Schedules across InfiniCharm Food & Beverage categories:
 * - Honey, Drinking Water, Talbeena & Dry Fruits/Dates: 5%
 * - Special personal care / lifestyle custom extensions if configured in Admin: 12% or 18%
 */
export function getCategoryGSTRate(categorySlug: string, priceInPaise: number): number {
  const slug = categorySlug.toLowerCase();

  if (
    slug.includes('fragrance') ||
    slug.includes('perfume') ||
    slug.includes('essential-oil') ||
    slug.includes('attar')
  ) {
    return 18;
  }

  if (slug.includes('apparel') || slug.includes('textile') || slug.includes('clothing')) {
    return priceInPaise <= 100000 ? 5 : 12;
  }

  // Approved Food & Grocery / Food & Beverages categories (Honey, Zamzam Water, Talbeena, Dates) = 5%
  return 5;
}

/**
 * Calculates itemized GST from an inclusive retail price in integer paise.
 * In accordance with Indian Consumer Protection rules, storefront prices are tax-inclusive.
 */
export function calculateGST(
  inclusiveAmountInPaise: number,
  categorySlug: string,
  destinationState?: string | null
): GSTBreakdown {
  if (inclusiveAmountInPaise <= 0) {
    return {
      taxableAmountInPaise: 0,
      totalTaxInPaise: 0,
      ratePercentage: 0,
      cgstInPaise: 0,
      sgstInPaise: 0,
      igstInPaise: 0,
      isInterState: false,
    };
  }

  const rate = getCategoryGSTRate(categorySlug, inclusiveAmountInPaise);

  // Inclusive tax formula: Taxable = Inclusive / (1 + Rate / 100)
  const taxableAmountInPaise = Math.round(
    inclusiveAmountInPaise / (1 + rate / 100)
  );
  const totalTaxInPaise = inclusiveAmountInPaise - taxableAmountInPaise;

  // Determine if Inter-State (IGST) or Intra-State (CGST + SGST)
  const state = destinationState?.trim() || DISPATCH_ORIGIN_STATE;
  const isInterState = state.toLowerCase() !== DISPATCH_ORIGIN_STATE.toLowerCase();

  let cgstInPaise = 0;
  let sgstInPaise = 0;
  let igstInPaise = 0;

  if (isInterState) {
    igstInPaise = totalTaxInPaise;
  } else {
    // Split equally for Bihar deliveries
    cgstInPaise = Math.floor(totalTaxInPaise / 2);
    sgstInPaise = totalTaxInPaise - cgstInPaise;
  }

  return {
    taxableAmountInPaise,
    totalTaxInPaise,
    ratePercentage: rate,
    cgstInPaise,
    sgstInPaise,
    igstInPaise,
    isInterState,
  };
}

