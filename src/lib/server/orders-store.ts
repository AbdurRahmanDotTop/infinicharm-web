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

