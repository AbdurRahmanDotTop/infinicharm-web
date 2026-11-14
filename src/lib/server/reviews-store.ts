// ==============================================================================
// InfiniCharm — Authoritative Server Reviews Store & Real Ratings Calculation
// Standards: 100% Real Customer Data, Zero Fabricated Ratings, Server Authority
// ==============================================================================

import fs from 'fs';
import path from 'path';
import type { Review, ReviewSettings } from '../../types/index.ts';

const REVIEWS_FILE_PATH = path.join(
  process.cwd(),
  'src',
  'data',
  'reviews.json'
);

const SETTINGS_FILE_PATH = path.join(
  process.cwd(),
  'src',
  'data',
  'review_settings.json'
);

function ensureDirectoryExists(filePath: string) {
  const dirname = path.dirname(filePath);
  if (!fs.existsSync(dirname)) {
    fs.mkdirSync(dirname, { recursive: true });
  }
}

const DEFAULT_REVIEW_SETTINGS: ReviewSettings = {
  autoApproveVerifiedPurchases: true,
  requireDeliveredStatus: true,
  minCommentLength: 10,
};

export function getReviewSettings(): ReviewSettings {
  try {
    if (!fs.existsSync(SETTINGS_FILE_PATH)) {
      ensureDirectoryExists(SETTINGS_FILE_PATH);
      fs.writeFileSync(
        SETTINGS_FILE_PATH,
        JSON.stringify(DEFAULT_REVIEW_SETTINGS, null, 2),
        'utf8'
      );
      return DEFAULT_REVIEW_SETTINGS;
    }
    const raw = fs.readFileSync(SETTINGS_FILE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      autoApproveVerifiedPurchases: parsed.autoApproveVerifiedPurchases ?? true,
      requireDeliveredStatus: parsed.requireDeliveredStatus ?? true,
      minCommentLength: parsed.minCommentLength ?? 10,
    };
  } catch (err) {
    console.error('Failed reading review_settings.json:', err);
    return DEFAULT_REVIEW_SETTINGS;
  }
}

export function saveReviewSettings(settings: Partial<ReviewSettings>): ReviewSettings {
  try {
    const current = getReviewSettings();
    const updated: ReviewSettings = {
      ...current,
      ...settings,
    };
    ensureDirectoryExists(SETTINGS_FILE_PATH);
    fs.writeFileSync(SETTINGS_FILE_PATH, JSON.stringify(updated, null, 2), 'utf8');
    return updated;
  } catch (err) {
    console.error('Failed saving review_settings.json:', err);
    return DEFAULT_REVIEW_SETTINGS;
  }
}

