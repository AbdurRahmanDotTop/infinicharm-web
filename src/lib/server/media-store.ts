// ==============================================================================
// InfiniCharm — External Media Server Store & Authority
// Governing PRD: PRD 05 & All_Docs/PRDs/MediaUses.md
// Principle: Zero Media Binaries, Metadata & External URLs only, Persistent Store
// ==============================================================================

import fs from 'fs';
import path from 'path';
import type { ExternalMedia, MediaProvider, MediaType, MediaRole } from '../../types/index.ts';
import { validateAndNormalizeMediaUrl } from '../media/providers.ts';

const MEDIA_FILE_PATH = path.join(
  process.cwd(),
  'src',
  'data',
  'media_assets.json'
);

export interface MediaFilterParams {
  provider?: MediaProvider | 'ALL';
  mediaType?: MediaType | 'ALL';
  status?: string;
  search?: string;
  productId?: string;
}

export interface MediaStatistics {
  totalAssets: number;
  activeAssets: number;
  disabledAssets: number;
  imageCount: number;
  videoCount: number;
  documentCount: number;
  audioCount: number;
  providerDistribution: Record<string, number>;
}

/**
 * Loads all media assets from the persistent JSON store.
 */
export function getAllMediaAssets(): ExternalMedia[] {
  try {
    if (!fs.existsSync(MEDIA_FILE_PATH)) {
      return [];
    }
    const raw = fs.readFileSync(MEDIA_FILE_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('[MediaStore] Error reading media assets:', error);
    return [];
  }
}

/**
 * Saves all media assets atomically to the persistent JSON store.
 */
function saveMediaAssets(assets: ExternalMedia[]): boolean {
  try {
    const dir = path.dirname(MEDIA_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tempPath = `${MEDIA_FILE_PATH}.tmp-${Date.now()}`;
    fs.writeFileSync(tempPath, JSON.stringify(assets, null, 2), 'utf-8');
    fs.renameSync(tempPath, MEDIA_FILE_PATH);
    return true;
  } catch (error) {
    console.error('[MediaStore] Error saving media assets:', error);
    return false;
  }
}

/**
 * Retrieves a single media asset by ID.
 */
export function getMediaAssetById(id: string): ExternalMedia | null {
  const all = getAllMediaAssets();
  return all.find((item) => item.id === id) || null;
}

/**
 * Filters media assets by criteria.
 */
export function filterMediaAssets(params: MediaFilterParams): ExternalMedia[] {
  let assets = getAllMediaAssets();

  if (params.provider && params.provider !== 'ALL') {
    assets = assets.filter((m) => m.provider === params.provider);
  }

  if (params.mediaType && params.mediaType !== 'ALL') {
    assets = assets.filter((m) => (m.mediaType || 'IMAGE') === params.mediaType);
  }

  if (params.status && params.status !== 'ALL') {
    assets = assets.filter((m) => m.status === params.status);
  }

  if (params.productId) {
    assets = assets.filter((m) => m.productId === params.productId);
  }

  if (params.search && params.search.trim()) {
    const q = params.search.toLowerCase().trim();
    assets = assets.filter(
      (m) =>
        m.altText.toLowerCase().includes(q) ||
        (m.title && m.title.toLowerCase().includes(q)) ||
        m.externalUrl.toLowerCase().includes(q) ||
        (m.caption && m.caption.toLowerCase().includes(q))
    );
  }

  return assets;
}

/**
 * Creates and registers a new external media asset.
 */
export function createMediaAsset(input: {
  url: string;
  altText: string;
  title?: string;
  caption?: string;
  role?: MediaRole;
  provider?: MediaProvider;
  mediaType?: MediaType;
  productId?: string;
  variantId?: string;
  displayOrder?: number;
}): { success: boolean; asset?: ExternalMedia; error?: string } {
  if (!input.url || !input.altText) {
    return { success: false, error: 'External URL and alt text are required' };
  }

  // Normalize and validate through provider adapters
  const val = validateAndNormalizeMediaUrl(input.url);
  if (!val.isValid || !val.normalized) {
    return {
      success: false,
      error: val.reason || 'Invalid external media URL or unsupported host',
    };
  }

  const normalized = val.normalized;
  const all = getAllMediaAssets();

  // Prevent duplicate exact external URLs
  const existing = all.find(
    (m) =>
      m.externalUrl === normalized.normalizedUrl ||
      m.sourceUrl === normalized.sourceUrl
  );
  if (existing) {
    return {
      success: false,
      error: `This external media URL is already registered (Asset ID: ${existing.id})`,
    };
  }

  const now = new Date().toISOString();
  const newAsset: ExternalMedia = {
    id: `med-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    provider: input.provider || normalized.provider,
    mediaType: input.mediaType || normalized.mediaType,
    sourceUrl: normalized.sourceUrl,
    externalUrl: normalized.normalizedUrl,
    providerAssetId: normalized.providerAssetId,
    mimeType:
      normalized.mediaType === 'VIDEO'
        ? 'video/mp4'
        : normalized.mediaType === 'DOCUMENT'
        ? 'application/pdf'
        : 'image/webp',
    altText: input.altText.trim(),
    title: input.title?.trim() || normalized.suggestedTitle || '',
    caption: input.caption?.trim(),
    role: input.role || 'PRIMARY',
    displayOrder: input.displayOrder ?? all.length + 1,
    productId: input.productId,
    variantId: input.variantId,
    width: normalized.dimensions?.width,
    height: normalized.dimensions?.height,
    visibility: 'PUBLIC',
    status: 'ACTIVE',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  const updated = [newAsset, ...all];
  const saved = saveMediaAssets(updated);

  if (!saved) {
    return { success: false, error: 'Failed to write media asset to persistent store' };
  }

  return { success: true, asset: newAsset };
}

/**
 * Updates metadata of an existing media asset.
 */
export function updateMediaAsset(
  id: string,
  updates: Partial<ExternalMedia>
): { success: boolean; asset?: ExternalMedia; error?: string } {
  const all = getAllMediaAssets();
  const index = all.findIndex((m) => m.id === id);

  if (index === -1) {
    return { success: false, error: 'Media asset not found' };
  }

  const current = all[index];

  // If URL is being updated, validate it
  let finalExternalUrl = current.externalUrl;
  let finalSourceUrl = current.sourceUrl;
  let finalProvider = current.provider;
  let finalMediaType = current.mediaType;
  let finalProviderAssetId = current.providerAssetId;

  if (updates.externalUrl && updates.externalUrl !== current.externalUrl) {
    const val = validateAndNormalizeMediaUrl(updates.externalUrl);
    if (!val.isValid || !val.normalized) {
      return { success: false, error: val.reason || 'Invalid external media URL' };
    }
    finalExternalUrl = val.normalized.normalizedUrl;
    finalSourceUrl = val.normalized.sourceUrl;
    finalProvider = val.normalized.provider;
    finalMediaType = val.normalized.mediaType;
    finalProviderAssetId = val.normalized.providerAssetId;
  }

  const updatedAsset: ExternalMedia = {
    ...current,
    ...updates,
    id: current.id,
    externalUrl: finalExternalUrl,
    sourceUrl: finalSourceUrl,
    provider: updates.provider || finalProvider,
    mediaType: updates.mediaType || finalMediaType,
    providerAssetId: finalProviderAssetId,
    updatedAt: new Date().toISOString(),
  };

  all[index] = updatedAsset;
  const saved = saveMediaAssets(all);

  if (!saved) {
    return { success: false, error: 'Failed to persist media asset update' };
  }

  return { success: true, asset: updatedAsset };
}

/**
 * Deletes an external media reference from the registry.
 * Strictly notes: Deleting a reference does NOT delete the external file on Blogger/YouTube/Drive/ImageKit/Cloudinary.
 */
export function deleteMediaAsset(id: string): { success: boolean; error?: string } {
  const all = getAllMediaAssets();
  const filtered = all.filter((m) => m.id !== id);

  if (filtered.length === all.length) {
    return { success: false, error: 'Media asset not found' };
  }

  const saved = saveMediaAssets(filtered);
  if (!saved) {
    return { success: false, error: 'Failed to remove media asset from persistent store' };
  }

  return { success: true };
}

/**
 * Returns summary counts and provider statistics for the Admin dashboard.
 */
export function getMediaStatistics(): MediaStatistics {
  const all = getAllMediaAssets();

  let activeCount = 0;
  let disabledCount = 0;
  let imageCount = 0;
  let videoCount = 0;
  let documentCount = 0;
  let audioCount = 0;
  const providerDist: Record<string, number> = {};

  for (const m of all) {
    if (m.isActive && m.status !== 'DISABLED') {
      activeCount++;
    } else {
      disabledCount++;
    }

    const type = m.mediaType || 'IMAGE';
    if (type === 'IMAGE') imageCount++;
    else if (type === 'VIDEO') videoCount++;
    else if (type === 'DOCUMENT' || type === 'PDF') documentCount++;
    else if (type === 'AUDIO') audioCount++;

    const prov = m.provider || 'EXTERNAL_HTTPS';
    providerDist[prov] = (providerDist[prov] || 0) + 1;
  }

  return {
    totalAssets: all.length,
    activeAssets: activeCount,
    disabledAssets: disabledCount,
    imageCount,
    videoCount,
    documentCount,
    audioCount,
    providerDistribution: providerDist,
  };
}
