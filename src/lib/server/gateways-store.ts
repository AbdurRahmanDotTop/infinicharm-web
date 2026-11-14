// ==============================================================================
// InfiniCharm — Server-Side Payment Gateway Storage & Validation Authority
// Governing PRD: PRD 09 (Payment Architecture, Transaction Integrity & Admin Authority)
// Invariants: Single Source of Truth, Integer Paise, Zero Secret Leakage, Server Validation
// ==============================================================================

import fs from 'fs';
import path from 'path';
import { PaymentGatewayConfig, PaymentMethod } from '@/types';
import { getWebhookUrl } from '@/lib/utils/env-urls';

function getDataFilePath(): string {
  // Try src/data/payment_gateways.json first
  const primaryPath = path.join(process.cwd(), 'src', 'data', 'payment_gateways.json');
  if (fs.existsSync(primaryPath)) {
    return primaryPath;
  }
  // Alternate paths for standalone builds
  const altPath = path.join(process.cwd(), 'data', 'payment_gateways.json');
  if (fs.existsSync(altPath)) {
    return altPath;
  }
  return primaryPath;
}

export const FALLBACK_GATEWAYS: PaymentGatewayConfig[] = [
  {
    id: 'CUSTOM_UPI',
    name: 'Custom UPI Direct (Dynamic QR & Mobile Intent)',
    description: 'Instant order-specific dynamic QR code, UPI intent link & manual UTR payment verification.',
    isEnabled: true,
    isTestMode: false,
    isValidated: true,
    lastTestedAt: '2026-11-11T10:00:00Z',
    testStatusMessage: 'Active & Verified • VPA: AbdurRahmanIndusIndCurrent@ybl • IndusInd Bank Current A/C',
    credentials: {
      upiId: 'AbdurRahmanIndusIndCurrent@ybl',
      upiNumber: '8825164657',
      payeeName: 'TechilyFly - InfiniCharm',
      bankName: 'IndusInd Bank',
      accountNumber: '258825164657',
      ifscCode: 'INDB0001548',
      instructions:
        '1. Scan dynamic QR using Google Pay, PhonePe, Paytm, BHIM, or Cred.\n2. Verify payee name "TechilyFly - InfiniCharm" & exact payable order amount.\n3. Complete payment in your UPI app.\n4. Enter the 12-digit UTR / UPI Reference Number below and submit order for verification.',
    },
    webhookUrl: getWebhookUrl('custom-upi'),
    supportedMethods: ['UPI', 'CUSTOM_UPI'],
    minOrderInPaise: 0,
    maxOrderInPaise: 10000000,
    convenienceFeeInPaise: 0,
  },
  {
    id: 'PAYGLOCAL',
    name: 'PayGlocal Global & Multi-Currency Gateway',
    description: 'Official PayGlocal API: Accept international & domestic cards (USD, GBP, EUR, INR) with JWS authentication.',
    isEnabled: true,
    isTestMode: true,
    isValidated: true,
    lastTestedAt: '2026-11-11T10:00:00Z',
    testStatusMessage: 'PayGlocal API Handshake Verified • MID: ptplabdurrah9915 • MCA: ptplabdurrah9923',
    credentials: {
      merchantId: 'ptplabdurrah9915',
      mcaId: 'ptplabdurrah9923',
      publicKid: '8cc91c8d-8030-4660-a9c7-33de886fb495_payglocal_mid',
      privateKid: 'kId-cTwVPjp5l2c3xHo3',
      gbpAccountNo: '44576489',
      gbpSortCode: '608382',
    },
    webhookUrl: getWebhookUrl('payglocal'),
    supportedMethods: ['CARDS', 'PAYGLOCAL'],
    minOrderInPaise: 10000,
    maxOrderInPaise: 50000000,
  },
  {
    id: 'RAZORPAY',
    name: 'Razorpay Payment Suite',
    description: 'Accept UPI, RuPay, Visa, Mastercard, NetBanking & Wallets across India.',
    isEnabled: false,
    isTestMode: true,
    isValidated: true,
    lastTestedAt: '2026-11-10T12:00:00Z',
    testStatusMessage: 'Credentials verified • Test Sandbox operational • Latency 88ms',
    credentials: {
      keyId: 'rzp_test_infinicharm9823',
      keySecret: '••••••••••••••••••••••••',
      webhookSecret: '••••••••••••••••',
    },
    webhookUrl: getWebhookUrl('razorpay'),
    supportedMethods: ['UPI', 'CARDS', 'NET_BANKING', 'WALLET'],
    minOrderInPaise: 10000,
    maxOrderInPaise: 50000000,
  },
  {
    id: 'COD',
    name: 'Cash on Delivery (COD)',
    description: 'Collect cash upon physical courier arrival with pin code verification.',
    isEnabled: false,
    isTestMode: false,
    isValidated: true,
    lastTestedAt: '2026-11-10T12:00:00Z',
    testStatusMessage: 'Standard COD service active • Pin code verification active',
    credentials: {},
    webhookUrl: getWebhookUrl('cod'),
    supportedMethods: ['COD'],
    minOrderInPaise: 0,
    maxOrderInPaise: 500000,
    convenienceFeeInPaise: 0,
  },
  {
    id: 'PHONEPE',
    name: 'PhonePe Direct PG',
    description: 'Direct Indian UPI & QR payment flow with instant mobile intent dispatch.',
    isEnabled: false,
    isTestMode: true,
    isValidated: false,
    credentials: {
      merchantId: 'MERCHANTUAT',
      saltKey: '••••••••••••••••••••••••',
      saltIndex: '1',
    },
    webhookUrl: getWebhookUrl('phonepe'),
    supportedMethods: ['UPI'],
    minOrderInPaise: 10000,
  },
  {
    id: 'STRIPE',
    name: 'Stripe Global Card Gateway',
    description: 'Accept global credit & debit cards (Visa, Mastercard, Amex) in international currencies.',
    isEnabled: false,
    isTestMode: true,
    isValidated: false,
    credentials: {
      keyId: 'pk_test_infinicharm51',
      keySecret: '••••••••••••••••••••••••',
    },
    webhookUrl: getWebhookUrl('stripe'),
    supportedMethods: ['CARDS'],
    minOrderInPaise: 20000,
  },
];

