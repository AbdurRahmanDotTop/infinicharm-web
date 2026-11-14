// ==============================================================================
// InfiniCharm — Announcement Bar Server Store & Authority
// Standards: 100% Real Data, Admin Full CRUD, Persistent JSON Store
// ==============================================================================

import fs from 'fs';
import path from 'path';

export interface AnnouncementItem {
  id: string;
  type: 'delivery' | 'coupon' | 'support' | 'track_order' | 'custom_link' | 'text';
  text: string;
  subtext?: string;
  icon?: string; // 'truck' | 'tag' | 'headphones' | 'compass' | 'bell' | 'sparkles'
  href?: string;
  isClickable: boolean;
  openInNewTab?: boolean;
  deliveryThresholdInRupees?: number;
  couponCode?: string;
  discountPercent?: number;
  supportEmail?: string;
  position: 'left' | 'right';
  displayOrder: number;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AnnouncementConfig {
  isMasterEnabled: boolean;
  items: AnnouncementItem[];
}

const FILE_PATH = path.join(
  process.cwd(),
  'src',
  'data',
  'announcements.json'
);

const DEFAULT_CONFIG: AnnouncementConfig = {
  isMasterEnabled: true,
  items: [
    {
      id: 'ann-delivery-01',
      type: 'delivery',
      text: 'Free Express Delivery over ₹499',
      deliveryThresholdInRupees: 499,
      icon: 'truck',
      href: '/shop',
      isClickable: true,
      position: 'left',
      displayOrder: 1,
      isEnabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'ann-care-01',
      type: 'support',
      text: '24/7 Care: support@infinicharm.com',
      supportEmail: 'support@infinicharm.com',
      icon: 'headphones',
      href: 'mailto:support@infinicharm.com',
      isClickable: true,
      position: 'right',
      displayOrder: 3,
      isEnabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'ann-track-01',
      type: 'track_order',
      text: 'Track Order',
      icon: 'compass',
      href: '/track-order',
      isClickable: true,
      position: 'right',
      displayOrder: 4,
      isEnabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
};

function ensureDir(p: string) {
  const d = path.dirname(p);
  if (!fs.existsSync(d)) {
    fs.mkdirSync(d, { recursive: true });
  }
}

export function getAnnouncementConfig(): AnnouncementConfig {
  try {
    if (!fs.existsSync(FILE_PATH)) {
      ensureDir(FILE_PATH);
      fs.writeFileSync(FILE_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf8');
      return DEFAULT_CONFIG;
    }
    const raw = fs.readFileSync(FILE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      isMasterEnabled: parsed.isMasterEnabled !== false,
      items: Array.isArray(parsed.items) ? parsed.items : [],
    };
  } catch (err) {
    console.error('Failed reading announcements.json:', err);
    return DEFAULT_CONFIG;
  }
}

export function saveAnnouncementConfig(config: AnnouncementConfig): boolean {
  try {
    ensureDir(FILE_PATH);
    fs.writeFileSync(FILE_PATH, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Failed saving announcements.json:', err);
    return false;
  }
}

export function getActiveAnnouncements(): {
  isMasterEnabled: boolean;
  items: AnnouncementItem[];
  leftItems: AnnouncementItem[];
  rightItems: AnnouncementItem[];
} {
  const config = getAnnouncementConfig();
  if (!config.isMasterEnabled) {
    return {
      isMasterEnabled: false,
      items: [],
      leftItems: [],
      rightItems: [],
    };
  }

  const activeItems = config.items
    .filter((i) => i.isEnabled)
    .sort((a, b) => a.displayOrder - b.displayOrder);

  return {
    isMasterEnabled: true,
    items: activeItems,
    leftItems: activeItems.filter((i) => i.position === 'left'),
    rightItems: activeItems.filter((i) => i.position === 'right'),
  };
}

export function createAnnouncementItem(payload: Partial<AnnouncementItem>): AnnouncementItem {
  const config = getAnnouncementConfig();
  const now = new Date().toISOString();

  let text = payload.text?.trim() || 'New Announcement';
  let href = payload.href?.trim() || undefined;

  // Format automatic text based on type if specific parameters provided
  if (payload.type === 'delivery' && payload.deliveryThresholdInRupees) {
    text = payload.text || `Free Express Delivery over ₹${payload.deliveryThresholdInRupees}`;
    href = href || '/shop';
  } else if (payload.type === 'coupon' && payload.couponCode) {
    const disc = payload.discountPercent ? `${payload.discountPercent}% Off` : 'Special Discount';
    text = payload.text || `Use Code '${payload.couponCode}' for ${disc}`;
    href = href || '/deals';
  } else if (payload.type === 'support' && payload.supportEmail) {
    text = payload.text || `24/7 Care: ${payload.supportEmail}`;
    href = `mailto:${payload.supportEmail}`;
  } else if (payload.type === 'track_order') {
    text = payload.text || 'Track Order';
    href = '/track-order';
  }

  const newItem: AnnouncementItem = {
    id: `ann-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    type: payload.type || 'text',
    text,
    subtext: payload.subtext?.trim() || undefined,
    icon: payload.icon || (payload.type === 'delivery' ? 'truck' : payload.type === 'coupon' ? 'tag' : payload.type === 'support' ? 'headphones' : payload.type === 'track_order' ? 'compass' : undefined),
    href,
    isClickable: payload.isClickable !== false && Boolean(href),
    openInNewTab: Boolean(payload.openInNewTab),
    deliveryThresholdInRupees: payload.deliveryThresholdInRupees,
    couponCode: payload.couponCode?.trim(),
    discountPercent: payload.discountPercent,
    supportEmail: payload.supportEmail?.trim(),
    position: payload.position || 'left',
    displayOrder: payload.displayOrder ?? config.items.length + 1,
    isEnabled: payload.isEnabled !== false,
    createdAt: now,
    updatedAt: now,
  };

  config.items.push(newItem);
  saveAnnouncementConfig(config);
  return newItem;
}

export function updateAnnouncementItem(
  id: string,
  payload: Partial<AnnouncementItem>
): AnnouncementItem | null {
  const config = getAnnouncementConfig();
  const idx = config.items.findIndex((i) => i.id === id);
  if (idx === -1) return null;

  const current = config.items[idx];
  const now = new Date().toISOString();

  let text = payload.text !== undefined ? payload.text.trim() : current.text;
  let href = payload.href !== undefined ? payload.href.trim() : current.href;

  const nextType = payload.type || current.type;
  if (nextType === 'support' && payload.supportEmail) {
    href = `mailto:${payload.supportEmail.trim()}`;
  }

  const updated: AnnouncementItem = {
    ...current,
    ...payload,
    text,
    href,
    updatedAt: now,
  };

  config.items[idx] = updated;
  saveAnnouncementConfig(config);
  return updated;
}

export function deleteAnnouncementItem(id: string): boolean {
  const config = getAnnouncementConfig();
  const prevLen = config.items.length;
  config.items = config.items.filter((i) => i.id !== id);
  if (config.items.length === prevLen) return false;
  saveAnnouncementConfig(config);
  return true;
}

export function setMasterAnnouncementBar(enabled: boolean): boolean {
  const config = getAnnouncementConfig();
  config.isMasterEnabled = enabled;
  return saveAnnouncementConfig(config);
}

export function reorderAnnouncements(orderedIds: string[]): AnnouncementItem[] {
  const config = getAnnouncementConfig();
  const idMap = new Map(orderedIds.map((id, index) => [id, index + 1]));

  config.items = config.items.map((item) => {
    if (idMap.has(item.id)) {
      return { ...item, displayOrder: idMap.get(item.id)! };
    }
    return item;
  });

  config.items.sort((a, b) => a.displayOrder - b.displayOrder);
  saveAnnouncementConfig(config);
  return config.items;
}

