import type { Product } from '../../types/index.ts';
import { getAllProducts } from '../data/products.ts';
import { formatPaiseToRupees } from '../utils/currency.ts';

export interface RecommendationCartItem {
  product?: { id: string; categoryId?: string; tags?: string[] };
  productId?: string;
  variantId?: string;
}

export interface RecommendationOptions {
  cartItems?: RecommendationCartItem[];
  currentProductId?: string;
  limit?: number;
  catalog?: Product[];
}

export interface ProductDiscountInfo {
  priceInPaise: number;
  compareAtPriceInPaise?: number;
  hasDiscount: boolean;
  discountPercent: number;
  savingsInPaise: number;
  savingsFormatted: string;
  priceFormatted: string;
  compareAtPriceFormatted: string;
}

// Curated affinity map for authentic cross-sells
const COMPLEMENTARY_PAIRINGS: Record<string, string[]> = {
  // Kashmiri Honey pairs with Talbeena and Dates
  'S-01-P-01': ['S-01-P-03', 'S-01-P-04', 'S-01-P-02'],
  // Zamzam Water pairs with Dates and Honey
  'S-01-P-02': ['S-01-P-04', 'S-01-P-01', 'S-01-P-03'],
  // Takmeeli Talbeena pairs with Kashmiri Honey and Dates
  'S-01-P-03': ['S-01-P-01', 'S-01-P-04', 'S-01-P-02'],
  // Premium Dates pairs with Zamzam Water, Kashmiri Honey, and Talbeena
  'S-01-P-04': ['S-01-P-02', 'S-01-P-01', 'S-01-P-03'],
};

// Category affinity
const CATEGORY_AFFINITY: Record<string, string[]> = {
  'cat-honey': ['cat-takmeeli-talbeena', 'cat-premium-dates'],
  'cat-zamzam-water': ['cat-premium-dates', 'cat-honey'],
  'cat-takmeeli-talbeena': ['cat-honey', 'cat-premium-dates'],
  'cat-premium-dates': ['cat-zamzam-water', 'cat-honey', 'cat-takmeeli-talbeena'],
};

export function getProductDiscountInfo(product: Product, variantId?: string): ProductDiscountInfo {
  const variant = variantId
    ? product.variants.find((v) => v.id === variantId) || product.variants[0]
    : product.variants[0];

  const price = variant?.priceInPaise || 0;
  const compareAt = variant?.compareAtPriceInPaise;
  const hasDiscount = Boolean(compareAt && compareAt > price);
  const savings = hasDiscount && compareAt ? compareAt - price : 0;
  const discountPercent = hasDiscount && compareAt ? Math.round((savings / compareAt) * 100) : 0;

  return {
    priceInPaise: price,
    compareAtPriceInPaise: compareAt,
    hasDiscount,
    discountPercent,
    savingsInPaise: savings,
    savingsFormatted: formatPaiseToRupees(savings),
    priceFormatted: formatPaiseToRupees(price),
    compareAtPriceFormatted: compareAt ? formatPaiseToRupees(compareAt) : '',
  };
}

export function getProductRecommendations(options: RecommendationOptions = {}): Product[] {
  const { cartItems = [], currentProductId, limit = 3, catalog } = options;

  // 1. Identify excluded IDs (already in cart or PDP target)
  const excludedIds = new Set<string>();
  if (currentProductId) excludedIds.add(currentProductId);
  for (const item of cartItems) {
    if (item.productId) excludedIds.add(item.productId);
    if (item.product?.id) excludedIds.add(item.product.id);
  }

  // 2. Fetch published in-stock candidates from catalog or data store
  const allProds: Product[] = catalog || getAllProducts(false);
  const eligiblePool = allProds.filter((p) => {
    if (p.status !== 'PUBLISHED') return false;
    if (excludedIds.has(p.id)) return false;
    const hasStock = p.variants.some((v) => (v.stockQuantity ?? 0) > 0);
    return hasStock;
  });

  if (eligiblePool.length === 0) {
    return [];
  }

  // 3. Extract affinity seeds from cart items
  const cartProductIds: string[] = [];
  const cartCategoryIds: string[] = [];
  const cartTags = new Set<string>();

  if (currentProductId) cartProductIds.push(currentProductId);

  for (const item of cartItems) {
    const id = item.productId || item.product?.id;
    if (id) cartProductIds.push(id);
    const catId = item.product?.categoryId;
    if (catId) cartCategoryIds.push(catId);
    if (item.product?.tags) {
      item.product.tags.forEach((t) => cartTags.add(t.toLowerCase()));
    }
  }

  // 4. Score each candidate
  const scored = eligiblePool.map((candidate) => {
    let score = 0;

    // Check direct complementary pairing
    for (const cartId of cartProductIds) {
      const affinities = COMPLEMENTARY_PAIRINGS[cartId] || [];
      const idx = affinities.indexOf(candidate.id);
      if (idx !== -1) {
        score += (affinities.length - idx) * 50; // top affinity gets high bonus
      }
    }

    // Check category affinity
    for (const catId of cartCategoryIds) {
      const relatedCats = CATEGORY_AFFINITY[catId] || [];
      if (relatedCats.includes(candidate.categoryId)) {
        score += 30;
      }
      if (catId === candidate.categoryId) {
        score += 20;
      }
    }

    // Check tag overlaps
    if (candidate.tags) {
      candidate.tags.forEach((tag) => {
        if (cartTags.has(tag.toLowerCase())) {
          score += 10;
        }
      });
    }

    // Featured product baseline weight
    if (candidate.isFeatured) {
      score += 15;
    }

    // Has active discount weight (conversion booster)
    const discount = getProductDiscountInfo(candidate);
    if (discount.hasDiscount) {
      score += 10 + discount.discountPercent;
    }

    return { candidate, score };
  });

  // Sort descending by score, tie-breaker: display order / title
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.candidate.title.localeCompare(b.candidate.title);
  });

  return scored.slice(0, limit).map((s) => s.candidate);
}