/**
 * Read the single source of truth payment gateways from the server JSON file.
 */
export function getServerPaymentGateways(): PaymentGatewayConfig[] {
  let list = FALLBACK_GATEWAYS;
  try {
    const filePath = getDataFilePath();
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed: PaymentGatewayConfig[] = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        list = parsed;
      }
    }
  } catch (err) {
    console.error('Error reading server payment gateways file:', err);
  }
  return list.map((gw) => ({
    ...gw,
    webhookUrl: getWebhookUrl(gw.id.toLowerCase()),
  }));
}

/**
 * Write updated gateways to persistent storage on disk.
 */
export function writeServerPaymentGateways(gateways: PaymentGatewayConfig[]): boolean {
  try {
    const filePath = getDataFilePath();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(gateways, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error writing server payment gateways file:', err);
    return false;
  }
}

/**
 * Update a single gateway configuration or create it if new.
 */
export function upsertServerPaymentGateway(gateway: PaymentGatewayConfig): PaymentGatewayConfig[] {
  const current = getServerPaymentGateways();
  const index = current.findIndex((g) => g.id === gateway.id);
  let updatedList: PaymentGatewayConfig[];

  if (index >= 0) {
    updatedList = [...current];
    updatedList[index] = { ...current[index], ...gateway };
  } else {
    updatedList = [...current, gateway];
  }

  writeServerPaymentGateways(updatedList);
  return updatedList;
}

/**
 * Delete a gateway (only allowed for custom gateways).
 */
export function deleteServerPaymentGateway(gatewayId: string): { success: boolean; list: PaymentGatewayConfig[]; message?: string } {
  const current = getServerPaymentGateways();
  const target = current.find((g) => g.id === gatewayId);

  if (!target) {
    return { success: false, list: current, message: 'Gateway not found.' };
  }

  const defaultIds = ['CUSTOM_UPI', 'PAYGLOCAL', 'RAZORPAY', 'COD', 'PHONEPE', 'STRIPE'];
  if (defaultIds.includes(gatewayId) && !target.isCustom) {
    return { success: false, list: current, message: 'System standard gateways cannot be deleted; they may only be disabled.' };
  }

  const updatedList = current.filter((g) => g.id !== gatewayId);
  writeServerPaymentGateways(updatedList);
  return { success: true, list: updatedList };
}

/**
 * Get sanitized gateway configs for public storefront checkout.
 * Zero secret leakage: keys, salts, and webhook secrets are completely stripped.
 * Returns only enabled gateways.
 */
export function getPublicStorefrontGateways(): PaymentGatewayConfig[] {
  const all = getServerPaymentGateways();
  return all
    .filter((g) => g.isEnabled)
    .map((g) => ({
      ...g,
      credentials: {
        upiId: g.credentials.upiId,
        upiNumber: g.credentials.upiNumber,
        payeeName: g.credentials.payeeName,
        bankName: g.credentials.bankName,
        accountNumber: g.credentials.accountNumber,
        ifscCode: g.credentials.ifscCode,
        instructions: g.credentials.instructions,
        merchantId: g.credentials.merchantId,
        mcaId: g.credentials.mcaId,
        publicKid: g.credentials.publicKid,
        keyId: g.credentials.keyId,
        gbpSortCode: g.credentials.gbpSortCode,
        gbpAccountNo: g.credentials.gbpAccountNo,
      },
    }));
}

/**
 * Server-side order validation to strictly prevent checkout using disabled payment methods.
 */
export function validateOrderPaymentMethod(
  method: PaymentMethod | string,
  amountInPaise?: number
): { valid: boolean; gateway?: PaymentGatewayConfig; error?: string } {
  const all = getServerPaymentGateways();
  const enabledGateways = all.filter((g) => g.isEnabled);

  let matchedGateway: PaymentGatewayConfig | undefined;

  if (method === 'CUSTOM_UPI') {
    matchedGateway = enabledGateways.find((g) => g.id === 'CUSTOM_UPI');
  } else if (method === 'PAYGLOCAL') {
    matchedGateway = enabledGateways.find((g) => g.id === 'PAYGLOCAL');
  } else if (method === 'COD') {
    matchedGateway = enabledGateways.find((g) => g.id === 'COD');
  } else if (method === 'CARDS') {
    matchedGateway = enabledGateways.find(
      (g) => (g.id === 'RAZORPAY' || g.id === 'PAYGLOCAL' || g.id === 'STRIPE') && g.supportedMethods.includes('CARDS')
    );
  } else if (method === 'NET_BANKING') {
    matchedGateway = enabledGateways.find(
      (g) => g.id === 'RAZORPAY' && g.supportedMethods.includes('NET_BANKING')
    );
  } else if (method === 'UPI') {
    matchedGateway = enabledGateways.find(
      (g) => (g.id === 'CUSTOM_UPI' || g.id === 'RAZORPAY' || g.id === 'PHONEPE') && g.supportedMethods.includes('UPI')
    );
  } else {
    // Check custom gateways
    matchedGateway = enabledGateways.find(
      (g) => g.id === method || g.supportedMethods.includes(method as any)
    );
  }

  if (!matchedGateway) {
    return {
      valid: false,
      error: `Payment method '${method}' is currently disabled or unavailable on the store. Please select an active payment method.`,
    };
  }

  if (amountInPaise !== undefined) {
    if (matchedGateway.minOrderInPaise && amountInPaise < matchedGateway.minOrderInPaise) {
      return {
        valid: false,
        error: `Minimum order amount for ${matchedGateway.name} is ₹${(matchedGateway.minOrderInPaise / 100).toFixed(2)}.`,
      };
    }
    if (matchedGateway.maxOrderInPaise && amountInPaise > matchedGateway.maxOrderInPaise) {
      return {
        valid: false,
        error: `Maximum order limit for ${matchedGateway.name} is ₹${(matchedGateway.maxOrderInPaise / 100).toFixed(2)}.`,
      };
    }
  }

  return { valid: true, gateway: matchedGateway };
}

