// ==============================================================================
// InfiniCharm — Server-Side Product Catalog Authority
// Invariants: Single Source of Truth, Integer Paise, Status Visibility Guard
// ==============================================================================

import fs from 'fs';
import path from 'path';
import type { Product, ProductVariant } from '../../types/index.ts';
import { INITIAL_PRODUCTS } from '../data/products.ts';

function getProductsFilePath(): string {
  const primaryPath = path.join(process.cwd(), 'src', 'data', 'products.json');
  if (fs.existsSync(primaryPath)) {
    return primaryPath;
  }
  const altPath = path.join(process.cwd(), 'data', 'products.json');
  if (fs.existsSync(altPath)) {
    return altPath;
  }
  return primaryPath;
}

export function getServerProducts(options?: {
  admin?: boolean;
  category?: string;
  query?: string;
  featured?: boolean;
  status?: 'PUBLISHED' | 'DRAFT' | 'ARCHIVED' | 'ALL';
}): Product[] {
  try {
    const filePath = getProductsFilePath();
    let products: Product[] = [];

    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        products = parsed;
      }
    }

    if (products.length === 0) {
      products = [...INITIAL_PRODUCTS];
      writeProductsToFile(products);
    }

    // Status filter: Public callers ONLY receive PUBLISHED products
    if (!options?.admin) {
      products = products.filter((p) => p.status === 'PUBLISHED');
    } else if (options.status && options.status !== 'ALL') {
      products = products.filter((p) => p.status === options.status);
    }

    // Category filter
    if (options?.category && options.category !== 'ALL') {
      const cat = options.category.toLowerCase();
      products = products.filter(
        (p) => p.categoryId.toLowerCase() === cat || (p.category?.slug && p.category.slug.toLowerCase() === cat)
      );
    }

    // Featured filter
    if (options?.featured) {
      products = products.filter((p) => p.isFeatured);
    }

    // Query search
    if (options?.query && options.query.trim()) {
      const q = options.query.trim().toLowerCase();
      products = products.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          (p.shortDescription && p.shortDescription.toLowerCase().includes(q)) ||
          (p.originRegion && p.originRegion.toLowerCase().includes(q)) ||
          p.variants.some((v) => v.sku.toLowerCase().includes(q))
      );
    }

    return products;
  } catch (error) {
    console.error('Error reading products file:', error);
    return INITIAL_PRODUCTS;
  }
}

export function getServerProductByIdOrSlug(
  idOrSlug: string,
  admin = false
): Product | null {
  if (!idOrSlug) return null;
  const products = getServerProducts({ admin: true });
  const clean = idOrSlug.trim().toLowerCase();

  const found = products.find(
    (p) => p.id.toLowerCase() === clean || p.slug.toLowerCase() === clean
  );

  if (!found) return null;
  if (!admin && found.status !== 'PUBLISHED') return null;

  return found;
}

