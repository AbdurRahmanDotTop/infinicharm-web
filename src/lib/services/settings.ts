// ==============================================================================
// InfiniCharm — Centralized Platform Settings & Dynamic Financial Rules Service
// Governing PRDs: PRD 01, PRD 07, PRD 08, PRD 12
// Standard: Integer Paise authority, Single-Owner direct dispatch settings
// ==============================================================================

import { BRAND } from '@/lib/constants/brand';

export interface DynamicPlatformSettings {
  freeShippingThresholdPaise: number;
  standardShippingFeePaise: number;
  expressShippingFeePaise: number;
  codConvenienceFeePaise: number;
  fssaiLicenseNumber: string;
  gstin: string;
  supportEmail: string;
  supportPhone: string;
  registeredOfficeAddress: string;
  tawkPropertyId: string;
  tawkWidgetId: string;
  updatedAt: string;
}

export const DEFAULT_PLATFORM_SETTINGS: DynamicPlatformSettings = {
  freeShippingThresholdPaise: 49900, // ₹499.00
  standardShippingFeePaise: 5000,    // ₹50.00
  expressShippingFeePaise: 12000,   // ₹120.00
  codConvenienceFeePaise: 0,        // Free COD
  fssaiLicenseNumber: '10423000001234',
  gstin: '10AAAAA0000A1Z5',
  supportEmail: BRAND.contact.supportEmail,
  supportPhone: '+91 98765 43210',
  registeredOfficeAddress: BRAND.contact.address.fullAddress,
  tawkPropertyId: '6ae76c24e068a73c41821c1f',
  tawkWidgetId: '1k6bvsse1',
  updatedAt: new Date().toISOString(),
};

const STORAGE_KEY_SETTINGS = 'infinicharm_platform_settings';

/**
 * Retrieve active platform settings.
 */
export function getPlatformSettings(): DynamicPlatformSettings {
  if (typeof window === 'undefined') return DEFAULT_PLATFORM_SETTINGS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (!stored) {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(DEFAULT_PLATFORM_SETTINGS));
      return DEFAULT_PLATFORM_SETTINGS;
    }
    return { ...DEFAULT_PLATFORM_SETTINGS, ...JSON.parse(stored) };
  } catch {
    return DEFAULT_PLATFORM_SETTINGS;
  }
}

/**
 * Update and persist platform settings.
 */
export function updatePlatformSettings(partial: Partial<DynamicPlatformSettings>): DynamicPlatformSettings {
  if (typeof window === 'undefined') return DEFAULT_PLATFORM_SETTINGS;
  try {
    const current = getPlatformSettings();
    const updated: DynamicPlatformSettings = {
      ...current,
      ...partial,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(updated));
    return updated;
  } catch {
    return DEFAULT_PLATFORM_SETTINGS;
  }
}
