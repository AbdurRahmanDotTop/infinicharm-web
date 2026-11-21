export type UserRole =
  | 'CUSTOMER'
  | 'ADMIN'
  | 'SUPER_ADMIN'
  | 'PRODUCT_MANAGER'
  | 'ORDER_MANAGER'
  | 'CONTENT_MANAGER';

export interface Profile {
  id: string;
  role: UserRole;
  fullName?: string;
  phone?: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  primaryCategory?: string;
  subCategory1?: string;
  subCategory2?: string;
  subCategory3?: string;
  hindiName?: string;
  tagline?: string;
  description: string;
  icon?: string;
  color?: string;
  badge?: string;
  imageUrl?: string;
  alt?: string;
  bannerUrl?: string;
  iconUrl?: string;
  displayOrder: number;
  isActive: boolean;
  complianceRequirement?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type CategoryDefinition = Category;

export type MediaProvider =
  | 'BLOGGER'
  | 'YOUTUBE'
  | 'GOOGLE_DRIVE'
  | 'IMAGEKIT'
  | 'CLOUDINARY'
  | 'EXTERNAL_HTTPS'
  | 'SUPABASE_STORAGE'
  | 'CLOUDFLARE_R2';

export type MediaType = 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' | 'PDF' | 'EMBED' | 'OTHER';

export type MediaRole =
  | 'PRIMARY'
  | 'GALLERY'
  | 'VARIANT'
  | 'VIDEO'
  | 'AUDIO'
  | 'CERTIFICATE'
  | 'DOCUMENT'
  | 'BANNER'
  | 'BROCHURE'
  | 'MANUAL'
  | 'SPECIFICATION'
  | 'OTHER';

export interface ExternalMedia {
  id: string;
  provider: MediaProvider;
  externalUrl: string;
  sourceUrl?: string;
  providerAssetId?: string;
  storageKey?: string;
  mimeType: string;
  altText: string;
  title?: string;
  caption?: string;
  mediaType?: MediaType;
  role: MediaRole;
  displayOrder: number;
  productId?: string;
  variantId?: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  visibility?: 'PUBLIC' | 'UNLISTED' | 'DISABLED';
  status?: 'ACTIVE' | 'DRAFT' | 'DISABLED' | 'BROKEN';
  metadata?: Record<string, any>;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  barcode?: string;
  title: string;
  priceInPaise: number;
  compareAtPriceInPaise?: number;
  costPriceInPaise?: number;
  stockQuantity: number;
  lowStockThreshold: number;
  weightInGrams?: number;
  attributes: Record<string, string>;
  isActive: boolean;
  media?: ExternalMedia[];
  mediaUrl?: string;
}

export type ProductType = 'simple' | 'variable' | 'grouped' | 'external';
export type TaxStatus = 'TAXABLE' | 'EXEMPT' | 'ZERO_RATED';
export type StockStatus = 'IN_STOCK' | 'OUT_OF_STOCK' | 'ON_BACKORDER';
export type BackorderPolicy = 'NO' | 'NOTIFY' | 'YES';

export interface ProductAttributeConfig {
  name: string;
  values: string[];
}

export interface ProductDimensions {
  length: number;
  width: number;
  height: number;
  unit: 'cm' | 'in';
}

export interface Product {
  id: string;
  categoryId: string;
  category?: Category;
  title: string;
  slug: string;
  productType?: ProductType;
  baseSku?: string;
  barcode?: string;
  tags?: string[];
  tagline?: string;
  shortDescription?: string;
  fullDescription?: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  brand: string;
  originCountry: string;
  originRegion?: string;
  ingredients?: string;
  storageInstructions?: string;
  fssaiLicenseNumber?: string;
  isFeatured: boolean;
  isNewArrival: boolean;
  customBadge?: string;
  customShippingText?: string;
  customGuaranteeText?: string;
  returnPolicyText?: string;
  highlights?: string[];
  specifications?: { label: string; value: string }[];
  relatedProductIds?: string[];
  seoTitle?: string;
  seoDescription?: string;
  
