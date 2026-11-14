// ==============================================================================
// InfiniCharm — External Media Provider Adapter Registry
// Governing PRD: PRD 05 & All_Docs/PRDs/MediaUses.md (Sections 6 & 10)
// Principles: Zero Server Binaries, Strict SSRF Prevention, Protocol & Domain Validation
// ==============================================================================

import type { MediaProvider, MediaType, MediaRole } from '../../types/index.ts';
import { validateExternalMediaUrl } from '../utils/media.ts';

export interface NormalizedMediaReference {
  provider: MediaProvider;
  mediaType: MediaType;
  sourceUrl: string;
  normalizedUrl: string;
  providerAssetId?: string;
  thumbnailUrl?: string;
  embedUrl?: string;
  dimensions?: { width?: number; height?: number };
  suggestedTitle?: string;
  suggestedAlt?: string;
}

export interface ProviderValidationResult {
  isValid: boolean;
  reason?: string;
  provider?: MediaProvider;
  mediaType?: MediaType;
  normalized?: NormalizedMediaReference;
}

export interface MediaProviderAdapter {
  provider: MediaProvider;
  supportedMediaTypes: MediaType[];
  matches(url: string, hostname: string): boolean;
  normalize(inputUrl: string): NormalizedMediaReference;
  validate(inputUrl: string): ProviderValidationResult;
}

// -----------------------------------------------------------------------------
// 1. Blogger / Google UserContent Adapter (Section 6.1.A)
// -----------------------------------------------------------------------------
export const BloggerAdapter: MediaProviderAdapter = {
  provider: 'BLOGGER',
  supportedMediaTypes: ['IMAGE'],

  matches(_url: string, hostname: string): boolean {
    const h = hostname.toLowerCase();
    return (
      h === 'blogger.googleusercontent.com' ||
      h === 'lh3.googleusercontent.com' ||
      h === 'lh4.googleusercontent.com' ||
      h === 'lh5.googleusercontent.com' ||
      h === 'lh6.googleusercontent.com' ||
      h.endsWith('.blogger.com') ||
      h.endsWith('.blogspot.com') ||
      h.endsWith('.googleusercontent.com')
    );
  },

  normalize(inputUrl: string): NormalizedMediaReference {
    const trimmed = inputUrl.trim();
    // Parse dimensions if present in Blogger URL params (e.g., =w800-h800 or /w275-h275-p-k-no-nu/)
    let width: number | undefined;
    let height: number | undefined;

    const dimMatch = trimmed.match(/[=/]w(\d+)-h(\d+)/i);
    if (dimMatch) {
      width = parseInt(dimMatch[1], 10);
      height = parseInt(dimMatch[2], 10);
    } else {
      const sMatch = trimmed.match(/[=/]s(\d+)/i);
      if (sMatch) {
        width = parseInt(sMatch[1], 10);
        height = parseInt(sMatch[1], 10);
      }
    }

    return {
      provider: 'BLOGGER',
      mediaType: 'IMAGE',
      sourceUrl: trimmed,
      normalizedUrl: trimmed,
      thumbnailUrl: trimmed,
      dimensions: width && height ? { width, height } : undefined,
      suggestedTitle: 'Blogger Hosted Asset',
      suggestedAlt: 'InfiniCharm Curated Product Imagery',
    };
  },

  validate(inputUrl: string): ProviderValidationResult {
    const baseVal = validateExternalMediaUrl(inputUrl);
    if (!baseVal.isValid) return { isValid: false, reason: baseVal.reason };

    try {
      const parsed = new URL(inputUrl.trim());
      if (!this.matches(inputUrl, parsed.hostname)) {
        return {
          isValid: false,
          reason: 'URL does not belong to an approved Blogger / Google UserContent host',
        };
      }
      return {
        isValid: true,
        provider: 'BLOGGER',
        mediaType: 'IMAGE',
        normalized: this.normalize(inputUrl),
      };
    } catch {
      return { isValid: false, reason: 'Invalid URL structure' };
    }
  },
};

