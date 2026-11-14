// ==============================================================================
// InfiniCharm — Payment Gateway Abstraction & Transaction Integrity Service
// Governing PRD: PRD 09 (Payment Architecture, Gateway Integrations & Transaction Integrity)
// Standard: Zero raw card storage (PCI-DSS SAQ-A), Integer Paise standard, Idempotent webhooks
// ==============================================================================

import crypto from 'crypto';
import type { PaymentMethod, PaymentStatus, PaymentRecord, RefundRecord } from '../../types/index.ts';

export interface CreatePaymentOrderParams {
  orderId: string;
  orderNumber: string;
  amountInPaise: number;
  currency?: string;
  customerEmail: string;
  customerPhone: string;
}

export interface ProviderOrderResult {
  success: boolean;
  provider: 'COD' | 'RAZORPAY' | 'STRIPE' | 'MANUAL' | 'UPI';
  providerOrderId: string;
  amountInPaise: number;
  currency: string;
  keyId?: string;
  notes?: Record<string, string>;
}

export interface VerifySignatureParams {
  orderId: string;
  paymentId: string;
  signature: string;
  secret: string;
}

export interface RefundRequestParams {
  orderId: string;
  paymentId: string;
  amountInPaise: number;
  reason: string;
  processedBy?: string;
}

/**
 * Validates cryptographic HMAC SHA-256 payment signature.
 * Prevents client-side manipulation of payment outcomes.
 */
export function verifyPaymentSignature({
  orderId,
  paymentId,
  signature,
  secret,
}: VerifySignatureParams): boolean {
  if (!orderId || !paymentId || !signature || !secret) {
    return false;
  }

  try {
    const payload = `${orderId}|${paymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch {
    return false;
  }
}

/**
 * Validates provider webhook signature to guard /api/webhooks endpoints against spoofing.
 */
export function validateWebhookSignature(
  rawBody: string,
  signatureHeader: string,
  webhookSecret: string
): boolean {
  if (!rawBody || !signatureHeader || !webhookSecret) {
    return false;
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signatureHeader, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch {
    return false;
  }
}

/**
 * Deterministic Payment State Machine transition validator.
 */
export function isValidPaymentTransition(
  currentStatus: PaymentStatus,
  targetStatus: PaymentStatus
): boolean {
  const allowedTransitions: Record<PaymentStatus, PaymentStatus[]> = {
    PENDING: ['UNDER_VERIFICATION', 'PAID', 'FAILED'],
    UNDER_VERIFICATION: ['PAID', 'FAILED', 'PENDING'],
    PAID: ['REFUNDED'],
    FAILED: ['PENDING', 'UNDER_VERIFICATION'], // Allow retry
    REFUNDED: [], // Terminal state
  };

  return allowedTransitions[currentStatus]?.includes(targetStatus) || false;
}

/**
 * Formats a human-readable summary of payment methods for Indian checkouts.
 */
export function formatPaymentMethodLabel(method: PaymentMethod): string {
  const labels: Record<PaymentMethod, string> = {
    CUSTOM_UPI: 'Custom UPI Direct (Dynamic QR & Mobile Intent)',
    PAYGLOCAL: 'PayGlocal Global Multi-Currency Gateway',
    COD: 'Cash on Delivery (Pay upon arrival)',
    UPI: 'Instant UPI (Google Pay, PhonePe, Paytm, BHIM)',
    CARDS: 'Credit / Debit Cards (RuPay, Visa, Mastercard)',
    NET_BANKING: 'Net Banking (All Major Indian Banks)',
    WALLET: 'Digital Wallets & PayLater',
  };

  return labels[method] || method;
}

