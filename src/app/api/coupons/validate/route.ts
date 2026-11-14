import { NextRequest, NextResponse } from 'next/server';
import {
  validateCouponServerSide,
  CouponValidationCartItem,
} from '@/lib/server/coupons-store';
import { getServerProducts } from '@/lib/server/products-store';
import { getServerCategories } from '@/lib/server/categories-store';
import { getServerCustomerById } from '@/lib/server/customers-store';
import { getServerOrders } from '@/lib/server/orders-store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const code = String(body.code || '').trim().toUpperCase();
    const rawItems: Array<{
      productId?: string;
      variantId?: string;
      categoryId?: string;
      categorySlug?: string;
      priceInPaise?: number;
      quantity?: number;
    }> = Array.isArray(body.items) ? body.items : [];

    // Resolve authenticated customer securely from HTTP cookies
    const customerIdCookie = req.cookies.get('infinicharm_customer_id')?.value;
    const sessionCookie = req.cookies.get('infinicharm_customer_session')?.value;
    let authenticatedCustomer = null;

    if (customerIdCookie && sessionCookie === 'active') {
      authenticatedCustomer = getServerCustomerById(customerIdCookie);
    }

    if (authenticatedCustomer && authenticatedCustomer.status === 'SUSPENDED') {
      return NextResponse.json(
        {
          valid: false,
          message: 'Your account is suspended and cannot apply promotional coupons.',
          discountInPaise: 0,
        },
        { status: 403 }
      );
    }

    const effectiveCustomerId = authenticatedCustomer?.id || null;
    const effectiveEmail =
      authenticatedCustomer?.email || (body.customerEmail ? String(body.customerEmail).trim() : null);
    const effectivePhone =
      authenticatedCustomer?.phone || (body.customerPhone ? String(body.customerPhone).trim() : null);

    // Compute prior order count for NEW_CUSTOMERS eligibility
    const orders = getServerOrders();
    const customerOrderCount = orders.filter((o) => {
      if (o.status === 'CANCELLED') return false;
      if (effectiveCustomerId && o.customerId === effectiveCustomerId) return true;
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

    // Resolve authoritative product prices & categories from server catalog
    const catalogProducts = getServerProducts({ status: 'PUBLISHED' });
    const categories = getServerCategories();
    const productMap = new Map(catalogProducts.map((p) => [p.id, p]));
    const categorySlugById = new Map(categories.map((c) => [c.id, c.slug]));

    const resolvedItems: CouponValidationCartItem[] = rawItems.map((item) => {
      const prod = item.productId ? productMap.get(item.productId) : undefined;
      const variant = prod?.variants?.find((v) => v.id === item.variantId) || prod?.variants?.[0];
      const priceInPaise = variant ? variant.priceInPaise : Math.max(0, Math.round(Number(item.priceInPaise) || 0));
      const categoryId = prod?.categoryId || item.categoryId;
      const categorySlug =
        (categoryId && categorySlugById.get(categoryId)) || item.categorySlug || undefined;

      return {
        productId: prod?.id || item.productId || '',
        variantId: variant?.id || item.variantId,
        categoryId,
        categorySlug,
        priceInPaise,
        quantity: Math.max(1, Math.round(Number(item.quantity) || 1)),
      };
    });

    const result = validateCouponServerSide({
      code,
      items: resolvedItems,
      subtotalInPaise:
        resolvedItems.length === 0 && body.subtotalInPaise !== undefined
          ? Number(body.subtotalInPaise)
          : undefined,
      customerId: effectiveCustomerId,
      customerEmail: effectiveEmail,
      customerPhone: effectivePhone,
      isAuthenticated: Boolean(authenticatedCustomer),
      customerOrderCount,
    });

    return NextResponse.json(result, {
      status: result.valid ? 200 : 400,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (err: any) {
    console.error('Coupon validate error:', err);
    return NextResponse.json(
      {
        valid: false,
        message: err?.message || 'Unable to validate coupon.',
        discountInPaise: 0,
      },
      { status: 500 }
    );
  }
}

