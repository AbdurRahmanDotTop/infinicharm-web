// ==============================================================================
// InfiniCharm — External Media Architecture & Provider Adapters Unit Test Suite
// Governing PRD: PRD 05 & All_Docs/PRDs/MediaUses.md (Section 22.1)
// Standards: Zero Binaries, Strict SSRF Prevention, URL Normalization, Precedence
// ==============================================================================

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  BloggerAdapter,
  YouTubeAdapter,
  GoogleDriveAdapter,
  ImageKitAdapter,
  CloudinaryAdapter,
  GenericExternalAdapter,
  detectProviderAdapter,
  validateAndNormalizeMediaUrl,
} from '../../src/lib/media/providers.ts';
import {
  validateExternalMediaUrl,
  resolveMediaPrecedence,
  getFallbackPlaceholderSvg,
} from '../../src/lib/utils/media.ts';
import {
  getAllMediaAssets,
  getMediaAssetById,
  filterMediaAssets,
  createMediaAsset,
  updateMediaAsset,
  deleteMediaAsset,
  getMediaStatistics,
} from '../../src/lib/server/media-store.ts';
import type { Product, ProductVariant } from '../../src/types/index.ts';

describe('1. External Media Provider Adapters & URL Normalization (PRD 05 Section 6 & 10)', () => {
  it('BloggerAdapter detects Blogger/Google UserContent hosts and parses dimensions', () => {
    const bloggerUrl =
      'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhKzWiq/w275-h275-p-k-no-nu/HoneyS01P01.jpg';
    assert.strictEqual(BloggerAdapter.matches(bloggerUrl, 'blogger.googleusercontent.com'), true);

    const val = BloggerAdapter.validate(bloggerUrl);
    assert.strictEqual(val.isValid, true);
    assert.strictEqual(val.provider, 'BLOGGER');
    assert.strictEqual(val.mediaType, 'IMAGE');
    assert.deepStrictEqual(val.normalized?.dimensions, { width: 275, height: 275 });
  });

  it('YouTubeAdapter normalizes watch, youtu.be, shorts and embed URLs to youtube-nocookie', () => {
    const watchUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    const youtuBeUrl = 'https://youtu.be/dQw4w9WgXcQ';
    const shortsUrl = 'https://youtube.com/shorts/dQw4w9WgXcQ';
    const embedUrl = 'https://www.youtube.com/embed/dQw4w9WgXcQ';

    for (const url of [watchUrl, youtuBeUrl, shortsUrl, embedUrl]) {
      const val = YouTubeAdapter.validate(url);
      assert.strictEqual(val.isValid, true, `Failed on ${url}`);
      assert.strictEqual(val.provider, 'YOUTUBE');
      assert.strictEqual(val.mediaType, 'VIDEO');
      assert.strictEqual(val.normalized?.providerAssetId, 'dQw4w9WgXcQ');
      assert.strictEqual(
        val.normalized?.normalizedUrl,
        'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'
      );
      assert.strictEqual(
        val.normalized?.thumbnailUrl,
        'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg'
      );
    }
  });

  it('YouTubeAdapter rejects malformed video links missing an ID', () => {
    const invalid = YouTubeAdapter.validate('https://www.youtube.com/feed/explore');
    assert.strictEqual(invalid.isValid, false);
    assert.ok(invalid.reason?.includes('video ID'));
  });

  it('GoogleDriveAdapter normalizes view links to preview URLs and extracts fileId', () => {
    const driveUrl =
      'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view';
    const val = GoogleDriveAdapter.validate(driveUrl);
    assert.strictEqual(val.isValid, true);
    assert.strictEqual(val.provider, 'GOOGLE_DRIVE');
    assert.strictEqual(val.mediaType, 'DOCUMENT');
    assert.strictEqual(
      val.normalized?.providerAssetId,
      '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms'
    );
    assert.strictEqual(
      val.normalized?.normalizedUrl,
      'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/preview'
    );
  });

  it('ImageKitAdapter & CloudinaryAdapter validate approved hostnames and paths', () => {
    const ikUrl = 'https://ik.imagekit.io/infinicharm/products/honey.webp';
    const ikVal = ImageKitAdapter.validate(ikUrl);
    assert.strictEqual(ikVal.isValid, true);
    assert.strictEqual(ikVal.provider, 'IMAGEKIT');

    const cldUrl = 'https://res.cloudinary.com/infinicharm/image/upload/v1/honey.webp';
    const cldVal = CloudinaryAdapter.validate(cldUrl);
    assert.strictEqual(cldVal.isValid, true);
    assert.strictEqual(cldVal.provider, 'CLOUDINARY');
  });

  it('detectProviderAdapter routes candidate URLs to appropriate adapter automatically', () => {
    assert.strictEqual(
      detectProviderAdapter('https://blogger.googleusercontent.com/test.jpg')?.provider,
      'BLOGGER'
    );
    assert.strictEqual(
      detectProviderAdapter('https://youtu.be/abc12345678')?.provider,
      'YOUTUBE'
    );
    assert.strictEqual(
      detectProviderAdapter('https://drive.google.com/file/d/xyz123/view')?.provider,
      'GOOGLE_DRIVE'
    );
    assert.strictEqual(
      detectProviderAdapter('https://ik.imagekit.io/test/demo.webp')?.provider,
      'IMAGEKIT'
    );
    assert.strictEqual(
      detectProviderAdapter('https://res.cloudinary.com/test/demo.jpg')?.provider,
      'CLOUDINARY'
    );
    assert.strictEqual(
      detectProviderAdapter('https://images.unsplash.com/photo-123')?.provider,
      'EXTERNAL_HTTPS'
    );
    assert.strictEqual(detectProviderAdapter('https://evil-unapproved-site.com/foo.jpg'), null);
  });
});

