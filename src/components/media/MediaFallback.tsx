'use client';

import React from 'react';
import { ImageOff, Sparkles, AlertCircle } from 'lucide-react';

interface MediaFallbackProps {
  alt?: string;
  title?: string;
  className?: string;
  aspectRatio?: 'square' | 'video' | 'portrait' | 'auto';
  showLabel?: boolean;
}

/**
 * InfiniCharm Zero-Layout-Shift Fallback Graphic
 * Complies with PRD 05 & MediaUses.md Section 15.
 * Strictly avoids infinite network retry loops.
 */
export const MediaFallback: React.FC<MediaFallbackProps> = ({
  alt = 'Heritage Selection',
  title = 'Direct Origin Dispatch',
  className = '',
  aspectRatio = 'square',
  showLabel = true,
}) => {
  const aspectClass =
    aspectRatio === 'square'
      ? 'aspect-square'
      : aspectRatio === 'video'
      ? 'aspect-video'
      : aspectRatio === 'portrait'
      ? 'aspect-[3/4]'
      : 'h-full min-h-[140px]';

  return (
    <div
      role="img"
      aria-label={alt}
      className={`relative w-full ${aspectClass} bg-stone-100/90 dark:bg-stone-900/40 border border-stone-200/80 dark:border-stone-800 rounded-2xl flex flex-col items-center justify-center p-4 text-center select-none overflow-hidden ${className}`}
    >
      {/* Editorial Decorative Subtle Shapes */}
      <div className="absolute inset-0 opacity-20 pointer-events-none flex items-center justify-center">
        <div className="w-32 h-32 rounded-full border border-dashed border-stone-400" />
      </div>

      <div className="relative z-10 flex flex-col items-center max-w-[85%] space-y-1.5">
        <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-700 flex items-center justify-center mb-1">
          <Sparkles className="w-5 h-5 text-amber-600" />
        </div>

        {showLabel && (
          <>
            <p className="font-display text-xs font-bold text-stone-800 dark:text-stone-200 line-clamp-1">
              {alt}
            </p>
            <p className="text-[10px] text-stone-500 font-medium tracking-wide uppercase line-clamp-1">
              {title}
            </p>
          </>
        )}
      </div>
    </div>
  );
};

