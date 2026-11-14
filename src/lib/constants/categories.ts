import rawCategories from '../../data/categories.json' with { type: 'json' };
import type { Category } from '@/types';

export type CategoryDefinition = Category;

export const CATEGORIES: Category[] = rawCategories as Category[];

export function getCategoryById(idOrSlug: string): Category | undefined {
  return CATEGORIES.find(
    (c) =>
      c.id === idOrSlug ||
      c.slug === idOrSlug ||
      c.slug.toLowerCase() === idOrSlug.toLowerCase()
  );
}
