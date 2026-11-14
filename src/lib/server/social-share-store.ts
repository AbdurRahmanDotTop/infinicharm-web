// ==============================================================================
// InfiniCharm — Server Social Media Links & Share Feature Settings Authority
// Source of truth: All_Docs/Credentials_and_other/SocialLinks.md
// Governs storefront social icons, PDP/Blog/Order sharing, and Admin CRUD
// ==============================================================================

import fs from 'fs';
import path from 'path';
import type {
  SocialAndShareSettings,
  SocialMediaLink,
  ShareFeatureSettings,
  SocialPlatformKey,
} from '../../types/index.ts';

function getStoreFilePath(): string {
  const primary = path.join(process.cwd(), 'src', 'data', 'social_and_share_settings.json');
  if (fs.existsSync(primary)) return primary;
  const alt = path.join(process.cwd(), 'data', 'social_and_share_settings.json');
  if (fs.existsSync(alt)) return alt;
  return primary;
}

const DEFAULT_SETTINGS: SocialAndShareSettings = {
  socialLinks: [
    {
      id: 'social-youtube',
      platform: 'youtube',
      label: 'YouTube',
      url: 'https://www.youtube.com/channel/UCJcnqFc-_JX0uF8-xNrU1rg',
      isEnabled: true,
      displayOrder: 1,
      description: 'InfiniCharm Official YouTube Channel',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'social-facebook',
      platform: 'facebook',
      label: 'Facebook',
      url: 'https://www.facebook.com/InfiniCharmOfficial',
      isEnabled: true,
      displayOrder: 2,
      description: 'InfiniCharm Official Facebook Page',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'social-instagram',
      platform: 'instagram',
      label: 'Instagram',
      url: 'https://www.instagram.com/InfiniCharmofficial/',
      isEnabled: true,
      displayOrder: 3,
      description: 'InfiniCharm Official Instagram Handle',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'social-thecrumb-infinicharm',
      platform: 'thecrumb',
      label: 'The Crumb (InfiniCharm)',
      url: 'https://thecrumb.co/InfiniCharmOfficial',
      isEnabled: true,
      displayOrder: 4,
      description: 'Official InfiniCharm Profile on The Crumb',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'social-thecrumb-techilyfly',
      platform: 'thecrumb',
      label: 'The Crumb (TechilyFly)',
      url: 'https://thecrumb.co/TechilyFly',
      isEnabled: true,
      displayOrder: 5,
      description: 'Operating Brand TechilyFly on The Crumb',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'social-thecrumb-founder',
      platform: 'thecrumb',
      label: 'The Crumb (AbdurRahman.Top)',
      url: 'https://thecrumb.co/AbdurRahmanDotTopTechilyFly',
      isEnabled: true,
      displayOrder: 6,
      description: 'Founder & CEO Profile on The Crumb',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'social-website-official',
      platform: 'website',
      label: 'Official Website',
      url: 'https://infinicharm.com/',
      isEnabled: true,
      displayOrder: 7,
      description: 'InfiniCharm Official E-Commerce Website',
      updatedAt: new Date().toISOString(),
    },
  ],
  sharing: {
    enableProductSharing: true,
    enableBlogSharing: true,
    enableOrderTrackingSharing: true,
    channels: {
      whatsapp: true,
      twitter: true,
      facebook: true,
      linkedin: true,
      email: true,
      copyLink: true,
    },
    customShareMessage:
      'Discover authentic, unadulterated essentials direct from single-origin harvesters at InfiniCharm.',
    updatedAt: new Date().toISOString(),
  },
  updatedAt: new Date().toISOString(),
};

function writeSettingsToFile(data: SocialAndShareSettings): void {
  try {
    const filePath = getStoreFilePath();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write social and share settings:', err);
  }
}

