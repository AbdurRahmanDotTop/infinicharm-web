'use client';

import React, { useState } from 'react';
import { Share2 } from 'lucide-react';
import { ShareModal } from './ShareModal';
import type { ShareChannelsConfig } from '@/types';
import { buildAbsoluteUrl, getAppOrigin } from '@/lib/utils/env-urls';

export interface ShareButtonProps {
  title: string;
  url?: string;
  text?: string;
  imageUrl?: string;
  subtitle?: string;
  variant?: 'button' | 'icon' | 'floating' | 'subtle';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  channels?: Partial<ShareChannelsConfig>;
  preferNative?: boolean;
}

export function ShareButton({
  title,
  url,
  text,
  imageUrl,
  subtitle,
  variant = 'button',
  size = 'md',
  className = '',
  channels,
  preferNative = true,
}: ShareButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const getResolvedUrl = () => {
    if (url) {
      if (url.startsWith('http://') || url.startsWith('https://')) return url;
      return buildAbsoluteUrl(url);
    }
    if (typeof window !== 'undefined') return window.location.href;
    return getAppOrigin();
  };

  const handleShareClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(true);
  };

  const resolvedUrl = getResolvedUrl();

  return (
    <>
      {variant === 'button' && (
        <button
          type="button"
          onClick={handleShareClick}
          className={`inline-flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl border border-border bg-surface-dim hover:bg-surface text-primary hover:text-accent font-semibold transition-all shadow-sm ${className}`}
          aria-label={`Share ${title}`}
          title="Share"
        >
          <Share2 className="w-4 h-4 shrink-0" />
          <span className="text-xs sm:text-sm">Share</span>
        </button>
      )}

      {variant === 'icon' && (
        <button
          type="button"
          onClick={handleShareClick}
          className={`p-2 rounded-xl bg-surface-dim hover:bg-surface border border-border text-muted hover:text-primary transition-colors flex items-center justify-center ${className}`}
          aria-label={`Share ${title}`}
          title="Share"
        >
          <Share2 className="w-4 h-4" />
        </button>
      )}

      {variant === 'floating' && (
        <button
          type="button"
          onClick={handleShareClick}
          className={`p-2.5 rounded-full backdrop-blur-md bg-white/80 hover:bg-white text-muted hover:text-primary transition-all shadow-md z-10 ${className}`}
          aria-label={`Share ${title}`}
          title="Share Product"
        >
          <Share2 className="w-4 h-4" />
        </button>
      )}

      {variant === 'subtle' && (
        <button
          type="button"
          onClick={handleShareClick}
          className={`inline-flex items-center gap-1.5 text-xs text-muted hover:text-primary transition-colors py-1 px-2 rounded-lg hover:bg-surface-dim ${className}`}
          aria-label={`Share ${title}`}
          title="Share"
        >
          <Share2 className="w-3.5 h-3.5" />
          <span>Share</span>
        </button>
      )}

      <ShareModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={title}
        url={resolvedUrl}
        text={text}
        imageUrl={imageUrl}
        subtitle={subtitle}
        channels={channels}
      />
    </>
  );
}
