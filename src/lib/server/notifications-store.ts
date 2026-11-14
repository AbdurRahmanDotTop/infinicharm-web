import fs from 'fs';
import path from 'path';
import type {
  GlobalNotificationPreferences,
  NotificationCategory,
  NotificationDeliveryLog,
  NotificationEventKey,
  NotificationEventRule,
} from '../../types/index.ts';

const PREFS_FILE_PATH = path.join(process.cwd(), 'src', 'data', 'notification_preferences.json');
const RULES_FILE_PATH = path.join(process.cwd(), 'src', 'data', 'notification_rules.json');
const LOGS_FILE_PATH = path.join(process.cwd(), 'src', 'data', 'notification_logs.json');
const MAX_NOTIFICATION_LOGS = 2000;

function ensureDirAndWrite(filePath: string, data: unknown): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tmp = `${filePath}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, filePath);
}

export function getDefaultGlobalPreferences(): GlobalNotificationPreferences {
  const adminFallback =
    process.env.INFINICHARM_ADMIN_EMAIL ||
    process.env.BREVO_DEFAULT_ADMIN_EMAIL ||
    'admin@infinicharm.com';
  return {
    notificationsEnabled: true,
    defaultAdminEmails: [adminFallback],
    supportReplyToEmail: process.env.BREVO_DEFAULT_SENDER_EMAIL || 'support@infinicharm.com',
    defaultVendorFallbackEmail: '',
    defaultSmtpConfigId: null,
    maxAutoRetries: 1,
    deduplicateOverlappingRecipients: true,
    updatedAt: new Date().toISOString(),
  };
}

export function getGlobalNotificationPreferences(
  filePath: string = PREFS_FILE_PATH
): GlobalNotificationPreferences {
  try {
    if (!fs.existsSync(filePath)) {
      const defaults = getDefaultGlobalPreferences();
      ensureDirAndWrite(filePath, defaults);
      return defaults;
    }
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return {
      ...getDefaultGlobalPreferences(),
      ...(parsed || {}),
      defaultAdminEmails: Array.isArray(parsed?.defaultAdminEmails)
        ? parsed.defaultAdminEmails.filter((e: unknown) => typeof e === 'string' && e.trim())
        : getDefaultGlobalPreferences().defaultAdminEmails,
    };
  } catch {
    return getDefaultGlobalPreferences();
  }
}

export function updateGlobalNotificationPreferences(
  updates: Partial<GlobalNotificationPreferences>,
  filePath: string = PREFS_FILE_PATH
): GlobalNotificationPreferences {
  const current = getGlobalNotificationPreferences(filePath);
  const next: GlobalNotificationPreferences = {
    ...current,
    ...updates,
    defaultAdminEmails: Array.isArray(updates.defaultAdminEmails)
      ? Array.from(new Set(updates.defaultAdminEmails.map((e) => e.trim().toLowerCase()).filter(Boolean)))
      : current.defaultAdminEmails,
    updatedAt: new Date().toISOString(),
  };
  ensureDirAndWrite(filePath, next);
  return next;
}

interface RuleSeedSpec {
  id: string;
  eventKey: NotificationEventKey;
  name: string;
  description: string;
  category: NotificationCategory;
  isEnabled?: boolean;
  sendToAdmin: boolean;
  sendToCustomer: boolean;
  sendToVendor: boolean;
  templateId: string;
  subjectOverride: string;
}

const DEFAULT_RULE_SPECS: RuleSeedSpec[] = [
  {
    id: 'rule-enquiry-submitted',
    eventKey: 'ENQUIRY_SUBMITTED',
    name: 'Customer Enquiry Submitted',
    description: 'Triggered when any visitor submits the contact or enquiry form.',
    category: 'ENQUIRY',
    sendToAdmin: true,
    sendToCustomer: true,
    sendToVendor: false,
    templateId: 'tpl-enquiry-admin-alert',
    subjectOverride: '[Enquiry {{inquiry_id}}] {{enquiry_subject}} — from {{customer_name}}',
  },
  {
    id: 'rule-enquiry-admin-reply',
    eventKey: 'ENQUIRY_ADMIN_REPLY',
    name: 'Admin Replied to Enquiry',
    description: 'Sends Admin response directly to the customer enquiry email.',
    category: 'ENQUIRY',
    sendToAdmin: false,
    sendToCustomer: true,
    sendToVendor: false,
    templateId: 'tpl-enquiry-admin-reply',
    subjectOverride: 'Re: {{enquiry_subject}} [Ref: {{inquiry_id}}] — InfiniCharm Care',
  },
  {
    id: 'rule-order-placed',
    eventKey: 'ORDER_PLACED',
    name: 'Order Placed',
    description: 'Triggered immediately when a new order is created at checkout.',
    category: 'ORDER',
    sendToAdmin: true,
    sendToCustomer: true,
    sendToVendor: false,
    templateId: 'tpl-order-placed',
    subjectOverride: 'Order Placed: {{order_number}} ({{order_total}})',
  },
  {
    id: 'rule-order-payment-approved',
    eventKey: 'ORDER_PAYMENT_APPROVED',
    name: 'Order Confirmed & Payment Approved',
    description: 'Triggered when UTR payment is verified or order payment confirms.',
    category: 'PAYMENT',
    sendToAdmin: false,
    sendToCustomer: true,
    sendToVendor: false,
    templateId: 'tpl-order-status-update',
    subjectOverride: 'Payment Confirmed — Order {{order_number}}',
  },
  {
    id: 'rule-order-payment-rejected',
    eventKey: 'ORDER_PAYMENT_REJECTED',
    name: 'Order Payment / UTR Rejected',
    description: 'Triggered when UTR verification fails or payment is rejected.',
    category: 'PAYMENT',
    sendToAdmin: true,
    sendToCustomer: true,
    sendToVendor: false,
    templateId: 'tpl-order-status-update',
    subjectOverride: 'Payment Action Needed — Order {{order_number}}',
  },
  {
    id: 'rule-order-processing',
    eventKey: 'ORDER_PROCESSING',
    name: 'Order Processing & Packed',
    description: 'Triggered when order status changes to PROCESSING, PACKED, or READY_FOR_DISPATCH.',
    category: 'ORDER',
    sendToAdmin: false,
    sendToCustomer: true,
    sendToVendor: false,
    templateId: 'tpl-order-status-update',
    subjectOverride: 'Your Order {{order_number}} is Being Prepared',
  },
  {
    id: 'rule-order-shipped',
    eventKey: 'ORDER_SHIPPED',
    name: 'Order Shipped & AWB Assigned',
    description: 'Triggered when courier tracking is assigned or status moves to SHIPPED.',
    category: 'ORDER',
    sendToAdmin: false,
    sendToCustomer: true,
    sendToVendor: false,
    templateId: 'tpl-order-shipped',
    subjectOverride: 'Shipped: Order {{order_number}} via {{courier_name}}',
  },
  {
    id: 'rule-order-out-for-delivery',
    eventKey: 'ORDER_OUT_FOR_DELIVERY',
    name: 'Order Out for Delivery',
    description: 'Triggered when courier dispatch status reaches OUT_FOR_DELIVERY.',
    category: 'ORDER',
    sendToAdmin: false,
    sendToCustomer: true,
    sendToVendor: false,
    templateId: 'tpl-order-status-update',
    subjectOverride: 'Out for Delivery Today — Order {{order_number}}',
  },
  {
    id: 'rule-order-delivered',
    eventKey: 'ORDER_DELIVERED',
    name: 'Order Delivered',
    description: 'Triggered when consignment delivery is confirmed.',
    category: 'ORDER',
    sendToAdmin: false,
    sendToCustomer: true,
    sendToVendor: false,
    templateId: 'tpl-order-status-update',
    subjectOverride: 'Delivered: Your InfiniCharm Order {{order_number}}',
  },
  {
    id: 'rule-order-cancelled',
    eventKey: 'ORDER_CANCELLED',
    name: 'Order Cancelled / RTO',
    description: 'Triggered when an order is cancelled or returned to origin.',
    category: 'ORDER',
    sendToAdmin: true,
    sendToCustomer: true,
    sendToVendor: false,
    templateId: 'tpl-order-status-update',
    subjectOverride: 'Order Update ({{order_status}}): {{order_number}}',
  },
  {
    id: 'rule-order-return-requested',
    eventKey: 'ORDER_RETURN_REQUESTED',
    name: 'Order Return Requested',
    description: 'Triggered when a return request is logged for an order.',
    category: 'ORDER',
    sendToAdmin: true,
    sendToCustomer: true,
    sendToVendor: false,
    templateId: 'tpl-order-status-update',
    subjectOverride: 'Return Request Received — Order {{order_number}}',
  },
  {
    id: 'rule-order-return-approved',
    eventKey: 'ORDER_RETURN_APPROVED',
    name: 'Return Approved / Completed',
    description: 'Triggered when order status becomes RETURN_APPROVED or RETURNED.',
    category: 'ORDER',
    sendToAdmin: false,
    sendToCustomer: true,
    sendToVendor: false,
    templateId: 'tpl-order-status-update',
    subjectOverride: 'Return Update ({{order_status}}) — Order {{order_number}}',
  },
  {
    id: 'rule-order-refunded',
    eventKey: 'ORDER_REFUNDED',
    name: 'Refund Processed',
    description: 'Triggered when a refund is marked completed on an order.',
    category: 'PAYMENT',
    sendToAdmin: true,
    sendToCustomer: true,
    sendToVendor: false,
    templateId: 'tpl-order-status-update',
    subjectOverride: 'Refund Processed for Order {{order_number}} ({{order_total}})',
  },
  {
    id: 'rule-customer-registered',
    eventKey: 'CUSTOMER_REGISTERED',
    name: 'Customer Account Registration',
    description: 'Triggered when a new customer creates an account.',
    category: 'ACCOUNT',
    sendToAdmin: true,
    sendToCustomer: true,
    sendToVendor: false,
    templateId: 'tpl-account-welcome',
    subjectOverride: 'Welcome to InfiniCharm, {{customer_name}}!',
  },
  {
    id: 'rule-customer-email-verification',
    eventKey: 'CUSTOMER_EMAIL_VERIFICATION',
    name: 'Account Email Verification',
    description: 'Triggered when a customer account verification code is dispatched.',
    category: 'ACCOUNT',
    sendToAdmin: false,
    sendToCustomer: true,
    sendToVendor: false,
    templateId: 'tpl-password-reset-otp',
    subjectOverride: 'Verify Your InfiniCharm Email ({{otp_code}})',
  },
  {
    id: 'rule-password-reset-otp',
    eventKey: 'PASSWORD_RESET_OTP',
    name: 'Password Reset Recovery Code',
    description: 'Triggered when a user requests password recovery on /forgot-password.',
    category: 'ACCOUNT',
    sendToAdmin: false,
    sendToCustomer: true,
    sendToVendor: false,
    templateId: 'tpl-password-reset-otp',
    subjectOverride: 'InfiniCharm Password Recovery Code: {{otp_code}}',
  },
  {
    id: 'rule-password-changed',
    eventKey: 'PASSWORD_CHANGED',
    name: 'Password Updated Alert',
    description: 'Security notification when customer password is updated or reset.',
    category: 'ACCOUNT',
    sendToAdmin: false,
    sendToCustomer: true,
    sendToVendor: false,
    templateId: 'tpl-account-activity',
    subjectOverride: 'Security Notice: Your InfiniCharm Password Was Updated',
  },
  {
    id: 'rule-customer-profile-updated',
    eventKey: 'CUSTOMER_PROFILE_UPDATED',
    name: 'Customer Profile Updated',
    description: 'Triggered when customer account profile details are saved.',
    category: 'ACCOUNT',
    sendToAdmin: false,
    sendToCustomer: true,
    sendToVendor: false,
    templateId: 'tpl-account-activity',
    subjectOverride: 'Profile Updated — InfiniCharm Account',
  },
  {
    id: 'rule-customer-address-updated',
    eventKey: 'CUSTOMER_ADDRESS_UPDATED',
    name: 'Delivery Address Book Updated',
    description: 'Triggered when a customer adds, edits, or removes a saved address.',
    category: 'ACCOUNT',
    sendToAdmin: false,
    sendToCustomer: true,
    sendToVendor: false,
    templateId: 'tpl-account-activity',
    subjectOverride: 'Address Book Updated — InfiniCharm',
  },
  {
    id: 'rule-customer-status-changed',
    eventKey: 'CUSTOMER_STATUS_CHANGED',
    name: 'Customer Account Status Changed',
    description: 'Triggered when admin activates or suspends a customer account.',
    category: 'ACCOUNT',
    sendToAdmin: true,
    sendToCustomer: true,
    sendToVendor: false,
    templateId: 'tpl-account-activity',
    subjectOverride: 'InfiniCharm Account Status Notice',
  },
  {
    id: 'rule-customer-account-deleted',
    eventKey: 'CUSTOMER_ACCOUNT_DELETED',
    name: 'Customer Account Deleted',
    description: 'Triggered when admin permanently deletes a customer account.',
    category: 'ACCOUNT',
    sendToAdmin: true,
    sendToCustomer: true,
    sendToVendor: false,
    templateId: 'tpl-account-activity',
    subjectOverride: 'Account Removal Confirmation — InfiniCharm',
  },
  {
    id: 'rule-review-submitted',
    eventKey: 'REVIEW_SUBMITTED',
    name: 'Product Review Submitted',
    description: 'Notifies Admin/Vendor when a verified buyer submits a product review.',
    category: 'REVIEW',
    sendToAdmin: true,
    sendToCustomer: false,
    sendToVendor: false,
    templateId: 'tpl-review-alert',
    subjectOverride: 'New {{rating}}-Star Verified Review on {{product_title}}',
  },
  {
    id: 'rule-review-moderated',
    eventKey: 'REVIEW_MODERATED',
    name: 'Review Approved / Replied',
    description: 'Notifies customer when admin moderates or replies to their review.',
    category: 'REVIEW',
    sendToAdmin: false,
    sendToCustomer: true,
    sendToVendor: false,
    templateId: 'tpl-account-activity',
    subjectOverride: 'Update on Your Review for {{product_title}}',
  },
  {
    id: 'rule-wishlist-item-added',
    eventKey: 'WISHLIST_ITEM_ADDED',
    name: 'Product Saved to Wishlist',
    description: 'Optional customer confirmation when adding an item to Wishlist.',
    category: 'WISHLIST',
    isEnabled: false,
    sendToAdmin: false,
    sendToCustomer: true,
    sendToVendor: false,
    templateId: 'tpl-account-activity',
    subjectOverride: 'Saved in Your InfiniCharm Wishlist: {{product_title}}',
  },
  {
    id: 'rule-product-low-stock',
    eventKey: 'PRODUCT_LOW_STOCK',
    name: 'Low Stock / Out-of-Stock Alert',
    description: 'Alerts Admin/Vendor when SKU stock drops to or below threshold (5 units).',
    category: 'INVENTORY',
    sendToAdmin: true,
    sendToCustomer: false,
    sendToVendor: true,
    templateId: 'tpl-inventory-alert',
    subjectOverride: '[Inventory Alert] {{product_title}} ({{stock_quantity}} remaining)',
  },
  {
    id: 'rule-product-status-changed',
    eventKey: 'PRODUCT_STATUS_CHANGED',
    name: 'Product Status / Catalog Approval Changed',
    description: 'Notifies Admin/Vendor when a catalog product is published or drafted.',
    category: 'INVENTORY',
    sendToAdmin: true,
    sendToCustomer: false,
    sendToVendor: true,
    templateId: 'tpl-inventory-alert',
    subjectOverride: 'Catalog Status Updated: {{product_title}} ({{product_status}})',
  },
  {
    id: 'rule-vendor-application-submitted',
    eventKey: 'VENDOR_APPLICATION_SUBMITTED',
    name: 'Vendor Application Submitted',
    description: 'Alerts Admin and confirms receipt to applying partner/vendor.',
    category: 'VENDOR',
    sendToAdmin: true,
    sendToCustomer: false,
    sendToVendor: true,
    templateId: 'tpl-vendor-dispatch',
    subjectOverride: 'Partner Application Received — {{vendor_name}}',
  },
  {
    id: 'rule-vendor-application-approved',
    eventKey: 'VENDOR_APPLICATION_APPROVED',
    name: 'Vendor Application Approved',
    description: 'Notifies vendor upon onboarding approval.',
    category: 'VENDOR',
    sendToAdmin: false,
    sendToCustomer: false,
    sendToVendor: true,
    templateId: 'tpl-vendor-dispatch',
    subjectOverride: 'Approved: Your InfiniCharm Partner Onboarding',
  },
  {
    id: 'rule-vendor-application-rejected',
    eventKey: 'VENDOR_APPLICATION_REJECTED',
    name: 'Vendor Application Rejected',
    description: 'Notifies vendor with review decision notice.',
    category: 'VENDOR',
    sendToAdmin: false,
    sendToCustomer: false,
    sendToVendor: true,
    templateId: 'tpl-vendor-dispatch',
    subjectOverride: 'Partner Application Update — InfiniCharm',
  },
  {
    id: 'rule-vendor-new-order',
    eventKey: 'VENDOR_NEW_ORDER',
    name: 'New Vendor Dispatch Order',
    description: 'Routes order dispatch notification to fulfillment partner/vendor and admin.',
    category: 'VENDOR',
    sendToAdmin: true,
    sendToCustomer: false,
    sendToVendor: true,
    templateId: 'tpl-vendor-dispatch',
    subjectOverride: 'New Fulfillment Order {{order_number}} Assigned',
  },
  {
    id: 'rule-vendor-payout-processed',
    eventKey: 'VENDOR_PAYOUT_PROCESSED',
    name: 'Vendor Payout & Commission Processed',
    description: 'Sends settlement statement summary to vendor & admin.',
    category: 'VENDOR',
    sendToAdmin: true,
    sendToCustomer: false,
    sendToVendor: true,
    templateId: 'tpl-vendor-dispatch',
    subjectOverride: 'Settlement Advice: {{payout_amount}} — InfiniCharm',
  },
];

export function buildDefaultNotificationRules(): NotificationEventRule[] {
  const now = new Date().toISOString();
  return DEFAULT_RULE_SPECS.map((spec) => ({
    id: spec.id,
    eventKey: spec.eventKey,
    name: spec.name,
    description: spec.description,
    category: spec.category,
    isEnabled: spec.isEnabled !== undefined ? spec.isEnabled : true,
    isSystemDefault: true,
    sendToAdmin: spec.sendToAdmin,
    sendToCustomer: spec.sendToCustomer,
    sendToVendor: spec.sendToVendor,
    adminEmails: [],
    vendorEmails: [],
    customEmails: [],
    templateId: spec.templateId,
    subjectOverride: spec.subjectOverride,
    smtpConfigId: null,
    createdAt: now,
    updatedAt: now,
  }));
}

function readRawRules(filePath: string = RULES_FILE_PATH): NotificationEventRule[] {
  try {
    if (!fs.existsSync(filePath)) {
      const seeds = buildDefaultNotificationRules();
      ensureDirAndWrite(filePath, seeds);
      return seeds;
    }
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!Array.isArray(parsed) || parsed.length === 0) {
      const seeds = buildDefaultNotificationRules();
      ensureDirAndWrite(filePath, seeds);
      return seeds;
    }
    return parsed as NotificationEventRule[];
  } catch {
    return buildDefaultNotificationRules();
  }
}

export function listNotificationRules(
  opts?: {
    category?: NotificationCategory | 'ALL';
    role?: 'ALL' | 'ADMIN' | 'CUSTOMER' | 'VENDOR';
    status?: 'ALL' | 'ENABLED' | 'DISABLED';
    q?: string;
  },
  filePath: string = RULES_FILE_PATH
): NotificationEventRule[] {
  let rules = readRawRules(filePath);
  if (opts?.category && opts.category !== 'ALL') {
    rules = rules.filter((r) => r.category === opts.category);
  }
  if (opts?.role === 'ADMIN') rules = rules.filter((r) => r.sendToAdmin);
  if (opts?.role === 'CUSTOMER') rules = rules.filter((r) => r.sendToCustomer);
  if (opts?.role === 'VENDOR') rules = rules.filter((r) => r.sendToVendor);
  if (opts?.status === 'ENABLED') rules = rules.filter((r) => r.isEnabled);
  if (opts?.status === 'DISABLED') rules = rules.filter((r) => !r.isEnabled);
  if (opts?.q?.trim()) {
    const q = opts.q.trim().toLowerCase();
    rules = rules.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.eventKey.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q)
    );
  }
  return rules;
}

export function getNotificationRuleById(
  id: string,
  filePath: string = RULES_FILE_PATH
): NotificationEventRule | null {
  return readRawRules(filePath).find((r) => r.id === id) || null;
}

export function getRulesByEventKey(
  eventKey: NotificationEventKey,
  filePath: string = RULES_FILE_PATH
): NotificationEventRule[] {
  return readRawRules(filePath).filter((r) => r.eventKey === eventKey);
}

export interface UpsertNotificationRuleInput {
  eventKey: NotificationEventKey;
  name: string;
  description?: string;
  category: NotificationCategory;
  isEnabled?: boolean;
  sendToAdmin?: boolean;
  sendToCustomer?: boolean;
  sendToVendor?: boolean;
  adminEmails?: string[];
  vendorEmails?: string[];
  customEmails?: string[];
  templateId?: string | null;
  subjectOverride?: string;
  smtpConfigId?: string | null;
}

function cleanEmailList(list?: string[]): string[] {
  if (!Array.isArray(list)) return [];
  return Array.from(
    new Set(
      list
        .map((e) => e.trim().toLowerCase())
        .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e))
    )
  );
}

export function createNotificationRule(
  input: UpsertNotificationRuleInput,
  filePath: string = RULES_FILE_PATH
): NotificationEventRule {
  const all = readRawRules(filePath);
  const now = new Date().toISOString();
  const created: NotificationEventRule = {
    id: `rule-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    eventKey: input.eventKey,
    name: input.name.trim(),
    description: (input.description || '').trim(),
    category: input.category,
    isEnabled: input.isEnabled !== undefined ? Boolean(input.isEnabled) : true,
    isSystemDefault: false,
    sendToAdmin: Boolean(input.sendToAdmin),
    sendToCustomer: Boolean(input.sendToCustomer),
    sendToVendor: Boolean(input.sendToVendor),
    adminEmails: cleanEmailList(input.adminEmails),
    vendorEmails: cleanEmailList(input.vendorEmails),
    customEmails: cleanEmailList(input.customEmails),
    templateId: input.templateId || null,
    subjectOverride: (input.subjectOverride || '').trim(),
    smtpConfigId: input.smtpConfigId || null,
    createdAt: now,
    updatedAt: now,
  };
  ensureDirAndWrite(filePath, [created, ...all]);
  return created;
}

