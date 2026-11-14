import type { NotificationEventKey, Order, OrderStatus } from '../../types/index.ts';
import { dispatchNotificationEvent, type NotificationStorePaths } from './notification-dispatcher.ts';
import { getAdminUrl, getOrderTrackingUrl } from '../utils/env-urls.ts';

function formatInrFromPaise(paise: number): string {
  const rupees = (Number(paise || 0) / 100).toFixed(2);
  return `₹${Number(rupees).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function mapOrderStatusToEventKey(status: OrderStatus): NotificationEventKey | null {
  switch (status) {
    case 'PAYMENT_RECEIVED':
    case 'CONFIRMED':
      return 'ORDER_PAYMENT_APPROVED';
    case 'PROCESSING':
    case 'PACKED':
    case 'READY_FOR_DISPATCH':
      return 'ORDER_PROCESSING';
    case 'SHIPPED':
      return 'ORDER_SHIPPED';
    case 'OUT_FOR_DELIVERY':
      return 'ORDER_OUT_FOR_DELIVERY';
    case 'DELIVERED':
      return 'ORDER_DELIVERED';
    case 'CANCELLED':
    case 'RTO_INITIATED':
    case 'RTO_DELIVERED':
      return 'ORDER_CANCELLED';
    case 'RETURN_REQUESTED':
      return 'ORDER_RETURN_REQUESTED';
    case 'RETURN_APPROVED':
    case 'RETURNED':
      return 'ORDER_RETURN_APPROVED';
    case 'REFUNDED':
      return 'ORDER_REFUNDED';
    default:
      return null;
  }
}

export async function dispatchOrderLifecycleNotification(
  eventKey: NotificationEventKey,
  order: Order,
  opts?: {
    statusMessage?: string;
    vendorEmails?: string[];
    paths?: NotificationStorePaths;
  }
) {
  const trackingUrl = getOrderTrackingUrl(order.orderNumber);
  const actionUrl = getAdminUrl('orders');
  const itemsSummary = (order.items || [])
    .map((item) => `${item.productTitle} x${item.quantity}`)
    .join(', ');
  const addr = order.shippingAddress;
  const formattedAddr = addr
    ? [addr.fullName, addr.addressLine1, addr.city, addr.state, addr.postalCode]
        .filter(Boolean)
        .join(', ')
    : 'Not provided';

  return dispatchNotificationEvent({
    eventKey,
    customerEmail: order.customerEmail || undefined,
    customerName: order.shippingAddress?.fullName || 'Valued Customer',
    vendorEmails: opts?.vendorEmails,
    entityType: 'ORDER',
    entityId: order.orderNumber || order.id,
    paths: opts?.paths,
    extraVars: {
      order_number: order.orderNumber,
      order_total: formatInrFromPaise(order.totalInPaise),
      order_status: order.status,
      payment_method: order.paymentMethod,
      payment_status: order.paymentStatus,
      order_items_summary: itemsSummary || 'Assorted items',
      shipping_address: formattedAddr,
      courier_name: order.courierName || 'Standard Courier',
      tracking_number: order.trackingNumber || 'Pending AWB',
      tracking_url: trackingUrl,
      action_url: actionUrl,
      customer_phone: order.shippingAddress?.phone || order.customerPhone || '',
      status_message:
        opts?.statusMessage ||
        `Order ${order.orderNumber} is currently marked as ${order.status} (Payment: ${order.paymentStatus}).`,
    },
  });
}