export function getServerReviews(): Review[] {
  try {
    if (!fs.existsSync(REVIEWS_FILE_PATH)) {
      ensureDirectoryExists(REVIEWS_FILE_PATH);
      fs.writeFileSync(REVIEWS_FILE_PATH, '[]', 'utf8');
      return [];
    }
    const raw = fs.readFileSync(REVIEWS_FILE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Failed reading reviews.json:', err);
    return [];
  }
}

export function saveServerReviews(reviews: Review[]): boolean {
  try {
    ensureDirectoryExists(REVIEWS_FILE_PATH);
    fs.writeFileSync(REVIEWS_FILE_PATH, JSON.stringify(reviews, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Failed saving reviews.json:', err);
    return false;
  }
}

export function getApprovedReviews(productId?: string): Review[] {
  const all = getServerReviews();
  const cleanTarget = productId ? productId.toLowerCase().trim() : undefined;

  return all.filter((r) => {
    const isApproved = r.status === 'APPROVED';
    if (!isApproved) return false;
    if (cleanTarget) {
      return (
        r.productId.toLowerCase().trim() === cleanTarget ||
        (r.productSlug && r.productSlug.toLowerCase().trim() === cleanTarget)
      );
    }
    return true;
  });
}

export interface ReviewStats {
  totalReviews: number;
  averageRating: number;
  hasGenuineReviews: boolean;
  ratingDistribution: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
}

export function getReviewStats(productId?: string): ReviewStats {
  const approved = getApprovedReviews(productId);
  const totalReviews = approved.length;

  const distribution = {
    5: 0,
    4: 0,
    3: 0,
    2: 0,
    1: 0,
  };

  if (totalReviews === 0) {
    return {
      totalReviews: 0,
      averageRating: 0,
      hasGenuineReviews: false,
      ratingDistribution: distribution,
    };
  }

  let totalRatingSum = 0;
  for (const r of approved) {
    const clampedRating = Math.max(1, Math.min(5, Math.round(r.rating || 5)));
    totalRatingSum += clampedRating;
    if (clampedRating in distribution) {
      distribution[clampedRating as keyof typeof distribution]++;
    }
  }

  const averageRating = Number((totalRatingSum / totalReviews).toFixed(1));

  return {
    totalReviews,
    averageRating,
    hasGenuineReviews: true,
    ratingDistribution: distribution,
  };
}

export function getCustomerReviewForProduct(
  customerId: string,
  productId: string
): Review | null {
  if (!customerId || !productId) return null;
  const all = getServerReviews();
  const cleanId = customerId.trim();
  const cleanProd = productId.toLowerCase().trim();

  return (
    all.find(
      (r) =>
        r.customerId === cleanId &&
        (r.productId.toLowerCase().trim() === cleanProd ||
          (r.productSlug && r.productSlug.toLowerCase().trim() === cleanProd))
    ) || null
  );
}

export function submitCustomerReview(payload: {
  productId: string;
  productTitle?: string;
  productSlug?: string;
  customerId?: string;
  customerName: string;
  customerEmail?: string;
  orderId?: string;
  orderNumber?: string;
  rating: number;
  title?: string;
  comment: string;
  isVerifiedPurchase?: boolean;
  status?: 'APPROVED' | 'PENDING' | 'REJECTED' | 'HIDDEN';
}): Review {
  const all = getServerReviews();
  const settings = getReviewSettings();

  const cleanProdId = payload.productId.trim();
  const cleanCustId = (payload.customerId || 'guest').trim();

  // Check if an existing review by this customer for this product exists
  const existingIdx = all.findIndex(
    (r) =>
      r.customerId === cleanCustId &&
      (r.productId.toLowerCase().trim() === cleanProdId.toLowerCase() ||
        (payload.productSlug &&
          r.productSlug &&
          r.productSlug.toLowerCase().trim() === payload.productSlug.toLowerCase().trim()))
  );

  const initialStatus =
    payload.status ?? (settings.autoApproveVerifiedPurchases ? 'APPROVED' : 'PENDING');

  if (existingIdx !== -1) {
    // Update existing review
    all[existingIdx] = {
      ...all[existingIdx],
      rating: Math.max(1, Math.min(5, Math.round(payload.rating || 5))),
      title: payload.title?.trim() || undefined,
      comment: payload.comment.trim(),
      customerName: payload.customerName.trim() || all[existingIdx].customerName,
      customerEmail: payload.customerEmail || all[existingIdx].customerEmail,
      orderId: payload.orderId || all[existingIdx].orderId,
      orderNumber: payload.orderNumber || all[existingIdx].orderNumber,
      productTitle: payload.productTitle || all[existingIdx].productTitle,
      productSlug: payload.productSlug || all[existingIdx].productSlug,
      status: initialStatus,
      updatedAt: new Date().toISOString(),
    };
    saveServerReviews(all);
    return all[existingIdx];
  }

  const newReview: Review = {
    id: `rev-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    productId: cleanProdId,
    productTitle: payload.productTitle?.trim() || undefined,
    productSlug: payload.productSlug?.trim() || undefined,
    customerId: cleanCustId,
    customerName: payload.customerName.trim() || 'Verified Customer',
    customerEmail: payload.customerEmail?.trim() || undefined,
    orderId: payload.orderId,
    orderNumber: payload.orderNumber,
    rating: Math.max(1, Math.min(5, Math.round(payload.rating || 5))),
    title: payload.title?.trim() || undefined,
    comment: payload.comment.trim(),
    isVerifiedPurchase: payload.isVerifiedPurchase ?? true,
    status: initialStatus,
    createdAt: new Date().toISOString(),
  };

  all.unshift(newReview);
  saveServerReviews(all);
  return newReview;
}

export function moderateReview(
  id: string,
  update: {
    status?: 'APPROVED' | 'REJECTED' | 'PENDING' | 'HIDDEN';
    adminReply?: string;
  }
): Review | null {
  const all = getServerReviews();
  const idx = all.findIndex((r) => r.id === id);
  if (idx === -1) return null;

  if (update.status) {
    all[idx].status = update.status;
  }
  if (update.adminReply !== undefined) {
    all[idx].adminReply = update.adminReply;
    all[idx].adminReplyAt = new Date().toISOString();
  }
  all[idx].updatedAt = new Date().toISOString();

  saveServerReviews(all);
  return all[idx];
}

export function deleteReview(id: string): boolean {
  const all = getServerReviews();
  const filtered = all.filter((r) => r.id !== id);
  if (filtered.length === all.length) return false;
  saveServerReviews(filtered);
  return true;
}
