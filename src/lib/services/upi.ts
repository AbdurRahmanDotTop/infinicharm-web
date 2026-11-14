// ==============================================================================
// InfiniCharm — Centralized UPI Payment & Universal Intent Engine
// Governing PRD: PRD 09 (Payment Architecture, Dynamic UPI QR & Mobile Intent)
// Standard: NPCI UPI Specification v1.6+, Server Financial Authority, Strict DRY
// Universal Sharing: HTTPS Shareable Payment Link, WhatsApp Click-to-Pay, App Intents
// ==============================================================================

import { getPaymentUrl } from '../utils/env-urls.ts';

export interface UpiCredentials {
  upiId?: string;
  upiNumber?: string;
  payeeName?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  instructions?: string;
}

export interface UpiAppUris {
  generic: string;
  phonePe: string;
  gPay: string;
  paytm: string;
  bhim: string;
  cred: string;
}

export interface UpiPaymentDetails {
  upiId: string;
  upiNumber: string;
  payeeName: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  amountInRupees: string;
  amountInPaise: number;
  orderId: string;
  transactionNote: string;
  transactionReference: string;
  upiIntentUri: string;
  shareablePaymentUrl: string;
  whatsAppShareUrl: string;
  appUris: UpiAppUris;
  isAmountExceedingLimit: boolean;
  isHighValueTransaction: boolean;
  limitWarningMessage: string | null;
}

export interface UtrParseResult {
  utrs: string[];
  rawCleaned: string;
  isValid: boolean;
  isSplitPayment: boolean;
  error: string | null;
}

/**
 * Standard NPCI single-transaction retail UPI ceiling (in paise): ₹1,00,000.00
 */
export const NPCI_UPI_SINGLE_TRANSACTION_LIMIT_PAISE = 10000000;

/**
 * Advisory threshold for banks with daily limits (in paise): ₹25,000.00
 */
export const BANK_UPI_ADVISORY_THRESHOLD_PAISE = 2500000;

/**
 * Single source of truth baseline UPI configuration for InfiniCharm
 */
export const DEFAULT_UPI_CREDENTIALS: Required<UpiCredentials> = {
  upiId: 'AbdurRahmanIndusIndCurrent@ybl',
  upiNumber: '8825164657',
  payeeName: 'TechilyFly - InfiniCharm',
  bankName: 'IndusInd Bank',
  accountNumber: '258825164657',
  ifscCode: 'INDB0001548',
  instructions:
    '1. Scan dynamic QR using Google Pay, PhonePe, Paytm, BHIM, or Cred.\n2. Verify payee name "TechilyFly - InfiniCharm" & exact payable order amount.\n3. Complete payment in your UPI app.\n4. Enter the 12-digit UTR / UPI Reference Number below and submit order for verification.',
};

/**
 * Formats the transaction note strictly matching the requirement:
 * InfiniCharm Order - [ORDER_ID]
 */
export function formatUpiTransactionNote(orderId: string): string {
  const cleanOrderId = (orderId || '').trim();
  if (!cleanOrderId) return 'InfiniCharm Order';
  return `InfiniCharm Order - ${cleanOrderId}`;
}

/**
 * Constructs a standardized query string for UPI intents according to NPCI specifications.
 * Mandatory parameters: pa, pn, am, cu=INR, tn
 * Recommended reference parameter: tr (Transaction Reference ID)
 */
export function buildUpiQueryString(params: {
  upiId?: string;
  payeeName?: string;
  amountInRupees: string;
  orderId: string;
  transactionReference?: string;
}): string {
  const upiId = (params.upiId || DEFAULT_UPI_CREDENTIALS.upiId).trim();
  const payeeName = (params.payeeName || DEFAULT_UPI_CREDENTIALS.payeeName).trim();
  const amount = params.amountInRupees;
  const tn = formatUpiTransactionNote(params.orderId);
  const tr = (params.transactionReference || params.orderId || '').trim();

  const queryParts = [
    `pa=${encodeURIComponent(upiId)}`,
    `pn=${encodeURIComponent(payeeName)}`,
    `am=${amount}`,
    'cu=INR',
    `tn=${encodeURIComponent(tn)}`,
  ];

  if (tr) {
    queryParts.push(`tr=${encodeURIComponent(tr)}`);
  }

  return queryParts.join('&');
}

