'use client';

import React, { useState } from 'react';
import { MediaFallback } from './MediaFallback';

export interface ExternalImageProps
  extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'> {
  src: string;
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
      {/* Skeleton loading background */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-stone-200/50 dark:bg-stone-800/40 animate-pulse" />
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={hasError && fallbackSrc ? fallbackSrc : src}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={priority ? 'high' : 'auto'}
        onLoad={() => setIsLoaded(true)}
        onError={() => {
          setHasError(true);
        }}
        className={`w-full h-full ${fitClass} transition-opacity duration-300 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        {...rest}
      />
    </div>
  );
};

