// ==============================================================================
// InfiniCharm — Order Fulfillment State Machine & Logistics Service
// Governing PRD: PRD 10 (Order Management, Fulfillment Lifecycle & Logistics)
// Standards: Deterministic state machine, Automatic restock trigger, IDOR defense
// ==============================================================================

import type {
  OrderStatus,
  PaymentStatus,
  Order,
  OrderTimelineEvent,
  PaymentMethod,
} from '../../types/index.ts';

export type OrderAccessState = 'AUTHORIZED' | 'UNAUTHENTICATED' | 'WRONG_ACCOUNT';

export interface OrderPrivacyMeta {
  isAuthenticated: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  canViewPrivateDetails: boolean;
  accessState: OrderAccessState;
}

export interface PublicTrackedOrder {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  manualApprovalStatus?: Order['manualApprovalStatus'];
  utrNumber?: string;
  rejectionReason?: string;
  courierName?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  estimatedDeliveryDate?: string;
  actualDeliveryDate?: string;
  timeline: OrderTimelineEvent[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Strictly verifies whether an authenticated customer owns the given order.
 * Non-guest orders require an exact customerId match. Guest orders match only on verified account email.
 */
export function isOrderOwnedByCustomer(
  order: Order,
  customer: { id: string; email?: string; phone?: string; status?: string } | null | undefined
): boolean {
  if (!customer || customer.status === 'SUSPENDED') {
    return false;
  }

  if (order.customerId && order.customerId !== 'guest') {
    return order.customerId === customer.id;
  }

  if (order.customerEmail && customer.email) {
    if (order.customerEmail.trim().toLowerCase() === customer.email.trim().toLowerCase()) {
      return true;
    }
  }

  if (customer.phone) {
    const cleanCustPhone = customer.phone.replace(/\D/g, '').slice(-10);
    const cleanOrderPhone = (order.customerPhone || order.shippingAddress?.phone || '').replace(/\D/g, '').slice(-10);
    if (cleanCustPhone && cleanOrderPhone && cleanCustPhone === cleanOrderPhone) {
      return true;
    }
  }

  return false;
}

/**
 * Removes all private customer PII, consignment items, delivery addresses, and financial totals
 * before returning an order to unauthenticated visitors or non-owner accounts.
 */
export function sanitizeOrderForPublicTracking(order: Order): PublicTrackedOrder {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    manualApprovalStatus: order.manualApprovalStatus,
    utrNumber: order.utrNumber,
    rejectionReason: order.rejectionReason,
    courierName: order.courierName,
    trackingNumber: order.trackingNumber,
    trackingUrl: order.trackingUrl,
    estimatedDeliveryDate: order.estimatedDeliveryDate,
    actualDeliveryDate: order.actualDeliveryDate,
    timeline: (order.timeline || []).filter((ev) => ev.isCustomerVisible !== false),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

export const SUPPORTED_COURIERS = [
  { name: 'Delhivery Surface / Express', shortCode: 'delhivery', trackingUrl: 'https://www.delhivery.com/track/package/{TRACKING}' },
  { name: 'Blue Dart Express', shortCode: 'bluedart', trackingUrl: 'https://www.bluedart.com/tracking?track={TRACKING}' },
  { name: 'DTDC Courier & Cargo', shortCode: 'dtdc', trackingUrl: 'https://www.dtdc.in/tracking/tracking_results.asp?trkid={TRACKING}' },
  { name: 'India Post Speed Post', shortCode: 'indiapost', trackingUrl: 'https://www.indiapost.gov.in/_layouts/15/dpt.cpt.tracking/trackconsignment.aspx' },
  { name: 'Xpressbees', shortCode: 'xpressbees', trackingUrl: 'https://www.xpressbees.com/track?tracking_id={TRACKING}' },
  { name: 'Shadowfax Logistics', shortCode: 'shadowfax', trackingUrl: 'https://tracker.shadowfax.in/#/track/{TRACKING}' },
] as const;

export const ORDER_STATUS_LABELS: Record<OrderStatus, { label: string; badgeClass: string; description: string }> = {
  PENDING: {
    label: 'Pending',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
    description: 'Order placed; awaiting payment verification or confirmation',
  },
  PAYMENT_RECEIVED: {
    label: 'Payment Received',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
    description: 'Payment successfully received and verified; awaiting confirmation',
  },
  PAYMENT_NOT_RECEIVED: {
    label: 'Payment Not Received',
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
    description: 'Payment was not received or failed bank reconciliation; customer may retry payment',
  },
  CONFIRMED: {
    label: 'Confirmed',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
    description: 'Payment verified / COD order confirmed by merchant',
  },
  PROCESSING: {
    label: 'Processing',
    badgeClass: 'bg-blue-50 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
    description: 'Order sent to fulfillment warehouse for item picking',
  },
  PACKED: {
    label: 'Packed',
    badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-300 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
    description: 'Items packed in tamper-proof seal and invoice attached',
  },
  READY_FOR_DISPATCH: {
    label: 'Ready for Dispatch',
    badgeClass: 'bg-purple-50 text-purple-800 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
    description: 'Manifest created; awaiting pickup by courier partner',
  },
  SHIPPED: {
    label: 'Shipped / In Transit',
    badgeClass: 'bg-teal-50 text-teal-800 border-teal-300 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800',
    description: 'Handed over to courier; in transit to delivery destination',
  },
  OUT_FOR_DELIVERY: {
    label: 'Out for Delivery',
    badgeClass: 'bg-cyan-50 text-cyan-800 border-cyan-300 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800',
    description: 'Arrived at local hub; rider out for final doorstep delivery',
  },
  DELIVERED: {
    label: 'Delivered',
    badgeClass: 'bg-green-50 text-green-800 border-green-300 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800',
    description: 'Consignment successfully delivered to recipient',
  },
  DELIVERY_ATTEMPTED: {
    label: 'Delivery Attempted',
    badgeClass: 'bg-orange-50 text-orange-800 border-orange-300 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800',
    description: 'Courier attempted delivery; door locked or recipient unavailable',
  },
  RTO_INITIATED: {
    label: 'RTO Initiated',
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
    description: 'Return to Origin initiated due to non-delivery',
  },
  RTO_DELIVERED: {
    label: 'RTO Delivered',
    badgeClass: 'bg-zinc-100 text-zinc-800 border-zinc-300 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-700',
    description: 'Consignment returned back to merchant warehouse',
  },
  CANCELLED: {
    label: 'Cancelled',
    badgeClass: 'bg-red-50 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800',
    description: 'Order cancelled by customer or rejected by admin',
  },
  RETURN_REQUESTED: {
    label: 'Return Requested',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
    description: 'Customer requested return of items',
  },
  RETURN_APPROVED: {
    label: 'Return Approved',
    badgeClass: 'bg-blue-50 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
    description: 'Return approved; reverse pickup scheduled',
  },
  RETURNED: {
    label: 'Returned',
    badgeClass: 'bg-zinc-100 text-zinc-800 border-zinc-300 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-700',
    description: 'Items received back at warehouse and inspected',
  },
  REFUNDED: {
    label: 'Refunded',
    badgeClass: 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
    description: 'Payment fully refunded to source account',
  },
};

/**
 * Deterministic Order State Machine Transition Table.
 * Prevents illegal state jumps while supporting all operational paths.
 */
export function isValidOrderTransition(
  currentStatus: OrderStatus,
  targetStatus: OrderStatus
): boolean {
  if (currentStatus === targetStatus) return true;

  const validTransitions: Record<OrderStatus, OrderStatus[]> = {
    PENDING: ['PAYMENT_RECEIVED', 'PAYMENT_NOT_RECEIVED', 'CONFIRMED', 'CANCELLED'],
    PAYMENT_RECEIVED: ['CONFIRMED', 'PROCESSING', 'PAYMENT_NOT_RECEIVED', 'CANCELLED'],
    PAYMENT_NOT_RECEIVED: ['PENDING', 'PAYMENT_RECEIVED', 'CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['PROCESSING', 'PACKED', 'READY_FOR_DISPATCH', 'SHIPPED', 'CANCELLED'],
    PROCESSING: ['PACKED', 'READY_FOR_DISPATCH', 'SHIPPED', 'CANCELLED'],
    PACKED: ['READY_FOR_DISPATCH', 'SHIPPED', 'CANCELLED'],
    READY_FOR_DISPATCH: ['SHIPPED', 'CANCELLED'],
    SHIPPED: ['OUT_FOR_DELIVERY', 'DELIVERY_ATTEMPTED', 'DELIVERED', 'RTO_INITIATED', 'CANCELLED'],
    OUT_FOR_DELIVERY: ['DELIVERED', 'DELIVERY_ATTEMPTED', 'RTO_INITIATED', 'CANCELLED'],
    DELIVERY_ATTEMPTED: ['OUT_FOR_DELIVERY', 'DELIVERED', 'RTO_INITIATED', 'CANCELLED'],
    RTO_INITIATED: ['RTO_DELIVERED', 'CANCELLED'],
    RTO_DELIVERED: ['CANCELLED', 'REFUNDED'],
    DELIVERED: ['RETURN_REQUESTED', 'RETURNED'],
    RETURN_REQUESTED: ['RETURN_APPROVED', 'DELIVERED', 'CANCELLED'],
    RETURN_APPROVED: ['RETURNED'],
    RETURNED: ['REFUNDED'],
    CANCELLED: [], // Terminal
    REFUNDED: [], // Terminal
  };

  return validTransitions[currentStatus]?.includes(targetStatus) || false;
}

/**
 * Determines whether an order is currently eligible for payment retry or Pay Now.
 */
export function isOrderEligibleForPaymentRetry(order: Order | null | undefined): boolean {
  if (!order) return false;
  if (order.paymentStatus === 'PAID' || order.status === 'PAYMENT_RECEIVED') return false;
  const terminalOrDispatched: OrderStatus[] = [
    'PAYMENT_RECEIVED',
    'CONFIRMED',
    'PROCESSING',
    'PACKED',
    'READY_FOR_DISPATCH',
    'SHIPPED',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'CANCELLED',
    'RETURN_REQUESTED',
    'RETURN_APPROVED',
    'RETURNED',
    'REFUNDED',
  ];
  if (terminalOrDispatched.includes(order.status)) return false;
  if (order.status === 'PAYMENT_NOT_RECEIVED') return true;
  if (order.paymentStatus === 'FAILED') return true;
  if (order.status === 'PENDING') return true;
  return false;
}

/**
 * Determines whether moving an order to a new status requires restocking inventory.
 * In accordance with PRD 10 Section 2.1, orders cancelled from CONFIRMED or PROCESSING must restock.
 */
export function shouldRestockOnTransition(
  currentStatus: OrderStatus,
  targetStatus: OrderStatus
): boolean {
  if (targetStatus === 'CANCELLED') {
    return ['CONFIRMED', 'PROCESSING', 'PACKED', 'READY_FOR_DISPATCH', 'SHIPPED'].includes(currentStatus);
  }
  if (targetStatus === 'RETURNED' || targetStatus === 'RTO_DELIVERED') {
    return true;
  }
  return false;
}

/**
 * Generates external courier tracking URLs.
 */
export function getCourierTrackingUrl(
  courierName?: string | null,
  trackingNumber?: string | null
): string | null {
  if (!trackingNumber) return null;
  if (!courierName) {
    return `https://www.google.com/search?q=${encodeURIComponent(`package tracking ${trackingNumber}`)}`;
  }

  const cleanCourier = courierName.toLowerCase();
  const match = SUPPORTED_COURIERS.find(
    (c) =>
      cleanCourier.includes(c.shortCode) ||
      c.name.toLowerCase().includes(cleanCourier) ||
      cleanCourier.includes(c.name.toLowerCase())
  );

  if (match) {
    return match.trackingUrl.replace('{TRACKING}', encodeURIComponent(trackingNumber.trim()));
  }

  return `https://www.google.com/search?q=${encodeURIComponent(
    `${courierName} tracking ${trackingNumber}`
  )}`;
}

/**
 * Verifies guest authorization for order lookup to protect against IDOR data scraping.
 * Complies strictly with PRD 10 Section 3.
 */
export function verifyGuestOrderAuthorization(
  order: Order,
  providedContact: string
): boolean {
  if (!providedContact) return false;
  const cleanInput = providedContact.trim().toLowerCase();

  const emailMatch = order.customerEmail.toLowerCase() === cleanInput;
  const phoneMatch =
    order.customerPhone.replace(/\D/g, '') === cleanInput.replace(/\D/g, '');

  return emailMatch || phoneMatch;
}

/**
 * Generates the initial chronological timeline for a newly placed order.
 */
export function generateInitialOrderTimeline(order: {
  orderNumber: string;
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  utrNumber?: string;
  createdAt?: string;
}): OrderTimelineEvent[] {
  const ts = order.createdAt || new Date().toISOString();
  const isCustomUpi = order.paymentMethod === 'CUSTOM_UPI';
  const isCod = order.paymentMethod === 'COD';
  const isPayGlocal = order.paymentMethod === 'PAYGLOCAL';

  const events: OrderTimelineEvent[] = [
    {
      id: `evt-${Date.now()}-1`,
      status: 'PENDING',
      title: 'Order Placed',
      description: `Order ${order.orderNumber} placed successfully via ${order.paymentMethod}.`,
      location: 'East Champaran Central Operations',
      timestamp: ts,
      actor: 'Customer',
      isCustomerVisible: true,
      type: 'FULFILLMENT',
    },
  ];

  if (isCustomUpi) {
    events.push({
      id: `evt-${Date.now()}-2`,
      status: 'PENDING',
      title: 'Payment Verification Pending',
      description: order.utrNumber
        ? `Customer submitted 12-digit UTR: ${order.utrNumber}. Verification pending with IndusInd Bank merchant reconciliation.`
        : 'Awaiting customer payment proof / UTR reference number for IndusInd Bank current account verification.',
      location: 'Merchant Banking Desk',
      timestamp: ts,
      actor: 'System / Customer',
      isCustomerVisible: true,
      type: 'PAYMENT',
    });
  } else if (isCod) {
    if (order.status === 'CONFIRMED') {
      events.push({
        id: `evt-${Date.now()}-2`,
        status: 'CONFIRMED',
        title: 'COD Order Confirmed',
        description: 'Cash on Delivery order confirmed. Payment will be collected at doorstep upon delivery.',
        location: 'Automated Operations Desk',
        timestamp: ts,
        actor: 'System',
        isCustomerVisible: true,
        type: 'PAYMENT',
      });
    } else {
      events.push({
        id: `evt-${Date.now()}-2`,
        status: 'PENDING',
        title: 'COD Order Awaiting Confirmation',
        description: 'Cash on Delivery order received and queued for fulfillment confirmation before dispatch.',
        location: 'East Champaran Operations Desk',
        timestamp: ts,
        actor: 'System',
        isCustomerVisible: true,
        type: 'FULFILLMENT',
      });
    }
  } else if (isPayGlocal) {
    if (order.paymentStatus === 'PAID') {
      events.push({
        id: `evt-${Date.now()}-2`,
        status: 'CONFIRMED',
        title: 'Payment Authorized & Verified',
        description: 'Online card payment successfully authorized via PayGlocal Secure Gateway.',
        location: 'PayGlocal Gateway',
        timestamp: ts,
        actor: 'PayGlocal Gateway',
        isCustomerVisible: true,
        type: 'PAYMENT',
      });
    } else {
      events.push({
        id: `evt-${Date.now()}-2`,
        status: 'PENDING',
        title: 'Payment Authorization Pending',
        description: 'Online transaction is awaiting gateway callback or 3D Secure completion.',
        location: 'PayGlocal Gateway',
        timestamp: ts,
        actor: 'PayGlocal Gateway',
        isCustomerVisible: true,
        type: 'PAYMENT',
      });
    }
  }

  return events;
}

/**
 * Approve a Custom UPI order with verified UTR
 */
export function approveCustomUpiOrder(order: Order, adminName = 'Finance Team'): Order {
  const now = new Date().toISOString();
  const updatedTimeline: OrderTimelineEvent[] = [
    ...(order.timeline || []),
    {
      id: `evt-${Date.now()}-approval`,
      status: 'CONFIRMED',
      title: 'UPI Payment Approved & Verified',
      description: `UTR ${order.utrNumber || 'N/A'} verified with IndusInd Bank statement. Payment confirmed by ${adminName}.`,
      location: 'Merchant Accounts Desk',
      timestamp: now,
      actor: adminName,
      isCustomerVisible: true,
      type: 'PAYMENT',
    },
    {
      id: `evt-${Date.now()}-confirmed`,
      status: 'CONFIRMED',
      title: 'Order Confirmed',
      description: 'Order confirmed and routed to warehouse for fulfillment.',
      location: 'East Champaran Fulfillment Hub',
      timestamp: now,
      actor: adminName,
      isCustomerVisible: true,
      type: 'FULFILLMENT',
    },
  ];

  return {
    ...order,
    status: 'CONFIRMED',
    paymentStatus: 'PAID',
    manualApprovalStatus: 'APPROVED',
    updatedAt: now,
    timeline: updatedTimeline,
  };
}

/**
 * Reject a Custom UPI order
 */
export function rejectCustomUpiOrder(order: Order, reason: string, adminName = 'Finance Team'): Order {
  const now = new Date().toISOString();
  const updatedTimeline: OrderTimelineEvent[] = [
    ...(order.timeline || []),
    {
      id: `evt-${Date.now()}-rejection`,
      status: 'CANCELLED',
      title: 'UPI Payment Rejected',
      description: `Payment rejected by ${adminName}. Reason: ${reason || 'UTR could not be reconciled with bank statement.'}`,
      location: 'Merchant Accounts Desk',
      timestamp: now,
      actor: adminName,
      isCustomerVisible: true,
      type: 'EXCEPTION',
    },
    {
      id: `evt-${Date.now()}-cancelled`,
      status: 'CANCELLED',
      title: 'Order Cancelled',
      description: 'Order cancelled due to unverified payment.',
      location: 'Central Operations',
      timestamp: now,
      actor: adminName,
      isCustomerVisible: true,
      type: 'FULFILLMENT',
    },
  ];

  return {
    ...order,
    status: 'CANCELLED',
    paymentStatus: 'FAILED',
    manualApprovalStatus: 'REJECTED',
    rejectionReason: reason,
    updatedAt: now,
    timeline: updatedTimeline,
  };
}