/**
 * Constructs a fully compliant NPCI UPI deep link (upi://pay)
 * carrying pa, pn, am, cu=INR, tn, and tr.
 */
export function generateUpiIntentUri(params: {
  upiId?: string;
  payeeName?: string;
  amountInRupees: string;
  orderId: string;
  transactionReference?: string;
}): string {
  const query = buildUpiQueryString(params);
  return `upi://pay?${query}`;
}

/**
 * Generates app-specific UPI deep links for supported Indian UPI applications
 * Useful for direct 1-tap app launching on iOS Safari and fallback scenarios.
 */
export function generateAppSpecificUpiUris(params: {
  upiId?: string;
  payeeName?: string;
  amountInRupees: string;
  orderId: string;
  transactionReference?: string;
}): UpiAppUris {
  const query = buildUpiQueryString(params);
  return {
    generic: `upi://pay?${query}`,
    phonePe: `phonepe://pay?${query}`,
    gPay: `tez://upi/pay?${query}`,
    paytm: `paytmmp://pay?${query}`,
    bhim: `bhim://pay?${query}`,
    cred: `cred://pay?${query}`,
  };
}

/**
 * Generates the authoritative HTTPS shareable payment link for an order.
 * This URL is universally copyable and shareable on WhatsApp, SMS, Telegram,
 * Email, and any browser address bar without breaking.
 */
export function generateShareablePaymentUrl(
  orderId: string,
  token?: string | null,
  context?: any
): string {
  return getPaymentUrl(orderId, token, context);
}

/**
 * Generates a pre-filled, friendly WhatsApp click-to-pay sharing link.
 * Allows customers or admins to share the payment request directly to WhatsApp chats.
 */
export function generateWhatsAppShareUrl(params: {
  orderId: string;
  amountInRupees: string;
  paymentUrl: string;
}): string {
  const text = [
    '🛍️ *InfiniCharm Order Payment*',
    '',
    `Order Reference: *${params.orderId}*`,
    `Payable Amount: *₹${params.amountInRupees}*`,
    '',
    'Click the link below to view order details and pay via any UPI app (GPay / PhonePe / Paytm / BHIM):',
    params.paymentUrl,
    '',
    '✓ 100% Genuine Heritage Harvesters | TechilyFly',
  ].join('\n');

  return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
}

/**
 * Generates centralized, synchronized payment details for:
 * 1. Dynamic QR Code generation
 * 2. Universal Direct UPI Payment link (upi://pay)
 * 3. App-specific UPI deep links (PhonePe, GPay, Paytm, BHIM, Cred)
 * 4. Shareable HTTPS Payment Link (https://infinicharm.com/pay/[ORDER_ID])
 * 5. Pre-filled WhatsApp Share Link
 */