export function getSocialAndShareSettings(): SocialAndShareSettings {
  try {
    const filePath = getStoreFilePath();
    if (!fs.existsSync(filePath)) {
      writeSettingsToFile(DEFAULT_SETTINGS);
      return DEFAULT_SETTINGS;
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed: SocialAndShareSettings = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.socialLinks)) {
      return DEFAULT_SETTINGS;
    }
    // Ensure displayOrder sorting
    parsed.socialLinks.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    return parsed;
  } catch (err) {
    console.error('Failed to read social and share settings:', err);
    return DEFAULT_SETTINGS;
  }
}

export function getPublicSocialAndShareSettings(): {
  socialLinks: SocialMediaLink[];
  sharing: ShareFeatureSettings;
} {
  const settings = getSocialAndShareSettings();
  return {
    socialLinks: settings.socialLinks.filter((link) => link.isEnabled),
    sharing: settings.sharing,
  };
}

export function updateShareSettings(
  partialSharing: Partial<ShareFeatureSettings>
): ShareFeatureSettings {
  const current = getSocialAndShareSettings();
  const updatedSharing: ShareFeatureSettings = {
    ...current.sharing,
    ...partialSharing,
    channels: {
      ...current.sharing.channels,
      ...(partialSharing.channels || {}),
    },
    updatedAt: new Date().toISOString(),
  };

  current.sharing = updatedSharing;
  current.updatedAt = new Date().toISOString();
  writeSettingsToFile(current);
  return updatedSharing;
}

export function addSocialLink(input: {
  platform: SocialPlatformKey;
  label: string;
  url: string;
  isEnabled?: boolean;
  description?: string;
}): SocialMediaLink {
  const current = getSocialAndShareSettings();
  const maxOrder = current.socialLinks.reduce((max, l) => Math.max(max, l.displayOrder || 0), 0);

  const newLink: SocialMediaLink = {
    id: `social-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    platform: input.platform || 'other',
    label: input.label.trim(),
    url: input.url.trim(),
    isEnabled: input.isEnabled !== false,
    displayOrder: maxOrder + 1,
    description: input.description?.trim(),
    updatedAt: new Date().toISOString(),
  };

  current.socialLinks.push(newLink);
  current.updatedAt = new Date().toISOString();
  writeSettingsToFile(current);
  return newLink;
}

export function updateSocialLink(
  id: string,
  updates: Partial<Omit<SocialMediaLink, 'id'>>
): SocialMediaLink | null {
  const current = getSocialAndShareSettings();
  const index = current.socialLinks.findIndex((l) => l.id === id);
  if (index === -1) return null;

  const existing = current.socialLinks[index];
  const updated: SocialMediaLink = {
    ...existing,
    ...updates,
    id: existing.id,
    updatedAt: new Date().toISOString(),
  };

  current.socialLinks[index] = updated;
  current.updatedAt = new Date().toISOString();
  writeSettingsToFile(current);
  return updated;
}

export function deleteSocialLink(id: string): boolean {
  const current = getSocialAndShareSettings();
  const initialLength = current.socialLinks.length;
  current.socialLinks = current.socialLinks.filter((l) => l.id !== id);

  if (current.socialLinks.length === initialLength) {
    return false;
  }

  // Normalize display orders
  current.socialLinks.forEach((link, idx) => {
    link.displayOrder = idx + 1;
  });

  current.updatedAt = new Date().toISOString();
  writeSettingsToFile(current);
  return true;
}

export function reorderSocialLinks(orderedIds: string[]): SocialMediaLink[] {
  const current = getSocialAndShareSettings();
  const map = new Map(current.socialLinks.map((l) => [l.id, l]));

  const reordered: SocialMediaLink[] = [];
  orderedIds.forEach((id, idx) => {
    const item = map.get(id);
    if (item) {
      item.displayOrder = idx + 1;
      item.updatedAt = new Date().toISOString();
      reordered.push(item);
      map.delete(id);
    }
  });

  // Append any unreferenced items
  for (const remaining of map.values()) {
    remaining.displayOrder = reordered.length + 1;
    reordered.push(remaining);
  }

  current.socialLinks = reordered;
  current.updatedAt = new Date().toISOString();
  writeSettingsToFile(current);
  return reordered;
}

