import { NextRequest, NextResponse } from 'next/server';
import {
  getServerOrders,
  getServerOrderByIdOrNumber,
  saveServerOrder,
} from '@/lib/server/orders-store';
import {
  validateCouponServerSide,
  recordCouponRedemption,
  CouponValidationCartItem,
} from '@/lib/server/coupons-store';
import { getServerProducts, updateServerProductStock } from '@/lib/server/products-store';
import { getServerCategories } from '@/lib/server/categories-store';
import { resolveAuthenticatedCustomer } from '@/lib/server/customers-store';
import { getAuthSettings } from '@/lib/server/auth-settings-store';
import { validateOrderPaymentMethod } from '@/lib/server/gateways-store';
import { generateInitialOrderTimeline, isOrderOwnedByCustomer } from '@/lib/services/orders';
import { getPlatformSettings } from '@/lib/services/settings';
import { getShippingSettings } from '@/lib/server/shipping-store';
import { calculateGST } from '@/lib/services/tax';
import { dispatchOrderLifecycleNotification } from '@/lib/server/order-notifications';
import { Order, OrderItem } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ==============================================================================
// InfiniCharm — Central Orders List & Creation API
// Governing PRD: PRD 10 (Order Management, Fulfillment Lifecycle & Logistics)
// Standards: Server authority, Initial pending status, Real-time persistence
// ==============================================================================