// -----------------------------------------------------------------------------
// 2. YouTube Video Adapter (Section 6.1.B)
// -----------------------------------------------------------------------------
export const YouTubeAdapter: MediaProviderAdapter = {
  provider: 'YOUTUBE',
  supportedMediaTypes: ['VIDEO', 'EMBED'],

  matches(_url: string, hostname: string): boolean {
    const h = hostname.toLowerCase();
    return (
      h === 'youtube.com' ||
      h === 'www.youtube.com' ||
      h === 'm.youtube.com' ||
      h === 'youtu.be' ||
      h === 'www.youtube-nocookie.com' ||
      h === 'youtube-nocookie.com'
    );
  },

  normalize(inputUrl: string): NormalizedMediaReference {
    const trimmed = inputUrl.trim();
    let videoId = '';

    try {
      const parsed = new URL(trimmed);
      const h = parsed.hostname.toLowerCase();

      if (h === 'youtu.be') {
        videoId = parsed.pathname.replace(/^\/+/, '').split('/')[0] || '';
      } else if (parsed.pathname.startsWith('/embed/')) {
        videoId = parsed.pathname.replace('/embed/', '').split('/')[0] || '';
      } else if (parsed.pathname.startsWith('/shorts/')) {
        videoId = parsed.pathname.replace('/shorts/', '').split('/')[0] || '';
      } else {
        videoId = parsed.searchParams.get('v') || '';
      }
    } catch {
      // ignore parsing error
    }

    const cleanVideoId = videoId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 15);
    const embedUrl = cleanVideoId
      ? `https://www.youtube-nocookie.com/embed/${cleanVideoId}`
      : trimmed;
    const thumbnailUrl = cleanVideoId
      ? `https://img.youtube.com/vi/${cleanVideoId}/hqdefault.jpg`
      : undefined;

    return {
      provider: 'YOUTUBE',
      mediaType: 'VIDEO',
      sourceUrl: trimmed,
      normalizedUrl: embedUrl,
      providerAssetId: cleanVideoId || undefined,
      thumbnailUrl,
      embedUrl,
      suggestedTitle: 'YouTube Product Demonstration',
      suggestedAlt: 'Product video demonstration on YouTube',
    };
  },

  validate(inputUrl: string): ProviderValidationResult {
    const baseVal = validateExternalMediaUrl(inputUrl);
    if (!baseVal.isValid) return { isValid: false, reason: baseVal.reason };

    try {
      const parsed = new URL(inputUrl.trim());
      if (!this.matches(inputUrl, parsed.hostname)) {
        return {
          isValid: false,
          reason: 'URL is not from an approved YouTube domain',
        };
      }

      const normalized = this.normalize(inputUrl);
      if (!normalized.providerAssetId || normalized.providerAssetId.length < 5) {
        return {
          isValid: false,
          reason: 'Could not extract a valid YouTube video ID from the provided URL',
        };
      }

      return {
        isValid: true,
        provider: 'YOUTUBE',
        mediaType: 'VIDEO',
        normalized,
      };
    } catch {
      return { isValid: false, reason: 'Malformed YouTube URL' };
    }
  },
};

// -----------------------------------------------------------------------------
// 3. Google Drive Document & PDF Adapter (Section 6.1.C)
// -----------------------------------------------------------------------------
export const GoogleDriveAdapter: MediaProviderAdapter = {
  provider: 'GOOGLE_DRIVE',
  supportedMediaTypes: ['DOCUMENT', 'PDF'],

  matches(_url: string, hostname: string): boolean {
    const h = hostname.toLowerCase();
    return h === 'drive.google.com' || h === 'docs.google.com';
  },

  normalize(inputUrl: string): NormalizedMediaReference {
    const trimmed = inputUrl.trim();
    let fileId = '';

    try {
      const parsed = new URL(trimmed);
      const match = parsed.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (match) {
        fileId = match[1];
      } else {
        fileId = parsed.searchParams.get('id') || '';
      }
    } catch {
      // ignore
    }

    const cleanFileId = fileId.replace(/[^a-zA-Z0-9_-]/g, '');
    const previewUrl = cleanFileId
      ? `https://drive.google.com/file/d/${cleanFileId}/preview`
      : trimmed;

    return {
      provider: 'GOOGLE_DRIVE',
      mediaType: 'DOCUMENT',
      sourceUrl: trimmed,
      normalizedUrl: previewUrl,
      providerAssetId: cleanFileId || undefined,
      embedUrl: previewUrl,
      suggestedTitle: 'Google Drive Product Documentation / Certificate',
      suggestedAlt: 'Verified product certification document on Google Drive',
    };
  },

  validate(inputUrl: string): ProviderValidationResult {
    const baseVal = validateExternalMediaUrl(inputUrl);
    if (!baseVal.isValid) return { isValid: false, reason: baseVal.reason };

    try {
      const parsed = new URL(inputUrl.trim());
      if (!this.matches(inputUrl, parsed.hostname)) {
        return {
          isValid: false,
          reason: 'URL is not from an approved Google Drive / Docs domain',
        };
      }

      const normalized = this.normalize(inputUrl);
      if (!normalized.providerAssetId) {
        return {
          isValid: false,
          reason: 'Could not extract a valid Google Drive file ID',
        };
      }

      return {
        isValid: true,
        provider: 'GOOGLE_DRIVE',
        mediaType: 'DOCUMENT',
        normalized,
      };
    } catch {
      return { isValid: false, reason: 'Malformed Google Drive URL' };
    }
  },
};

