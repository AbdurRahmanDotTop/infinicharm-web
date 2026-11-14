'use client';

import React from 'react';
import { Music, Radio } from 'lucide-react';

interface ExternalAudioProps {
  url: string;
  title?: string;
  caption?: string;
  className?: string;
}

/**
 * InfiniCharm External Audio Player
 * Complies with MediaUses.md Section 7 & 11.
 * Renders direct audio recordings from external origins.
 */
export const ExternalAudio: React.FC<ExternalAudioProps> = ({
  url,
  title = 'Artisan Field Audio Guide',
  caption = 'Authentic field recording from single-origin extraction facilities.',
  className = '',
}) => {
  if (!url) return null;

  return (
    <div
      className={`w-full rounded-2xl border border-stone-200 dark:border-stone-800 bg-surface-dim/90 p-5 flex flex-col items-center justify-center text-center space-y-3 ${className}`}
    >
      <div className="w-12 h-12 rounded-full bg-accent/10 text-accent flex items-center justify-center animate-pulse">
        <Music className="w-6 h-6" />
      </div>

      <div className="space-y-1">
        <h4 className="font-display font-bold text-sm text-primary">{title}</h4>
        <p className="text-xs text-muted max-w-sm">{caption}</p>
      </div>

      <audio
        controls
        src={url}
        preload="metadata"
        className="w-full max-w-sm mt-2 rounded-lg"
      >
        Your browser does not support audio playback.
      </audio>
    </div>
  );
};

