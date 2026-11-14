// ==============================================================================
// InfiniCharm — Server-Side Categories Authority
// Governing Invariants: Single Source of Truth, Instant Enablement, Order & Sync
// ==============================================================================

import fs from 'fs';
import path from 'path';
import type { Category } from '../../types/index.ts';

function getCategoriesFilePath(): string {
  const primaryPath = path.join(process.cwd(), 'src', 'data', 'categories.json');
  if (fs.existsSync(primaryPath)) {
    return primaryPath;
  }
  const altPath = path.join(process.cwd(), 'data', 'categories.json');
  if (fs.existsSync(altPath)) {
    return altPath;
  }
  return primaryPath;
}

export function getServerCategories(onlyActive = false): Category[] {
  try {
    const filePath = getCategoriesFilePath();
    if (!fs.existsSync(filePath)) {
      return [];
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed: Category[] = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    const sorted = [...parsed].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

    if (onlyActive) {
      return sorted.filter((c) => c.isActive !== false);
    }

    return sorted;
  } catch (error) {
    console.error('Error reading categories file:', error);
    return [];
  }
}

export function getServerCategoryById(idOrSlug: string): Category | null {
  const categories = getServerCategories();
  return (
    categories.find(
      (c) => c.id === idOrSlug || c.slug === idOrSlug || c.slug.toLowerCase() === idOrSlug.toLowerCase()
    ) || null
  );
}

export function writeCategoriesToFile(categories: Category[]): boolean {
  try {
    const filePath = getCategoriesFilePath();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(categories, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Error writing categories file:', error);
    return false;
  }
}

export function createServerCategory(
  data: Partial<Category>
): { success: boolean; category?: Category; error?: string } {
  try {
    const categories = getServerCategories();

    const name = data.name?.trim();
    if (!name) {
      return { success: false, error: 'Category name is required.' };
    }

    const rawSlug = data.slug?.trim() || name;
    const slug = rawSlug
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const id = data.id?.trim() || `cat-${slug}`;

    if (categories.some((c) => c.id === id)) {
      return { success: false, error: `Category with ID "${id}" already exists.` };
    }

    const newCategory: Category = {
      id,
      slug,
      name,
      hindiName: data.hindiName?.trim() || undefined,
      tagline: data.tagline?.trim() || 'Everyday natural essentials',
      description: data.description?.trim() || 'Carefully sourced Indian single-origin harvest.',
      icon: data.icon || 'Layers',
      color: data.color || '#FF7759',
      badge: data.badge?.trim() || 'Direct Harvest',
      imageUrl:
        data.imageUrl?.trim() ||
        'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=600&q=80',
      alt: data.alt?.trim() || `${name} artisan harvest`,
      complianceRequirement: data.complianceRequirement?.trim() || 'FSSAI License & Lab Records',
      displayOrder: typeof data.displayOrder === 'number' ? data.displayOrder : categories.length + 1,
      isActive: data.isActive !== false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    categories.push(newCategory);
    writeCategoriesToFile(categories);

    return { success: true, category: newCategory };
  } catch (error: any) {
    console.error('Failed to create server category:', error);
    return { success: false, error: error.message || 'Failed to create category' };
  }
}

export function updateServerCategory(
  id: string,
  updates: Partial<Category>
): { success: boolean; category?: Category; error?: string } {
  try {
    const categories = getServerCategories();
    const idx = categories.findIndex((c) => c.id === id);

    if (idx < 0) {
      return { success: false, error: `Category with ID "${id}" not found.` };
    }

    const updated: Category = {
      ...categories[idx],
      ...updates,
      id, // protect ID
      updatedAt: new Date().toISOString(),
    };

    categories[idx] = updated;
    writeCategoriesToFile(categories);

    return { success: true, category: updated };
  } catch (error: any) {
    console.error('Failed to update server category:', error);
    return { success: false, error: error.message || 'Failed to update category' };
  }
}

export function toggleServerCategoryActive(
  id: string,
  isActive?: boolean
): { success: boolean; category?: Category; error?: string } {
  const category = getServerCategoryById(id);
  if (!category) {
    return { success: false, error: `Category "${id}" not found.` };
  }

  const nextActive = typeof isActive === 'boolean' ? isActive : !category.isActive;
  return updateServerCategory(id, { isActive: nextActive });
}

export function deleteServerCategory(id: string): { success: boolean; error?: string } {
  try {
    const categories = getServerCategories();
    const filtered = categories.filter((c) => c.id !== id);

    if (filtered.length === categories.length) {
      return { success: false, error: `Category with ID "${id}" not found.` };
    }

    writeCategoriesToFile(filtered);
    return { success: true };
  } catch (error: any) {
    console.error('Failed to delete server category:', error);
    return { success: false, error: error.message || 'Failed to delete category' };
  }
}

export function reorderServerCategories(
  orderedIds: string[]
): { success: boolean; categories?: Category[]; error?: string } {
  try {
    const categories = getServerCategories();
    const updated = categories.map((cat) => {
      const pos = orderedIds.indexOf(cat.id);
      return {
        ...cat,
        displayOrder: pos >= 0 ? pos + 1 : cat.displayOrder,
      };
    });

    updated.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    writeCategoriesToFile(updated);

    return { success: true, categories: updated };
  } catch (error: any) {
    console.error('Failed to reorder server categories:', error);
    return { success: false, error: error.message || 'Failed to reorder categories' };
  }
}