export function updateNotificationRule(
  id: string,
  updates: Partial<UpsertNotificationRuleInput>,
  filePath: string = RULES_FILE_PATH
): { success: boolean; rule?: NotificationEventRule; error?: string } {
  const all = readRawRules(filePath);
  const idx = all.findIndex((r) => r.id === id);
  if (idx === -1) return { success: false, error: 'Notification rule not found.' };

  const current = all[idx];
  const updated: NotificationEventRule = {
    ...current,
    eventKey: updates.eventKey !== undefined ? updates.eventKey : current.eventKey,
    name: updates.name !== undefined ? updates.name.trim() : current.name,
    description:
      updates.description !== undefined ? updates.description.trim() : current.description,
    category: updates.category !== undefined ? updates.category : current.category,
    isEnabled: updates.isEnabled !== undefined ? Boolean(updates.isEnabled) : current.isEnabled,
    sendToAdmin:
      updates.sendToAdmin !== undefined ? Boolean(updates.sendToAdmin) : current.sendToAdmin,
    sendToCustomer:
      updates.sendToCustomer !== undefined
        ? Boolean(updates.sendToCustomer)
        : current.sendToCustomer,
    sendToVendor:
      updates.sendToVendor !== undefined ? Boolean(updates.sendToVendor) : current.sendToVendor,
    adminEmails:
      updates.adminEmails !== undefined ? cleanEmailList(updates.adminEmails) : current.adminEmails,
    vendorEmails:
      updates.vendorEmails !== undefined
        ? cleanEmailList(updates.vendorEmails)
        : current.vendorEmails,
    customEmails:
      updates.customEmails !== undefined
        ? cleanEmailList(updates.customEmails)
        : current.customEmails,
    templateId: updates.templateId !== undefined ? updates.templateId : current.templateId,
    subjectOverride:
      updates.subjectOverride !== undefined
        ? updates.subjectOverride.trim()
        : current.subjectOverride,
    smtpConfigId:
      updates.smtpConfigId !== undefined ? updates.smtpConfigId : current.smtpConfigId,
    updatedAt: new Date().toISOString(),
  };

  all[idx] = updated;
  ensureDirAndWrite(filePath, all);
  return { success: true, rule: updated };
}