export function writeProductsToFile(products: Product[]): boolean {
  try {
    const filePath = getProductsFilePath();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(products, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Error writing products file:', error);
    return false;
  }
}

export function saveServerProduct(product: Product): { success: boolean; product?: Product; error?: string } {
  try {
    const products = getServerProducts({ admin: true });
    const idx = products.findIndex((p) => p.id === product.id);
    const now = new Date().toISOString();

    const normalizedProduct: Product = {
      ...product,
      updatedAt: now,
      createdAt: product.createdAt || now,
    };

    if (idx >= 0) {
      products[idx] = normalizedProduct;
    } else {
      products.unshift(normalizedProduct);
    }

    writeProductsToFile(products);
    return { success: true, product: normalizedProduct };
  } catch (error: any) {
    console.error('Failed to save product to file:', error);
    return { success: false, error: error.message || 'Failed to save product' };
  }
}

export function deleteServerProduct(id: string): { success: boolean; error?: string } {
  try {
    const products = getServerProducts({ admin: true });
    const filtered = products.filter((p) => p.id !== id);
    if (filtered.length === products.length) {
      return { success: false, error: `Product with ID "${id}" not found.` };
    }
    writeProductsToFile(filtered);
    return { success: true };
  } catch (error: any) {
    console.error('Failed to delete product:', error);
    return { success: false, error: error.message || 'Failed to delete product' };
  }
}

export function updateServerProductStock(
  productId: string,
  variantId: string,
  delta: number
): { success: boolean; product?: Product; newStock?: number; error?: string } {
  try {
    const products = getServerProducts({ admin: true });
    const pIdx = products.findIndex((p) => p.id === productId);
    if (pIdx < 0) {
      return { success: false, error: `Product "${productId}" not found.` };
    }

    const prod = products[pIdx];
    const vIdx = prod.variants.findIndex((v) => v.id === variantId);
    if (vIdx < 0) {
      return { success: false, error: `Variant "${variantId}" not found in product.` };
    }

    const currentQty = prod.variants[vIdx].stockQuantity || 0;
    const newStock = Math.max(0, currentQty + delta);

    prod.variants[vIdx].stockQuantity = newStock;
    prod.updatedAt = new Date().toISOString();

    products[pIdx] = prod;
    writeProductsToFile(products);

    return { success: true, product: prod, newStock };
  } catch (error: any) {
    console.error('Failed to update product stock:', error);
    return { success: false, error: error.message || 'Failed to update stock' };
  }
}

export function toggleServerProductStatus(
  productId: string
): { success: boolean; product?: Product; error?: string } {
  try {
    const products = getServerProducts({ admin: true });
    const idx = products.findIndex((p) => p.id === productId);
    if (idx < 0) {
      return { success: false, error: `Product "${productId}" not found.` };
    }

    const prod = products[idx];
    prod.status = prod.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    prod.updatedAt = new Date().toISOString();

    products[idx] = prod;
    writeProductsToFile(products);

    return { success: true, product: prod };
  } catch (error: any) {
    console.error('Failed to toggle product status:', error);
    return { success: false, error: error.message || 'Failed to toggle status' };
  }
}

export function duplicateServerProduct(
  id: string
): { success: boolean; product?: Product; error?: string } {
  try {
    const products = getServerProducts({ admin: true });
    const original = products.find((p) => p.id === id);
    if (!original) {
      return { success: false, error: `Product "${id}" not found.` };
    }

    const now = new Date().toISOString();
    const timestamp = Date.now();
    const randomSuffix = Math.floor(Math.random() * 1000);
    const newId = `prod-copy-${timestamp}`;
    const newSlug = `${original.slug}-copy-${timestamp.toString().slice(-4)}`;

    const clonedVariants: ProductVariant[] = original.variants.map((v, idx) => ({
      ...v,
      id: `var-${timestamp}-${idx + 1}`,
      productId: newId,
      sku: `${v.sku || 'SKU'}-COPY-${randomSuffix}`,
    }));

    const clonedMedia = original.media.map((m, idx) => ({
      ...m,
      id: `med-${timestamp}-${idx + 1}`,
      productId: newId,
    }));

    const clonedProduct: Product = {
      ...original,
      id: newId,
      slug: newSlug,
      title: `${original.title} (Copy)`,
      status: 'DRAFT',
      baseSku: original.baseSku ? `${original.baseSku}-COPY` : undefined,
      variants: clonedVariants,
      media: clonedMedia,
      createdAt: now,
      updatedAt: now,
    };

    products.unshift(clonedProduct);
    writeProductsToFile(products);

    return { success: true, product: clonedProduct };
  } catch (error: any) {
    console.error('Failed to duplicate product:', error);
    return { success: false, error: error.message || 'Failed to duplicate product' };
  }
}

export function bulkUpdateServerProducts(
  ids: string[],
  action: 'PUBLISH' | 'DRAFT' | 'DELETE'
): { success: boolean; count: number; error?: string } {
  try {
    const products = getServerProducts({ admin: true });
    const idSet = new Set(ids);
    let affectedCount = 0;

    if (action === 'DELETE') {
      const remaining = products.filter((p) => {
        if (idSet.has(p.id)) {
          affectedCount++;
          return false;
        }
        return true;
      });
      writeProductsToFile(remaining);
      return { success: true, count: affectedCount };
    }

    const targetStatus: 'PUBLISHED' | 'DRAFT' = action === 'PUBLISH' ? 'PUBLISHED' : 'DRAFT';
    const now = new Date().toISOString();

    const updated = products.map((p) => {
      if (idSet.has(p.id)) {
        affectedCount++;
        return {
          ...p,
          status: targetStatus,
          updatedAt: now,
        };
      }
      return p;
    });

    writeProductsToFile(updated);
    return { success: true, count: affectedCount };
  } catch (error: any) {
    console.error('Failed to execute bulk update:', error);
    return { success: false, count: 0, error: error.message || 'Bulk operation failed' };
  }
}