describe('2. Strict SSRF Protection & Scheme Enforcement (PRD 05 Section 4 & 17)', () => {
  it('blocks insecure HTTP protocol and unsupported URI schemes', () => {
    assert.strictEqual(validateExternalMediaUrl('http://blogger.googleusercontent.com/img').isValid, false);
    assert.strictEqual(validateExternalMediaUrl('javascript:alert(1)').isValid, false);
    assert.strictEqual(validateExternalMediaUrl('file:///etc/hosts').isValid, false);
    assert.strictEqual(validateExternalMediaUrl('data:image/png;base64,iVBORw0KGgo').isValid, false);
  });

  it('blocks SSRF loopback addresses, private networks, and cloud instance metadata', () => {
    assert.strictEqual(validateExternalMediaUrl('https://localhost:3000/image.jpg').isValid, false);
    assert.strictEqual(validateExternalMediaUrl('https://127.0.0.1/admin.png').isValid, false);
    assert.strictEqual(validateExternalMediaUrl('https://169.254.169.254/latest/meta-data').isValid, false);
    assert.strictEqual(validateExternalMediaUrl('https://10.0.0.1/private.webp').isValid, false);
    assert.strictEqual(validateExternalMediaUrl('https://192.168.1.1/router.jpg').isValid, false);
    assert.strictEqual(validateExternalMediaUrl('https://172.16.0.5/internal.png').isValid, false);
    assert.strictEqual(validateExternalMediaUrl('https://metadata.google.internal/computeMetadata').isValid, false);
  });
});

