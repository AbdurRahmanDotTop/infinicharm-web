// ==============================================================================
// InfiniCharm — Server-Side Orders Storage & State Transition Authority
// Governing PRD: PRD 10 (Order Management, Fulfillment Lifecycle & Logistics)
// Invariants: Single Source of Truth, Integer Paise, State Transition Validation
// ==============================================================================

import fs from 'fs';
import path from 'path';
import { Order, OrderStatus, OrderTimelineEvent } from '@/types';
import {
  isValidOrderTransition,
  shouldRestockOnTransition,
  getCourierTrackingUrl,
} from '@/lib/services/orders';
import { parseUtrInput, verifyPaymentToken } from '@/lib/services/upi';
import { updateServerProductStock } from './products-store';

function restockOrderItems(order: Order): void {
  for (const item of order.items || []) {
    const qty = Math.max(0, Math.round(Number(item.quantity || 0)));
    if (qty > 0 && item.productId && item.variantId) {
      updateServerProductStock(item.productId, item.variantId, qty);
    }
  }
}

function getDataFilePath(): string {
  const primaryPath = path.join(process.cwd(), 'src', 'data', 'orders.json');
  if (fs.existsSync(primaryPath)) {
    return primaryPath;
  }
  const altPath = path.join(process.cwd(), 'data', 'orders.json');
  if (fs.existsSync(altPath)) {
    return altPath;
  }
  return primaryPath;
}

