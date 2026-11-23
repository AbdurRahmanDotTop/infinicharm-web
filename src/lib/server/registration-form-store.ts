import fs from 'fs';
import path from 'path';
import type { RegistrationFormField, RegistrationFormSettings } from '../../types/index.ts';

const SETTINGS_PATH = path.join(process.cwd(), 'src', 'data', 'registration_form_settings.json');

const DEFAULT_SETTINGS: RegistrationFormSettings = {
  title: 'Create Your Account',
  subtitle: 'Join the InfiniCharm Circle for pure batch living, expedited checkout, and tracking.',
  submitButtonText: 'Create InfiniCharm Account',
  termsAgreementRequired: true,
  termsText: 'I agree to the Terms of Service and acknowledge the Privacy Policy (DPDP Act).',
  termsLink: '/policies/terms',
  privacyLink: '/policies/privacy',
  fields: [
    {
      id: 'field-fullname',
      key: 'fullName',
      label: 'Full Name',
      type: 'text',
      placeholder: 'AbdurRahman Ibn Ghufran',
      description: 'Your official legal or personal name for parcel delivery',
      required: true,
      isEnabled: true,
      order: 1,
      section: 'personal',
      isSystemField: true,
      validation: { minLength: 2, maxLength: 100 },
    },
    {
      id: 'field-email',
      key: 'email',
      label: 'Email Address',
      type: 'email',
      placeholder: 'abdurrahman@infinicharm.com',
      description: 'Your primary account identifier and dispatch notification channel',
      required: true,
      isEnabled: true,
      order: 2,
      section: 'account',
      isSystemField: true,
      validation: { minLength: 5, maxLength: 120 },
    },
    {
      id: 'field-phone',
      key: 'phone',
      label: 'Mobile Phone (Optional)',
      type: 'phone',
      placeholder: '+91 8825164657',
      description: 'Used for courier SMS and WhatsApp delivery tracking notifications',
      required: false,
      isEnabled: true,
      order: 3,
      section: 'personal',
      isSystemField: false,
      validation: { pattern: '^[+0-9\\s-]{10,15}$' },
    },
    {
      id: 'field-password',
      key: 'password',
      label: 'Password',
      type: 'password',
      placeholder: 'Create a strong password',
      description: 'Must be at least 8 characters with letters, numbers, and symbols',
      required: true,
      isEnabled: true,
      order: 4,
      section: 'account',
      isSystemField: true,
      validation: { minLength: 8, maxLength: 128 },
    },
    {
      id: 'field-confirm-password',
      key: 'confirmPassword',
      label: 'Confirm Password',
      type: 'password',
      placeholder: 'Re-enter your password',
      description: 'Confirm your password to ensure accurate typing',
      required: true,
      isEnabled: true,
      order: 5,
      section: 'account',
      isSystemField: true,
      validation: { minLength: 8, maxLength: 128 },
    },
    {
      id: 'field-hear-about-us',
      key: 'hearAboutUs',
      label: 'How Did You Discover InfiniCharm?',
      type: 'select',
      placeholder: 'Select an option',
      description: 'Helps us improve our craft and artisan reach across India',
      required: false,
      isEnabled: true,
      order: 6,
      section: 'additional',
      isSystemField: false,
      options: [
        { label: 'Google Search / Organic', value: 'google' },
        { label: 'Instagram / Social Media', value: 'instagram' },
        { label: 'Word of Mouth / Recommendation', value: 'referral' },
        { label: 'YouTube / Reviews', value: 'youtube' },
        { label: 'Press / News Feature', value: 'press' },
        { label: 'Other', value: 'other' },
      ],
    },
  ],
  updatedAt: new Date().toISOString(),
};

export function getRegistrationFormSettings(): RegistrationFormSettings {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const content = fs.readFileSync(SETTINGS_PATH, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed && Array.isArray(parsed.fields)) {
        return parsed as RegistrationFormSettings;
      }
    }
  } catch (err) {
    console.error('[registration-form-store] Error reading settings:', err);
  }
  return DEFAULT_SETTINGS;
}

export function getPublicRegistrationFormSettings(): RegistrationFormSettings {
  const full = getRegistrationFormSettings();
  const enabledFields = full.fields
    .filter((f) => f.isEnabled)
    .sort((a, b) => a.order - b.order);

  return {
    ...full,
    fields: enabledFields,
  };
}