// -----------------------------------------------------------------------------
// 4. ImageKit Adapter (Section 6.1.D)
// -----------------------------------------------------------------------------
export const ImageKitAdapter: MediaProviderAdapter = {
  provider: 'IMAGEKIT',
  supportedMediaTypes: ['IMAGE', 'VIDEO'],

  matches(_url: string, hostname: string): boolean {
    const h = hostname.toLowerCase();
    return h === 'ik.imagekit.io' || h.endsWith('.imagekit.io');
  },

  normalize(inputUrl: string): NormalizedMediaReference {
    const trimmed = inputUrl.trim();
    return {
      provider: 'IMAGEKIT',
      mediaType: 'IMAGE',
      sourceUrl: trimmed,
      normalizedUrl: trimmed,
      thumbnailUrl: trimmed,
      suggestedTitle: 'ImageKit Optimized Asset',
      suggestedAlt: 'InfiniCharm image served via ImageKit CDN',
    };
  },

  validate(inputUrl: string): ProviderValidationResult {
    const baseVal = validateExternalMediaUrl(inputUrl);
    if (!baseVal.isValid) return { isValid: false, reason: baseVal.reason };

    try {
      const parsed = new URL(inputUrl.trim());
      if (!this.matches(inputUrl, parsed.hostname)) {
        return { isValid: false, reason: 'URL does not belong to ImageKit CDN' };
      }
      return {
        isValid: true,
        provider: 'IMAGEKIT',
        mediaType: 'IMAGE',
        normalized: this.normalize(inputUrl),
      };
    } catch {
      return { isValid: false, reason: 'Malformed ImageKit URL' };
    }
  },
};

// -----------------------------------------------------------------------------
// 5. Cloudinary Adapter (Section 6.1.E)
// -----------------------------------------------------------------------------
export const CloudinaryAdapter: MediaProviderAdapter = {
  provider: 'CLOUDINARY',
  supportedMediaTypes: ['IMAGE', 'VIDEO'],

  matches(_url: string, hostname: string): boolean {
    const h = hostname.toLowerCase();
    return h === 'res.cloudinary.com' || h.endsWith('.cloudinary.com');
  },

  normalize(inputUrl: string): NormalizedMediaReference {
    const trimmed = inputUrl.trim();
    return {
      provider: 'CLOUDINARY',
      mediaType: 'IMAGE',
      sourceUrl: trimmed,
      normalizedUrl: trimmed,
      thumbnailUrl: trimmed,
      suggestedTitle: 'Cloudinary Optimized Asset',
      suggestedAlt: 'InfiniCharm image served via Cloudinary',
    };
  },

  validate(inputUrl: string): ProviderValidationResult {
    const baseVal = validateExternalMediaUrl(inputUrl);
    if (!baseVal.isValid) return { isValid: false, reason: baseVal.reason };

    try {
      const parsed = new URL(inputUrl.trim());
      if (!this.matches(inputUrl, parsed.hostname)) {
        return { isValid: false, reason: 'URL does not belong to Cloudinary CDN' };
      }
      return {
        isValid: true,
        provider: 'CLOUDINARY',
        mediaType: 'IMAGE',
        normalized: this.normalize(inputUrl),
      };
    } catch {
      return { isValid: false, reason: 'Malformed Cloudinary URL' };
    }
  },
};

