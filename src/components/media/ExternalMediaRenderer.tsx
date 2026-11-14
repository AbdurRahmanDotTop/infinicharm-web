'use client';

import React from 'react';
import type { ExternalMedia, MediaType, MediaRole } from '@/types';
import { ExternalImage } from './ExternalImage';
import { ExternalVideo } from './ExternalVideo';
import { ExternalDocument } from './ExternalDocument';
import { ExternalAudio } from './ExternalAudio';
import { MediaFallback } from './MediaFallback';

interface ExternalMediaRendererProps {
  media?: ExternalMedia | {
    externalUrl: string;
    altText?: string;
    title?: string;
    caption?: string;
    mediaType?: MediaType;
    role?: MediaRole;
  } | null;
  aspectRatio?: 'square' | 'video' | 'portrait' | 'auto';
  priority?: boolean;
  className?: string;
}

/**
 * InfiniCharm Central External Media Dispatcher
 * Dispatches to specialized renderers: ExternalImage, ExternalVideo, ExternalDocument, ExternalAudio.
 * Strictly adheres to MediaUses.md Section 11.
 */
export const ExternalMediaRenderer: React.FC<ExternalMediaRendererProps> = ({
  media,
  aspectRatio = 'square',
  priority = false,
  className = '',
}) => {
  if (!media || !media.externalUrl) {
    return (
      <MediaFallback
        alt="InfiniCharm Selection"
        title="Direct Origin Dispatch"
        aspectRatio={aspectRatio}
        className={className}
      />
    );
  }

  const type = media.mediaType || 'IMAGE';
  const role = media.role || 'PRIMARY';

  // Video dispatch
  if (type === 'VIDEO' || role === 'VIDEO') {
    return (
      <ExternalVideo
        url={media.externalUrl}
        title={media.title || media.altText}
        className={className}
      />
    );
  }

  // Audio dispatch
  if (type === 'AUDIO' || role === 'AUDIO') {
    return (
      <ExternalAudio
        url={media.externalUrl}
        title={media.title || media.altText}
        caption={media.caption}
        className={className}
      />
    );
  }

  // Document/PDF dispatch
  if (
    type === 'DOCUMENT' ||
    type === 'PDF' ||
    role === 'CERTIFICATE' ||
    role === 'DOCUMENT' ||
    role === 'BROCHURE' ||
    role === 'MANUAL'
  ) {
    return (
      <ExternalDocument
        url={media.externalUrl}
        title={media.title || media.altText}
        caption={media.caption}
        isCertificate={role === 'CERTIFICATE'}
        className={className}
      />
    );
  }

  // Default image dispatch
  return (
    <ExternalImage
      src={media.externalUrl}
      alt={media.altText || media.title || 'InfiniCharm Product'}
      aspectRatio={aspectRatio}
      priority={priority}
      className={className}
    />
  );
};

