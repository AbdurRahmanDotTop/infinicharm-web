import { describe, it } from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';
import {
  isValidPaymentTransition,
  verifyPaymentSignature,
  validateWebhookSignature,
  formatPaymentMethodLabel,
} from '../../src/lib/services/payment.ts';
import {
  isValidOrderTransition,
  shouldRestockOnTransition,
  getCourierTrackingUrl,
  verifyGuestOrderAuthorization,
  isOrderOwnedByCustomer,
  sanitizeOrderForPublicTracking,
} from '../../src/lib/services/orders.ts';
import {
  canCustomerReviewProduct,
  validateReviewSubmission,
} from '../../src/lib/services/reviews.ts';
import type { Order } from '../../src/types/index.ts';

describe('Payment Architecture & Transaction Integrity (PRD 09)', () => {
  const secret = 'test_webhook_and_payment_secret_2026';

  it('validates authentic cryptographic payment HMAC signatures and rejects tampered ones', () => {
    const orderId = 'order_test_1001';
    const paymentId = 'pay_test_2002';
    const payload = `${orderId}|${paymentId}`;
    const validSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    const isValid = verifyPaymentSignature({
      orderId,
      paymentId,
      signature: validSignature,
      secret,
    });
    assert.strictEqual(isValid, true);

    const isTampered = verifyPaymentSignature({
      orderId,
      paymentId: 'pay_fraud_9999',
      signature: validSignature,
      secret,
    });
    assert.strictEqual(isTampered, false);
  });

  it('verifies provider webhook payload signatures for idempotent webhook handling', () => {
    const rawBody = JSON.stringify({ event: 'payment.captured', id: 'pay_999' });
    const signature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    const validWebhook = validateWebhookSignature(rawBody, signature, secret);
    assert.strictEqual(validWebhook, true);

    const tamperedWebhook = validateWebhookSignature(rawBody + 'tamper', signature, secret);
    assert.strictEqual(tamperedWebhook, false);
  });

  it('enforces deterministic Payment State Machine transitions', () => {
    assert.strictEqual(isValidPaymentTransition('PENDING', 'PAID'), true);
    assert.strictEqual(isValidPaymentTransition('PENDING', 'FAILED'), true);
    assert.strictEqual(isValidPaymentTransition('PAID', 'REFUNDED'), true);
    assert.strictEqual(isValidPaymentTransition('FAILED', 'PENDING'), true); // Allow retry

    // Terminal states cannot transition
    assert.strictEqual(isValidPaymentTransition('REFUNDED', 'PAID'), false);
    assert.strictEqual(isValidPaymentTransition('PAID', 'PENDING'), false);
  });

  it('formats verified payment rail labels', () => {
    assert.ok(formatPaymentMethodLabel('COD').includes('Cash on Delivery'));
    assert.ok(formatPaymentMethodLabel('UPI').includes('Google Pay'));
  });
});

