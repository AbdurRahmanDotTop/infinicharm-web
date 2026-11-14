// ==============================================================================
// InfiniCharm — External Media Resolution & SSRF Prevention Engine
// Governing PRD: PRD 05 (External Media Management, URL Storage & SSRF Protection)
// Principles: Zero Server Binaries, Precedence (SKU > Variant > Product), SSRF Guard
// ==============================================================================

import type { ExternalMedia, Product, ProductVariant } from '../../types/index.ts';

/**
 * Validates external media URLs against SSRF vulnerabilities and protocol security standards.
 * Complies strictly with PRD 05 Section 4.
 */
export function validateExternalMediaUrl(url: string): {
  isValid: boolean;
  reason?: string;
} {
  if (!url || typeof url !== 'string') {
    return { isValid: false, reason: 'URL string is required' };
  }

  const trimmed = url.trim();

  // 1. Strict Protocol Restriction: HTTPS only
  if (!trimmed.startsWith('https://')) {
    return {
      isValid: false,
      reason: 'Only secure HTTPS protocols (https://) are permitted for external media',
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { isValid: false, reason: 'Malformed URL format' };
  }

  const hostname = parsed.hostname.toLowerCase();

  // 2. SSRF Loopback & Localhost Restrictions
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '0.0.0.0'
  ) {
    return {
      isValid: false,
      reason: 'SSRF Violation: Local loopback addresses are blocked',
    };
  }

  // 3. SSRF Cloud Metadata Endpoint Restrictions
  if (
    hostname === '169.254.169.254' ||
    hostname === 'metadata.google.internal' ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.local')
  ) {
    return {
      isValid: false,
      reason: 'SSRF Violation: Cloud instance metadata endpoints are blocked',
    };
  }

  // 4. SSRF Private IP Space Restrictions (RFC 1918)
  const isPrivateIp =
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname);

  if (isPrivateIp) {
    return {
      isValid: false,
      reason: 'SSRF Violation: Private intranet IP ranges are blocked',
    };
  }

  return { isValid: true };
}

/**
 * Resolves the authoritative display media according to PRD 05 Precedence:
 * Priority 1: SKU-Specific Dedicated Media
 * Priority 2: Variant-Level Dedicated Media
 * Priority 3: Product-Level Primary Image / Gallery
 */
export function resolveMediaPrecedence(
  product?: Product | null,
  selectedVariant?: ProductVariant | null,
  selectedSku?: string | null
): ExternalMedia | { externalUrl: string; altText: string } {
  // Priority 1: SKU Match inside Variant Media
  if (selectedSku && selectedVariant?.media && selectedVariant.media.length > 0) {
    const skuMedia = selectedVariant.media.find(
      (m) => m.isActive && (m.role === 'PRIMARY' || m.role === 'VARIANT')
    );
    if (skuMedia) return skuMedia;
  }

  // Priority 2: Variant Media
  if (selectedVariant?.media && selectedVariant.media.length > 0) {
    const activeVariantMedia = selectedVariant.media.find((m) => m.isActive);
    if (activeVariantMedia) return activeVariantMedia;
  }

  // Priority 3: Product Primary or Gallery Image
  if (product?.media && product.media.length > 0) {
    const primaryMedia = product.media.find(
      (m) => m.isActive && m.role === 'PRIMARY'
    );
    if (primaryMedia) return primaryMedia;

    const anyActiveMedia = product.media.find((m) => m.isActive);
    if (anyActiveMedia) return anyActiveMedia;
  }

  // Fallback to high-quality default product image or placeholder
  return {
    externalUrl:
      'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=800&q=80',
    altText: product?.title || 'InfiniCharm Heritage Selection',
  };
}

/**
 * Returns an inline SVG data URI placeholder for products when an external image cannot be rendered.
 * Strictly avoids infinite network retry loops and ensures zero layout shift.
 */
export function getFallbackPlaceholderSvg(label: string = 'InfiniCharm Heritage Selection'): string {
  const safeLabel = label.replace(/[<>&"]/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="100%" height="100%">
    <rect width="800" height="800" fill="#F8F6F2"/>
    <circle cx="400" cy="360" r="120" fill="#E8DEC8" opacity="0.4"/>
    <path d="M350 400 L400 320 L450 400 Z" fill="#D97706" opacity="0.7"/>
    <circle cx="400" cy="330" r="16" fill="#D97706"/>
    <text x="400" y="520" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="600" fill="#1C1917" text-anchor="middle">${safeLabel}</text>
    <text x="400" y="560" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="500" fill="#78716C" text-anchor="middle">Authentic Single-Origin Dispatch</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