export function saveRegistrationFormSettings(settings: RegistrationFormSettings): boolean {
  try {
    const dir = path.dirname(SETTINGS_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Validate and sanitize fields
    const sanitizedFields: RegistrationFormField[] = settings.fields.map((f, idx) => ({
      ...f,
      id: f.id || `field-${Date.now()}-${idx}`,
      order: typeof f.order === 'number' ? f.order : idx + 1,
      isEnabled: Boolean(f.isEnabled),
      required: Boolean(f.required),
    }));

    const toSave: RegistrationFormSettings = {
      ...settings,
      fields: sanitizedFields,
      updatedAt: new Date().toISOString(),
    };

    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(toSave, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('[registration-form-store] Error saving settings:', err);
    return false;
  }
}

export function addRegistrationFormField(field: Omit<RegistrationFormField, 'id' | 'order'> & { order?: number }): {
  success: boolean;
  field?: RegistrationFormField;
  error?: string;
} {
  const current = getRegistrationFormSettings();
  const cleanKey = field.key.trim().replace(/[^a-zA-Z0-9_]/g, '');

  if (!cleanKey) {
    return { success: false, error: 'Field key is required and must be alphanumeric.' };
  }

  if (current.fields.some((f) => f.key.toLowerCase() === cleanKey.toLowerCase())) {
    return { success: false, error: `A field with key "${cleanKey}" already exists.` };
  }

  const maxOrder = current.fields.reduce((max, f) => Math.max(max, f.order || 0), 0);
  const newField: RegistrationFormField = {
    ...field,
    id: `field-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    key: cleanKey,
    order: field.order || maxOrder + 1,
    isEnabled: field.isEnabled !== false,
    required: Boolean(field.required),
    isSystemField: false,
  };

  current.fields.push(newField);
  const ok = saveRegistrationFormSettings(current);
  if (!ok) return { success: false, error: 'Failed to write updated settings.' };

  return { success: true, field: newField };
}

export function updateRegistrationFormField(
  key: string,
  updates: Partial<RegistrationFormField>
): { success: boolean; field?: RegistrationFormField; error?: string } {
  const current = getRegistrationFormSettings();
  const targetIndex = current.fields.findIndex((f) => f.key.toLowerCase() === key.toLowerCase());

  if (targetIndex === -1) {
    return { success: false, error: `Field with key "${key}" not found.` };
  }

  const existing = current.fields[targetIndex];

  // If system field, prevent altering system properties
  if (existing.isSystemField) {
    if (updates.key && updates.key !== existing.key) {
      return { success: false, error: 'System field key cannot be modified.' };
    }
    if (updates.type && updates.type !== existing.type) {
      return { success: false, error: 'System field type cannot be modified.' };
    }
    // fullName, email, password, confirmPassword are permanently required
    if (['fullName', 'email', 'password', 'confirmPassword'].includes(existing.key) && updates.required === false) {
      return { success: false, error: 'This system field is mandatory for account security.' };
    }
  }

  const updatedField: RegistrationFormField = {
    ...existing,
    ...updates,
    key: existing.key, // retain canonical key
    isSystemField: existing.isSystemField,
  };

  current.fields[targetIndex] = updatedField;
  const ok = saveRegistrationFormSettings(current);
  if (!ok) return { success: false, error: 'Failed to save field updates.' };

  return { success: true, field: updatedField };
}

export function deleteRegistrationFormField(key: string): { success: boolean; error?: string } {
  const current = getRegistrationFormSettings();
  const target = current.fields.find((f) => f.key.toLowerCase() === key.toLowerCase());

  if (!target) {
    return { success: false, error: `Field with key "${key}" not found.` };
  }

  if (target.isSystemField) {
    return { success: false, error: 'System critical fields cannot be deleted.' };
  }

  current.fields = current.fields.filter((f) => f.key.toLowerCase() !== key.toLowerCase());
  // Normalize ordering
  current.fields.forEach((f, idx) => {
    f.order = idx + 1;
  });

  const ok = saveRegistrationFormSettings(current);
  if (!ok) return { success: false, error: 'Failed to remove field.' };

  return { success: true };
}

export function reorderRegistrationFormFields(keys: string[]): {
  success: boolean;
  fields?: RegistrationFormField[];
  error?: string;
} {
  const current = getRegistrationFormSettings();
  const fieldMap = new Map(current.fields.map((f) => [f.key, f]));

  const newFields: RegistrationFormField[] = [];
  keys.forEach((k, idx) => {
    const f = fieldMap.get(k);
    if (f) {
      newFields.push({ ...f, order: idx + 1 });
      fieldMap.delete(k);
    }
  });

  // Append any fields not mentioned in keys at the end
  fieldMap.forEach((f) => {
    newFields.push({ ...f, order: newFields.length + 1 });
  });

  current.fields = newFields;
  const ok = saveRegistrationFormSettings(current);
  if (!ok) return { success: false, error: 'Failed to save reordered fields.' };

  return { success: true, fields: newFields };
}