describe('Order Lifecycle State Machine & Logistics (PRD 10)', () => {
  it('enforces sequential Order State Machine transitions and prevents illegal jumps', () => {
    assert.strictEqual(isValidOrderTransition('PENDING', 'CONFIRMED'), true);
    assert.strictEqual(isValidOrderTransition('CONFIRMED', 'PROCESSING'), true);
    assert.strictEqual(isValidOrderTransition('PROCESSING', 'SHIPPED'), true);
    assert.strictEqual(isValidOrderTransition('SHIPPED', 'DELIVERED'), true);
    assert.strictEqual(isValidOrderTransition('DELIVERED', 'RETURNED'), true);
    assert.strictEqual(isValidOrderTransition('RETURNED', 'REFUNDED'), true);

    // Illegal state jumps must be rejected
    assert.strictEqual(isValidOrderTransition('DELIVERED', 'CONFIRMED'), false);
    assert.strictEqual(isValidOrderTransition('CANCELLED', 'PROCESSING'), false);
    assert.strictEqual(isValidOrderTransition('REFUNDED', 'DELIVERED'), false);
  });

  it('correctly triggers stock restocking for cancellations and returns', () => {
    assert.strictEqual(shouldRestockOnTransition('CONFIRMED', 'CANCELLED'), true);
    assert.strictEqual(shouldRestockOnTransition('PROCESSING', 'CANCELLED'), true);
    assert.strictEqual(shouldRestockOnTransition('SHIPPED', 'CANCELLED'), true);
    assert.strictEqual(shouldRestockOnTransition('DELIVERED', 'RETURNED'), true);

    // Normal forward transitions must NOT trigger restocking
    assert.strictEqual(shouldRestockOnTransition('PENDING', 'CONFIRMED'), false);
    assert.strictEqual(shouldRestockOnTransition('CONFIRMED', 'PROCESSING'), false);
  });

  it('generates direct tracking deep-links for Blue Dart, Delhivery, DTDC', () => {
    const blueDart = getCourierTrackingUrl('Blue Dart', 'BD123456IN');
    assert.ok(blueDart?.includes('bluedart.com'));
    assert.ok(blueDart?.includes('BD123456IN'));

    const delhivery = getCourierTrackingUrl('Delhivery', 'DLH987654');
    assert.ok(delhivery?.includes('delhivery.com'));
    assert.ok(delhivery?.includes('DLH987654'));
  });

  it('protects against IDOR data scraping on guest track order queries', () => {
    const mockOrder: Order = {
      id: 'ord-1',
      orderNumber: 'INF-202611-1001',
      customerEmail: 'abdurrahman@infinicharm.com',
      customerPhone: '9876543210',
      status: 'SHIPPED',
      subtotalInPaise: 49900,
      discountInPaise: 0,
      shippingInPaise: 0,
      taxInPaise: 2495,
      totalInPaise: 49900,
      paymentMethod: 'COD',
      paymentStatus: 'PENDING',
      shippingAddress: {} as any,
      billingAddress: {} as any,
      items: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    assert.strictEqual(verifyGuestOrderAuthorization(mockOrder, 'abdurrahman@infinicharm.com'), true);
    assert.strictEqual(verifyGuestOrderAuthorization(mockOrder, '9876543210'), true);
    assert.strictEqual(verifyGuestOrderAuthorization(mockOrder, 'attacker@evil.com'), false);
    assert.strictEqual(verifyGuestOrderAuthorization(mockOrder, '1111111111'), false);
  });
});

describe('Customer Portal & Verified Purchase Review Moderation (PRD 11)', () => {
  it('enforces Zero Fake Reviews invariant: strictly requires a verified DELIVERED purchase', () => {
    const deliveredOrder: Order = {
      id: 'ord-deliv',
      orderNumber: 'INF-202611-1002',
      customerId: 'cust-123',
      customerEmail: 'customer@infinicharm.com',
      customerPhone: '9876543210',
      status: 'DELIVERED',
      subtotalInPaise: 49900,
      discountInPaise: 0,
      shippingInPaise: 0,
      taxInPaise: 2495,
      totalInPaise: 49900,
      paymentMethod: 'UPI',
      paymentStatus: 'PAID',
      shippingAddress: {} as any,
      billingAddress: {} as any,
      items: [
        {
          id: 'item-1',
          orderId: 'ord-deliv',
          productId: 'prod-oil',
          variantId: 'var-1',
          productTitle: 'Mustard Oil',
          variantTitle: '1 Litre',
          sku: 'INF-OIL-1L',
          priceInPaise: 49900,
          quantity: 1,
          totalInPaise: 49900,
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Case 1: Customer has a DELIVERED order for prod-oil -> Can review
    const eligible = canCustomerReviewProduct('cust-123', 'prod-oil', [deliveredOrder]);
    assert.strictEqual(eligible.canReview, true);

    // Case 2: Customer has NOT purchased prod-honey -> Blocked
    const ineligible = canCustomerReviewProduct('cust-123', 'prod-honey', [deliveredOrder]);
    assert.strictEqual(ineligible.canReview, false);
    assert.ok(ineligible.reason?.includes('purchased and received'));

    // Case 3: Order is SHIPPED but not yet DELIVERED -> Blocked until delivery
    const shippedOrder = { ...deliveredOrder, status: 'SHIPPED' as const };
    const notYetDelivered = canCustomerReviewProduct('cust-123', 'prod-oil', [shippedOrder]);
    assert.strictEqual(notYetDelivered.canReview, false);
  });

  it('validates review submission ratings and character minimums', () => {
    const valid = validateReviewSubmission(5, 'Authentic aroma and pure quality. Highly recommended!');
    assert.strictEqual(valid.isValid, true);
    assert.strictEqual(valid.errors.length, 0);

    const invalidRating = validateReviewSubmission(6, 'Too high rating.');
    assert.strictEqual(invalidRating.isValid, false);

    const tooShort = validateReviewSubmission(5, 'Bad');
    assert.strictEqual(tooShort.isValid, false);
    assert.ok(tooShort.errors[0].includes('at least 10 characters'));
  });
});

describe('Track Order Privacy & Ownership Enforcement', () => {
  const sampleOrder: Order = {
    id: 'ord-privacy-1',
    orderNumber: 'INF-202611-9001',
    customerId: 'cust-owner-1',
    customerEmail: 'owner@infinicharm.com',
    customerPhone: '+919876543210',
    status: 'SHIPPED',
    subtotalInPaise: 240000,
    taxInPaise: 12000,
    discountInPaise: 0,
    shippingInPaise: 5000,
    totalInPaise: 245000,
    paymentMethod: 'CUSTOM_UPI',
    paymentStatus: 'PAID',
    utrNumber: '123456789012',
    courierName: 'Blue Dart Express',
    trackingNumber: 'BLU99887766',
    shippingAddress: {
      id: 'addr-1',
      label: 'Home',
      recipientName: 'Owner Customer',
      phone: '+919876543210',
      addressLine1: '123 Secret Street',
      city: 'Motihari',
      state: 'Bihar',
      pincode: '845427',
    } as any,
    billingAddress: {
      id: 'addr-1',
      recipientName: 'Owner Customer',
      addressLine1: '123 Secret Street',
    } as any,
    customerNotes: 'Leave near gate',
    items: [
      {
        id: 'item-1',
        orderId: 'ord-privacy-1',
        productId: 'prod-1',
        variantId: 'var-1',
        productTitle: '100% Kashmiri Honey',
        variantTitle: 'Standard Pack',
        sku: 'S-01-P-01',
        priceInPaise: 240000,
        quantity: 1,
        totalInPaise: 240000,
      },
    ],
    timeline: [
      {
        id: 'evt-public',
        status: 'SHIPPED',
        title: 'Consignment Shipped',
        description: 'Dispatched via Blue Dart',
        location: 'Motihari Hub',
        timestamp: new Date().toISOString(),
        actor: 'Ops',
        isCustomerVisible: true,
        type: 'LOGISTICS',
      },
      {
        id: 'evt-internal',
        status: 'SHIPPED',
        title: 'Internal Ops Note',
        description: 'Sensitive admin note',
        location: 'Internal',
        timestamp: new Date().toISOString(),
        actor: 'Admin',
        isCustomerVisible: false,
        type: 'FULFILLMENT',
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('strictly grants ownership only to non-suspended matching customer accounts', () => {
    assert.strictEqual(isOrderOwnedByCustomer(sampleOrder, null), false);
    assert.strictEqual(isOrderOwnedByCustomer(sampleOrder, undefined), false);
    assert.strictEqual(
      isOrderOwnedByCustomer(sampleOrder, { id: 'cust-other', email: 'other@infinicharm.com', status: 'ACTIVE' }),
      false
    );
    // Even if email somehow matches on a registered customerId order, different customerId must be rejected
    assert.strictEqual(
      isOrderOwnedByCustomer(sampleOrder, { id: 'cust-other', email: 'owner@infinicharm.com', status: 'ACTIVE' }),
      false
    );
    assert.strictEqual(
      isOrderOwnedByCustomer(sampleOrder, { id: 'cust-owner-1', email: 'owner@infinicharm.com', status: 'SUSPENDED' }),
      false
    );
    assert.strictEqual(
      isOrderOwnedByCustomer(sampleOrder, { id: 'cust-owner-1', email: 'owner@infinicharm.com', status: 'ACTIVE' }),
      true
    );

    // Guest order falls back to verified email matching
    const guestOrder: Order = { ...sampleOrder, customerId: 'guest' };
    assert.strictEqual(
      isOrderOwnedByCustomer(guestOrder, { id: 'cust-registered', email: 'OWNER@infinicharm.com', status: 'ACTIVE' }),
      true
    );
    assert.strictEqual(
      isOrderOwnedByCustomer(guestOrder, { id: 'cust-registered', email: 'other@infinicharm.com', status: 'ACTIVE' }),
      false
    );
  });

  it('redacts items, delivery addresses, customer PII, financials, and internal timeline events from public tracking', () => {
    const sanitized = sanitizeOrderForPublicTracking(sampleOrder) as unknown as Record<string, unknown>;

    assert.strictEqual(sanitized.orderNumber, 'INF-202611-9001');
    assert.strictEqual(sanitized.status, 'SHIPPED');
    assert.strictEqual(sanitized.courierName, 'Blue Dart Express');
    assert.strictEqual(sanitized.trackingNumber, 'BLU99887766');

    assert.strictEqual('items' in sanitized, false);
    assert.strictEqual('shippingAddress' in sanitized, false);
    assert.strictEqual('billingAddress' in sanitized, false);
    assert.strictEqual('customerName' in sanitized, false);
    assert.strictEqual('customerEmail' in sanitized, false);
    assert.strictEqual('customerPhone' in sanitized, false);
    assert.strictEqual('customerNotes' in sanitized, false);
    assert.strictEqual('customerId' in sanitized, false);
    assert.strictEqual('subtotalInPaise' in sanitized, false);
    assert.strictEqual('totalInPaise' in sanitized, false);

    const visibleTimeline = sanitized.timeline as Array<{ id: string }>;
    assert.strictEqual(visibleTimeline.length, 1);
    assert.strictEqual(visibleTimeline[0].id, 'evt-public');
  });
});

