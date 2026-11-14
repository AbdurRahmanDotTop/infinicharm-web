'use client';

import React, { useState, useEffect } from 'react';
import type { SocialMediaLink } from '@/types';
import { renderPlatformIcon } from '@/components/common/SocialIcons';

const DEFAULT_LINKS: SocialMediaLink[] = [
  {
    id: 'social-youtube',
    platform: 'youtube',
    label: 'YouTube',
    url: 'https://www.youtube.com/channel/UCJcnqFc-_JX0uF8-xNrU1rg',
    isEnabled: true,
    displayOrder: 1,
    description: 'InfiniCharm Official YouTube Channel',
  },
  {
    id: 'social-facebook',
    platform: 'facebook',
    label: 'Facebook',
    url: 'https://www.facebook.com/InfiniCharmOfficial',
    isEnabled: true,
    displayOrder: 2,
    description: 'InfiniCharm Official Facebook Page',
  },
  {
    id: 'social-instagram',
    platform: 'instagram',
    label: 'Instagram',
    url: 'https://www.instagram.com/InfiniCharmofficial/',
    isEnabled: true,
    displayOrder: 3,
    description: 'InfiniCharm Official Instagram Handle',
  },
  {
    id: 'social-thecrumb-infinicharm',
    platform: 'thecrumb',
    label: 'The Crumb (InfiniCharm)',
    url: 'https://thecrumb.co/InfiniCharmOfficial',
    isEnabled: true,
    displayOrder: 4,
    description: 'Official InfiniCharm Profile on The Crumb',
  },
  {
    id: 'social-thecrumb-techilyfly',
    platform: 'thecrumb',
    label: 'The Crumb (TechilyFly)',
    url: 'https://thecrumb.co/TechilyFly',
    isEnabled: true,
    displayOrder: 5,
    description: 'Operating Brand TechilyFly on The Crumb',
  },
  {
    id: 'social-thecrumb-founder',
    platform: 'thecrumb',
    label: 'The Crumb (AbdurRahman.Top)',
    url: 'https://thecrumb.co/AbdurRahmanDotTopTechilyFly',
    isEnabled: true,
    displayOrder: 6,
    description: 'Founder & CEO Profile on The Crumb',
  },
  {
    id: 'social-website-official',
    platform: 'website',
    label: 'Official Website',
    url: 'https://infinicharm.com/',
    isEnabled: true,
    displayOrder: 7,
    description: 'InfiniCharm Official E-Commerce Website',
  },
];

export function FooterSocialLinks() {
  const [links, setLinks] = useState<SocialMediaLink[]>(DEFAULT_LINKS);

  const fetchLinks = async () => {
    try {
      const res = await fetch('/api/settings/social-share', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.socialLinks) && data.socialLinks.length > 0) {
          setLinks(data.socialLinks);
        }
      }
    } catch {
      // Fallback to DEFAULT_LINKS from SocialLinks.md
    }
  };

  useEffect(() => {
    fetchLinks();
    const handleUpdate = () => fetchLinks();
    window.addEventListener('infinicharm_social_updated', handleUpdate);
    return () => window.removeEventListener('infinicharm_social_updated', handleUpdate);
  }, []);

  return (
    <div className="space-y-3 pt-2">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-primary">
        Connect & Follow
      </h4>
      <div className="flex flex-wrap items-center gap-2">
        {links.map((item) => (
          <a
            key={item.id}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-8 h-8 rounded-lg bg-surface-dim hover:bg-surface border border-border text-muted hover:text-primary flex items-center justify-center transition-all hover:scale-105 shadow-2xs hover:border-accent/40"
            aria-label={`${item.label} (opens in a new tab)`}
            title={item.description || item.label}
          >
            {renderPlatformIcon(item.platform, 15)}
          </a>
        ))}
      </div>
    </div>
  );
}

