import type { Product } from '../../types/index.ts';
import { CATEGORIES } from '../constants/categories.ts';
import productsData from '../../data/products.json' with { type: 'json' };

// Single authoritative dataset loaded from products.json
export const INITIAL_PRODUCTS: Product[] = productsData as unknown as Product[];

export function getLiveProducts(): Product[] {
  if (typeof window === 'undefined') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('fs');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const path = require('path');
      const filePath = path.join(process.cwd(), 'src', 'data', 'products.json');
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // fallback to INITIAL_PRODUCTS
    }
  } else {
    try {
      const cached = localStorage.getItem('infinicharm_authoritative_products');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
  }
  return INITIAL_PRODUCTS;
}

// Helper query functions
export function getAllProducts(includeDrafts = false): Product[] {
  const prods = getLiveProducts();
  if (includeDrafts) return prods;
  return prods.filter((p) => p.status === 'PUBLISHED');
}

export function getProductBySlug(slug: string, includeDrafts = false): Product | undefined {
  const prods = getAllProducts(includeDrafts);
  return prods.find((p) => p.slug === slug);
}

export function getProductsByCategory(categorySlug: string): Product[] {
  const category = CATEGORIES.find((c) => c.slug === categorySlug);
  if (!category) return [];
  const prods = getAllProducts(false);
  return prods.filter((p) => p.categoryId === category.id);
}

export function getFeaturedProducts(): Product[] {
  return getAllProducts(false).filter((p) => p.isFeatured);
}

export function getNewArrivalProducts(): Product[] {
  return getAllProducts(false).filter((p) => p.isNewArrival);
}
