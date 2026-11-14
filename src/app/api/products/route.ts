import { NextResponse } from 'next/server';
import {
  getServerProducts,
  saveServerProduct,
  bulkUpdateServerProducts,
} from '@/lib/server/products-store';
import { Product } from '@/types';

// ==============================================================================
// InfiniCharm — Products REST Collection API
// Query params:
//   ?admin=true -> returns all statuses (DRAFT, PUBLISHED, ARCHIVED)
//   ?category=<slug_or_id>
//   ?q=<query>
//   ?featured=true
//   ?status=PUBLISHED|DRAFT|ARCHIVED|ALL
// ==============================================================================

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const admin = searchParams.get('admin') === 'true';
    const category = searchParams.get('category') || undefined;
    const query = searchParams.get('q') || undefined;
    const featured = searchParams.get('featured') === 'true';
    const status = (searchParams.get('status') as any) || undefined;

    const products = getServerProducts({
      admin,
      category,
      query,
      featured,
      status,
    });

    return NextResponse.json(
      {
        success: true,
        count: products.length,
        products,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error: any) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error fetching products' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.title || !body.title.trim()) {
      return NextResponse.json(
        { success: false, error: 'Product title is required.' },
        { status: 400 }
      );
    }

    const title = body.title.trim();
    const slug =
      body.slug?.trim() ||
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '') + `-${Date.now().toString().slice(-4)}`;

    const id = body.id || `prod-custom-${Date.now()}`;
    const categoryId = body.categoryId || 'cat-honey';
    const priceInPaise = Math.round(Number(body.priceInPaise || body.priceRupees * 100 || 29900));
    const stockQuantity = Math.max(0, Number(body.stockQuantity || body.stock || 50));
    const originRegion = body.originRegion || body.origin || 'Bairgania, Sitamarhi, Bihar';
    const brand = body.brand || 'InfiniCharm';
    const mediaUrl =
      body.mediaUrl ||
      body.media?.[0]?.externalUrl ||
      'https://images.unsplash.com/photo-1685773253905-915ce8dd470b?q=80&w=1073&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D';

    const newProduct: Product = {
      id,
      categoryId,
      title,
      slug,
      tagline: body.tagline || 'Single-origin authentic produce directly from source',
      shortDescription: body.shortDescription || body.shortDesc || title,
      fullDescription: body.fullDescription || body.shortDescription || title,
      status: body.status || 'PUBLISHED',
      brand,
      originCountry: 'India',
      originRegion,
      ingredients: body.ingredients || '100% Pure & Natural Single-Origin Sourced',
      storageInstructions: body.storageInstructions || 'Store in a cool dry pantry away from sunlight.',
      fssaiLicenseNumber: body.fssaiLicenseNumber || 'FSSAI Lic. No. 10423000001234',
      isFeatured: !!body.isFeatured,
      isNewArrival: !!body.isNewArrival,
      seoTitle: body.seoTitle || `${title} | Buy Authentic Online | InfiniCharm`,
      seoDescription: body.seoDescription || body.shortDescription || title,
      variants: body.variants && body.variants.length > 0
        ? body.variants
        : [
            {
              id: `var-${id}-primary`,
              productId: id,
              sku: body.sku || `INF-${id.toUpperCase().slice(-8)}`,
              title: body.variantTitle || 'Standard Pack',
              priceInPaise,
              compareAtPriceInPaise: Math.round(priceInPaise * 1.25),
              costPriceInPaise: Math.round(priceInPaise * 0.65),
              stockQuantity,
              lowStockThreshold: 10,
              weightInGrams: body.weightInGrams || 500,
              attributes: body.attributes || { Packaging: 'Food Grade Container' },
              isActive: true,
            },
          ],
      media: body.media && body.media.length > 0
        ? body.media
        : [
            {
              id: `med-${id}-1`,
              provider: 'EXTERNAL_HTTPS',
              externalUrl: mediaUrl,
              mimeType: 'image/jpeg',
              altText: title,
              role: 'PRIMARY',
              displayOrder: 1,
              isActive: true,
            },
          ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = saveServerProduct(newProduct);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, product: result.product }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating product:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error creating product' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    if (body.action === 'BULK_ACTION') {
      const { ids, bulkAction } = body;
      if (!Array.isArray(ids) || ids.length === 0 || !['PUBLISH', 'DRAFT', 'DELETE'].includes(bulkAction)) {
        return NextResponse.json(
          { success: false, error: 'Valid ids array and bulkAction (PUBLISH|DRAFT|DELETE) are required' },
          { status: 400 }
        );
      }

      const result = bulkUpdateServerProducts(ids, bulkAction);
      if (!result.success) {
        return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        count: result.count,
        action: bulkAction,
        message: `Successfully updated ${result.count} product(s).`,
      });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('Error in bulk products action:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

