import fs from 'fs';
import path from 'path';
import type { ContactSettings } from '@/types';

const CONTACT_SETTINGS_PATH = path.join(process.cwd(), 'src', 'data', 'contact_settings.json');

export const DEFAULT_CONTACT_SETTINGS: ContactSettings = {
  pageTitle: 'We Are Here to Assist You',
  badge: 'Customer Care & Support',
  pageDescription:
    'Have a question about product origins, packaging, or an existing order? Get in touch with our team.',
  primaryPhone: '+91 8825164657',
  displayPhone: '+91 8825164657',
  phoneHours: 'Monday to Saturday: 9:00 AM – 7:00 PM IST',
  supportEmail: 'support@infinicharm.com',
  inquiryEmail: 'support@infinicharm.com',
  registeredOffice:
    'Ward No. 07, Lahsaniya, Khoripakar, Dewapur, Pachpakari, Patahi, Dhaka, Motihari, East Champaran, Bihar, India - 845427',
  fulfillmentCenter:
    'InfiniCharm Heritage Sourcing & Fulfillment Hub, East Champaran, Bihar - 845427',
  operatingHours: 'Monday to Saturday: 9:00 AM – 7:00 PM IST',
  grievanceOfficer: {
    name: 'AbdurRahman Ibn Ghufran',
    designation: 'Founder & CEO',
    email: 'support@infinicharm.com',
    phone: '+91 8825164657',
    responseTime: 'Complaints acknowledged within 48 hours.',
  },
  sectionsVisibility: {
    showPhone: true,
    showEmail: true,
    showOffice: true,
    showOperatingHours: true,
    showGrievanceOfficer: true,
    showInquiryForm: true,
  },
};

export function getContactSettings(): ContactSettings {
  try {
    if (fs.existsSync(CONTACT_SETTINGS_PATH)) {
      const raw = fs.readFileSync(CONTACT_SETTINGS_PATH, 'utf-8');
      return { ...DEFAULT_CONTACT_SETTINGS, ...JSON.parse(raw) };
    }
  } catch (err) {
    console.error('Failed to read contact settings:', err);
  }
  return DEFAULT_CONTACT_SETTINGS;
}

export function saveContactSettings(
  updated: Partial<ContactSettings>,
  updatedBy = 'admin@infinicharm.com'
): ContactSettings {
  const current = getContactSettings();
  const merged: ContactSettings = {
    ...current,
    ...updated,
    grievanceOfficer: {
      ...current.grievanceOfficer,
      ...(updated.grievanceOfficer || {}),
    },
    sectionsVisibility: {
      ...current.sectionsVisibility,
      ...(updated.sectionsVisibility || {}),
    },
    updatedAt: new Date().toISOString(),
    updatedBy,
  };

  try {
    const dir = path.dirname(CONTACT_SETTINGS_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CONTACT_SETTINGS_PATH, JSON.stringify(merged, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write contact settings:', err);
  }

  return merged;
}