describe('3. Media Precedence Hierarchy & Fallback System (PRD 05 Section 5 & 15)', () => {
  const dummyProduct: Product = {
    id: 'p-oil',
    categoryId: 'c-oil',
    title: 'Cold Pressed Mustard Oil',
    slug: 'cold-pressed-mustard-oil',
    status: 'PUBLISHED',
    brand: 'InfiniCharm',
    originCountry: 'India',
    isFeatured: true,
    isNewArrival: false,
    variants: [],
    media: [
      {
        id: 'm-prod-primary',
        provider: 'EXTERNAL_HTTPS',
        externalUrl: 'https://images.unsplash.com/photo-mustard-primary',
        mimeType: 'image/jpeg',
        altText: 'Product Primary Image',
        role: 'PRIMARY',
        displayOrder: 1,
        isActive: true,
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const dummyVariant: ProductVariant = {
    id: 'var-1l',
    productId: 'p-oil',
    sku: 'SKU-OIL-1L',
    title: '1 Litre',
    priceInPaise: 29900,
    stockQuantity: 10,
    lowStockThreshold: 2,
    attributes: {},
    isActive: true,
    media: [
      {
        id: 'm-var-1l',
        provider: 'EXTERNAL_HTTPS',
        externalUrl: 'https://images.unsplash.com/photo-variant-1l',
        mimeType: 'image/jpeg',
        altText: '1L Bottle Image',
        role: 'VARIANT',
        displayOrder: 1,
        isActive: true,
      },
    ],
  };

  it('respects SKU / Variant dedicated media over product gallery', () => {
    const res = resolveMediaPrecedence(dummyProduct, dummyVariant, 'SKU-OIL-1L');
    assert.strictEqual(res.externalUrl, 'https://images.unsplash.com/photo-variant-1l');
  });

  it('falls back to product primary when variant has no media', () => {
    const variantNoMedia: ProductVariant = { ...dummyVariant, media: [] };
    const res = resolveMediaPrecedence(dummyProduct, variantNoMedia, null);
    assert.strictEqual(res.externalUrl, 'https://images.unsplash.com/photo-mustard-primary');
  });

  it('generates zero-layout-shift SVG fallback when image cannot be loaded', () => {
    const svg = getFallbackPlaceholderSvg('100% Kashmiri Honey');
    assert.ok(svg.startsWith('data:image/svg+xml;utf8,'));
    assert.ok(svg.includes('100%25%20Kashmiri%20Honey') || svg.includes('Kashmiri'));
  });
});

describe('4. Server Media Store Persistence & CRUD (PRD 05 Section 8 & 12)', () => {
  it('loads persistent media assets and statistics', () => {
    const all = getAllMediaAssets();
    assert.ok(all.length >= 4, `Expected at least 4 media assets, found ${all.length}`);

    const stats = getMediaStatistics();
    assert.strictEqual(stats.totalAssets, all.length);
    assert.ok(stats.activeAssets > 0);
    assert.ok(stats.imageCount > 0);
  });

  it('filters media assets by provider and media type cleanly', () => {
    const bloggerAssets = filterMediaAssets({ provider: 'BLOGGER' });
    for (const a of bloggerAssets) {
      assert.strictEqual(a.provider, 'BLOGGER');
    }

    const videoAssets = filterMediaAssets({ mediaType: 'VIDEO' });
    for (const a of videoAssets) {
      assert.strictEqual(a.mediaType, 'VIDEO');
    }
  });

  it('performs full CRUD lifecycle on external media without duplicate URLs', () => {
    const testUrl = `https://blogger.googleusercontent.com/img/b/test-crud-${Date.now()}.jpg`;

    // 1. Create
    const createRes = createMediaAsset({
      url: testUrl,
      altText: 'Test CRUD Asset Alt',
      title: 'Test Asset Title',
      role: 'GALLERY',
    });
    assert.strictEqual(createRes.success, true, createRes.error);
    assert.ok(createRes.asset);
    const assetId = createRes.asset.id;

    // 2. Prevent duplicate exact URL
    const dupRes = createMediaAsset({
      url: testUrl,
      altText: 'Duplicate Attempt',
    });
    assert.strictEqual(dupRes.success, false);
    assert.ok(dupRes.error?.includes('already registered'));

    // 3. Read
    const fetched = getMediaAssetById(assetId);
    assert.ok(fetched);
    assert.strictEqual(fetched.altText, 'Test CRUD Asset Alt');

    // 4. Update
    const updateRes = updateMediaAsset(assetId, {
      title: 'Updated Test Title',
      status: 'DISABLED',
      isActive: false,
    });
    assert.strictEqual(updateRes.success, true);
    assert.strictEqual(updateRes.asset?.title, 'Updated Test Title');
    assert.strictEqual(updateRes.asset?.status, 'DISABLED');

    // 5. Delete
    const delRes = deleteMediaAsset(assetId);
    assert.strictEqual(delRes.success, true);
    assert.strictEqual(getMediaAssetById(assetId), null);
  });
});

