// ==============================================================================
// InfiniCharm — Centralized Shipping & Delivery Settings Server Store
// Single Source of Truth for Free Shipping Thresholds, Fees & Delivery Rules
// Integer Paise Authority: 1 INR = 100 Paise
// ==============================================================================

import fs from 'fs';
import path from 'path';

export interface ShippingSettings {
  freeShippingEnabled: boolean;
  freeShippingThresholdPaise: number;
  freeShippingThresholdRupees: number;
  standardShippingFeePaise: number;
  standardShippingFeeRupees: number;
  expressShippingFeePaise: number;
  expressShippingFeeRupees: number;
  codConvenienceFeePaise: number;
  bannerMessage: string;
  policyText: string;
  updatedAt: string;
}

export const DEFAULT_SHIPPING_SETTINGS: ShippingSettings = {
  freeShippingEnabled: true,
  freeShippingThresholdPaise: 499900,
  freeShippingThresholdRupees: 4999,
  standardShippingFeePaise: 6000,
  standardShippingFeeRupees: 60,
  expressShippingFeePaise: 15000,
  expressShippingFeeRupees: 150,
  codConvenienceFeePaise: 0,
  bannerMessage: 'Free Express Delivery over ₹4,999',
  policyText:
    'Orders with a qualifying subtotal of ₹4,999 or higher automatically receive Free Standard Shipping across India.',
  updatedAt: '2026-11-14T08:00:00.000Z',
};

function getShippingSettingsFilePath(): string {
  const primary = path.join(process.cwd(), 'src', 'data', 'shipping_settings.json');
  if (fs.existsSync(primary)) return primary;
  const alt = path.join(process.cwd(), 'data', 'shipping_settings.json');
  if (fs.existsSync(alt)) return alt;
  return primary;
}

export function getShippingSettings(): ShippingSettings {
  try {
    const filePath = getShippingSettingsFilePath();
    if (!fs.existsSync(filePath)) {
      writeShippingSettingsToFile(DEFAULT_SHIPPING_SETTINGS);
      return DEFAULT_SHIPPING_SETTINGS;
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SHIPPING_SETTINGS,
      ...parsed,
    };
  } catch (err) {
    console.warn('[shipping-store] Falling back to default shipping settings:', err);
    return DEFAULT_SHIPPING_SETTINGS;
  }
}

export function updateShippingSettings(
  partial: Partial<ShippingSettings>
): { success: boolean; settings: ShippingSettings; error?: string } {
  try {
    const current = getShippingSettings();
    const thresholdRupees =
      typeof partial.freeShippingThresholdRupees === 'number'
        ? partial.freeShippingThresholdRupees
        : typeof partial.freeShippingThresholdPaise === 'number'
        ? Math.round(partial.freeShippingThresholdPaise / 100)
        : current.freeShippingThresholdRupees;

    const thresholdPaise =
      typeof partial.freeShippingThresholdPaise === 'number'
        ? partial.freeShippingThresholdPaise
        : thresholdRupees * 100;

    const standardFeeRupees =
      typeof partial.standardShippingFeeRupees === 'number'
        ? partial.standardShippingFeeRupees
        : typeof partial.standardShippingFeePaise === 'number'
        ? Math.round(partial.standardShippingFeePaise / 100)
        : current.standardShippingFeeRupees;

    const standardFeePaise =
      typeof partial.standardShippingFeePaise === 'number'
        ? partial.standardShippingFeePaise
        : standardFeeRupees * 100;

    const expressFeeRupees =
      typeof partial.expressShippingFeeRupees === 'number'
        ? partial.expressShippingFeeRupees
        : typeof partial.expressShippingFeePaise === 'number'
        ? Math.round(partial.expressShippingFeePaise / 100)
        : current.expressShippingFeeRupees;

    const expressFeePaise =
      typeof partial.expressShippingFeePaise === 'number'
        ? partial.expressShippingFeePaise
        : expressFeeRupees * 100;

    const updated: ShippingSettings = {
      ...current,
      ...partial,
      freeShippingThresholdRupees: thresholdRupees,
      freeShippingThresholdPaise: thresholdPaise,
      standardShippingFeeRupees: standardFeeRupees,
      standardShippingFeePaise: standardFeePaise,
      expressShippingFeeRupees: expressFeeRupees,
      expressShippingFeePaise: expressFeePaise,
      bannerMessage:
        partial.bannerMessage ||
        `Free Express Delivery over ₹${thresholdRupees.toLocaleString('en-IN')}`,
      policyText:
        partial.policyText ||
        `Orders with a qualifying subtotal of ₹${thresholdRupees.toLocaleString('en-IN')} or higher automatically receive Free Standard Shipping across India.`,
      updatedAt: new Date().toISOString(),
    };

    writeShippingSettingsToFile(updated);
    return { success: true, settings: updated };
  } catch (err: any) {
    return { success: false, settings: getShippingSettings(), error: err.message };
  }
}

function writeShippingSettingsToFile(settings: ShippingSettings): void {
  const filePath = getShippingSettingsFilePath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf8');
}
