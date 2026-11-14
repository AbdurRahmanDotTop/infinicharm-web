// ==============================================================================
// InfiniCharm — Server Storefront Badges & Guarantees Authority
// Governs dynamic badges on PDP: Free Shipping, Replacement Guarantee, Custom Badges
// Full Admin CRUD & Immediate Storefront Synchronization
// ==============================================================================

import fs from 'fs';
import path from 'path';
import type { StorefrontBadge } from '../../types/index.ts';

function getBadgesFilePath(): string {
  const primary = path.join(process.cwd(), 'src', 'data', 'storefront_badges.json');
  if (fs.existsSync(primary)) return primary;
  const alt = path.join(process.cwd(), 'data', 'storefront_badges.json');
  if (fs.existsSync(alt)) return alt;
  return primary;
}

const DEFAULT_BADGES: StorefrontBadge[] = [
  {
    id: 'badge-free-shipping',
    key: 'free_shipping',
    title: 'Free Shipping on orders above ₹4,999',
    subtitle: 'Pan-India direct harvest dispatch',
    icon: 'Truck',
    isEnabled: true,
    displayOrder: 1,
    thresholdRupees: 4999,
    conditionsText: 'Applicable on orders above ₹4,999 across all pincodes in India.',
    linkUrl: '/policies/shipping',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'badge-replacement-guarantee',
    key: 'replacement_guarantee',
    title: 'Transit Damage Replacement Guarantee',
    subtitle: '100% replacement for broken seals or damage',
    icon: 'RotateCcw',
    isEnabled: true,
    displayOrder: 2,
    conditionsText: 'Report transit damage within 48 hours for immediate replacement.',
    linkUrl: '/policies/refunds',
    updatedAt: new Date().toISOString(),
  },
];

export function getStorefrontBadges(activeOnly = false): StorefrontBadge[] {
  try {
    const filePath = getBadgesFilePath();
    if (!fs.existsSync(filePath)) {
      writeBadgesToFile(DEFAULT_BADGES);
      return activeOnly ? DEFAULT_BADGES.filter((b) => b.isEnabled) : DEFAULT_BADGES;
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed: StorefrontBadge[] = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const sorted = [...parsed].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    if (activeOnly) {
      return sorted.filter((b) => b.isEnabled !== false);
    }
    return sorted;
  } catch (error) {
    console.error('Failed reading storefront_badges.json:', error);
    return [];
  }
}

export function getStorefrontBadgeById(id: string): StorefrontBadge | null {
  const badges = getStorefrontBadges();
  return badges.find((b) => b.id === id || b.key === id) || null;
}

function writeBadgesToFile(badges: StorefrontBadge[]): boolean {
  try {
    const filePath = getBadgesFilePath();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(badges, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Failed writing storefront_badges.json:', error);
    return false;
  }
}

export function createStorefrontBadge(
  data: Partial<StorefrontBadge>
): { success: boolean; badge?: StorefrontBadge; error?: string } {
  try {
    const title = data.title?.trim();
    if (!title) {
      return { success: false, error: 'Badge title is required.' };
    }

    const badges = getStorefrontBadges();
    const id = data.id?.trim() || `badge-${Date.now()}`;
    const key = data.key?.trim() || id;

    if (badges.some((b) => b.id === id)) {
      return { success: false, error: `Badge with ID "${id}" already exists.` };
    }

    const newBadge: StorefrontBadge = {
      id,
      key,
      title,
      subtitle: data.subtitle?.trim() || undefined,
      icon: data.icon || 'ShieldCheck',
      isEnabled: data.isEnabled !== false,
      displayOrder: typeof data.displayOrder === 'number' ? data.displayOrder : badges.length + 1,
      thresholdRupees: typeof data.thresholdRupees === 'number' ? data.thresholdRupees : undefined,
      conditionsText: data.conditionsText?.trim() || undefined,
      linkUrl: data.linkUrl?.trim() || undefined,
      badgeColor: data.badgeColor || '#FF7759',
      updatedAt: new Date().toISOString(),
    };

    badges.push(newBadge);
    writeBadgesToFile(badges);

    return { success: true, badge: newBadge };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to create badge.' };
  }
}

export function updateStorefrontBadge(
  id: string,
  updates: Partial<StorefrontBadge>
): { success: boolean; badge?: StorefrontBadge; error?: string } {
  try {
    const badges = getStorefrontBadges();
    const idx = badges.findIndex((b) => b.id === id);
    if (idx < 0) {
      return { success: false, error: `Badge "${id}" not found.` };
    }

    const updated: StorefrontBadge = {
      ...badges[idx],
      ...updates,
      id, // protect ID
      updatedAt: new Date().toISOString(),
    };

    badges[idx] = updated;
    writeBadgesToFile(badges);

    return { success: true, badge: updated };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update badge.' };
  }
}

export function toggleStorefrontBadge(
  id: string,
  isEnabled?: boolean
): { success: boolean; badge?: StorefrontBadge; error?: string } {
  const badge = getStorefrontBadgeById(id);
  if (!badge) {
    return { success: false, error: `Badge "${id}" not found.` };
  }
  const nextEnabled = typeof isEnabled === 'boolean' ? isEnabled : !badge.isEnabled;
  return updateStorefrontBadge(id, { isEnabled: nextEnabled });
}

export function deleteStorefrontBadge(id: string): { success: boolean; error?: string } {
  try {
    const badges = getStorefrontBadges();
    const filtered = badges.filter((b) => b.id !== id);
    if (filtered.length === badges.length) {
      return { success: false, error: `Badge "${id}" not found.` };
    }
    writeBadgesToFile(filtered);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to delete badge.' };
  }
}

export function reorderStorefrontBadges(orderedIds: string[]): { success: boolean; badges?: StorefrontBadge[] } {
  try {
    const badges = getStorefrontBadges();
    const updated = badges.map((badge) => {
      const pos = orderedIds.indexOf(badge.id);
      return {
        ...badge,
        displayOrder: pos >= 0 ? pos + 1 : badge.displayOrder,
      };
    });
    updated.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    writeBadgesToFile(updated);
    return { success: true, badges: updated };
  } catch (err: any) {
    return { success: false };
  }
}
