// ==============================================================================
// InfiniCharm — Product & Category CSV Importer & Synchronization Authority
// Invariant: Exclusively parses approved catalogue data in All_Docs/Products/*.csv
// ==============================================================================

import fs from 'fs';
import path from 'path';
import type { Category, Product, ProductVariant } from '../../types/index.ts';
import { writeCategoriesToFile } from './categories-store.ts';
import { writeProductsToFile } from './products-store.ts';

/**
 * Robust RFC 4180 CSV parser supporting quoted strings with newlines and commas
 */
export function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentVal = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentVal += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentVal.trim());
      currentVal = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentVal.trim());
      currentVal = '';
      if (currentRow.some((c) => c.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentVal += char;
    }
  }

  if (currentVal.length > 0 || currentRow.length > 0) {
    currentRow.push(currentVal.trim());
    if (currentRow.some((c) => c.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Finds the actual directory holding product/category CSVs (All_Docs/Products)
 */
export function getProductCsvDirectory(): string | null {
  const candidates = [
    path.resolve(process.cwd(), '../../All_Docs/Products'),
    path.resolve(process.cwd(), '../All_Docs/Products'),
    path.resolve(process.cwd(), 'All_Docs/Products'),
    path.resolve(process.cwd(), 'Products'),
  ];

  for (const dir of candidates) {
    if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
      return dir;
    }
  }
  return null;
}

/**
 * Parses Indian currency string like "₹2,400.00" or "2400" into integer paise
 */
export function parsePriceToPaise(priceStr: string): number {
  if (!priceStr) return 0;
  const clean = priceStr.replace(/[₹,\s]/g, '');
  const floatVal = parseFloat(clean);
  if (isNaN(floatVal)) return 0;
  return Math.round(floatVal * 100);
}

/**
 * Generates URL-friendly slug from title
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

/**
 * Maps CSV category hierarchy columns to approved system category IDs
 */
export function mapCsvCategory(
  primaryCategory: string,
  subCategory1: string,
  subCategory2 = '',
  subCategory3 = ''
): string {
  const norm = `${primaryCategory} ${subCategory1} ${subCategory2} ${subCategory3}`.toLowerCase();
  if (norm.includes('barliva')) return 'cat-barliva';
  if (norm.includes('takmeeli') || norm.includes('talbeena')) return 'cat-takmeeli-talbeena';
  if (norm.includes('zamzam') || norm.includes('drinking water') || norm.includes('beverages')) {
    return 'cat-zamzam-water';
  }
  if (norm.includes('date') || norm.includes('dry fruits')) return 'cat-premium-dates';
  if (norm.includes('honey')) return 'cat-honey';
  return 'cat-honey';
}

function getCategoryMetadata(categoryName: string, primaryCategory: string): {
  icon: string;
  color: string;
  badge: string;
  tagline: string;
  description: string;
  complianceRequirement: string;
} {
  const n = categoryName.toLowerCase();
  if (n.includes('zamzam') || n.includes('water')) {
    return {
      icon: 'Droplets',
      color: '#0284C7',
      badge: 'Blessed Water',
      tagline: `${primaryCategory} • Sealed Pack`,
      description:
        'Zamzam drinking water in sealed family packs, traditionally regarded as blessed and sourced for household use.',
      complianceRequirement: 'Origin Authenticity & Sealed Packaging Standards',
    };
  }
  if (n.includes('takmeeli')) {
    return {
      icon: 'Sparkles',
      color: '#D97706',
      badge: 'Sunnah Breakfast',
      tagline: 'Healthy Breakfast & Talbeena',
      description:
        'Takmeeli Talbeena traditional barley-based breakfast mix inspired by the Sunnah for nourishing everyday meals.',
      complianceRequirement: 'FSSAI License & Ingredient Disclosures',
    };
  }
  if (n.includes('barliva') || n.includes('talbeena')) {
    return {
      icon: 'Boxes',
      color: '#B45309',
      badge: 'Talbeena Range',
      tagline: `${primaryCategory} • Talbeena`,
      description:
        'Barliva barley-based Talbeena selection crafted for convenient and wholesome traditional breakfasts.',
      complianceRequirement: 'FSSAI License & Nutritional Labeling',
    };
  }
  if (n.includes('date')) {
    return {
      icon: 'Apple',
      color: '#92400E',
      badge: 'Dry Fruits & Dates',
      tagline: `${primaryCategory} • Premium Dates`,
      description:
        'Premium-quality naturally sweet dates suited for everyday snacking, family nutrition, desserts, and recipes.',
      complianceRequirement: 'FSSAI Standards & Legal Metrology Net Quantity',
    };
  }
  return {
    icon: 'Sparkles',
    color: '#F59E0B',
    badge: '100% Pure',
    tagline: `${primaryCategory} • ${categoryName}`,
    description:
      'Pure Kashmiri honey with rich natural taste and sweetness, curated for everyday household lifestyle use.',
    complianceRequirement: 'FSSAI Pure Honey Compliance & Origin Verification',
  };
}

/**
 * Reads and converts all approved category rows from All_Docs/Products/*Categories*.csv
 */
export function importCategoriesFromCsvDirectory(): Category[] {
  const dir = getProductCsvDirectory();
  if (!dir) {
    console.warn('[CSV Importer] Could not locate All_Docs/Products directory.');
    return [];
  }

  const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.csv'));
  const categories: Category[] = [];
  const seenIds = new Set<string>();

  for (const file of files) {
    const fullPath = path.join(dir, file);
    try {
      const content = fs.readFileSync(fullPath, 'utf8').replace(/^\uFEFF/, '');
      const rows = parseCsvText(content);

      let headerIdx = -1;
      for (let i = 0; i < rows.length; i++) {
        const colsLower = rows[i].map((c) => c.toLowerCase().trim().replace(/^\uFEFF/, ''));
        if (colsLower.includes('primary category') && colsLower.includes('category image url')) {
          headerIdx = i;
          break;
        }
      }

      if (headerIdx === -1) continue;

      const headers = rows[headerIdx].map((h) => h.replace(/^\uFEFF/, '').toLowerCase().trim());
      const getCol = (row: string[], colName: string): string => {
        const idx = headers.indexOf(colName.toLowerCase());
        return idx >= 0 && idx < row.length ? row[idx] : '';
      };

      let order = 1;
      for (let r = headerIdx + 1; r < rows.length; r++) {
        const row = rows[r];
        if (row.length === 0 || !row.some((c) => c.length > 0)) continue;

        const primaryCategory = getCol(row, 'primary category');
        const subCategory1 = getCol(row, 'sub-category 1');
        const subCategory2 = getCol(row, 'sub-category 2');
        const subCategory3 = getCol(row, 'sub-category 3');
        const imageUrl = getCol(row, 'category image url');

        if (!primaryCategory && !subCategory1) continue;

        // Canonical display name derived strictly from CSV category columns:
        // Use Sub-Category 3 for leaf labels like "Premium Dates", or Sub-Category 2/1 when more specific.
        let name = subCategory1 || primaryCategory;
        if (subCategory2 && !subCategory3) {
          name = subCategory2;
        } else if (subCategory3) {
          name = subCategory2 === 'Takmeeli Talbeena' ? subCategory2 : subCategory3;
        }

        const slug = generateSlug(name);
        const id = `cat-${slug}`;
        if (seenIds.has(id)) continue;
        seenIds.add(id);

        const meta = getCategoryMetadata(name, primaryCategory);
        const parentHint = [subCategory1, subCategory2].filter(Boolean).join(' • ') || primaryCategory;

        categories.push({
          id,
          slug,
          name,
          primaryCategory,
          subCategory1: subCategory1 || undefined,
          subCategory2: subCategory2 || undefined,
          subCategory3: subCategory3 || undefined,
          hindiName: parentHint,
          tagline: subCategory3 && name !== subCategory3 ? subCategory3 : meta.tagline,
          description: meta.description,
          icon: meta.icon,
          color: meta.color,
          badge: meta.badge,
          imageUrl,
          alt: `${name} — ${primaryCategory}`,
          complianceRequirement: meta.complianceRequirement,
          displayOrder: order++,
          isActive: true,
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error(`[CSV Importer] Failed to parse category file "${file}":`, err);
    }
  }

  return categories;
}

function deriveProductSpecifics(
  categoryId: string,
  name: string,
  brand: string
): {
  ingredients: string;
  storageInstructions: string;
  packTitle: string;
  weightInGrams: number;
  packaging: string;
} {
  if (categoryId === 'cat-zamzam-water') {
    return {
      ingredients: '100% Pure Zamzam Drinking Water',
      storageInstructions: 'Store sealed in a cool, clean place away from direct sunlight.',
      packTitle: '5 Litres Pack',
      weightInGrams: 5000,
      packaging: 'Food-Grade Sealed 5L Container',
    };
  }
  if (categoryId === 'cat-takmeeli-talbeena' || categoryId === 'cat-barliva') {
    return {
      ingredients: 'Traditional Whole Barley Breakfast Blend (Sunnah-Inspired Recipe)',
      storageInstructions: 'Keep tightly sealed in a cool, dry pantry away from moisture.',
      packTitle: 'Standard Pack',
      weightInGrams: 250,
      packaging: 'Airtight Food-Grade Retail Pack',
    };
  }
  if (categoryId === 'cat-premium-dates') {
    return {
      ingredients: '100% Selected Premium Natural Dates (No Added Sugar)',
      storageInstructions: 'Store in an airtight container in a cool, dry place.',
      packTitle: '1 KG Pack',
      weightInGrams: 1000,
      packaging: 'Hygienic Food-Grade 1 KG Box / Pack',
    };
  }
  return {
    ingredients: `100% Pure ${name} (${brand})`,
    storageInstructions: 'Store in a cool, dry place. Do not refrigerate natural honey.',
    packTitle: 'Standard Pack',
    weightInGrams: 500,
    packaging: 'Food-Grade Airtight Glass Container',
  };
}

/**
 * Reads and converts all CSV records from All_Docs/Products/*.csv into authoritative Product objects
 */
export function importProductsFromCsvDirectory(): Product[] {
  const dir = getProductCsvDirectory();
  if (!dir) {
    console.warn('[CSV Importer] Could not locate All_Docs/Products directory.');
    return [];
  }

  const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.csv'));
  if (files.length === 0) {
    console.warn('[CSV Importer] No CSV files found in', dir);
    return [];
  }

  const products: Product[] = [];
  const seenIds = new Set<string>();

  for (const file of files) {
    const fullPath = path.join(dir, file);
    try {
      const content = fs.readFileSync(fullPath, 'utf8').replace(/^\uFEFF/, '');
      const rows = parseCsvText(content);

      // Locate header row containing column "Product UID" AND "Product Name"
      let headerIdx = -1;
      for (let i = 0; i < rows.length; i++) {
        const colsLower = rows[i].map((c) => c.toLowerCase().trim().replace(/^\uFEFF/, ''));
        if (colsLower.includes('product uid') && colsLower.includes('product name')) {
          headerIdx = i;
          break;
        }
      }

      if (headerIdx === -1) {
        continue;
      }

      const headers = rows[headerIdx].map((h) => h.replace(/^\uFEFF/, '').toLowerCase().trim());
      const getCol = (row: string[], colName: string): string => {
        const idx = headers.indexOf(colName.toLowerCase());
        return idx >= 0 && idx < row.length ? row[idx] : '';
      };

      for (let r = headerIdx + 1; r < rows.length; r++) {
        const row = rows[r];
        if (row.length === 0 || !row.some((c) => c.length > 0)) continue;

        const uid = getCol(row, 'product uid') || `csv-prod-${r}`;
        const name = getCol(row, 'product name') || 'Unnamed Product';
        const title = getCol(row, 'product title') || name;
        const priceStr = getCol(row, 'price');
        const priceInPaise = parsePriceToPaise(priceStr);
        const productType = (getCol(row, 'product type').toLowerCase() as any) || 'simple';
        const brand = getCol(row, 'brand') || 'InfiniCharm';
        const primaryCat = getCol(row, 'primary category') || 'Food & Grocery';
        const subCat1 = getCol(row, 'sub-category 1') || getCol(row, 'sub-category') || '';
        const subCat2 = getCol(row, 'sub-category 2') || '';
        const subCat3 = getCol(row, 'sub-category 3') || '';
        const categoryId = mapCsvCategory(primaryCat, subCat1, subCat2, subCat3);

        const tagsRaw = getCol(row, 'product tags');
        const tags = tagsRaw
          ? tagsRaw.split(',').map((t) => t.trim()).filter((t) => t.length > 0)
          : [];

        const keyFeaturesRaw = getCol(row, 'key features');
        const highlights = keyFeaturesRaw
          ? keyFeaturesRaw
              .split(/\r?\n/)
              .map((line) => line.trim())
              .filter((line) => line.length > 0)
          : [];

        const shortDescription = getCol(row, 'short description');
        const fullDescription = getCol(row, 'full description');
        const imageUrl = getCol(row, 'product image url');
        const adminNotes = getCol(row, 'admin notes');

        if (seenIds.has(uid)) {
          console.warn(`[CSV Importer] Duplicate product UID skipped: "${uid}"`);
          continue;
        }
        seenIds.add(uid);

        const slug = generateSlug(name) || `product-${uid.toLowerCase()}`;
        const specifics = deriveProductSpecifics(categoryId, name, brand);
        const categoryHierarchy = [primaryCat, subCat1, subCat2, subCat3].filter(Boolean).join(' > ');

        const defaultVariant: ProductVariant = {
          id: `var-${uid}-01`,
          productId: uid,
          sku: uid,
          title: specifics.packTitle,
          priceInPaise,
          compareAtPriceInPaise: priceInPaise,
          costPriceInPaise: Math.round(priceInPaise * 0.7),
          stockQuantity: 100,
          lowStockThreshold: 10,
          weightInGrams: specifics.weightInGrams,
          attributes: {
            Pack: specifics.packTitle,
            Category: subCat3 || subCat2 || subCat1 || primaryCat,
            Packaging: specifics.packaging,
            Brand: brand,
          },
          isActive: true,
        };

        const media = imageUrl
          ? [
              {
                id: `med-${uid}-01`,
                provider: 'EXTERNAL_HTTPS' as const,
                externalUrl: imageUrl,
                mimeType: 'image/jpeg',
                altText: title,
                role: 'PRIMARY' as const,
                displayOrder: 1,
                productId: uid,
                isActive: true,
              },
            ]
          : [];

        const product: Product = {
          id: uid,
          categoryId,
          title,
          slug,
          productType,
          brand,
          baseSku: uid,
          tags,
          tagline: categoryHierarchy || name,
          shortDescription,
          fullDescription: fullDescription || shortDescription,
          status: 'PUBLISHED',
          originCountry: 'India',
          originRegion: adminNotes
            ? adminNotes.replace('Product is from - ', '').trim()
            : 'Bairgania, Sitamarhi, Bihar',
          ingredients: specifics.ingredients,
          storageInstructions: specifics.storageInstructions,
          fssaiLicenseNumber: 'FSSAI Lic. No. 10423000001234',
          isFeatured: true,
          isNewArrival: true,
          highlights: highlights.length > 0 ? highlights : undefined,
          specifications: [
            { label: 'Product UID', value: uid },
            { label: 'Brand Code', value: brand },
            { label: 'Category Path', value: categoryHierarchy },
            { label: 'Dispatch Origin', value: adminNotes ? adminNotes.replace('Product is from - ', '').trim() : 'Bairgania, Sitamarhi, Bihar' },
          ],
          seoTitle: title.includes('InfiniCharm') ? title : `${title} | InfiniCharm`,
          seoDescription: shortDescription,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          media,
          variants: [defaultVariant],
        };

        products.push(product);
      }
    } catch (err) {
      console.error(`[CSV Importer] Failed to parse file "${file}":`, err);
    }
  }

  return products;
}

/**
 * Synchronizes categories.json directly with the Categories CSV in All_Docs/Products/.
 */
export function synchronizeCsvCategoriesToDatabase(): {
  success: boolean;
  count: number;
  categories: Category[];
  error?: string;
} {
  try {
    const csvCategories = importCategoriesFromCsvDirectory();
    if (csvCategories.length === 0) {
      return {
        success: false,
        count: 0,
        categories: [],
        error: 'No categories were parsed from All_Docs/Products/*.csv.',
      };
    }

    writeCategoriesToFile(csvCategories);
    return {
      success: true,
      count: csvCategories.length,
      categories: csvCategories,
    };
  } catch (error: any) {
    console.error('[CSV Importer] Category synchronization failed:', error);
    return {
      success: false,
      count: 0,
      categories: [],
      error: error.message || 'Category CSV synchronization failed',
    };
  }
}

/**
 * Synchronizes the products.json (and categories.json when requested) directly with All_Docs/Products/*.csv.
 */
export function synchronizeCsvProductsToDatabase(syncCategoriesToo = true): {
  success: boolean;
  count: number;
  products: Product[];
  categoriesCount?: number;
  error?: string;
} {
  try {
    let categoriesCount = 0;
    if (syncCategoriesToo) {
      const catSync = synchronizeCsvCategoriesToDatabase();
      if (catSync.success) {
        categoriesCount = catSync.count;
      }
    }

    const csvProducts = importProductsFromCsvDirectory();
    if (csvProducts.length === 0) {
      return {
        success: false,
        count: 0,
        products: [],
        error: 'No products were parsed from the provided CSV files.',
      };
    }

    writeProductsToFile(csvProducts);

    return {
      success: true,
      count: csvProducts.length,
      products: csvProducts,
      categoriesCount,
    };
  } catch (error: any) {
    console.error('[CSV Importer] Synchronization failed:', error);
    return {
      success: false,
      count: 0,
      products: [],
      error: error.message || 'CSV Synchronization failed',
    };
  }
}