  // WooCommerce-grade Inventory & Taxation
  costPriceInPaise?: number;
  taxStatus?: TaxStatus;
  taxClass?: string;
  saleStartDate?: string;
  saleEndDate?: string;
  manageStock?: boolean;
  stockStatus?: StockStatus;
  backordersAllowed?: BackorderPolicy;
  soldIndividually?: boolean;
  weightInGrams?: number;
  dimensions?: ProductDimensions;
  shippingClass?: string;
  purchaseNote?: string;
  externalProductUrl?: string;
  buttonText?: string;
  attributesConfig?: ProductAttributeConfig[];

  variants: ProductVariant[];
  media: ExternalMedia[];
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  id: string;
  variantId: string;
  product: Product;
  variant: ProductVariant;
  quantity: number;
}

export type CouponStatus = 'ACTIVE' | 'INACTIVE' | 'EXPIRED';
export type CouponApplicabilityType = 'ALL' | 'CATEGORIES' | 'PRODUCTS';
export type CouponUserEligibility =
  | 'ALL'
  | 'LOGGED_IN'
  | 'NEW_CUSTOMERS'
  | 'SPECIFIC_CUSTOMERS';

export interface CouponRedemptionRecord {
  customerId?: string;
  customerEmail?: string;
  customerPhone?: string;
  orderNumber: string;
  discountInPaise: number;
  redeemedAt: string;
}

export interface Coupon {
  id: string;
  code: string;
  description?: string;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue: number; // percentage (1-100) or paise
  minOrderInPaise: number;
  maxDiscountInPaise?: number;
  usageLimitTotal?: number;
  usageLimitPerCustomer: number;
  usageCount: number;
  redeemedBy?: CouponRedemptionRecord[];
  validFrom: string;
  validUntil: string;
  applicabilityType?: CouponApplicabilityType;
  applicableCategoryIds?: string[];
  applicableProductIds?: string[];
  userEligibility?: CouponUserEligibility;
  eligibleCustomerIds?: string[];
  isActive: boolean;
  status?: CouponStatus;
  createdAt?: string;
  updatedAt?: string;
}

export type OrderStatus =
  | 'PENDING'
  | 'PAYMENT_RECEIVED'
  | 'PAYMENT_NOT_RECEIVED'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'PACKED'
  | 'READY_FOR_DISPATCH'
  | 'SHIPPED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'DELIVERY_ATTEMPTED'
  | 'RTO_INITIATED'
  | 'RTO_DELIVERED'
  | 'CANCELLED'
  | 'RETURN_REQUESTED'
  | 'RETURN_APPROVED'
  | 'RETURNED'
  | 'REFUNDED';

export type PaymentMethod =
  | 'COD'
  | 'UPI'
  | 'CARDS'
  | 'NET_BANKING'
  | 'WALLET'
  | 'CUSTOM_UPI'
  | 'PAYGLOCAL'
  | (string & {});
export type PaymentStatus =
  | 'PENDING'
  | 'UNDER_VERIFICATION'
  | 'PAID'
  | 'FAILED'
  | 'REFUNDED';

export interface OrderTimelineEvent {
  id: string;
  status: OrderStatus | string;
  title: string;
  description: string;
  location?: string;
  timestamp: string;
  actor?: string;
  isCustomerVisible: boolean;
  type?: 'PAYMENT' | 'FULFILLMENT' | 'LOGISTICS' | 'EXCEPTION' | 'RETURN';
}

export interface CustomerAddress {
  id: string;
  customerId: string;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
}

export type CustomerStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export interface CustomerPreferences {
  newsletterSubscribed: boolean;
  smsAlerts: boolean;
  orderUpdatesWhatsapp: boolean;
  preferredCurrency: 'INR' | 'USD' | 'GBP' | 'EUR';
  language: 'en' | 'hi';
}

export interface Customer {
  id: string;
  email: string;
  passwordHash?: string;
  fullName: string;
  phone: string;
  status: CustomerStatus;
  role: 'CUSTOMER' | 'ADMIN';
  emailVerified?: boolean;
  emailVerifiedAt?: string | null;
  verificationSentAt?: string | null;
  registrationSource?: 'REGISTER_PAGE' | 'CHECKOUT' | 'ADMIN' | 'SEED';
  sessionVersion?: number;
  avatarUrl?: string;
  notes?: string;
  preferences: CustomerPreferences;
  addresses: CustomerAddress[];
  wishlistProductIds: string[];
  customFields?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export interface CustomerSummary extends Omit<Customer, 'passwordHash'> {
  totalOrders: number;
  lifetimeSpendInPaise: number;
  lastOrderDate?: string;
}

export interface AuthSettings {
  registrationEnabled: boolean;
  loginEnabled: boolean;
  checkoutRegistrationEnabled: boolean;
  checkoutInlineLoginEnabled: boolean;
  guestCheckoutEnabled: boolean;
  requireEmailVerification: boolean;
  verificationTokenTtlMinutes: number;
  verificationResendCooldownSeconds: number;
  verificationResendMaxPerHour: number;
  resetTokenTtlMinutes: number;
  resetRequestMaxPerHour: number;
  minPasswordLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSpecialChar: boolean;
  verificationRedirectPath: string;
  autoRedirectAfterVerificationSeconds: number;
  passwordResetMode: 'LINK_AND_OTP' | 'LINK_ONLY';
  updatedAt: string;
  updatedBy?: string;
}

export type PublicAuthSettings = Omit<AuthSettings, 'updatedBy'>;

export type RegistrationFieldType =
  | 'text'
  | 'textarea'
  | 'email'
  | 'phone'
  | 'number'
  | 'password'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'date';

export interface RegistrationFormFieldOption {
  label: string;
  value: string;
}

export interface RegistrationFormField {
  id: string;
  key: string;
  label: string;
  type: RegistrationFieldType;
  placeholder?: string;
  description?: string;
  required: boolean;
  isEnabled: boolean;
  order: number;
  section?: 'account' | 'personal' | 'preferences' | 'additional';
  isSystemField?: boolean;
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    min?: number;
    max?: number;
  };
  options?: RegistrationFormFieldOption[];
  defaultValue?: string | boolean | number;
}

export interface RegistrationFormSettings {
  title: string;
  subtitle: string;
  submitButtonText: string;
  termsAgreementRequired: boolean;
  termsText: string;
  termsLink: string;
  privacyLink: string;
  fields: RegistrationFormField[];
  updatedAt?: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  variantId: string;
  productTitle: string;
  variantTitle: string;
  sku: string;
  priceInPaise: number;
  quantity: number;
  totalInPaise: number;
  image?: string;
  itemMetadata?: Record<string, any>;
}

export interface OrderPrivacyMeta {
  isAuthenticated: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  canViewPrivateDetails: boolean;
  accessState: 'AUTHORIZED' | 'UNAUTHENTICATED' | 'WRONG_ACCOUNT';
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId?: string;
  customerName?: string;
  customerEmail: string;
  customerPhone: string;
  status: OrderStatus;
  subtotalInPaise: number;
  discountInPaise: number;
  shippingInPaise: number;
  taxInPaise: number;
  totalInPaise: number;
  couponCode?: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  shippingAddress: CustomerAddress;
  billingAddress: CustomerAddress;
  courierName?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  estimatedDeliveryDate?: string;
  actualDeliveryDate?: string;
  customerNotes?: string;
  adminNotes?: string;
  utrNumber?: string;
  manualApprovalStatus?: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
  deliveryAttempts?: number;
  timeline?: OrderTimelineEvent[];
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
}

export interface Review {
  id: string;
  productId: string;
  productTitle?: string;
  productSlug?: string;
  customerId: string;
  customerName: string;
  customerEmail?: string;
  orderId?: string;
  orderNumber?: string;
  rating: number; // 1-5
  title?: string;
  comment: string;
  isVerifiedPurchase: boolean;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'HIDDEN';
  adminReply?: string;
  adminReplyAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ReviewSettings {
  autoApproveVerifiedPurchases: boolean;
  requireDeliveredStatus: boolean;
  minCommentLength: number;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  summary: string;
  contentMarkdown: string;
  featuredImageUrl?: string;
  category: string;
  tags: string[];
  authorId?: string;
  authorName: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  publishedAt?: string;
  seoTitle?: string;
  seoDescription?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformSettings {
  shipping: {
    freeShippingThresholdPaise: number;
    defaultShippingFeePaise: number;
    expressShippingFeePaise: number;
    codConvenienceFeePaise: number;
    dispatchOriginPostalCode: string;
    dispatchOriginState: string;
  };
  payments: {
    codEnabled: boolean;
    upiEnabled: boolean;
    cardsEnabled: boolean;
    netBankingEnabled: boolean;
  };
  compliance: {
    fssaiLicenseNumber: string;
    gstin?: string;
    grievanceOfficerName: string;
    grievanceOfficerEmail: string;
  };
}

export interface OrderStatusHistory {
  id: string;
  orderId: string;
  oldStatus?: OrderStatus;
  newStatus: OrderStatus;
  notes?: string;
  changedBy?: string;
  createdAt: string;
}

export interface PaymentRecord {
  id: string;
  orderId: string;
  provider: 'COD' | 'RAZORPAY' | 'STRIPE' | 'MANUAL' | 'UPI';
  providerTransactionId?: string;
  providerOrderId?: string;
  amountInPaise: number;
  status: 'INITIATED' | 'SUCCESS' | 'FAILED' | 'REFUNDED';
  rawPayload?: Record<string, any>;
  createdAt: string;
}

export interface RefundRecord {
  id: string;
  orderId: string;
  paymentId: string;
  amountInPaise: number;
  reason: string;
  status: 'PENDING' | 'PROCESSED' | 'REJECTED';
  processedBy?: string;
  createdAt: string;
}

export interface StorefrontBadge {
  id: string;
  key: string;
  title: string;
  subtitle?: string;
  icon: string;
  isEnabled: boolean;
  displayOrder: number;
  thresholdRupees?: number;
  conditionsText?: string;
  linkUrl?: string;
  badgeColor?: string;
  updatedAt?: string;
}

export interface WishlistItem {
  id: string;
  customerId: string;
  productId: string;
  product?: Product;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  actorId?: string;
  actorEmail: string;
  action: string;
  resourceType: string;
  resourceId: string;
  diff?: Record<string, any>;
  ipAddress?: string;
  createdAt: string;
}

export type PaymentGatewayId =
  | 'RAZORPAY'
  | 'COD'
  | 'PHONEPE'
  | 'STRIPE'
  | 'CUSTOM_UPI'
  | 'PAYGLOCAL'
  | (string & {});

export interface PaymentGatewayConfig {
  id: PaymentGatewayId;
  name: string;
  description: string;
  isEnabled: boolean;
  isTestMode: boolean;
  isValidated: boolean;
  isCustom?: boolean;
  lastTestedAt?: string;
  testStatusMessage?: string;
  credentials: {
    keyId?: string;
    keySecret?: string;
    merchantId?: string;
    saltKey?: string;
    saltIndex?: string;
    webhookSecret?: string;
    // Custom UPI Direct credentials
    upiId?: string;
    upiNumber?: string;
    payeeName?: string;
    bankName?: string;
    accountNumber?: string;
    ifscCode?: string;
    instructions?: string;
    // PayGlocal credentials
    mcaId?: string;
    publicKid?: string;
    privateKid?: string;
    privateKeyPem?: string;
    gbpSortCode?: string;
    gbpAccountNo?: string;
  };
  webhookUrl: string;
  supportedMethods: PaymentMethod[];
  minOrderInPaise?: number;
  maxOrderInPaise?: number;
  convenienceFeeInPaise?: number;
}

export interface PaymentTransaction {
  id: string;
  orderNumber: string;
  gatewayId: PaymentGatewayId;
  gatewayTransactionId?: string;
  amountInPaise: number;
  currency: string;
  method: PaymentMethod;
  status: 'SUCCESS' | 'PENDING' | 'FAILED' | 'REFUNDED';
  customerEmail: string;
  customerPhone: string;
  failureReason?: string;
  utrNumber?: string;
  manualApprovalStatus?: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  payglocalGid?: string;
  createdAt: string;
}

export interface CustomerInquiry {
  id: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  status: 'NEW' | 'IN_PROGRESS' | 'RESOLVED';
  adminResponse?: string;
  source?: string;
  notificationStatus?: 'SENT' | 'FAILED' | 'DISABLED' | 'PENDING';
  createdAt: string;
  updatedAt: string;
}

export type NewsletterSubscriberStatus =
  | 'ACTIVE'
  | 'UNSUBSCRIBED'
  | 'PENDING'
  | 'BOUNCED'
  | 'SUPPRESSED';

export interface NewsletterSubscriber {
  id: string;
  email: string;
  fullName?: string;
  status: NewsletterSubscriberStatus;
  source: string;
  tags?: string[];
  unsubscribeToken: string;
  consentIp?: string;
  bounceReason?: string;
  notes?: string;
  subscribedAt: string;
  unsubscribedAt?: string | null;
  resubscribedAt?: string | null;
  lastCampaignSentAt?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface NewsletterWidgetSettings {
  isEnabled: boolean;
  badge: string;
  heading: string;
  description: string;
  emailPlaceholder: string;
  buttonText: string;
  loadingText: string;
  successMessage: string;
  alreadySubscribedMessage: string;
  invalidEmailMessage: string;
  errorMessage: string;
  privacyFootnote: string;
  sendWelcomeEmail: boolean;
  welcomeTemplateId?: string | null;
  updatedAt: string;
}

export type SmtpProviderType = 'BREVO' | 'CUSTOM_SMTP';
export type SmtpEncryptionType = 'NONE' | 'STARTTLS' | 'SSL';

export interface SmtpConfig {
  id: string;
  name: string;
  providerType: SmtpProviderType;
  host: string;
  port: number;
  encryption: SmtpEncryptionType;
  username: string;
  encryptedSecret?: string;
  useEnvCredentials?: boolean;
  senderName: string;
  senderEmail: string;
  replyToEmail?: string;
  isDefault: boolean;
  isEnabled: boolean;
  lastTestedAt?: string | null;
  lastTestStatus?: 'SUCCESS' | 'FAILED' | 'UNTESTED';
  lastTestMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SanitizedSmtpConfig extends Omit<SmtpConfig, 'encryptedSecret'> {
  hasSecret: boolean;
  maskedSecret: string;
}

export type EmailTemplatePurpose =
  | 'TRANSACTIONAL'
  | 'ADMIN'
  | 'CUSTOMER'
  | 'VENDOR'
  | 'WELCOME'
  | 'MARKETING'
  | 'ANNOUNCEMENT'
  | 'GENERAL';

export interface EmailTemplate {
  id: string;
  name: string;
  slug: string;
  purpose: EmailTemplatePurpose;
  subject: string;
  previewText?: string;
  htmlContent: string;
  textContent: string;
  isDefaultForPurpose: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CampaignStatus = 'DRAFT' | 'SENDING' | 'SENT' | 'PARTIAL' | 'FAILED';
export type CampaignRecipientSegment = 'ALL_ACTIVE' | 'CUSTOM_SELECTION' | 'SOURCE_FILTER';

export interface EmailCampaign {
  id: string;
  name: string;
  subject: string;
  previewText?: string;
  templateId?: string | null;
  smtpConfigId?: string | null;
  senderName: string;
  senderEmail: string;
  replyToEmail?: string;
  htmlContent: string;
  textContent: string;
  segment: CampaignRecipientSegment;
  selectedSubscriberIds?: string[];
  sourceFilter?: string;
  status: CampaignStatus;
  eligibleCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  lastError?: string | null;
  sentAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmailDeliveryLog {
  id: string;
  type: 'WELCOME' | 'CAMPAIGN' | 'TEST' | 'SYSTEM';
  campaignId?: string | null;
  campaignName?: string | null;
  subscriberId?: string | null;
  recipientEmail: string;
  subject: string;
  smtpConfigId?: string | null;
  providerName: string;
  status: 'SENT' | 'FAILED' | 'SKIPPED';
  messageId?: string;
  errorMessage?: string;
  sentAt: string;
}

// ==============================================================================
// Centralized Email Notification Engine Types
// ==============================================================================

export type EmailRecipientRole = 'ADMIN' | 'CUSTOMER' | 'VENDOR' | 'CUSTOM';

export type NotificationCategory =
  | 'ENQUIRY'
  | 'ORDER'
  | 'PAYMENT'
  | 'ACCOUNT'
  | 'REVIEW'
  | 'INVENTORY'
  | 'VENDOR'
  | 'WISHLIST'
  | 'SYSTEM';

export type NotificationEventKey =
  | 'ENQUIRY_SUBMITTED'
  | 'ENQUIRY_ADMIN_REPLY'
  | 'ORDER_PLACED'
  | 'ORDER_PAYMENT_APPROVED'
  | 'ORDER_PAYMENT_REJECTED'
  | 'ORDER_PROCESSING'
  | 'ORDER_SHIPPED'
  | 'ORDER_OUT_FOR_DELIVERY'
  | 'ORDER_DELIVERED'
  | 'ORDER_CANCELLED'
  | 'ORDER_RETURN_REQUESTED'
  | 'ORDER_RETURN_APPROVED'
  | 'ORDER_REFUNDED'
  | 'CUSTOMER_REGISTERED'
  | 'CUSTOMER_EMAIL_VERIFICATION'
  | 'PASSWORD_RESET_OTP'
  | 'PASSWORD_CHANGED'
  | 'CUSTOMER_PROFILE_UPDATED'
  | 'CUSTOMER_ADDRESS_UPDATED'
  | 'CUSTOMER_STATUS_CHANGED'
  | 'CUSTOMER_ACCOUNT_DELETED'
  | 'REVIEW_SUBMITTED'
  | 'REVIEW_MODERATED'
  | 'WISHLIST_ITEM_ADDED'
  | 'PRODUCT_LOW_STOCK'
  | 'PRODUCT_STATUS_CHANGED'
  | 'VENDOR_APPLICATION_SUBMITTED'
  | 'VENDOR_APPLICATION_APPROVED'
  | 'VENDOR_APPLICATION_REJECTED'
  | 'VENDOR_NEW_ORDER'
  | 'VENDOR_PAYOUT_PROCESSED'
  | (string & {});

export interface NotificationEventRule {
  id: string;
  eventKey: NotificationEventKey;
  name: string;
  description: string;
  category: NotificationCategory;
  isEnabled: boolean;
  isSystemDefault: boolean;
  sendToAdmin: boolean;
  sendToCustomer: boolean;
  sendToVendor: boolean;
  adminEmails: string[];
  vendorEmails: string[];
  customEmails: string[];
  templateId?: string | null;
  subjectOverride?: string;
  smtpConfigId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GlobalNotificationPreferences {
  notificationsEnabled: boolean;
  defaultAdminEmails: string[];
  supportReplyToEmail: string;
  defaultVendorFallbackEmail: string;
  defaultSmtpConfigId?: string | null;
  maxAutoRetries: number;
  deduplicateOverlappingRecipients: boolean;
  updatedAt: string;
}

export interface NotificationDeliveryLog {
  id: string;
  ruleId?: string | null;
  eventKey: string;
  eventName: string;
  recipientRole: EmailRecipientRole;
  recipientEmail: string;
  subject: string;
  templateId?: string | null;
  smtpConfigId?: string | null;
  providerName: string;
  status: 'SENT' | 'FAILED' | 'PENDING' | 'SKIPPED' | 'DISABLED';
  messageId?: string;
  errorMessage?: string;
  retryCount: number;
  contextPayload?: Record<string, string>;
  createdAt: string;
}

// ==============================================================================
// Homepage CMS & Dynamic Layout Engine Types
// ==============================================================================

export type HomepageSectionType =
  | 'hero'
  | 'categories'
  | 'departments'
  | 'flash_deals'
  | 'tabbed_spotlight'
  | 'deg_bhapka'
  | 'kirana_packs'
  | 'sourcing_centers'
  | 'values_strip'
  | 'journal_preview'
  | 'newsletter'
  | 'custom'
  | (string & {});

export type HeroItemType = 'category' | 'product' | 'custom';
export type HeroItemPosition = 'featured' | 'secondary_top' | 'secondary_bottom' | 'grid';

export interface HeroItem {
  id: string;
  type: HeroItemType;
  targetId?: string; // category id/slug or product id/slug
  title: string;
  subtitle?: string;
  badge?: string; // e.g. "Bairgania, Bihar Dispatch", "Original Sealed Can"
  tagline?: string; // e.g. "Pure Taste & Natural Sweetness"
  priceDisplay?: string; // e.g. "₹2,400" or dynamic from product
  ctaText?: string;
  linkUrl?: string; // for custom content or override
  imageUrl: string;
  position?: HeroItemPosition;
  displayOrder: number;
  isEnabled: boolean;
}

export interface SpotlightCardItem {
  id: string;
  title: string;
  description: string;
}

export interface SourcingCenterCardItem {
  id: string;
  title: string;
  location: string;
  description: string;
  specLeft: string;
  specRight: string;
  ctaText: string;
  linkUrl: string;
  imageUrl: string;
  categoryId?: string;
}

export interface HomepageSectionConfig {
  selectionMode?: 'manual' | 'category';
  selectedProductIds?: string[];
  selectedCategoryId?: string;
  productLimit?: number;
  sortBy?: 'featured' | 'newest' | 'price_low_high' | 'price_high_low' | 'discount';
  featuredTagline?: string;
  discountHighlight?: string;
  bundleHighlight?: string;
  location?: string;
  quote?: string;
  spotlightFloatingBadge?: string;
  spotlightFloatingText?: string;
  spotlightCards?: SpotlightCardItem[];
  centerCards?: SourcingCenterCardItem[];
  hubCount?: string;
  incentive?: string;
  heroItems?: HeroItem[];
  [key: string]: any;
}

export interface HomepageSection {
  id: string;
  type: HomepageSectionType;
  title: string;
  subtitle?: string;
  badge?: string;
  ctaText?: string;
  ctaLink?: string;
  secondaryCtaText?: string;
  secondaryCtaLink?: string;
  imageUrl?: string;
  displayOrder: number;
  isEnabled: boolean;
  config?: HomepageSectionConfig;
  heroItems?: HeroItem[];
  updatedAt?: string;
  createdAt?: string;
}

// ==============================================================================
// Social Media Links & Public Content Sharing Types
// Single Source of Truth: All_Docs/Credentials_and_other/SocialLinks.md
// ==============================================================================

export type SocialPlatformKey =
  | 'youtube'
  | 'facebook'
  | 'instagram'
  | 'thecrumb'
  | 'website'
  | 'twitter'
  | 'linkedin'
  | 'whatsapp'
  | 'other';

export interface SocialMediaLink {
  id: string;
  platform: SocialPlatformKey;
  label: string;
  url: string;
  isEnabled: boolean;
  displayOrder: number;
  description?: string;
  updatedAt?: string;
}

export interface ShareChannelsConfig {
  whatsapp: boolean;
  twitter: boolean;
  facebook: boolean;
  linkedin: boolean;
  email: boolean;
  copyLink: boolean;
}

export interface ShareFeatureSettings {
  enableProductSharing: boolean;
  enableBlogSharing: boolean;
  enableOrderTrackingSharing: boolean;
  channels: ShareChannelsConfig;
  customShareMessage?: string;
  updatedAt?: string;
}

export interface SocialAndShareSettings {
  socialLinks: SocialMediaLink[];
  sharing: ShareFeatureSettings;
  updatedAt?: string;
}

export interface ContactSettings {
  pageTitle: string;
  badge: string;
  pageDescription: string;
  primaryPhone: string;
  displayPhone: string;
  phoneHours: string;
  supportEmail: string;
  inquiryEmail: string;
  registeredOffice: string;
  fulfillmentCenter: string;
  operatingHours: string;
  grievanceOfficer: {
    name: string;
    designation: string;
    email: string;
    phone: string;
    responseTime: string;
  };
  sectionsVisibility: {
    showPhone: boolean;
    showEmail: boolean;
    showOffice: boolean;
    showOperatingHours: boolean;
    showGrievanceOfficer: boolean;
    showInquiryForm: boolean;
  };
  updatedAt?: string;
  updatedBy?: string;
}