export function duplicateNotificationRule(
  id: string,
  filePath: string = RULES_FILE_PATH
): { success: boolean; rule?: NotificationEventRule; error?: string } {
  const original = getNotificationRuleById(id, filePath);
  if (!original) return { success: false, error: 'Notification rule not found.' };
  const copy = createNotificationRule(
    {
      eventKey: original.eventKey,
      name: `${original.name} (Copy)`,
      description: original.description,
      category: original.category,
      isEnabled: false, // Safer default until admin reviews duplicated rule
      sendToAdmin: original.sendToAdmin,
      sendToCustomer: original.sendToCustomer,
      sendToVendor: original.sendToVendor,
      adminEmails: original.adminEmails,
      vendorEmails: original.vendorEmails,
      customEmails: original.customEmails,
      templateId: original.templateId,
      subjectOverride: original.subjectOverride,
      smtpConfigId: original.smtpConfigId,
    },
    filePath
  );
  return { success: true, rule: copy };
}

export function deleteNotificationRule(
  id: string,
  filePath: string = RULES_FILE_PATH
): { success: boolean; error?: string } {
  const all = readRawRules(filePath);
  const target = all.find((r) => r.id === id);
  if (!target) return { success: false, error: 'Notification rule not found.' };
  const filtered = all.filter((r) => r.id !== id);
  ensureDirAndWrite(filePath, filtered);
  return { success: true };
}

