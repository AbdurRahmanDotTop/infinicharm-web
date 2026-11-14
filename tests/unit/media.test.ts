import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  validateExternalMediaUrl,
  resolveMediaPrecedence,
} from '../../src/lib/utils/media.ts';
import type { Product, ProductVariant } from '../../src/types/index.ts';

describe('External Media Management & SSRF Protection Engine (PRD 05)', () => {
  it('permits secure HTTPS external URLs', () => {
    const valid = validateExternalMediaUrl(
      'https://lh3.googleusercontent.com/aida-public/test-image.webp'
    );
    assert.strictEqual(valid.isValid, true);
    assert.strictEqual(valid.reason, undefined);
  });

  it('rejects unencrypted HTTP URLs and insecure schemes', () => {
    const httpRes = validateExternalMediaUrl('http://infinicharm.com/image.jpg');
    assert.strictEqual(httpRes.isValid, false);
    assert.ok(httpRes.reason?.includes('HTTPS'));

    const fileRes = validateExternalMediaUrl('file:///etc/passwd');
    assert.strictEqual(fileRes.isValid, false);

    const jsRes = validateExternalMediaUrl('javascript:alert(1)');
    assert.strictEqual(jsRes.isValid, false);
  });

  it('strictly blocks SSRF loopback, internal addresses, and cloud metadata', () => {
    const localhost = validateExternalMediaUrl('https://localhost/exploit.png');
    assert.strictEqual(localhost.isValid, false);
    assert.ok(localhost.reason?.includes('SSRF'));

    const loopback = validateExternalMediaUrl('https://127.0.0.1:8080/data');
    assert.strictEqual(loopback.isValid, false);

    const metadata = validateExternalMediaUrl(
      'https://169.254.169.254/latest/meta-data'
    );
    assert.strictEqual(metadata.isValid, false);

    const privateRange = validateExternalMediaUrl('https://192.168.1.10/admin');
    assert.strictEqual(privateRange.isValid, false);
  });

  it('resolves media precedence according to PRD 05 hierarchy (SKU > Variant > Product)', () => {
    const mockProduct: Product = {
      id: 'p-1',
      categoryId: 'c-1',
      title: 'Kachi Ghani Mustard Oil',
      slug: 'kachi-ghani-mustard-oil',
      status: 'PUBLISHED',
      brand: 'InfiniCharm',
      originCountry: 'India',
      isFeatured: true,
      isNewArrival: false,
      variants: [],
      media: [
        {
          id: 'm-prod',
          provider: 'EXTERNAL_HTTPS',
          externalUrl: 'https://cdn.infinicharm.com/product-primary.webp',
          mimeType: 'image/webp',
          altText: 'Product Primary Image',
          role: 'PRIMARY',
          displayOrder: 0,
          isActive: true,
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const mockVariant: ProductVariant = {
      id: 'v-1',
      productId: 'p-1',
      sku: 'SKU-OIL-1L',
      title: '1 Litre Bottle',
      priceInPaise: 24900,
      stockQuantity: 50,
      lowStockThreshold: 5,
      attributes: { size: '1L' },
      isActive: true,
      media: [
        {
          id: 'm-var',
          provider: 'EXTERNAL_HTTPS',
          externalUrl: 'https://cdn.infinicharm.com/variant-1l.webp',
          mimeType: 'image/webp',
          altText: '1L Bottle Variant Image',
          role: 'VARIANT',
          displayOrder: 0,
          isActive: true,
        },
      ],
    };

    // Case 1: When Variant has dedicated media, it takes precedence over product gallery
    const resolvedVariantMedia = resolveMediaPrecedence(mockProduct, mockVariant, null);
    assert.strictEqual(
      resolvedVariantMedia.externalUrl,
      'https://cdn.infinicharm.com/variant-1l.webp'
    );

    // Case 2: When Variant has no media, falls back to product primary media
    const resolvedProductMedia = resolveMediaPrecedence(mockProduct, null, null);
    assert.strictEqual(
      resolvedProductMedia.externalUrl,
      'https://cdn.infinicharm.com/product-primary.webp'
    );
  });
});