export function getServerOrders(): Order[] {
  try {
    const filePath = getDataFilePath();
    if (!fs.existsSync(filePath)) {
      return [];
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Error reading orders file:', error);
    return [];
  }
}

export function getServerOrderByIdOrNumber(idOrNumber: string): Order | null {
  if (!idOrNumber) return null;
  const clean = idOrNumber.trim().toUpperCase();
  const normalizedHyphen = clean.replace(/\s+/g, '-').replace(/-+/g, '-');
  const cleanDigits = clean.replace(/\D/g, '');
  const cleanLast10 = cleanDigits.length >= 10 ? cleanDigits.slice(-10) : '';
  const orders = getServerOrders();
  return (
    orders.find((o) => {
      const ordUpper = o.orderNumber.toUpperCase();
      const idUpper = o.id.toUpperCase();
      if (
        idUpper === clean ||
        ordUpper === clean ||
        ordUpper === normalizedHyphen ||
        idUpper === normalizedHyphen
      ) {
        return true;
      }
      if (cleanLast10 && !/[A-Z]/.test(clean)) {
        const orderDigits = (o.customerPhone || '').replace(/\D/g, '');
        if (orderDigits.length >= 10 && orderDigits.slice(-10) === cleanLast10) {
          return true;
        }
      }
      return false;
    }) || null
  );
}

function writeOrdersToFile(orders: Order[]): boolean {
  try {
    const filePath = getDataFilePath();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(orders, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Error writing orders file:', error);
    return false;
  }
}

export function saveServerOrder(order: Order): Order {
  const orders = getServerOrders();
  const existingIdx = orders.findIndex(
    (o) => o.id === order.id || o.orderNumber === order.orderNumber
  );

  const enrichedOrder: Order = {
    ...order,
    trackingUrl: order.trackingUrl || getCourierTrackingUrl(order.courierName, order.trackingNumber) || undefined,
    updatedAt: new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    orders[existingIdx] = enrichedOrder;
  } else {
    orders.unshift(enrichedOrder);
  }

  writeOrdersToFile(orders);
  return enrichedOrder;
}

export function updateServerOrderStatus(
  idOrNumber: string,
  newStatus: OrderStatus,
  adminNotes?: string,
  actor = 'Store Admin'
): { success: boolean; order?: Order; error?: string } {
  const orders = getServerOrders();
  const idx = orders.findIndex(
    (o) => o.id === idOrNumber || o.orderNumber === idOrNumber
  );

  if (idx < 0) {
    return { success: false, error: `Order ${idOrNumber} not found.` };
  }

  const existing = orders[idx];

  // Validate state machine transition
  if (!isValidOrderTransition(existing.status, newStatus)) {
    return {
      success: false,
      error: `Illegal state transition from ${existing.status} to ${newStatus}.`,
    };
  }

  const now = new Date().toISOString();
  const timelineEvent: OrderTimelineEvent = {
    id: `evt-${Date.now()}-${newStatus.toLowerCase()}`,
    status: newStatus,
    title: `Order Status Updated to ${newStatus}`,
    description: adminNotes || `Order fulfillment status changed from ${existing.status} to ${newStatus}.`,
    location: 'East Champaran Fulfillment Hub',
    timestamp: now,
    actor,
    isCustomerVisible: true,
    type: 'FULFILLMENT',
  };

  const updated: Order = {
    ...existing,
    status: newStatus,
    adminNotes: adminNotes || existing.adminNotes,
    updatedAt: now,
    timeline: [...(existing.timeline || []), timelineEvent],
  };

  // Synchronize payment status for verified/confirmed fulfillments
  if (newStatus === 'PAYMENT_RECEIVED') {
    updated.paymentStatus = 'PAID';
    if (existing.paymentMethod === 'CUSTOM_UPI') {
      updated.manualApprovalStatus = 'APPROVED';
    }
  } else if (newStatus === 'PAYMENT_NOT_RECEIVED') {
    updated.paymentStatus = 'FAILED';
    if (existing.paymentMethod === 'CUSTOM_UPI') {
      updated.manualApprovalStatus = 'REJECTED';
    }
  } else if (['CONFIRMED', 'PROCESSING', 'PACKED', 'READY_FOR_DISPATCH', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(newStatus)) {
    if (existing.paymentMethod === 'CUSTOM_UPI') {
      updated.paymentStatus = 'PAID';
      updated.manualApprovalStatus = 'APPROVED';
    }
  }

  // If status moved to DELIVERED, set actualDeliveryDate
  if (newStatus === 'DELIVERED') {
    updated.actualDeliveryDate = now;
    if (existing.paymentMethod === 'COD') {
      updated.paymentStatus = 'PAID';
    }
  }

  orders[idx] = updated;
  writeOrdersToFile(orders);

  const alreadyRestocked = ['CANCELLED', 'RETURNED', 'RTO_DELIVERED', 'REFUNDED'].includes(existing.status);
  if (!alreadyRestocked && (shouldRestockOnTransition(existing.status, newStatus) || newStatus === 'CANCELLED')) {
    restockOrderItems(existing);
  }

  return { success: true, order: updated };
}

export function updateServerOrderTracking(
  idOrNumber: string,
  courierName: string,
  trackingNumber: string,
  estimatedDeliveryDate?: string,
  checkpointNotes?: string,
  actor = 'Logistics Desk'
): { success: boolean; order?: Order; error?: string } {
  const orders = getServerOrders();
  const idx = orders.findIndex(
    (o) => o.id === idOrNumber || o.orderNumber === idOrNumber
  );

  if (idx < 0) {
    return { success: false, error: `Order ${idOrNumber} not found.` };
  }

  const existing = orders[idx];
  const now = new Date().toISOString();
  const trackingUrl = getCourierTrackingUrl(courierName, trackingNumber) || undefined;

  const timelineEvent: OrderTimelineEvent = {
    id: `evt-${Date.now()}-tracking`,
    status: 'SHIPPED',
    title: `Dispatched via ${courierName}`,
    description: checkpointNotes || `Consignment dispatched with tracking AWB: ${trackingNumber}. Tracking URL active.`,
    location: 'Central Sorting Hub',
    timestamp: now,
    actor,
    isCustomerVisible: true,
    type: 'LOGISTICS',
  };

  const updated: Order = {
    ...existing,
    status: existing.status === 'PENDING' || existing.status === 'CONFIRMED' || existing.status === 'PROCESSING' || existing.status === 'PACKED' || existing.status === 'READY_FOR_DISPATCH'
      ? 'SHIPPED'
      : existing.status,
    courierName,
    trackingNumber,
    trackingUrl,
    estimatedDeliveryDate: estimatedDeliveryDate || existing.estimatedDeliveryDate,
    updatedAt: now,
    timeline: [...(existing.timeline || []), timelineEvent],
  };

  orders[idx] = updated;
  writeOrdersToFile(orders);

  return { success: true, order: updated };
}

export function approveServerOrderUtr(
  idOrNumber: string,
  adminName = 'Super Admin'
): { success: boolean; order?: Order; error?: string } {
  const orders = getServerOrders();
  const idx = orders.findIndex(
    (o) => o.id === idOrNumber || o.orderNumber === idOrNumber
  );

  if (idx < 0) {
    return { success: false, error: `Order ${idOrNumber} not found.` };
  }

  const existing = orders[idx];
  const now = new Date().toISOString();

  const approvalTimeline: OrderTimelineEvent[] = [
    ...(existing.timeline || []),
    {
      id: `evt-${Date.now()}-approval`,
      status: 'CONFIRMED',
      title: 'UPI Payment Verified & Approved',
      description: `UTR ${existing.utrNumber || 'N/A'} verified with IndusInd Bank statement. Payment confirmed by ${adminName}.`,
      location: 'Merchant Banking Operations',
      timestamp: now,
      actor: adminName,
      isCustomerVisible: true,
      type: 'PAYMENT',
    },
    {
      id: `evt-${Date.now()}-confirmed`,
      status: 'CONFIRMED',
      title: 'Order Confirmed',
      description: 'Order confirmed and released to warehouse for fulfillment.',
      location: 'East Champaran Fulfillment Hub',
      timestamp: now,
      actor: adminName,
      isCustomerVisible: true,
      type: 'FULFILLMENT',
    },
  ];

  const updated: Order = {
    ...existing,
    status: 'CONFIRMED',
    paymentStatus: 'PAID',
    manualApprovalStatus: 'APPROVED',
    updatedAt: now,
    timeline: approvalTimeline,
  };

  orders[idx] = updated;
  writeOrdersToFile(orders);

  return { success: true, order: updated };
}

export function rejectServerOrderUtr(
  idOrNumber: string,
  reason: string,
  adminName = 'Super Admin'
): { success: boolean; order?: Order; error?: string } {
  const orders = getServerOrders();
  const idx = orders.findIndex(
    (o) => o.id === idOrNumber || o.orderNumber === idOrNumber
  );

  if (idx < 0) {
    return { success: false, error: `Order ${idOrNumber} not found.` };
  }

  const existing = orders[idx];
  const now = new Date().toISOString();

  const rejectionTimeline: OrderTimelineEvent[] = [
    ...(existing.timeline || []),
    {
      id: `evt-${Date.now()}-rejection`,
      status: 'CANCELLED',
      title: 'UPI Payment Verification Rejected',
      description: `Payment rejected by ${adminName}. Reason: ${reason || 'UTR could not be reconciled with bank statement.'}`,
      location: 'Merchant Banking Operations',
      timestamp: now,
      actor: adminName,
      isCustomerVisible: true,
      type: 'EXCEPTION',
    },
    {
      id: `evt-${Date.now()}-cancelled`,
      status: 'CANCELLED',
      title: 'Order Cancelled',
      description: 'Order cancelled due to unverified UPI payment.',
      location: 'Central Operations Desk',
      timestamp: now,
      actor: adminName,
      isCustomerVisible: true,
      type: 'FULFILLMENT',
    },
  ];

  const updated: Order = {
    ...existing,
    status: 'CANCELLED',
    paymentStatus: 'FAILED',
    manualApprovalStatus: 'REJECTED',
    rejectionReason: reason,
    updatedAt: now,
    timeline: rejectionTimeline,
  };

  orders[idx] = updated;
  writeOrdersToFile(orders);

  const alreadyRestocked = ['CANCELLED', 'RETURNED', 'RTO_DELIVERED', 'REFUNDED'].includes(existing.status);
  if (!alreadyRestocked) {
    restockOrderItems(existing);
  }

  return { success: true, order: updated };
}

export function addServerOrderTimelineEvent(
  idOrNumber: string,
  event: Omit<OrderTimelineEvent, 'id' | 'timestamp'>
): { success: boolean; order?: Order; error?: string } {
  const orders = getServerOrders();
  const idx = orders.findIndex(
    (o) => o.id === idOrNumber || o.orderNumber === idOrNumber
  );

  if (idx < 0) {
    return { success: false, error: `Order ${idOrNumber} not found.` };
  }

  const existing = orders[idx];
  const now = new Date().toISOString();

  const newEvent: OrderTimelineEvent = {
    ...event,
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: now,
  };

  const updated: Order = {
    ...existing,
    updatedAt: now,
    timeline: [...(existing.timeline || []), newEvent],
  };

  orders[idx] = updated;
  writeOrdersToFile(orders);

  return { success: true, order: updated };
}

/**
 * Submits a customer or payer UTR for verified UPI settlement.
 * Strict authority: Does not mark as paid; transitions to PENDING_REVIEW for bank reconciliation.
 */
export function submitServerOrderUtr(
  idOrNumber: string,
  rawUtr: string,
  payerName = 'Customer / Payer',
  token?: string
): { success: boolean; order?: Order; error?: string } {
  const orders = getServerOrders();
  let idx = orders.findIndex(
    (o) => o.id === idOrNumber || o.orderNumber === idOrNumber
  );

  if (idx < 0 && token) {
    const decoded = verifyPaymentToken(token);
    if (decoded) {
      const tokenOrder: Order = {
        id: decoded.orderId || decoded.orderNumber || idOrNumber,
        orderNumber: decoded.orderNumber || decoded.orderId || idOrNumber,
        customerId: 'guest',
        customerEmail: decoded.customerEmail || 'guest@infinicharm.com',
        customerPhone: decoded.customerPhone || '8825164657',
        status: 'PENDING',
        subtotalInPaise: decoded.totalInPaise,
        discountInPaise: 0,
        shippingInPaise: 0,
        taxInPaise: 0,
        totalInPaise: decoded.totalInPaise,
        paymentMethod: 'CUSTOM_UPI',
        paymentStatus: 'PENDING',
        shippingAddress: {
          id: `addr-token-${Date.now()}`,
          customerId: 'guest',
          fullName: decoded.customerName || payerName || 'Valued Patron',
          phone: decoded.customerPhone || '8825164657',
          addressLine1: 'Consignment Delivery Address',
          city: 'East Champaran',
          state: 'Bihar',
          postalCode: '845427',
          country: 'India',
          isDefaultShipping: true,
          isDefaultBilling: false,
        },
        billingAddress: {
          id: `bill-token-${Date.now()}`,
          customerId: 'guest',
          fullName: decoded.customerName || payerName || 'Valued Patron',
          phone: decoded.customerPhone || '8825164657',
          addressLine1: 'Consignment Delivery Address',
          city: 'East Champaran',
          state: 'Bihar',
          postalCode: '845427',
          country: 'India',
          isDefaultShipping: true,
          isDefaultBilling: false,
        },
        items: decoded.items?.map((it, i) => ({
          id: `item-token-${i}`,
          orderId: decoded.orderNumber || idOrNumber,
          productId: 'prod-item',
          variantId: 'var-item',
          productTitle: it.title,
          variantTitle: 'Standard',
          sku: 'SKU-UPI',
          priceInPaise: it.priceInPaise,
          quantity: it.quantity,
          totalInPaise: it.priceInPaise * it.quantity,
        })) || [],
        timeline: [],
        createdAt: decoded.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      orders.unshift(tokenOrder);
      idx = 0;
    }
  }

  if (idx < 0) {
    return { success: false, error: `Order "${idOrNumber}" not found.` };
  }

  const existing = orders[idx];

  // Prevent submission on already paid or cancelled orders
  if (existing.paymentStatus === 'PAID' || existing.status === 'CONFIRMED') {
    return {
      success: false,
      error: 'This order is already marked as PAID and confirmed. No additional payment submission is required.',
    };
  }
  if (['CANCELLED', 'RETURNED', 'REFUNDED'].includes(existing.status)) {
    return {
      success: false,
      error: `This order is ${existing.status} and cannot accept payment submissions.`,
    };
  }

  const utrCheck = parseUtrInput(rawUtr);
  if (!utrCheck.isValid) {
    return {
      success: false,
      error: utrCheck.error || 'Please enter a valid 12-digit UPI UTR number.',
    };
  }

  const now = new Date().toISOString();
  const utrTimeline: OrderTimelineEvent[] = [
    ...(existing.timeline || []),
    {
      id: `evt-${Date.now()}-utr-submission`,
      status: 'PENDING',
      title: 'UPI Payment Reference (UTR) Submitted',
      description: `Payer submitted UTR ${utrCheck.rawCleaned}. Awaiting merchant bank statement verification.`,
      location: 'Payment Desk / Customer Self-Service',
      timestamp: now,
      actor: payerName,
      isCustomerVisible: true,
      type: 'PAYMENT',
    },
  ];

  const updated: Order = {
    ...existing,
    utrNumber: utrCheck.rawCleaned,
    paymentMethod: 'CUSTOM_UPI',
    paymentStatus: 'PENDING',
    manualApprovalStatus: 'PENDING_REVIEW',
    updatedAt: now,
    timeline: utrTimeline,
  };

  orders[idx] = updated;
  writeOrdersToFile(orders);

  return { success: true, order: updated };
}

/**
 * Creates or updates a pending order draft for shareable HTTPS payment links.
 * Ensures that if a payment link is copied/shared at checkout, the order exists on the server.
 */
export function createOrUpdateDraftOrder(
  orderData: Partial<Order>
): { success: boolean; order?: Order; error?: string } {
  if (!orderData.orderNumber && !orderData.id) {
    return { success: false, error: 'Order reference is required.' };
  }
  const orders = getServerOrders();
  const ref = orderData.orderNumber || orderData.id!;
  const existingIdx = orders.findIndex(
    (o) => o.id === ref || o.orderNumber === ref
  );

  const now = new Date().toISOString();
  if (existingIdx >= 0) {
    const existing = orders[existingIdx];
    const updated: Order = {
      ...existing,
      ...orderData,
      id: existing.id,
      orderNumber: existing.orderNumber,
      updatedAt: now,
    };
    orders[existingIdx] = updated;
    writeOrdersToFile(orders);
    return { success: true, order: updated };
  }

  const defaultAddress = orderData.shippingAddress || {
    id: `addr-${Date.now()}`,
    customerId: orderData.customerId || 'guest',
    fullName: 'Valued Guest',
    phone: orderData.customerPhone || '8825164657',
    addressLine1: 'Pending Customer Checkout Address',
    city: 'East Champaran',
    state: 'Bihar',
    postalCode: '845427',
    country: 'India',
    isDefaultShipping: true,
    isDefaultBilling: false,
  };

  const newOrder: Order = {
    id: orderData.id || `ord-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    orderNumber: orderData.orderNumber || ref,
    customerEmail: orderData.customerEmail || 'guest@infinicharm.com',
    customerPhone: orderData.customerPhone || '8825164657',
    status: 'PENDING',
    paymentStatus: 'PENDING',
    paymentMethod: orderData.paymentMethod || 'CUSTOM_UPI',
    items: orderData.items || [],
    subtotalInPaise: orderData.subtotalInPaise || 0,
    shippingInPaise: orderData.shippingInPaise || 0,
    discountInPaise: orderData.discountInPaise || 0,
    taxInPaise: orderData.taxInPaise || 0,
    totalInPaise: orderData.totalInPaise || 0,
    shippingAddress: defaultAddress,
    billingAddress: orderData.billingAddress || defaultAddress,
    utrNumber: orderData.utrNumber,
    manualApprovalStatus: orderData.utrNumber ? 'PENDING_REVIEW' : undefined,
    createdAt: now,
    updatedAt: now,
    timeline: [
      {
        id: `evt-${Date.now()}-created`,
        status: 'PENDING',
        title: 'Payment Order Created',
        description: 'Order reference generated and awaiting UPI settlement.',
        location: 'Online Storefront',
        timestamp: now,
        actor: 'InfiniCharm Storefront',
        isCustomerVisible: true,
        type: 'FULFILLMENT',
      },
    ],
  };

  orders.unshift(newOrder);
  writeOrdersToFile(orders);
  return { success: true, order: newOrder };
}

/**
 * Creates an authoritative order through Admin workflows
 */
export function createAdminOrder(
  data: Partial<Order> & {
    items: Order['items'];
    shippingAddress: Order['shippingAddress'];
  },
  actor = 'Operations Admin'
): { success: boolean; order?: Order; error?: string } {
  if (!Array.isArray(data.items) || data.items.length === 0) {
    return { success: false, error: 'At least one order item is required.' };
  }
  if (!data.shippingAddress || !data.shippingAddress.addressLine1 || !data.shippingAddress.postalCode) {
    return { success: false, error: 'Complete delivery address and postal code are required.' };
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const orderNumber = data.orderNumber || `INF-${yearMonth}-${randomSuffix}`;
  const orderId = data.id || `ord-${Date.now()}-${randomSuffix}`;

  // Recalculate financial breakdown in integer paise
  const subtotalInPaise = data.items.reduce((sum, item) => sum + (item.priceInPaise * item.quantity), 0);
  const shippingInPaise = data.shippingInPaise ?? (subtotalInPaise >= 499900 ? 0 : 6000);
  const discountInPaise = data.discountInPaise || 0;
  const taxInPaise = data.taxInPaise || 0;
  const totalInPaise = data.totalInPaise || Math.max(0, subtotalInPaise + shippingInPaise + taxInPaise - discountInPaise);

  const newOrder: Order = {
    id: orderId,
    orderNumber,
    customerId: data.customerId || 'guest',
    customerEmail: data.customerEmail || data.shippingAddress.phone + '@infinicharm.com',
    customerPhone: data.customerPhone || data.shippingAddress.phone,
    customerName: data.customerName || data.shippingAddress.fullName,
    status: data.status || 'PENDING',
    paymentStatus: data.paymentStatus || 'PENDING',
    paymentMethod: data.paymentMethod || 'CUSTOM_UPI',
    items: data.items,
    subtotalInPaise,
    shippingInPaise,
    discountInPaise,
    taxInPaise,
    totalInPaise,
    shippingAddress: data.shippingAddress,
    billingAddress: data.billingAddress || data.shippingAddress,
    utrNumber: data.utrNumber,
    adminNotes: data.adminNotes,
    courierName: data.courierName,
    trackingNumber: data.trackingNumber,
    createdAt: nowIso,
    updatedAt: nowIso,
    timeline: [
      {
        id: `evt-${Date.now()}-admin-created`,
        status: data.status || 'PENDING',
        title: 'Order Created by Administrator',
        description: `Order ${orderNumber} created manually by ${actor}.`,
        location: 'East Champaran Admin Operations',
        timestamp: nowIso,
        actor,
        isCustomerVisible: true,
        type: 'FULFILLMENT',
      },
    ],
  };

  const orders = getServerOrders();
  orders.unshift(newOrder);
  writeOrdersToFile(orders);

  return { success: true, order: newOrder };
}

/**
 * Updates full details of an existing order through Admin workflows
 */
export function updateAdminOrder(
  idOrNumber: string,
  updates: Partial<Order>,
  actor = 'Operations Admin'
): { success: boolean; order?: Order; error?: string } {
  const orders = getServerOrders();
  const idx = orders.findIndex(o => o.id === idOrNumber || o.orderNumber === idOrNumber);
  if (idx === -1) {
    return { success: false, error: `Order ${idOrNumber} not found.` };
  }

  const existing = orders[idx];
  const now = new Date().toISOString();

  // If status is being changed, check transition validity
  if (updates.status && updates.status !== existing.status) {
    const transitionResult = updateServerOrderStatus(idOrNumber, updates.status, updates.adminNotes, actor);
    if (!transitionResult.success) {
      return transitionResult;
    }
  }

  // Reload current orders after potential status transition
  const currentOrders = getServerOrders();
  const currentIdx = currentOrders.findIndex(o => o.id === idOrNumber || o.orderNumber === idOrNumber);
  const current = currentOrders[currentIdx] || existing;

  const mergedItems = updates.items || current.items;
  let subtotalInPaise = current.subtotalInPaise;
  let totalInPaise = current.totalInPaise;

  if (updates.items) {
    subtotalInPaise = mergedItems.reduce((acc, it) => acc + (it.priceInPaise * it.quantity), 0);
    const shipping = updates.shippingInPaise ?? current.shippingInPaise;
    const tax = updates.taxInPaise ?? current.taxInPaise;
    const discount = updates.discountInPaise ?? current.discountInPaise;
    totalInPaise = Math.max(0, subtotalInPaise + shipping + tax - discount);
  }

  const updatedOrder: Order = {
    ...current,
    ...updates,
    id: current.id,
    orderNumber: current.orderNumber,
    items: mergedItems,
    subtotalInPaise,
    totalInPaise: updates.totalInPaise ?? totalInPaise,
    updatedAt: now,
    timeline: [
      ...(current.timeline || []),
      {
        id: `evt-${Date.now()}-admin-edit`,
        status: updates.status || current.status,
        title: 'Order Details Updated',
        description: `Order information modified by ${actor}.`,
        location: 'Admin Operations Hub',
        timestamp: now,
        actor,
        isCustomerVisible: false,
        type: 'EXCEPTION',
      },
    ],
  };

  currentOrders[currentIdx] = updatedOrder;
  writeOrdersToFile(currentOrders);

  return { success: true, order: updatedOrder };
}

/**
 * Delete an order with statutory safeguards
 */
export function deleteServerOrder(
  idOrNumber: string,
  actor = 'Operations Admin',
  permanent = false
): { success: boolean; error?: string; orderNumber?: string } {
  const orders = getServerOrders();
  const idx = orders.findIndex(o => o.id === idOrNumber || o.orderNumber === idOrNumber);
  if (idx === -1) {
    return { success: false, error: `Order ${idOrNumber} not found.` };
  }

  const target = orders[idx];

  if (permanent) {
    // Permanent purge (for test/draft records or direct admin deletion request)
    orders.splice(idx, 1);
    writeOrdersToFile(orders);
    return { success: true, orderNumber: target.orderNumber };
  }

  // Statutory retention workflow: transition to CANCELLED and add audit log
  const cancelResult = updateServerOrderStatus(idOrNumber, 'CANCELLED', `Order cancelled by ${actor}`, actor);
  return { success: cancelResult.success, error: cancelResult.error, orderNumber: target.orderNumber };
}

/**
 * Bulk update multiple orders
 */
export function bulkUpdateServerOrders(
  orderIds: string[],
  updates: { status?: OrderStatus; paymentStatus?: Order['paymentStatus']; adminNotes?: string },
  actor = 'Operations Admin'
): { success: boolean; updatedCount: number; errors: string[] } {
  let updatedCount = 0;
  const errors: string[] = [];

  for (const id of orderIds) {
    try {
      if (updates.status) {
        const res = updateServerOrderStatus(id, updates.status, updates.adminNotes, actor);
        if (res.success) {
          updatedCount++;
        } else {
          errors.push(res.error || `Failed to update ${id}`);
        }
      } else {
        const res = updateAdminOrder(id, updates, actor);
        if (res.success) updatedCount++;
        else errors.push(res.error || `Failed to update ${id}`);
      }
    } catch (e: any) {
      errors.push(e?.message || `Error on ${id}`);
    }
  }

  return { success: updatedCount > 0, updatedCount, errors };
}

/**
 * Bulk delete / cancel multiple orders
 */
export function bulkDeleteServerOrders(
  orderIds: string[],
  actor = 'Operations Admin',
  permanent = false
): { success: boolean; deletedCount: number; errors: string[] } {
  let deletedCount = 0;
  const errors: string[] = [];

  for (const id of orderIds) {
    const res = deleteServerOrder(id, actor, permanent);
    if (res.success) {
      deletedCount++;
    } else {
      errors.push(res.error || `Failed to delete ${id}`);
    }
  }

  return { success: deletedCount > 0, deletedCount, errors };
}