export async function GET(request: NextRequest) {
  try {
    const isAdmin = request.cookies.get('infinicharm_admin_session')?.value === 'active';
    const authCustomer = resolveAuthenticatedCustomer(request);

    if (!isAdmin && !authCustomer) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Sign in required to view order records.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.toLowerCase() || '';
    const status = searchParams.get('status');
    const phone = searchParams.get('phone');

    let orders = getServerOrders();

    // Non-admin customers only ever see their own orders
    if (!isAdmin && authCustomer) {
      orders = orders.filter((o) => isOrderOwnedByCustomer(o, authCustomer));
    }

    if (status && status !== 'ALL') {
      orders = orders.filter((o) => o.status === status);
    }

    if (phone) {
      const cleanPhone = phone.replace(/\D/g, '');
      orders = orders.filter(
        (o) => o.customerPhone.replace(/\D/g, '') === cleanPhone
      );
    }

    if (query) {
      orders = orders.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(query) ||
          o.customerPhone.includes(query) ||
          o.shippingAddress?.fullName?.toLowerCase().includes(query) ||
          o.customerEmail?.toLowerCase().includes(query)
      );
    }

    return NextResponse.json(
      { success: true, count: orders.length, orders },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, private',
          Vary: 'Cookie',
        },
      }
    );
  } catch (error: any) {
    console.error('Error fetching orders:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error fetching orders' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: Partial<Order> = await request.json();

    if (!body.orderNumber || !body.items || body.items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Missing required order fields or items' },
        { status: 400 }
      );
    }

    // Idempotent Single Order Authority: Prevent duplicate orders while allowing safe replay/updates
    const existingOrder = getServerOrderByIdOrNumber(body.orderNumber);
    if (existingOrder) {
      if (existingOrder.status === 'PENDING' || body.utrNumber) {
        const mergedOrder: Order = {
          ...existingOrder,
          ...body,
          id: existingOrder.id,
          orderNumber: existingOrder.orderNumber,
          createdAt: existingOrder.createdAt,
          updatedAt: new Date().toISOString(),
          utrNumber: body.utrNumber || existingOrder.utrNumber,
          paymentStatus: body.paymentStatus || existingOrder.paymentStatus,
          manualApprovalStatus: (body.utrNumber || existingOrder.utrNumber)
            ? 'PENDING_REVIEW'
            : existingOrder.manualApprovalStatus,
        };
        const saved = saveServerOrder(mergedOrder);
        return NextResponse.json(
          { success: true, order: saved, isIdempotent: true },
          { status: 200 }
        );
      }
      return NextResponse.json(
        { success: true, order: existingOrder, isIdempotent: true },
        { status: 200 }
      );
    }

    // Resolve authenticated customer securely when verified session cookies exist
    const isAdmin = request.cookies.get('infinicharm_admin_session')?.value === 'active';
    const authCustomer = resolveAuthenticatedCustomer(request);
    const authSettings = getAuthSettings();

    if (!authCustomer && !isAdmin && !authSettings.guestCheckoutEnabled) {
      return NextResponse.json(
        {
          success: false,
          error: 'Guest checkout is currently disabled. Please sign in with a verified customer account to place your order.',
        },
        { status: 401 }
      );
    }

    const effectiveCustomerId = authCustomer?.id || (isAdmin ? body.customerId || 'guest' : 'guest');
    const effectiveEmail = authCustomer?.email || body.customerEmail || '';
    const effectivePhone = authCustomer?.phone || body.customerPhone || '';

    // Resolve authoritative catalog products, stock availability & GST classifications
    const catalogProducts = getServerProducts({ status: 'PUBLISHED' });
    const categories = getServerCategories();
    const productMap = new Map(catalogProducts.map((p) => [p.id, p]));
    const categorySlugById = new Map(categories.map((c) => [c.id, c.slug]));

    let authoritativeSubtotalInPaise = 0;
    const couponItems: CouponValidationCartItem[] = [];
    const authoritativeItems: OrderItem[] = [];
    const stockRequests: Array<{ productId: string; variantId: string; quantity: number; categorySlug: string }> = [];

    for (const item of body.items) {
      const prod = item.productId ? productMap.get(item.productId) : undefined;
      if (!prod) {
        return NextResponse.json(
          { success: false, error: `Product "${item.productId || 'unknown'}" is unavailable or unpublished.` },
          { status: 400 }
        );
      }

      const variant = item.variantId
        ? prod.variants?.find((v) => v.id === item.variantId)
        : prod.variants?.[0];
      if (!variant) {
        return NextResponse.json(
          { success: false, error: `Variant "${item.variantId || 'default'}" not found for ${prod.title}.` },
          { status: 400 }
        );
      }

      const qty = Math.round(Number(item.quantity || 0));
      if (!Number.isFinite(qty) || qty < 1) {
        return NextResponse.json(
          { success: false, error: `Invalid quantity specified for ${prod.title}.` },
          { status: 400 }
        );
      }

      const availableStock = variant.stockQuantity || 0;
      if (availableStock < qty) {
        return NextResponse.json(
          {
            success: false,
            error: `Insufficient stock for ${prod.title} (${variant.title}). Only ${availableStock} left in stock.`,
          },
          { status: 400 }
        );
      }

      const unitPrice = variant.priceInPaise;
      const lineTotal = unitPrice * qty;
      authoritativeSubtotalInPaise += lineTotal;

      const categoryId = prod.categoryId;
      const categorySlug = (categoryId ? categorySlugById.get(categoryId) : undefined) || 'general';

      couponItems.push({
        productId: prod.id,
        variantId: variant.id,
        categoryId,
        categorySlug,
        priceInPaise: unitPrice,
        quantity: qty,
      });

      authoritativeItems.push({
        id: item.id || `item-${variant.id}-${Date.now()}`,
        orderId: body.orderNumber,
        productId: prod.id,
        variantId: variant.id,
        productTitle: prod.title,
        variantTitle: variant.title,
        sku: variant.sku,
        priceInPaise: unitPrice,
        quantity: qty,
        totalInPaise: lineTotal,
      });

      stockRequests.push({
        productId: prod.id,
        variantId: variant.id,
        quantity: qty,
        categorySlug,
      });
    }

    const subtotalInPaise = authoritativeSubtotalInPaise;
    const shippingSettings = getShippingSettings();
    const freeThreshold = shippingSettings.freeShippingEnabled
      ? shippingSettings.freeShippingThresholdPaise
      : Infinity;
    const shippingInPaise =
      subtotalInPaise >= freeThreshold
        ? 0
        : shippingSettings.standardShippingFeePaise;
    const normalizedCouponCode = body.couponCode ? String(body.couponCode).trim().toUpperCase() : undefined;

    let discountInPaise = 0;
    if (normalizedCouponCode) {
      const existingOrders = getServerOrders();
      const customerOrderCount = existingOrders.filter((o) => {
        if (o.status === 'CANCELLED') return false;
        if (effectiveCustomerId !== 'guest' && o.customerId === effectiveCustomerId) return true;
        if (effectiveEmail && o.customerEmail && o.customerEmail.toLowerCase() === effectiveEmail.toLowerCase()) {
          return true;
        }
        if (
          effectivePhone &&
          o.customerPhone &&
          o.customerPhone.replace(/\D/g, '') === effectivePhone.replace(/\D/g, '')
        ) {
          return true;
        }
        return false;
      }).length;

      const couponCheck = validateCouponServerSide({
        code: normalizedCouponCode,
        items: couponItems,
        customerId: effectiveCustomerId !== 'guest' ? effectiveCustomerId : null,
        customerEmail: effectiveEmail || null,
        customerPhone: effectivePhone || null,
        isAuthenticated: Boolean(authCustomer),
        customerOrderCount,
      });

      if (!couponCheck.valid) {
        return NextResponse.json(
          { success: false, error: couponCheck.message },
          { status: 400 }
        );
      }

      discountInPaise = couponCheck.discountInPaise;
    }

    const totalInPaise = Math.max(0, subtotalInPaise - discountInPaise + shippingInPaise);
    const requestedMethod = body.paymentMethod || 'COD';
    const gatewayValidation = validateOrderPaymentMethod(requestedMethod, totalInPaise);
    if (!gatewayValidation.valid) {
      return NextResponse.json(
        { success: false, error: gatewayValidation.error || 'Selected payment method is currently unavailable.' },
        { status: 400 }
      );
    }

    // Calculate statutory tax-inclusive GST across discounted product lines
    const destinationState = body.shippingAddress?.state || 'Bihar';
    const netProductTotal = Math.max(0, subtotalInPaise - discountInPaise);
    const taxInPaise = authoritativeItems.reduce((sum, item, idx) => {
      const lineShare =
        subtotalInPaise > 0
          ? Math.round((item.totalInPaise / subtotalInPaise) * netProductTotal)
          : 0;
      const gst = calculateGST(lineShare, stockRequests[idx].categorySlug, destinationState);
      return sum + gst.totalTaxInPaise;
    }, 0);

    const isCustomUpi = requestedMethod === 'CUSTOM_UPI';
    const isPayGlocal = requestedMethod === 'PAYGLOCAL';
    const isCod = requestedMethod === 'COD';

    // Invariant: CUSTOM_UPI, PAYGLOCAL, and COD orders start as PENDING for verification/confirmation!
    const initialStatus = isCustomUpi || isPayGlocal || isCod ? 'PENDING' : body.status || 'CONFIRMED';
    const initialPaymentStatus =
      isCod || isCustomUpi || isPayGlocal ? 'PENDING' : body.paymentStatus || 'PAID';

    const orderToSave: Order = {
      id: body.id || `ord-${Date.now()}`,
      orderNumber: body.orderNumber,
      customerId: effectiveCustomerId,
      customerEmail: effectiveEmail,
      customerPhone: effectivePhone,
      status: initialStatus,
      subtotalInPaise,
      discountInPaise,
      shippingInPaise,
      taxInPaise,
      totalInPaise,
      couponCode: normalizedCouponCode,
      paymentMethod: requestedMethod,
      paymentStatus: initialPaymentStatus,
      manualApprovalStatus: isCustomUpi ? 'PENDING_REVIEW' : body.manualApprovalStatus,
      utrNumber: body.utrNumber,
      courierName: body.courierName,
      trackingNumber: body.trackingNumber,
      trackingUrl: body.trackingUrl,
      estimatedDeliveryDate: body.estimatedDeliveryDate,
      customerNotes: body.customerNotes,
      adminNotes: body.adminNotes,
      shippingAddress: body.shippingAddress as any,
      billingAddress: body.billingAddress as any,
      items: authoritativeItems,
      timeline:
        body.timeline && body.timeline.length > 0
          ? body.timeline
          : generateInitialOrderTimeline({
              orderNumber: body.orderNumber,
              paymentMethod: requestedMethod,
              paymentStatus: initialPaymentStatus,
              status: initialStatus,
              utrNumber: body.utrNumber,
              createdAt: body.createdAt,
            }),
      createdAt: body.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Atomically decrement product inventory with rollback guard
    const decremented: Array<{ productId: string; variantId: string; quantity: number }> = [];
    for (const reqItem of stockRequests) {
      const stockRes = updateServerProductStock(
        reqItem.productId,
        reqItem.variantId,
        -reqItem.quantity
      );
      if (!stockRes.success) {
        for (const rollback of decremented) {
          updateServerProductStock(rollback.productId, rollback.variantId, rollback.quantity);
        }
        return NextResponse.json(
          { success: false, error: stockRes.error || 'Failed to reserve inventory for order.' },
          { status: 400 }
        );
      }
      decremented.push({
        productId: reqItem.productId,
        variantId: reqItem.variantId,
        quantity: reqItem.quantity,
      });
    }

    let saved: Order;
    try {
      saved = saveServerOrder(orderToSave);
    } catch (saveErr) {
      for (const rollback of decremented) {
        updateServerProductStock(rollback.productId, rollback.variantId, rollback.quantity);
      }
      throw saveErr;
    }

    if (normalizedCouponCode) {
      recordCouponRedemption(normalizedCouponCode, {
        customerId: effectiveCustomerId !== 'guest' ? effectiveCustomerId : undefined,
        customerEmail: effectiveEmail || undefined,
        customerPhone: effectivePhone || undefined,
        orderNumber: saved.orderNumber,
        discountInPaise: saved.discountInPaise,
        redeemedAt: saved.createdAt,
      });
    }

    try {
      await dispatchOrderLifecycleNotification('ORDER_PLACED', saved);
    } catch (notifyErr) {
      console.error('[api/orders] non-blocking ORDER_PLACED notification error:', notifyErr);
    }

    return NextResponse.json(
      { success: true, order: saved },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating order:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error saving order' },
      { status: 500 }
    );
  }
}