export function generateUpiPaymentDetails(params: {
  credentials?: UpiCredentials;
  totalInPaise: number;
  orderId: string;
  transactionReference?: string;
  token?: string | null;
  context?: any;
}): UpiPaymentDetails {
  const creds = params.credentials || {};
  const upiId = (creds.upiId || DEFAULT_UPI_CREDENTIALS.upiId).trim();
  const upiNumber = (creds.upiNumber || DEFAULT_UPI_CREDENTIALS.upiNumber).trim();
  const payeeName = (creds.payeeName || DEFAULT_UPI_CREDENTIALS.payeeName).trim();
  const bankName = (creds.bankName || DEFAULT_UPI_CREDENTIALS.bankName).trim();
  const accountNumber = (creds.accountNumber || DEFAULT_UPI_CREDENTIALS.accountNumber).trim();
  const ifscCode = (creds.ifscCode || DEFAULT_UPI_CREDENTIALS.ifscCode).trim();

  const totalPaise = Math.max(0, params.totalInPaise || 0);
  const amountInRupees = (totalPaise / 100).toFixed(2);
  const orderId = (params.orderId || '').trim();
  const transactionReference = (params.transactionReference || orderId).trim();
  const transactionNote = formatUpiTransactionNote(orderId);

  const queryParams = {
    upiId,
    payeeName,
    amountInRupees,
    orderId,
    transactionReference,
  };

  const upiIntentUri = generateUpiIntentUri(queryParams);
  const appUris = generateAppSpecificUpiUris(queryParams);
  const shareablePaymentUrl = generateShareablePaymentUrl(orderId, params.token, params.context);
  const whatsAppShareUrl = generateWhatsAppShareUrl({
    orderId,
    amountInRupees,
    paymentUrl: shareablePaymentUrl,
  });

  const isAmountExceedingLimit = totalPaise > NPCI_UPI_SINGLE_TRANSACTION_LIMIT_PAISE;
  const isHighValueTransaction =
    totalPaise > BANK_UPI_ADVISORY_THRESHOLD_PAISE && !isAmountExceedingLimit;

  let limitWarningMessage: string | null = null;
  if (isAmountExceedingLimit) {
    limitWarningMessage =
      'NPCI UPI Transaction Limit Notice: Individual UPI transfers in India are capped at ₹1,00,000 by banking regulations. If paying via UPI, you can submit multiple split UTR numbers below, or choose Cards / NetBanking (PayGlocal) for single-transaction settlement.';
  } else if (isHighValueTransaction) {
    limitWarningMessage =
      'Bank Daily Limit Advisory: Certain Indian banks enforce a daily UPI limit of ₹25,000 to ₹50,000. If your bank declines a single payment, you can submit split payments and enter all UTR numbers below.';
  }

  return {
    upiId,
    upiNumber,
    payeeName,
    bankName,
    accountNumber,
    ifscCode,
    amountInRupees,
    amountInPaise: totalPaise,
    orderId,
    transactionNote,
    transactionReference,
    upiIntentUri,
    shareablePaymentUrl,
    whatsAppShareUrl,
    appUris,
    isAmountExceedingLimit,
    isHighValueTransaction,
    limitWarningMessage,
  };
}

/**
 * Generates a stable order number for checkout session
 * Format: INF-YYYYMM-XXXX
 */
export function generateCheckoutOrderNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const random = Math.floor(1000 + Math.random() * 9000);
  return `INF-${year}${month}-${random}`;
}

/**
 * Validates and parses UTR input supporting both single 12-digit UTR
 * and multiple comma-separated UTRs (for split payments due to bank limits).
 */
export function parseUtrInput(rawInput: string): UtrParseResult {
  if (!rawInput || !rawInput.trim()) {
    return {
      utrs: [],
      rawCleaned: '',
      isValid: false,
      isSplitPayment: false,
      error: 'Please enter the 12-digit UPI Transaction Reference / UTR Number after completing your payment.',
    };
  }

  // Split on commas, semicolons, or whitespace
  const rawSegments = rawInput
    .split(/[,;\n]+/)
    .map((s) => s.trim().replace(/[^a-zA-Z0-9]/g, ''))
    .filter(Boolean);

  if (rawSegments.length === 0) {
    return {
      utrs: [],
      rawCleaned: '',
      isValid: false,
      isSplitPayment: false,
      error: 'Please enter a valid 12-digit alphanumeric UPI Transaction Reference / UTR Number.',
    };
  }

  const validUtrs: string[] = [];
  const invalidSegments: string[] = [];

  for (const seg of rawSegments) {
    // UPI UTRs in India are strictly 12 digits, but some netbanking / wallet refs can be 10-18 alphanumeric chars
    if (seg.length >= 10 && seg.length <= 22) {
      validUtrs.push(seg);
    } else {
      invalidSegments.push(seg);
    }
  }

  if (invalidSegments.length > 0) {
    return {
      utrs: validUtrs,
      rawCleaned: rawSegments.join(', '),
      isValid: false,
      isSplitPayment: rawSegments.length > 1,
      error: `Invalid UTR reference "${invalidSegments[0]}". UPI UTR numbers must be at least 10-16 alphanumeric characters.`,
    };
  }

  return {
    utrs: validUtrs,
    rawCleaned: validUtrs.join(', '),
    isValid: validUtrs.length > 0,
    isSplitPayment: validUtrs.length > 1,
    error: null,
  };
}
