'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MediaFallback } from './MediaFallback';

export interface ExternalImageProps
  extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'> {
  src?: string | null;
  alt: string;
  fallbackSrc?: string;
  aspectRatio?: 'square' | 'video' | 'portrait' | 'auto';
  objectFit?: 'cover' | 'contain' | 'fill';
  priority?: boolean;
}

/**
 * InfiniCharm External Image Renderer
 * Satisfies PRD 05 & MediaUses.md Section 11:
 * Direct client browser fetch to external CDN origin. Zero server binary proxy.
 * Robust SSR-hydration cache-complete detection to prevent invisible image states.
 */
export const ExternalImage: React.FC<ExternalImageProps> = ({
  src,
  alt,
  fallbackSrc,
  aspectRatio = 'square',
  objectFit = 'cover',
  priority = false,
  className = '',
  ...rest
}) => {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Check if image is already completed in browser cache or loaded before hydration
  const checkImageComplete = useCallback((img: HTMLImageElement | null) => {
    if (img && img.complete) {
      if (img.naturalWidth > 0) {
        setIsLoaded(true);
      } else {
        setHasError(true);
      }
    }
  }, []);

  // Ref callback to check image immediately upon DOM element attachment
  const setRef = useCallback(
    (node: HTMLImageElement | null) => {
      imgRef.current = node;
      if (node) {
        checkImageComplete(node);
      }
    },
    [checkImageComplete]
  );

  // Re-check whenever src or fallbackSrc changes
  useEffect(() => {
    setHasError(false);
    if (imgRef.current) {
      checkImageComplete(imgRef.current);
    }
  }, [src, fallbackSrc, checkImageComplete]);

  // If no source or error occurred with no secondary fallback, display graceful SVG fallback
  if (!src || hasError) {
    if (fallbackSrc && !hasError) {
      // try fallbackSrc once
    } else {
      return (
        <MediaFallback
          alt={alt}
          title="Direct Origin Dispatch"
          aspectRatio={aspectRatio}
          className={className}
        />
      );
    }
  }

  const fitClass =
    objectFit === 'contain'
      ? 'object-contain'
      : objectFit === 'fill'
      ? 'object-fill'
      : 'object-cover';

  const aspectClass =
    aspectRatio === 'square'
      ? 'aspect-square'
      : aspectRatio === 'video'
      ? 'aspect-video'
      : aspectRatio === 'portrait'
      ? 'aspect-[3/4]'
      : '';

  return (
    <div className={`relative overflow-hidden w-full ${aspectClass} ${className}`}>
      {/* Skeleton loading background - display until image is loaded or if priority loads instantly */}
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 bg-stone-200/50 dark:bg-stone-800/40 animate-pulse pointer-events-none" />
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={setRef}
        src={hasError && fallbackSrc ? fallbackSrc : (src || undefined)}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={priority ? 'high' : 'auto'}
        onLoad={() => setIsLoaded(true)}
        onError={() => {
          setHasError(true);
        }}
        className={`w-full h-full ${fitClass} transition-opacity duration-300 ${
          isLoaded || priority ? 'opacity-100' : 'opacity-0'
        }`}
        {...rest}
      />
    </div>
  );
};