// ==============================================================================
// Notification Delivery Logs Store
// ==============================================================================

function readLogsRaw(filePath: string = LOGS_FILE_PATH): NotificationDeliveryLog[] {
  try {
    if (!fs.existsSync(filePath)) return [];
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(parsed) ? (parsed as NotificationDeliveryLog[]) : [];
  } catch {
    return [];
  }
}

export function appendNotificationLog(
  entry: Omit<NotificationDeliveryLog, 'id' | 'createdAt'>,
  filePath: string = LOGS_FILE_PATH
): NotificationDeliveryLog {
  const all = readLogsRaw(filePath);
  const created: NotificationDeliveryLog = {
    ...entry,
    id: `nlog-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    createdAt: new Date().toISOString(),
  };
  const next = [created, ...all].slice(0, MAX_NOTIFICATION_LOGS);
  ensureDirAndWrite(filePath, next);
  return created;
}

export function updateNotificationLogById(
  id: string,
  updates: Partial<NotificationDeliveryLog>,
  filePath: string = LOGS_FILE_PATH
): NotificationDeliveryLog | null {
  const all = readLogsRaw(filePath);
  const idx = all.findIndex((l) => l.id === id);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], ...updates };
  ensureDirAndWrite(filePath, all);
  return all[idx];
}

export function queryNotificationLogs(
  opts?: {
    status?: NotificationDeliveryLog['status'] | 'ALL';
    recipientRole?: NotificationDeliveryLog['recipientRole'] | 'ALL';
    eventKey?: string;
    q?: string;
    page?: number;
    limit?: number;
  },
  filePath: string = LOGS_FILE_PATH
) {
  const all = readLogsRaw(filePath);
  const stats = {
    total: all.length,
    sent: all.filter((l) => l.status === 'SENT').length,
    failed: all.filter((l) => l.status === 'FAILED').length,
    pending: all.filter((l) => l.status === 'PENDING').length,
    disabledOrSkipped: all.filter((l) => l.status === 'DISABLED' || l.status === 'SKIPPED').length,
  };

  let filtered = [...all];
  if (opts?.status && opts.status !== 'ALL') {
    filtered = filtered.filter((l) => l.status === opts.status);
  }
  if (opts?.recipientRole && opts.recipientRole !== 'ALL') {
    filtered = filtered.filter((l) => l.recipientRole === opts.recipientRole);
  }
  if (opts?.eventKey && opts.eventKey !== 'ALL') {
    filtered = filtered.filter((l) => l.eventKey === opts.eventKey);
  }
  if (opts?.q?.trim()) {
    const q = opts.q.trim().toLowerCase();
    filtered = filtered.filter(
      (l) =>
        l.recipientEmail.toLowerCase().includes(q) ||
        l.eventKey.toLowerCase().includes(q) ||
        l.eventName.toLowerCase().includes(q) ||
        l.subject.toLowerCase().includes(q) ||
        (l.errorMessage || '').toLowerCase().includes(q)
    );
  }

  const limit = Math.max(1, Math.min(200, opts?.limit || 25));
  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  const page = Math.max(1, Math.min(totalPages, opts?.page || 1));
  const start = (page - 1) * limit;

  return {
    logs: filtered.slice(start, start + limit),
    totalCount,
    page,
    limit,
    totalPages,
    stats,
  };
}

export function getNotificationLogById(
  id: string,
  filePath: string = LOGS_FILE_PATH
): NotificationDeliveryLog | null {
  return readLogsRaw(filePath).find((l) => l.id === id) || null;
}

