import { NextResponse } from 'next/server';
import {
  getServerProductByIdOrSlug,
  saveServerProduct,
  deleteServerProduct,
  updateServerProductStock,
  toggleServerProductStatus,
  duplicateServerProduct,
} from '@/lib/server/products-store';
import { dispatchNotificationEvent } from '@/lib/server/notification-dispatcher';
import { getAdminUrl } from '@/lib/utils/env-urls';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const admin = searchParams.get('admin') === 'true';

    const product = getServerProductByIdOrSlug(id, admin);
    if (!product) {
      return NextResponse.json(
        { success: false, error: `Product "${id}" not found.` },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: true, product },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error: any) {
    console.error('Error fetching product by ID:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const action = body.action || 'UPDATE_PRODUCT';

    // 1. Stock Adjustment
    if (action === 'UPDATE_STOCK') {
      const { variantId, delta } = body;
      if (!variantId || typeof delta !== 'number') {
        return NextResponse.json(
          { success: false, error: 'variantId and numeric delta are required.' },
          { status: 400 }
        );
      }
      const result = updateServerProductStock(id, variantId, delta);
      if (!result.success) {
        return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      }
      if (typeof result.newStock === 'number' && result.newStock <= 5 && result.product) {
        try {
          await dispatchNotificationEvent({
            eventKey: 'PRODUCT_LOW_STOCK',
            entityType: 'PRODUCT',
            entityId: result.product.id,
            extraVars: {
              product_title: result.product.title,
              stock_quantity: result.newStock,
              product_status: result.product.status,
              action_url: getAdminUrl('products', request),
              activity_summary: `Variant ${variantId} of ${result.product.title} dropped to ${result.newStock} remaining units.`,
            },
          });
        } catch (notifyErr) {
          console.error('[api/products/[id]] non-blocking low stock alert error:', notifyErr);
        }
      }
      return NextResponse.json({ success: true, product: result.product, newStock: result.newStock });
    }

    // 2. Toggle Status (PUBLISHED <-> DRAFT)
    if (action === 'TOGGLE_STATUS') {
      const result = toggleServerProductStatus(id);
      if (!result.success) {
        return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      }
      if (result.product) {
        try {
          await dispatchNotificationEvent({
            eventKey: 'PRODUCT_STATUS_CHANGED',
            entityType: 'PRODUCT',
            entityId: result.product.id,
            extraVars: {
              product_title: result.product.title,
              stock_quantity: (result.product.variants || []).reduce(
                (acc, v) => acc + Number(v.stockQuantity || 0),
                0
              ),
              product_status: result.product.status,
              action_url: getAdminUrl('products', request),
              activity_summary: `Catalog status of ${result.product.title} changed to ${result.product.status}.`,
            },
          });
        } catch (notifyErr) {
          console.error('[api/products/[id]] non-blocking status alert error:', notifyErr);
        }
      }
      return NextResponse.json({ success: true, product: result.product });
    }

    // 3. Duplicate Product
    if (action === 'DUPLICATE') {
      const result = duplicateServerProduct(id);
      if (!result.success) {
        return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      }
      return NextResponse.json({ success: true, product: result.product }, { status: 201 });
    }

    // 3. Full / Partial Update
    const existing = getServerProductByIdOrSlug(id, true);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: `Product "${id}" not found.` },
        { status: 404 }
      );
    }

    const updated = {
      ...existing,
      ...body,
      id: existing.id, // prevent overwriting ID
      updatedAt: new Date().toISOString(),
    };

    // If variants updated via simplified price/stock fields
    if (body.priceRupees !== undefined || body.stock !== undefined) {
      const priceInPaise = body.priceRupees !== undefined
        ? Math.round(Number(body.priceRupees) * 100)
        : existing.variants[0]?.priceInPaise || 29900;
      const stockQuantity = body.stock !== undefined
        ? Math.max(0, Number(body.stock))
        : existing.variants[0]?.stockQuantity || 0;

      updated.variants = existing.variants.map((v, idx) => {
        if (idx === 0) {
          return {
            ...v,
            priceInPaise,
            compareAtPriceInPaise: Math.round(priceInPaise * 1.25),
            stockQuantity,
          };
        }
        return v;
      });
    }

    // If media updated via mediaUrl
    if (body.mediaUrl && body.mediaUrl.trim()) {
      if (updated.media && updated.media.length > 0) {
        updated.media[0].externalUrl = body.mediaUrl.trim();
      } else {
        updated.media = [
          {
            id: `med-${existing.id}-1`,
            provider: 'EXTERNAL_HTTPS',
            externalUrl: body.mediaUrl.trim(),
            mimeType: 'image/jpeg',
            altText: updated.title,
            role: 'PRIMARY',
            displayOrder: 1,
            isActive: true,
          },
        ];
      }
    }

    const saveRes = saveServerProduct(updated);
    if (!saveRes.success) {
      return NextResponse.json({ success: false, error: saveRes.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, product: saveRes.product });
  } catch (error: any) {
    console.error('Error updating product:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error updating product' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = deleteServerProduct(id);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, message: `Product ${id} deleted successfully.` });
  } catch (error: any) {
    console.error('Error deleting product:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error deleting product' },
      { status: 500 }
    );
  }
}

