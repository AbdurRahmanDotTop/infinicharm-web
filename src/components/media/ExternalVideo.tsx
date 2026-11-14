'use client';

import React, { useState } from 'react';
import { ExternalLink, Play, Film } from 'lucide-react';
import { YouTubeAdapter } from '@/lib/media/providers';

interface ExternalVideoProps {
  url: string;
  title?: string;
  posterUrl?: string;
  autoPlay?: boolean;
  className?: string;
}

/**
 * InfiniCharm External Video Renderer & YouTube Embed Player
 * Complies with MediaUses.md Sections 6.1.B and 11.4.
 * Uses privacy-enhanced youtube-nocookie.com embed with 16:9 responsive frame.
 */
export const ExternalVideo: React.FC<ExternalVideoProps> = ({
  url,
  title = 'InfiniCharm Product Video',
  posterUrl,
  autoPlay = false,
  className = '',
}) => {
  const [isPlaying, setIsPlaying] = useState(autoPlay);

  if (!url) return null;

  // Determine if it is a YouTube video
  const isYouTube =
    url.includes('youtube.com') ||
    url.includes('youtu.be') ||
    url.includes('youtube-nocookie.com');

  if (isYouTube) {
    const normalized = YouTubeAdapter.normalize(url);
    const embedUrl = normalized.embedUrl || url;
    const watchUrl = normalized.providerAssetId
      ? `https://www.youtube.com/watch?v=${normalized.providerAssetId}`
      : url;
    const thumbnail = posterUrl || normalized.thumbnailUrl;

    return (
      <div className={`relative aspect-video w-full rounded-2xl overflow-hidden bg-black/90 border border-stone-200 dark:border-stone-800 ${className}`}>
        {!isPlaying && thumbnail ? (
          <div className="relative w-full h-full group cursor-pointer" onClick={() => setIsPlaying(true)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumbnail}
              alt={title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-accent/90 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <Play className="w-6 h-6 fill-current ml-0.5" />
              </div>
            </div>
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-white/90">
              <span className="font-semibold truncate max-w-[70%]">{title}</span>
              <a
                href={watchUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-[11px] bg-black/60 hover:bg-black/80 px-2 py-1 rounded-md"
              >
                <span>Watch on YouTube</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        ) : (
          <>
            <iframe
              src={`${embedUrl}${isPlaying ? '?autoplay=1' : ''}`}
              title={title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              loading="lazy"
              className="w-full h-full border-0"
            />
            <div className="absolute top-2 right-2 z-10">
              <a
                href={watchUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[10px] bg-black/70 hover:bg-black/90 text-white px-2 py-0.5 rounded-full backdrop-blur-sm"
              >
                <span>YouTube</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          </>
        )}
      </div>
    );
  }

  // Direct MP4/WebM video stream
  return (
    <div className={`relative aspect-video w-full rounded-2xl overflow-hidden bg-black border border-stone-200 dark:border-stone-800 ${className}`}>
      <video
        controls
        playsInline
        src={url}
        poster={posterUrl}
        className="w-full h-full object-cover"
      >
        Your browser does not support external video playback.
      </video>
    </div>
  );
};

export const YouTubePlayer = ExternalVideo;

