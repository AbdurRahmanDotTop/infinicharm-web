'use client';

// ==============================================================================
// InfiniCharm — Product Search Results & Shop Listing Experience
// Standards: 100% Real CSV Data, Zero Mock/Demo Products, Server Financial Authority,
//            Interactive Draggable Dual-Range Slider, WCAG 2.2 AA Contrast,
//            10-Viewport Zero Horizontal Overflow, Centralized Admin Control
// ==============================================================================

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Product, Category } from '@/types';
import { CATEGORIES } from '@/lib/constants/categories';
import { getAllProducts } from '@/lib/data/products';
import { formatPaiseToRupees } from '@/lib/utils/currency';
import { useCart } from '@/lib/context/CartContext';
import { useWishlist } from '@/lib/context/WishlistContext';
import { Container } from '@/components/ui/Container';
import {
  Search,
  SlidersHorizontal,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Heart,
  Check,
  ShoppingBag,
  ShieldCheck,
  LayoutGrid,
  List,
  PackageOpen,
  Home,
  Bell,
  BellRing,
  CheckCircle2,
  Truck,
  RotateCcw,
} from 'lucide-react';

interface ShopAllProductsViewProps {
  initialCategory?: string;
  initialSearch?: string;
}

export function ShopAllProductsView({
  initialCategory,
  initialSearch,
}: ShopAllProductsViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addItem, items } = useCart();
  const { isInWishlist, toggleWishlist: toggleWishlistContext } = useWishlist();

  const [allProducts, setAllProducts] = useState<Product[]>(() => getAllProducts());
  const [liveCategories, setLiveCategories] = useState<Category[]>(() =>
    (CATEGORIES as Category[]).filter((c) => c.isActive !== false)
  );

  // Keep storefront products and categories synchronized with server authority
  useEffect(() => {
    const loadLiveData = () => {
      fetch('/api/products')
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.products)) {
            setAllProducts(data.products);
          }
        })
        .catch((err) => console.error('Failed to sync shop products with server:', err));

      fetch('/api/categories?activeOnly=true')
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.categories)) {
            setLiveCategories(data.categories);
          }
        })
        .catch((err) => console.error('Failed to sync shop categories with server:', err));
    };

    loadLiveData();

    const handleUpdate = () => loadLiveData();
    window.addEventListener('infinicharm_products_updated', handleUpdate);
    window.addEventListener('infinicharm_categories_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('infinicharm_products_updated', handleUpdate);
      window.removeEventListener('infinicharm_categories_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  // Compute dynamic price range bounds from actual product catalogue
  const { minProductPrice, maxProductPrice } = useMemo(() => {
    if (allProducts.length === 0) return { minProductPrice: 0, maxProductPrice: 3000 };
    const prices = allProducts.map((p) => {
      const v = p.variants[0];
      return v ? Math.round(v.priceInPaise / 100) : 0;
    });
    const min = 0;
    const highest = Math.max(...prices);
    const max = Math.max(3000, Math.ceil(highest / 500) * 500);
    return { minProductPrice: min, maxProductPrice: max };
  }, [allProducts]);

  // Synchronize category and search query from props or searchParams
  const categoryParam = searchParams?.get('category') || initialCategory || '';
  const searchParam = searchParams?.get('q') || initialSearch || '';

  // Local interactive filter state
  const [searchQuery, setSearchQuery] = useState(searchParam);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    categoryParam ? [categoryParam] : []
  );
  const [selectedOrigins, setSelectedOrigins] = useState<string[]>([]);
  const [selectedVarieties, setSelectedVarieties] = useState<string[]>([]);
  const [selectedPackaging, setSelectedPackaging] = useState<string[]>([]);
  const [selectedPurityBadges, setSelectedPurityBadges] = useState<string[]>([]);
  const [priceMin, setPriceMin] = useState<number>(0);
  const [priceMax, setPriceMax] = useState<number>(3000);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [selectedDiscount, setSelectedDiscount] = useState<number | null>(null);
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);
  const [freshHarvestOnly, setFreshHarvestOnly] = useState<boolean>(false);

  // Synchronize priceMax when dynamic bound becomes known
  useEffect(() => {
    if (maxProductPrice > 0) {
      setPriceMax(maxProductPrice);
    }
  }, [maxProductPrice]);

  // Layout & Sorting state
  const [sortBy, setSortBy] = useState<string>('relevant');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(16);

  // Interactive Feature States
  const [isSearchAlertSaved, setIsSearchAlertSaved] = useState<boolean>(false);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState<boolean>(false);

  // Sync parameters when URL changes
  useEffect(() => {
    if (searchParam !== searchQuery) {
      setSearchQuery(searchParam);
    }
  }, [searchParam]);

  useEffect(() => {
    if (categoryParam) {
      setSelectedCategories([categoryParam]);
    }
  }, [categoryParam]);

  // Wishlist toggle using global WishlistContext
  const toggleWishlist = (productId: string, e: React.MouseEvent) => {
    toggleWishlistContext(productId, e);
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCategories([]);
    setSelectedOrigins([]);
    setSelectedVarieties([]);
    setSelectedPackaging([]);
    setSelectedPurityBadges([]);
    setPriceMin(minProductPrice);
    setPriceMax(maxProductPrice);
    setSelectedRating(null);
    setSelectedDiscount(null);
    setInStockOnly(false);
    setFreshHarvestOnly(false);
    setCurrentPage(1);
    if (searchParam) {
      router.push('/shop');
    }
  };

  // Quick price preset buttons
  const applyPricePreset = (min: number, max: number) => {
    setPriceMin(min);
    setPriceMax(max);
    setCurrentPage(1);
  };

  // Dynamic Facet Calculations directly from authoritative products
  const categoryFacetList = useMemo(() => {
    const cats = liveCategories.length > 0 ? liveCategories : (CATEGORIES as Category[]);
    return cats.map((cat) => ({
      id: cat.id,
      slug: cat.slug,
      name: cat.name,
      count: allProducts.filter((p) => p.categoryId === cat.id).length,
    }));
  }, [liveCategories, allProducts]);

  const dynamicVarieties = useMemo(() => {
    const map = new Map<string, number>();
    allProducts.forEach((p) => {
      const v = p.variants[0]?.attributes?.['Variety'];
      if (v) {
        map.set(v, (map.get(v) || 0) + 1);
      } else if (p.tags && p.tags.length > 0) {
        p.tags.slice(0, 3).forEach((tag) => {
          map.set(tag, (map.get(tag) || 0) + 1);
        });
      }
    });
    return Array.from(map.entries()).map(([label, count]) => ({ label, count }));
  }, [allProducts]);

  const dynamicPackaging = useMemo(() => {
    const map = new Map<string, number>();
    allProducts.forEach((p) => {
      const pkg = p.variants[0]?.attributes?.['Packaging'] || p.variants[0]?.title;
      if (pkg) {
        map.set(pkg, (map.get(pkg) || 0) + 1);
      }
    });
    return Array.from(map.entries()).map(([label, count]) => ({ label, count }));
  }, [allProducts]);

  const dynamicOrigins = useMemo(() => {
    const map = new Map<string, { count: number; region: string }>();
    allProducts.forEach((p) => {
      const brand = p.brand || 'InfiniCharm';
      const region = p.originRegion || 'India';
      const existing = map.get(brand);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(brand, { count: 1, region });
      }
    });
    return Array.from(map.entries()).map(([brand, data]) => ({
      brand,
      region: data.region,
      count: data.count,
    }));
  }, [allProducts]);

  const inStockCount = useMemo(
    () => allProducts.filter((p) => p.variants.some((v) => (v.stockQuantity || 0) > 0)).length,
    [allProducts]
  );

  const freshHarvestCount = useMemo(
    () => allProducts.filter((p) => p.isNewArrival).length,
    [allProducts]
  );

  const ratingCounts = useMemo(() => {
    return {
      fiveStar: allProducts.filter((p) => p.isFeatured).length,
      all: allProducts.length,
    };
  }, [allProducts]);

  // Main Filter Computation
  const filteredProducts = useMemo(() => {
    return allProducts.filter((product) => {
      const defaultVar = product.variants[0];
      const priceRupees = defaultVar ? defaultVar.priceInPaise / 100 : 0;
      const compareRupees = defaultVar?.compareAtPriceInPaise
        ? defaultVar.compareAtPriceInPaise / 100
        : priceRupees;
      const discountPct =
        compareRupees > priceRupees
          ? Math.round(((compareRupees - priceRupees) / compareRupees) * 100)
          : 0;

      // Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const tokens = q.split(/\s+/).filter(Boolean);
        const searchableText = `${product.title} ${product.shortDescription || ''} ${product.fullDescription || ''} ${product.brand} ${product.categoryId} ${product.originRegion || ''} ${defaultVar?.attributes?.['Variety'] || ''} ${(product.tags || []).join(' ')}`.toLowerCase();

        const matchesExact = searchableText.includes(q);
        const matchesAllTokens = tokens.length > 0 && tokens.every((t) => searchableText.includes(t));

        if (!matchesExact && !matchesAllTokens) {
          return false;
        }
      }

      // Category filter
      if (selectedCategories.length > 0) {
        const categoryMatch = selectedCategories.some((slug) => {
          const normalized = slug.toLowerCase();
          const cat = (liveCategories.length > 0 ? liveCategories : (CATEGORIES as Category[])).find(
            (c) =>
              c.slug === slug ||
              c.id === slug ||
              c.slug.includes(normalized) ||
              c.name.toLowerCase().includes(normalized) ||
              c.primaryCategory?.toLowerCase().includes(normalized) ||
              c.subCategory1?.toLowerCase().includes(normalized) ||
              c.subCategory2?.toLowerCase().includes(normalized) ||
              c.subCategory3?.toLowerCase().includes(normalized)
          );
          return cat ? product.categoryId === cat.id : false;
        });
        if (!categoryMatch) return false;
      }

      // Facility / Origin filter
      if (selectedOrigins.length > 0) {
        const originMatch = selectedOrigins.some(
          (org) =>
            product.brand.toLowerCase().includes(org.toLowerCase()) ||
            product.originRegion?.toLowerCase().includes(org.toLowerCase())
        );
        if (!originMatch) return false;
      }

      // Variety subcategory filter
      if (selectedVarieties.length > 0) {
        const varietyAttr = defaultVar?.attributes?.['Variety'];
        const varietyMatch = selectedVarieties.some(
          (v) =>
            varietyAttr?.toLowerCase().includes(v.toLowerCase()) ||
            product.title.toLowerCase().includes(v.toLowerCase()) ||
            (product.tags || []).some((t) => t.toLowerCase().includes(v.toLowerCase()))
        );
        if (!varietyMatch) return false;
      }

      // Packaging filter
      if (selectedPackaging.length > 0) {
        const pkgAttr = defaultVar?.attributes?.['Packaging'];
        const weightAttr = defaultVar?.attributes?.['Weight'];
        const pkgMatch = selectedPackaging.some(
          (p) =>
            pkgAttr?.toLowerCase().includes(p.toLowerCase()) ||
            weightAttr?.toLowerCase().includes(p.toLowerCase()) ||
            defaultVar?.title.toLowerCase().includes(p.toLowerCase()) ||
            product.title.toLowerCase().includes(p.toLowerCase())
        );
        if (!pkgMatch) return false;
      }

      // Purity standards filter
      if (selectedPurityBadges.length > 0) {
        const textToSearch = (
          (product.shortDescription || '') +
          ' ' +
          (product.fullDescription || '') +
          ' ' +
          (product.ingredients || '')
        ).toLowerCase();
        const purityMatch = selectedPurityBadges.some((badge) => {
          if (badge === 'raw') return textToSearch.includes('raw') || textToSearch.includes('unheated') || textToSearch.includes('pure');
          if (badge === 'nmr') return textToSearch.includes('nmr') || textToSearch.includes('lab') || textToSearch.includes('natural');
          if (badge === 'organic') return textToSearch.includes('organic') || textToSearch.includes('natural') || textToSearch.includes('sweetness');
          if (badge === 'wild') return textToSearch.includes('wild') || textToSearch.includes('kashmiri') || textToSearch.includes('forest');
          return true;
        });
        if (!purityMatch) return false;
      }

      // Price range filter
      if (priceRupees < priceMin || priceRupees > priceMax) {
        return false;
      }

      // Rating filter
      if (selectedRating !== null) {
        if (selectedRating >= 5 && !product.isFeatured) return false;
      }

      // Discount filter
      if (selectedDiscount !== null) {
        if (discountPct < selectedDiscount) return false;
      }

      // Stock availability filter
      if (inStockOnly) {
        const totalStock = product.variants.reduce(
          (sum, v) => sum + (v.stockQuantity || 0),
          0
        );
        if (totalStock <= 0) return false;
      }

      // Fresh harvest filter
      if (freshHarvestOnly && !product.isNewArrival) {
        return false;
      }

      return true;
    });
  }, [
    allProducts,
    searchQuery,
    selectedCategories,
    selectedOrigins,
    selectedVarieties,
    selectedPackaging,
    selectedPurityBadges,
    priceMin,
    priceMax,
    selectedRating,
    selectedDiscount,
    inStockOnly,
    freshHarvestOnly,
    liveCategories,
  ]);

  // Sorting Computation
  const sortedProducts = useMemo(() => {
    const list = [...filteredProducts];
    switch (sortBy) {
      case 'price-asc':
        return list.sort((a, b) => {
          const pA = a.variants[0]?.priceInPaise || 0;
          const pB = b.variants[0]?.priceInPaise || 0;
          return pA - pB;
        });
      case 'price-desc':
        return list.sort((a, b) => {
          const pA = a.variants[0]?.priceInPaise || 0;
          const pB = b.variants[0]?.priceInPaise || 0;
          return pB - pA;
        });
      case 'harvest':
      case 'latest':
        return list.sort((a, b) => (b.isNewArrival ? 1 : 0) - (a.isNewArrival ? 1 : 0));
      case 'rating':
        return list.sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0));
      case 'discount':
        return list.sort((a, b) => {
          const calcDisc = (p: Product) => {
            const v = p.variants[0];
            if (!v || !v.compareAtPriceInPaise) return 0;
            return v.compareAtPriceInPaise - v.priceInPaise;
          };
          return calcDisc(b) - calcDisc(a);
        });
      case 'relevant':
      default:
        return list;
    }
  }, [filteredProducts, sortBy]);

  // Pagination Computation
  const totalPages = Math.max(1, Math.ceil(sortedProducts.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedProducts = sortedProducts.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  // Active filters count for badge
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedCategories.length > 0) count += selectedCategories.length;
    if (selectedOrigins.length > 0) count += selectedOrigins.length;
    if (selectedVarieties.length > 0) count += selectedVarieties.length;
    if (selectedPackaging.length > 0) count += selectedPackaging.length;
    if (selectedPurityBadges.length > 0) count += selectedPurityBadges.length;
    if (priceMin > minProductPrice || priceMax < maxProductPrice) count += 1;
    if (selectedRating !== null) count += 1;
    if (selectedDiscount !== null) count += 1;
    if (searchQuery.trim()) count += 1;
    if (inStockOnly) count += 1;
    if (freshHarvestOnly) count += 1;
    return count;
  }, [
    selectedCategories,
    selectedOrigins,
    selectedVarieties,
    selectedPackaging,
    selectedPurityBadges,
    priceMin,
    priceMax,
    minProductPrice,
    maxProductPrice,
    selectedRating,
    selectedDiscount,
    searchQuery,
    inStockOnly,
    freshHarvestOnly,
  ]);

  // Handle Quick Add to Cart
  const handleQuickAdd = (product: Product, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const defaultVariant = product.variants[0];
    if (defaultVariant && defaultVariant.stockQuantity > 0) {
      addItem(product, defaultVariant, 1);
    }
  };

  // Check product cart count
  const getProductCartCount = (productId: string) => {
    const item = items.find((i) => i.product.id === productId);
    return item ? item.quantity : 0;
  };

  // ============================================================================
  // SIDEBAR FILTERS COMPONENT (DRY: Desktop Column & Mobile Slide-Out Drawer)
  // ============================================================================
  const FilterContent = () => (
    <div className="space-y-4">
      {/* 1. Active Filters Quick Bar */}
      <div className="bg-surface rounded-xl p-4 border border-border shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <span className="font-display text-sm font-bold text-primary">
            Applied Filters
          </span>
          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-[11px] text-accent hover:underline font-bold"
            >
              Clear All ({activeFiltersCount})
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {searchQuery && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary text-white text-[11px] font-medium shadow-xs">
              <span>&ldquo;{searchQuery}&rdquo;</span>
              <X
                className="w-3 h-3 cursor-pointer hover:text-accent"
                onClick={() => setSearchQuery('')}
              />
            </span>
          )}
          {selectedCategories.map((slug) => {
            const cat = (liveCategories.length > 0 ? liveCategories : (CATEGORIES as Category[])).find((c) => c.slug === slug || c.id === slug);
            return (
              <span
                key={slug}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary text-white text-[11px] font-medium shadow-xs"
              >
                <span>{cat?.name || slug}</span>
                <X
                  className="w-3 h-3 cursor-pointer hover:text-accent"
                  onClick={() =>
                    setSelectedCategories((prev) => prev.filter((s) => s !== slug))
                  }
                />
              </span>
            );
          })}
          {selectedVarieties.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary text-white text-[11px] font-medium shadow-xs"
            >
              <span>{v}</span>
              <X
                className="w-3 h-3 cursor-pointer hover:text-accent"
                onClick={() =>
                  setSelectedVarieties((prev) => prev.filter((item) => item !== v))
                }
              />
            </span>
          ))}
          {(priceMin > minProductPrice || priceMax < maxProductPrice) && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary text-white text-[11px] font-medium shadow-xs">
              <span>₹{priceMin} – ₹{priceMax}</span>
              <X
                className="w-3 h-3 cursor-pointer hover:text-accent"
                onClick={() => {
                  setPriceMin(minProductPrice);
                  setPriceMax(maxProductPrice);
                }}
              />
            </span>
          )}
          {selectedRating !== null && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary text-white text-[11px] font-medium shadow-xs">
              <span>Featured Only</span>
              <X
                className="w-3 h-3 cursor-pointer hover:text-accent"
                onClick={() => setSelectedRating(null)}
              />
            </span>
          )}
          {inStockOnly && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary text-white text-[11px] font-medium shadow-xs">
              <span>In Stock</span>
              <X
                className="w-3 h-3 cursor-pointer hover:text-accent"
                onClick={() => setInStockOnly(false)}
              />
            </span>
          )}
          {activeFiltersCount === 0 && (
            <span className="text-[11px] text-neutral-500 italic">
              No filters currently applied.
            </span>
          )}
        </div>
      </div>

      {/* 2. Filter Group: Categories */}
      <div className="bg-surface rounded-xl p-4 border border-border shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-primary uppercase tracking-wider">
            Categories
          </span>
          <ChevronDown className="w-4 h-4 text-neutral-400" />
        </div>
        <div className="space-y-2 text-xs">
          {categoryFacetList.map((cat) => {
            const isChecked = selectedCategories.includes(cat.slug) || selectedCategories.includes(cat.id);
            return (
              <label
                key={cat.id}
                className="flex items-center justify-between text-primary hover:text-accent cursor-pointer transition-colors py-0.5"
              >
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedCategories((prev) => [...prev, cat.slug]);
                      } else {
                        setSelectedCategories((prev) =>
                          prev.filter((s) => s !== cat.slug && s !== cat.id)
                        );
                      }
                      setCurrentPage(1);
                    }}
                    className="w-4 h-4 rounded border-border text-accent accent-accent focus:ring-accent"
                  />
                  <span className={isChecked ? 'font-bold text-primary' : 'text-neutral-700'}>
                    {cat.name}
                  </span>
                </span>
                <span className="font-mono text-[11px] text-neutral-500 bg-surface-dim px-2 py-0.5 rounded-full border border-border/40">
                  {cat.count}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {/* 3. Filter Group: Interactive Draggable Dual-Range Slider */}
      <div className="bg-surface rounded-xl p-4 border border-border shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-primary uppercase tracking-wider">
            Price Range
          </span>
          <span className="font-mono text-xs font-bold text-accent">
            ₹{priceMin.toLocaleString('en-IN')} – ₹{priceMax.toLocaleString('en-IN')}
          </span>
        </div>

        {/* Dual-Range Slider Track */}
        <div className="relative w-full h-8 flex items-center my-1 select-none">
          {/* Background Track */}
          <div className="w-full h-2 bg-neutral-200 dark:bg-neutral-800 rounded-full relative overflow-hidden">
            {/* Active Highlight Range */}
            <div
              className="absolute h-full bg-accent rounded-full transition-all duration-75"
              style={{
                left: `${Math.max(0, Math.min(100, ((priceMin - minProductPrice) / (maxProductPrice - minProductPrice || 1)) * 100))}%`,
                width: `${Math.max(0, Math.min(100, ((priceMax - priceMin) / (maxProductPrice - minProductPrice || 1)) * 100))}%`,
              }}
            />
          </div>

          {/* Native Draggable Range Inputs (Min & Max Handles) */}
          <input
            type="range"
            min={minProductPrice}
            max={maxProductPrice}
            step={25}
            value={priceMin}
            onChange={(e) => {
              const val = Math.min(Number(e.target.value), priceMax);
              setPriceMin(val);
              setCurrentPage(1);
            }}
            aria-label="Minimum Price Filter"
            className="absolute w-full h-2 top-1/2 -translate-y-1/2 appearance-none bg-transparent pointer-events-none z-20 focus:outline-hidden
              [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:active:cursor-grabbing [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110
              [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-accent [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:cursor-grab [&::-moz-range-thumb]:active:cursor-grabbing"
          />
          <input
            type="range"
            min={minProductPrice}
            max={maxProductPrice}
            step={25}
            value={priceMax}
            onChange={(e) => {
              const val = Math.max(Number(e.target.value), priceMin);
              setPriceMax(val);
              setCurrentPage(1);
            }}
            aria-label="Maximum Price Filter"
            className="absolute w-full h-2 top-1/2 -translate-y-1/2 appearance-none bg-transparent pointer-events-none z-20 focus:outline-hidden
              [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:active:cursor-grabbing [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110
              [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-accent [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:cursor-grab [&::-moz-range-thumb]:active:cursor-grabbing"
          />
        </div>

        {/* Min / Max Readouts */}
        <div className="grid grid-cols-2 gap-2 my-2">
          <div className="p-2 bg-surface-dim rounded-lg border border-border flex items-center justify-between">
            <span className="text-[10px] text-neutral-500 uppercase font-semibold">Min</span>
            <span className="font-mono text-xs font-bold text-primary">₹{priceMin.toLocaleString('en-IN')}</span>
          </div>
          <div className="p-2 bg-surface-dim rounded-lg border border-border flex items-center justify-between">
            <span className="text-[10px] text-neutral-500 uppercase font-semibold">Max</span>
            <span className="font-mono text-xs font-bold text-primary">₹{priceMax.toLocaleString('en-IN')}</span>
          </div>
        </div>

        {/* Quick Bracket Chips */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {[
            { label: 'All Prices', min: minProductPrice, max: maxProductPrice },
            { label: 'Under ₹1,000', min: minProductPrice, max: Math.min(1000, maxProductPrice) },
            { label: '₹1,000 – ₹2,500', min: 1000, max: Math.min(2500, maxProductPrice) },
            { label: 'Above ₹2,000', min: 2000, max: maxProductPrice },
          ].map((preset) => {
            const isActive = priceMin === preset.min && priceMax === preset.max;
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => applyPricePreset(preset.min, preset.max)}
                className={`px-2 py-1 rounded text-[11px] font-mono transition-colors border ${
                  isActive
                    ? 'bg-primary text-white border-primary font-bold'
                    : 'bg-surface-dim text-neutral-700 hover:bg-border border-border'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Filter Group: Variety & Tags (Rendered dynamically if present) */}
      {dynamicVarieties.length > 0 && (
        <div className="bg-surface rounded-xl p-4 border border-border shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-primary uppercase tracking-wider">
              Variety &amp; Tags
            </span>
            <ChevronDown className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="space-y-2 text-xs">
            {dynamicVarieties.map((item) => {
              const isChecked = selectedVarieties.includes(item.label);
              return (
                <label
                  key={item.label}
                  className="flex items-center justify-between text-neutral-700 hover:text-primary cursor-pointer transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedVarieties((prev) => [...prev, item.label]);
                        } else {
                          setSelectedVarieties((prev) =>
                            prev.filter((v) => v !== item.label)
                          );
                        }
                        setCurrentPage(1);
                      }}
                      className="w-4 h-4 rounded border-border text-accent accent-accent focus:ring-accent"
                    />
                    <span className={isChecked ? 'font-bold text-primary' : ''}>
                      {item.label}
                    </span>
                  </span>
                  <span className="font-mono text-[11px] text-neutral-500 bg-surface-dim px-2 py-0.5 rounded-full border border-border/40">
                    {item.count}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. Filter Group: Packaging (Rendered dynamically if present) */}
      {dynamicPackaging.length > 0 && (
        <div className="bg-surface rounded-xl p-4 border border-border shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-primary uppercase tracking-wider">
              Packaging Format
            </span>
            <ChevronDown className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="space-y-2 text-xs">
            {dynamicPackaging.map((item) => {
              const isChecked = selectedPackaging.includes(item.label);
              return (
                <label
                  key={item.label}
                  className="flex items-center justify-between text-neutral-700 hover:text-primary cursor-pointer transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedPackaging((prev) => [...prev, item.label]);
                        } else {
                          setSelectedPackaging((prev) =>
                            prev.filter((p) => p !== item.label)
                          );
                        }
                        setCurrentPage(1);
                      }}
                      className="w-4 h-4 rounded border-border text-accent accent-accent focus:ring-accent"
                    />
                    <span className={isChecked ? 'font-bold text-primary' : ''}>
                      {item.label}
                    </span>
                  </span>
                  <span className="font-mono text-[11px] text-neutral-500 bg-surface-dim px-2 py-0.5 rounded-full border border-border/40">
                    {item.count}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* 6. Filter Group: Purity Standards */}
      <div className="bg-surface rounded-xl p-4 border border-border shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-primary uppercase tracking-wider">
            Purity Standards
          </span>
          <ShieldCheck className="w-4 h-4 text-accent" />
        </div>
        <div className="space-y-2 text-xs">
          {[
            { id: 'raw', label: '100% Pure & Natural' },
            { id: 'nmr', label: 'Quality & Safety Verified' },
            { id: 'organic', label: 'Traditional & Wholesome' },
            { id: 'wild', label: 'Direct East Champaran Dispatch' },
          ].map((item) => {
            const isChecked = selectedPurityBadges.includes(item.id);
            return (
              <label
                key={item.id}
                className="flex items-center gap-2 text-neutral-700 hover:text-primary cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedPurityBadges((prev) => [...prev, item.id]);
                    } else {
                      setSelectedPurityBadges((prev) =>
                        prev.filter((id) => id !== item.id)
                      );
                    }
                    setCurrentPage(1);
                  }}
                  className="w-4 h-4 rounded border-border text-accent accent-accent focus:ring-accent"
                />
                <span className={isChecked ? 'font-bold text-primary' : ''}>
                  {item.label}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {/* 7. Filter Group: Authentic Producers & Facilities */}
      {dynamicOrigins.length > 0 && (
        <div className="bg-surface rounded-xl p-4 border border-border shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-primary uppercase tracking-wider">
              Producers &amp; Brands
            </span>
            <ChevronDown className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="space-y-2 text-xs">
            {dynamicOrigins.map((item) => {
              const isChecked = selectedOrigins.includes(item.brand);
              return (
                <label
                  key={item.brand}
                  className="flex items-center justify-between text-neutral-700 hover:text-primary cursor-pointer transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedOrigins((prev) => [...prev, item.brand]);
                        } else {
                          setSelectedOrigins((prev) =>
                            prev.filter((org) => org !== item.brand)
                          );
                        }
                        setCurrentPage(1);
                      }}
                      className="w-4 h-4 rounded border-border text-accent accent-accent focus:ring-accent"
                    />
                    <span className={isChecked ? 'font-bold text-primary' : ''}>
                      {item.brand}
                    </span>
                  </span>
                  <span className="font-mono text-[11px] text-neutral-500 bg-surface-dim px-2 py-0.5 rounded-full border border-border/40">
                    {item.count}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* 8. Filter Group: Stock Availability & Quality Badges */}
      <div className="bg-surface rounded-xl p-4 border border-border shadow-xs space-y-4">
        <div>
          <span className="text-xs font-bold text-primary uppercase tracking-wider block mb-2">
            Availability
          </span>
          <div className="space-y-2 text-xs">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(e) => {
                    setInStockOnly(e.target.checked);
                    setCurrentPage(1);
                  }}
                  className="w-4 h-4 rounded border-border text-accent accent-accent focus:ring-accent"
                />
                <span className="text-neutral-700">In Stock &amp; Ready to Ship</span>
              </span>
              <span className="font-mono text-[11px] text-neutral-500 bg-surface-dim px-2 py-0.5 rounded-full border border-border/40">
                {inStockCount}
              </span>
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={freshHarvestOnly}
                  onChange={(e) => {
                    setFreshHarvestOnly(e.target.checked);
                    setCurrentPage(1);
                  }}
                  className="w-4 h-4 rounded border-border text-accent accent-accent focus:ring-accent"
                />
                <span className="text-neutral-700">Fresh Harvest Season</span>
              </span>
              <span className="font-mono text-[11px] text-neutral-500 bg-surface-dim px-2 py-0.5 rounded-full border border-border/40">
                {freshHarvestCount}
              </span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full bg-canvas text-primary">
      {/* ====================================================================== */}
      {/* SECTION 1: BREADCRUMB, HEADER INTRODUCTION & STATUTORY STRIP           */}
      {/* ====================================================================== */}
      <section className="w-full bg-surface pt-4 pb-6 border-b border-border">
        <Container className="px-4 sm:px-6 lg:px-8 space-y-4">
          {/* Breadcrumbs & Quick Action Controls */}
          <div className="flex items-center justify-between flex-wrap gap-3 py-1">
            <nav
              aria-label="Breadcrumbs"
              className="flex items-center gap-2 text-xs text-neutral-600 font-medium"
            >
              <Link
                href="/"
                className="hover:text-primary transition-colors flex items-center gap-1"
              >
                <Home className="w-3.5 h-3.5 text-neutral-400" />
                <span>Home</span>
              </Link>
              <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
              <Link href="/shop" className="hover:text-primary transition-colors">
                {searchQuery ? 'Search Results' : 'Shop'}
              </Link>
              <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
              <span className="text-primary font-bold bg-surface-dim px-2.5 py-0.5 rounded-full border border-border/60">
                {searchQuery ? `"${searchQuery}"` : 'All Products'}
              </span>
            </nav>

            {/* Top Action Buttons (Save Search Alert) */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsSearchAlertSaved(!isSearchAlertSaved)}
                className={`flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold transition-all border shadow-xs ${
                  isSearchAlertSaved
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'bg-surface-dim hover:bg-border text-primary border-border'
                }`}
                aria-label="Save search alert"
              >
                {isSearchAlertSaved ? (
                  <>
                    <BellRing className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Search Alert Saved!</span>
                  </>
                ) : (
                  <>
                    <Bell className="w-3.5 h-3.5 text-accent" />
                    <span>Save Search Alert</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Headline & Lab Certified Banner */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pt-1 pb-2">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold text-primary tracking-tight">
                  {searchQuery ? (
                    <>
                      Search Results for{' '}
                      <span className="text-primary bg-accent/15 px-2.5 py-0.5 rounded-lg border border-accent/25 inline-block">
                        &ldquo;{searchQuery}&rdquo;
                      </span>
                    </>
                  ) : (
                    'Shop All Products'
                  )}
                </h1>
                <span className="px-2.5 py-1 rounded-full bg-primary text-white font-mono text-[10px] sm:text-xs font-bold tracking-wider uppercase shadow-xs">
                  {filteredProducts.length} Verified
                </span>
              </div>
              <p className="text-xs sm:text-sm text-neutral-600 mt-1.5 max-w-2xl leading-relaxed">
                Showing{' '}
                <strong className="text-primary font-mono font-bold">
                  {filteredProducts.length === 0
                    ? 0
                    : `${startIndex + 1}–${Math.min(
                        startIndex + itemsPerPage,
                        filteredProducts.length
                      )}`}
                </strong>{' '}
                of{' '}
                <strong className="text-primary font-mono font-bold">
                  {filteredProducts.length} authentic products
                </strong>{' '}
                direct from verified artisanal producers and regional apiaries.
              </p>
            </div>

            {/* Quick Origin Indicator / Lab certified tag */}
            <div className="flex items-center gap-2.5 shrink-0 bg-surface-dim p-2.5 rounded-xl border border-border shadow-xs">
              <div className="w-9 h-9 rounded-lg bg-surface flex items-center justify-center text-accent shadow-xs border border-border/60">
                <ShieldCheck className="w-5 h-5 text-accent" />
              </div>
              <div className="pr-1 text-left">
                <span className="block text-xs font-bold text-primary leading-tight">
                  100% Direct From Source
                </span>
                <span className="block text-[10px] text-neutral-500 leading-tight">
                  Zero chemical adulteration or synthetic processing
                </span>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* ====================================================================== */}
      {/* SECTION 2: MAIN CATALOG GRID & FILTER SIDEBAR (2-Column Layout)        */}
      {/* ====================================================================== */}
      <main className="w-full py-8 sm:py-10">
        <Container className="px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-12 gap-6 lg:gap-8 items-start">
            {/* DESKTOP FILTER SIDEBAR (3 Columns) */}
            <aside className="hidden lg:block col-span-3 sticky top-12 space-y-4">
              <FilterContent />
            </aside>

            {/* RIGHT CATALOG AREA (9 Columns) */}
            <section className="col-span-12 lg:col-span-9 flex flex-col space-y-6">
              {/* Search Toolbar Component */}
              <div className="bg-surface rounded-xl p-4 border border-border shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
                {/* Results Counter & Inline Chips */}
                <div className="flex items-center gap-3 flex-wrap min-w-0 w-full md:w-auto">
                  <span className="text-xs font-bold text-primary whitespace-nowrap">
                    {filteredProducts.length === 0
                      ? 0
                      : `${startIndex + 1}–${Math.min(
                          startIndex + itemsPerPage,
                          filteredProducts.length
                        )}`}{' '}
                    of {filteredProducts.length} Products
                  </span>

                  {/* Verified Fast Dispatch badge */}
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                    <Truck className="w-3 h-3 text-emerald-600" />
                    <span>Verified Fast Dispatch</span>
                  </span>

                  {/* In-page Real-time Search Input */}
                  <div className="relative w-full sm:w-56">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search within all products..."
                      className="w-full h-8 pl-7 pr-6 rounded-lg bg-surface-dim border border-border text-xs text-primary placeholder:text-neutral-400 focus:outline-hidden focus:border-accent"
                    />
                    <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                    {searchQuery && (
                      <X
                        className="w-3 h-3 text-neutral-400 hover:text-primary cursor-pointer absolute right-2 top-1/2 -translate-y-1/2"
                        onClick={() => setSearchQuery('')}
                      />
                    )}
                  </div>

                  <span className="h-4 w-px bg-border hidden md:inline-block" />

                  {/* Active inline chips */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {selectedCategories.length > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-dim text-primary text-[10px] font-semibold border border-border">
                        Category: {selectedCategories[0]}
                        <X
                          className="w-2.5 h-2.5 cursor-pointer hover:text-accent"
                          onClick={() => setSelectedCategories([])}
                        />
                      </span>
                    )}
                    {(priceMin > minProductPrice || priceMax < maxProductPrice) && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-dim text-primary text-[10px] font-semibold border border-border">
                        ₹{priceMin}–₹{priceMax}
                        <X
                          className="w-2.5 h-2.5 cursor-pointer hover:text-accent"
                          onClick={() => {
                            setPriceMin(minProductPrice);
                            setPriceMax(maxProductPrice);
                          }}
                        />
                      </span>
                    )}
                    {activeFiltersCount > 0 && (
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="text-[11px] text-accent hover:underline font-bold pl-1"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>

                {/* Controls: Mobile Drawer Trigger, Sort Dropdown & View Mode */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 shrink-0 w-full md:w-auto justify-between md:justify-end">
                  {/* Mobile Filters Toggle Button */}
                  <button
                    type="button"
                    onClick={() => setIsMobileFilterOpen(true)}
                    className="lg:hidden flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-surface-dim hover:bg-border text-primary text-xs font-bold border border-border transition-colors"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-accent" />
                    <span>Filters</span>
                    {activeFiltersCount > 0 && (
                      <span className="w-4 h-4 rounded-full bg-accent text-white font-mono text-[9px] flex items-center justify-center font-bold">
                        {activeFiltersCount}
                      </span>
                    )}
                  </button>

                  {/* Sort Dropdown */}
                  <div className="flex items-center gap-1.5 text-xs text-neutral-600">
                    <span className="hidden sm:inline">Sort by:</span>
                    <div className="relative">
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="appearance-none bg-surface-dim hover:bg-border text-primary font-semibold pl-3 pr-8 py-1.5 rounded-lg border border-border focus:outline-hidden cursor-pointer shadow-xs text-xs"
                      >
                        <option value="relevant">Most Relevant</option>
                        <option value="harvest">New Season Harvest</option>
                        <option value="price-asc">Price: Low to High</option>
                        <option value="price-desc">Price: High to Low</option>
                        <option value="discount">Best Discount</option>
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-neutral-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  {/* Grid vs List View Switcher */}
                  <div className="flex items-center bg-surface-dim rounded-lg p-0.5 border border-border shadow-xs">
                    <button
                      type="button"
                      onClick={() => setViewMode('grid')}
                      className={`p-1.5 rounded transition-all ${
                        viewMode === 'grid'
                          ? 'bg-surface text-primary shadow-2xs font-bold'
                          : 'text-neutral-500 hover:text-primary'
                      }`}
                      title="4-Column Grid View"
                      aria-label="Grid View"
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('list')}
                      className={`p-1.5 rounded transition-all ${
                        viewMode === 'list'
                          ? 'bg-surface text-primary shadow-2xs font-bold'
                          : 'text-neutral-500 hover:text-primary'
                      }`}
                      title="List View"
                      aria-label="List View"
                    >
                      <List className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* EMPTY STATE INSIDE CATALOG (When zero products match active filters) */}
              {filteredProducts.length === 0 ? (
                <div className="bg-surface rounded-2xl p-8 sm:p-12 shadow-level-2 border border-border text-center max-w-xl mx-auto my-6">
                  <div className="w-16 h-16 rounded-full bg-surface-dim mx-auto flex items-center justify-center text-accent mb-4 border border-border">
                    <PackageOpen className="w-8 h-8" />
                  </div>
                  <h3 className="font-display text-xl sm:text-2xl font-bold text-primary">
                    No products found matching &ldquo;{searchQuery || 'your filters'}&rdquo;
                  </h3>
                  <p className="text-xs sm:text-sm text-neutral-600 max-w-md mx-auto mt-2 leading-relaxed">
                    Try adjusting your search keywords, price boundaries, or reset all active filters to view all available products.
                  </p>
                  <div className="flex items-center justify-center gap-3 mt-6">
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="h-10 px-5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold transition-colors uppercase tracking-wider flex items-center gap-2 shadow-xs"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset All Filters</span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* PRODUCT GRID VIEW */}
                {viewMode === 'grid' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-5">
                    {paginatedProducts.map((product) => {
                      const defaultVariant = product.variants[0];
                      const cartCount = getProductCartCount(product.id);
                      const isWishlisted = isInWishlist(product.id);
                      const isOutOfStock =
                        defaultVariant && defaultVariant.stockQuantity <= 0;

                      const priceInPaise = defaultVariant?.priceInPaise || 0;
                      const compareAtPaise =
                        defaultVariant?.compareAtPriceInPaise || 0;
                      const discountPct =
                        compareAtPaise > priceInPaise
                          ? Math.round(
                              ((compareAtPaise - priceInPaise) / compareAtPaise) *
                                100
                            )
                          : 0;

                      let badgeText = '';
                      let badgeClass = 'bg-accent text-white';
                      if (product.customBadge) {
                        badgeText = product.customBadge;
                        badgeClass = 'bg-primary text-white';
                      } else if (discountPct > 0) {
                        badgeText = `-${discountPct}% OFF`;
                        badgeClass = 'bg-accent text-white';
                      } else if (product.isFeatured) {
                        badgeText = 'Featured Harvest';
                        badgeClass = 'bg-primary text-white';
                      } else if (product.isNewArrival) {
                        badgeText = 'New Arrival';
                        badgeClass = 'bg-primary text-white';
                      }

                      return (
                        <div
                          key={product.id}
                          className={`group relative bg-surface rounded-2xl p-3 border border-border shadow-xs hover:shadow-level-2 transition-all flex flex-col justify-between ${
                            isOutOfStock ? 'opacity-85' : ''
                          }`}
                        >
                          <div>
                            {/* Image Container with Aspect 4:5 */}
                            <div className="relative aspect-4/5 rounded-xl overflow-hidden bg-surface-dim mb-3">
                              <Link
                                href={`/product/${product.slug}`}
                                className="block w-full h-full"
                              >
                                {product.media?.[0]?.externalUrl ? (
                                  /* eslint-disable-next-line @next/next/no-img-element */
                                  <img
                                    src={product.media[0].externalUrl}
                                    alt={product.title}
                                    onError={(e) => {
                                      const target = e.currentTarget;
                                      if (!target.dataset.fallback) {
                                        target.dataset.fallback = 'true';
                                        target.src = 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=800&q=80';
                                      }
                                    }}
                                    className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${
                                      isOutOfStock ? 'grayscale-30' : ''
                                    }`}
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-neutral-400">
                                    <ShoppingBag className="w-10 h-10" />
                                  </div>
                                )}
                              </Link>

                              {/* Promotional / Status Badge */}
                              {isOutOfStock ? (
                                <span className="absolute top-2 left-2 px-2 py-0.5 bg-surface-dim text-primary rounded font-mono text-[10px] font-bold shadow-xs border border-border">
                                  Out of Stock
                                </span>
                              ) : badgeText ? (
                                <span
                                  className={`absolute top-2 left-2 px-2 py-0.5 rounded font-mono text-[10px] font-bold shadow-xs ${badgeClass}`}
                                >
                                  {badgeText}
                                </span>
                              ) : null}

                              {/* Wishlist Button */}
                              <button
                                type="button"
                                onClick={(e) => toggleWishlist(product.id, e)}
                                className={`absolute top-2 right-2 w-8 h-8 rounded-full bg-surface/80 backdrop-blur-xs flex items-center justify-center transition-colors shadow-xs ${
                                  isWishlisted
                                    ? 'text-accent'
                                    : 'text-neutral-600 hover:text-accent'
                                }`}
                                aria-label="Toggle Wishlist"
                                title={isWishlisted ? 'Saved in Wishlist' : 'Save to Wishlist'}
                              >
                                <Heart
                                  className={`w-4 h-4 ${
                                    isWishlisted ? 'fill-current text-accent' : ''
                                  }`}
                                />
                              </button>
                            </div>

                            {/* Producer / Brand & Provenance */}
                            <div className="flex items-center justify-between mb-1 text-[11px]">
                              <span className="font-semibold text-neutral-600 truncate">
                                {product.brand || 'InfiniCharm'}
                              </span>
                              <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 shrink-0">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>100% Authentic</span>
                              </span>
                            </div>

                            {/* Title & Description */}
                            <h3 className="font-display text-xs sm:text-sm font-bold text-primary group-hover:text-accent transition-colors line-clamp-2">
                              <Link href={`/product/${product.slug}`}>
                                {product.title}
                              </Link>
                            </h3>
                            <p className="text-[11px] text-neutral-500 line-clamp-1 mt-0.5">
                              {product.shortDescription}
                            </p>
                          </div>

                          {/* Pricing & Add to Cart Action */}
                          <div className="mt-3 pt-2 border-t border-border">
                            <div className="flex items-baseline gap-2 mb-2 font-mono">
                              <span className="text-sm sm:text-base font-bold text-primary">
                                {formatPaiseToRupees(priceInPaise)}
                              </span>
                              {compareAtPaise > priceInPaise && (
                                <span className="text-xs text-neutral-500 line-through">
                                  {formatPaiseToRupees(compareAtPaise)}
                                </span>
                              )}
                            </div>

                            {/* Action Button */}
                            {isOutOfStock ? (
                              <button
                                type="button"
                                disabled
                                className="w-full h-10 rounded-lg bg-surface-dim text-neutral-500 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-not-allowed border border-border"
                              >
                                <Bell className="w-3.5 h-3.5" />
                                <span>Notify Me</span>
                              </button>
                            ) : cartCount > 0 ? (
                              <button
                                type="button"
                                onClick={(e) => handleQuickAdd(product, e)}
                                className="w-full h-10 rounded-lg bg-surface-dim text-primary border border-border hover:bg-border text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                              >
                                <Check className="w-4 h-4 text-accent" />
                                <span>Added ({cartCount} in Bag)</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => handleQuickAdd(product, e)}
                                className="w-full h-10 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                              >
                                <ShoppingBag className="w-4 h-4" />
                                <span>Add to Cart</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* HORIZONTAL LIST VIEW */
                  <div className="space-y-4">
                    {paginatedProducts.map((product) => {
                      const defaultVariant = product.variants[0];
                      const cartCount = getProductCartCount(product.id);
                      const isOutOfStock =
                        defaultVariant && defaultVariant.stockQuantity <= 0;
                      const priceInPaise = defaultVariant?.priceInPaise || 0;
                      const compareAtPaise =
                        defaultVariant?.compareAtPriceInPaise || 0;

                      return (
                        <div
                          key={product.id}
                          className="bg-surface rounded-2xl p-4 border border-border flex flex-col sm:flex-row gap-5 items-center justify-between shadow-xs hover:shadow-level-2 transition-all"
                        >
                          <div className="flex items-center gap-4 w-full sm:w-auto">
                            <Link
                              href={`/product/${product.slug}`}
                              className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden bg-surface-dim shrink-0 border border-border"
                            >
                              {product.media?.[0]?.externalUrl && (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img
                                  src={product.media[0].externalUrl}
                                  alt={product.title}
                                  onError={(e) => {
                                    const target = e.currentTarget;
                                    if (!target.dataset.fallback) {
                                      target.dataset.fallback = 'true';
                                      target.src = 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=800&q=80';
                                    }
                                  }}
                                  className="w-full h-full object-cover"
                                />
                              )}
                            </Link>
                            <div className="space-y-1">
                              <span className="text-[11px] font-semibold text-accent uppercase tracking-wider">
                                {product.brand}
                              </span>
                              <h3 className="font-display text-sm sm:text-base font-bold text-primary hover:text-accent transition-colors">
                                <Link href={`/product/${product.slug}`}>
                                  {product.title}
                                </Link>
                              </h3>
                              <p className="text-xs text-neutral-600 line-clamp-2 max-w-lg">
                                {product.shortDescription}
                              </p>
                              {product.originRegion && (
                                <span className="inline-block text-[10px] text-neutral-500 font-medium">
                                  Origin: {product.originRegion}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-border">
                            <div className="text-right">
                              <span className="font-mono text-base sm:text-lg font-bold text-primary block">
                                {formatPaiseToRupees(priceInPaise)}
                              </span>
                              {compareAtPaise > priceInPaise && (
                                <span className="font-mono text-xs text-neutral-500 line-through">
                                  {formatPaiseToRupees(compareAtPaise)}
                                </span>
                              )}
                            </div>

                            {isOutOfStock ? (
                              <button
                                type="button"
                                disabled
                                className="h-10 px-4 rounded-lg bg-surface-dim text-neutral-500 text-xs font-semibold cursor-not-allowed border border-border"
                              >
                                Out of Stock
                              </button>
                            ) : cartCount > 0 ? (
                              <button
                                type="button"
                                onClick={(e) => handleQuickAdd(product, e)}
                                className="h-10 px-4 rounded-lg bg-surface-dim text-primary border border-border text-xs font-bold flex items-center gap-1.5"
                              >
                                <Check className="w-3.5 h-3.5 text-accent" />
                                <span>Added ({cartCount})</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => handleQuickAdd(product, e)}
                                className="h-10 px-4 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
                              >
                                <ShoppingBag className="w-3.5 h-3.5" />
                                <span>Add to Cart</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* DESKTOP & MOBILE PAGINATION STRIP */}
                <div className="bg-surface rounded-xl p-4 border border-border shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4 mt-4">
                  <div className="text-xs text-neutral-600 font-medium">
                    Showing{' '}
                    <strong className="text-primary font-mono">
                      {filteredProducts.length === 0
                        ? 0
                        : `${startIndex + 1}–${Math.min(
                            startIndex + itemsPerPage,
                            filteredProducts.length
                          )}`}{' '}
                    </strong>
                    of{' '}
                    <strong className="text-primary font-mono">
                      {filteredProducts.length}
                    </strong>{' '}
                    results
                  </div>

                  <div className="flex items-center gap-1 font-mono text-xs">
                    <button
                      type="button"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="w-9 h-9 rounded-lg bg-surface-dim text-neutral-600 hover:text-primary flex items-center justify-center transition-colors disabled:opacity-40 disabled:pointer-events-none"
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    {Array.from({ length: totalPages }, (_, idx) => idx + 1).map(
                      (p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setCurrentPage(p)}
                          className={`w-9 h-9 rounded-lg font-bold transition-all ${
                            currentPage === p
                              ? 'bg-primary text-white shadow-xs'
                              : 'bg-surface-dim hover:bg-border text-primary'
                          }`}
                        >
                          {p}
                        </button>
                      )
                    )}

                    <button
                      type="button"
                      disabled={currentPage >= totalPages}
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      className="w-9 h-9 rounded-lg bg-surface-dim text-neutral-600 hover:text-primary flex items-center justify-center transition-colors disabled:opacity-40 disabled:pointer-events-none"
                      aria-label="Next page"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-neutral-600">
                    <span>Items per page:</span>
                    <select
                      value={itemsPerPage}
                      onChange={(e) => {
                        setItemsPerPage(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="px-2 py-1 rounded bg-surface-dim border border-border font-mono font-bold text-primary focus:outline-hidden cursor-pointer"
                    >
                      <option value={16}>16</option>
                      <option value={24}>24</option>
                      <option value={32}>32</option>
                    </select>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </Container>
    </main>

      {/* ====================================================================== */}
      {/* MOBILE SLIDE-OUT FILTER DRAWER (Never hides any desktop filter)        */}
      {/* ====================================================================== */}
      {isMobileFilterOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileFilterOpen(false)}
          />

          {/* Drawer Sheet */}
          <div className="fixed inset-y-0 right-0 max-w-sm w-full bg-surface shadow-level-3 p-6 overflow-y-auto z-10 flex flex-col justify-between">
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <span className="font-display text-lg font-bold text-primary">
                  Filter Catalog
                </span>
                <button
                  type="button"
                  onClick={() => setIsMobileFilterOpen(false)}
                  className="p-1 rounded-full text-neutral-500 hover:text-primary"
                  aria-label="Close filters"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <FilterContent />
            </div>

            <div className="pt-6 border-t border-border mt-6">
              <button
                type="button"
                onClick={() => setIsMobileFilterOpen(false)}
                className="w-full h-11 rounded-xl bg-primary text-white font-bold text-xs uppercase tracking-wider"
              >
                Apply Filters ({filteredProducts.length} Results)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ShopAllProductsView;