// -----------------------------------------------------------------------------
// 6. Generic Approved External HTTPS Adapter (Section 6.2)
// -----------------------------------------------------------------------------
const APPROVED_GENERIC_HOSTS = [
  'images.unsplash.com',
  'plus.unsplash.com',
  'zamzamstoreeg.com',
  'rukminim2.flixcart.com',
  'encrypted-tbn0.gstatic.com',
  'cdn.jsdelivr.net',
  'assets.payglocal.in',
  'via.placeholder.com',
];

export const GenericExternalAdapter: MediaProviderAdapter = {
  provider: 'EXTERNAL_HTTPS',
  supportedMediaTypes: ['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'OTHER'],

  matches(_url: string, hostname: string): boolean {
    const h = hostname.toLowerCase();
    return APPROVED_GENERIC_HOSTS.some((domain) => h === domain || h.endsWith(`.${domain}`));
  },

  normalize(inputUrl: string): NormalizedMediaReference {
    const trimmed = inputUrl.trim();
    let mediaType: MediaType = 'IMAGE';

    if (/\.(mp4|webm|mov)(\?|$)/i.test(trimmed)) {
      mediaType = 'VIDEO';
    } else if (/\.(mp3|wav|ogg|m4a)(\?|$)/i.test(trimmed)) {
      mediaType = 'AUDIO';
    } else if (/\.(pdf|doc|docx)(\?|$)/i.test(trimmed)) {
      mediaType = 'DOCUMENT';
    }

    return {
      provider: 'EXTERNAL_HTTPS',
      mediaType,
      sourceUrl: trimmed,
      normalizedUrl: trimmed,
      thumbnailUrl: mediaType === 'IMAGE' ? trimmed : undefined,
      suggestedTitle: 'External HTTPS Asset',
      suggestedAlt: 'InfiniCharm External Heritage Asset',
    };
  },

  validate(inputUrl: string): ProviderValidationResult {
    const baseVal = validateExternalMediaUrl(inputUrl);
    if (!baseVal.isValid) return { isValid: false, reason: baseVal.reason };

    try {
      const parsed = new URL(inputUrl.trim());
      const h = parsed.hostname.toLowerCase();
      const isApproved = APPROVED_GENERIC_HOSTS.some(
        (domain) => h === domain || h.endsWith(`.${domain}`)
      );

      if (!isApproved) {
        return {
          isValid: false,
          reason: `Domain "${h}" is not currently in the approved external media whitelist`,
        };
      }

      return {
        isValid: true,
        provider: 'EXTERNAL_HTTPS',
        mediaType: 'IMAGE',
        normalized: this.normalize(inputUrl),
      };
    } catch {
      return { isValid: false, reason: 'Malformed external URL' };
    }
  },
};

// -----------------------------------------------------------------------------
// Master Adapter Registry
// -----------------------------------------------------------------------------
export const ALL_MEDIA_ADAPTERS: MediaProviderAdapter[] = [
  BloggerAdapter,
  YouTubeAdapter,
  GoogleDriveAdapter,
  ImageKitAdapter,
  CloudinaryAdapter,
  GenericExternalAdapter,
];

/**
 * Automatically detects the provider adapter for an external URL.
 */
export function detectProviderAdapter(url: string): MediaProviderAdapter | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    const hostname = parsed.hostname.toLowerCase();
    for (const adapter of ALL_MEDIA_ADAPTERS) {
      if (adapter.matches(trimmed, hostname)) {
        return adapter;
      }
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Validates and normalizes any candidate external media URL using the centralized adapter registry.
 */
export function validateAndNormalizeMediaUrl(url: string): ProviderValidationResult {
  const adapter = detectProviderAdapter(url);
  if (!adapter) {
    // Check if it passes base SSRF and HTTPS check
    const baseVal = validateExternalMediaUrl(url);
    if (!baseVal.isValid) {
      return { isValid: false, reason: baseVal.reason };
    }
    return {
      isValid: false,
      reason:
        'URL host is not supported. Please use Blogger, YouTube, Google Drive, ImageKit, Cloudinary, or an approved partner CDN.',
    };
  }

  return adapter.validate(url);
}
