'use client';

// ==============================================================================
// InfiniCharm — Official Single-Owner Storefront Homepage
// Brand Authority: TechilyFly India | Founder & CEO: AbdurRahman Ibn Ghufran
// Single-Owner Architecture: Centralized Sourcing, Zero Multi-Vendor Functionality
// Standards: Real Data, Server Financial Authority, WCAG 2.2 AA Contrast
// Dynamic Homepage CMS: Driven by Authoritative Store (`src/data/homepage_sections.json`)
// ==============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Award,
  Sparkles,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  ChevronRight,
  Star,
  ShoppingBag,
  Store,
  Clock,
  Zap,
  Heart,
  Truck,
  Check,
  Headphones,
  Compass,
  Flame,
  Layers,
  Leaf,
  MapPin,
  FileCheck,
} from 'lucide-react';
import { BRAND } from '@/lib/constants/brand';
import { CATEGORIES } from '@/lib/constants/categories';
import {
  getAllProducts,
  getFeaturedProducts,
  getNewArrivalProducts,
} from '@/lib/data/products';
import { getAllBlogPosts } from '@/lib/data/blog';
import defaultSections from '@/data/homepage_sections.json';
import { Container } from '@/components/ui/Container';
import { NewsletterCircleSection } from '@/components/common/NewsletterCircleSection';
import { ProductCard } from '@/components/shop/ProductCard';
import { useCart } from '@/lib/context/CartContext';
import { useWishlist } from '@/lib/context/WishlistContext';
import { formatPaiseToRupees } from '@/lib/utils/currency';
import { Product, HomepageSection, Category, HeroItem } from '@/types';

export default function HomePage() {
  const { addItem, totalItemsCount, subtotalInPaise, openDrawer } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const [activeTab, setActiveTab] = useState<string>('all');

  // Dynamic server-backed real review stats
  const [reviewStats, setReviewStats] = useState<{
    totalReviews: number;
    averageRating: number;
    hasGenuineReviews: boolean;
  }>({
    totalReviews: 0,
    averageRating: 0,
    hasGenuineReviews: false,
  });

  // Dynamic sections loaded from server store with instant default fallback
  const [sections, setSections] = useState<HomepageSection[]>(
    defaultSections as HomepageSection[]
  );

  const [allProducts, setAllProducts] = useState<Product[]>(() => getAllProducts());
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>(() => getFeaturedProducts());
  const [bestSellingProducts, setBestSellingProducts] = useState<Product[]>([]);
  const [liveCategories, setLiveCategories] = useState<Category[]>(() =>
    (CATEGORIES as Category[]).filter((c) => c.isActive !== false)
  );
  const blogPosts = getAllBlogPosts();

  // Sync products, categories, orders, and homepage sections dynamically with server authority
  useEffect(() => {
    const syncAll = () => {
      fetch('/api/products')
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.products)) {
            setAllProducts(data.products);
            setFeaturedProducts(data.products.filter((p: Product) => p.isFeatured && p.status === 'PUBLISHED'));
          }
        })
        .catch((err) => console.error('Failed to sync homepage products:', err));

      fetch('/api/products/best-sellers?limit=99')
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.products)) {
            setBestSellingProducts(data.products);
          }
        })
        .catch((err) => console.error('Failed to sync best-selling products:', err));

      fetch('/api/categories?activeOnly=true', { cache: 'no-store' })
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.categories)) {
            setLiveCategories(data.categories);
          }
        })
        .catch((err) => console.error('Failed to sync homepage categories:', err));

      fetch('/api/homepage/sections')
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.sections) && data.sections.length > 0) {
            setSections(data.sections);
          }
        })
        .catch((err) => console.error('Failed to sync homepage sections:', err));

      fetch('/api/reviews')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.success && data.stats) {
            setReviewStats({
              totalReviews: data.stats.totalReviews || 0,
              averageRating: data.stats.averageRating || 0,
              hasGenuineReviews: Boolean(data.stats.hasGenuineReviews),
            });
          }
        })
        .catch(() => {});
    };

    syncAll();

    const handleUpdate = () => syncAll();
    window.addEventListener('infinicharm_products_updated', handleUpdate);
    window.addEventListener('infinicharm_orders_updated', handleUpdate);
    window.addEventListener('infinicharm_categories_updated', handleUpdate);
    window.addEventListener('infinicharm_sections_updated', handleUpdate);
    window.addEventListener('infinicharm_reviews_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('infinicharm_products_updated', handleUpdate);
      window.removeEventListener('infinicharm_orders_updated', handleUpdate);
      window.removeEventListener('infinicharm_categories_updated', handleUpdate);
      window.removeEventListener('infinicharm_sections_updated', handleUpdate);
      window.removeEventListener('infinicharm_reviews_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  // Dynamic product resolver supporting both Manual Selection and Category-Based Selection
  const getSectionProducts = useCallback(
    (sec: HomepageSection, defaultLimit = 4): Product[] => {
      const published = allProducts.filter((p) => p.status === 'PUBLISHED');
      const limit = sec.config?.productLimit || defaultLimit;

      // 1. Manual Product Selection Mode
      if (
        sec.config?.selectionMode === 'manual' &&
        Array.isArray(sec.config?.selectedProductIds) &&
        sec.config.selectedProductIds.length > 0
      ) {
        const manualMap = new Map(published.map((p) => [p.id, p]));
        const selected = sec.config.selectedProductIds
          .map((id) => manualMap.get(id))
          .filter((p): p is Product => Boolean(p));

        if (selected.length > 0) {
          return selected.slice(0, limit);
        }
      }

      // 2. Category-Based Selection Mode
      if (
        sec.config?.selectionMode === 'category' &&
        sec.config?.selectedCategoryId &&
        sec.config.selectedCategoryId !== 'ALL'
      ) {
        const catProds = published.filter(
          (p) => p.categoryId === sec.config?.selectedCategoryId
        );
        if (catProds.length > 0) {
          return catProds.slice(0, limit);
        }
      }

      // 3. Best-Selling Products Dynamic Sales Ranking Mode
      if (sec.type === 'best_sellers') {
        const pool = bestSellingProducts.length > 0 ? bestSellingProducts : published;
        return pool.slice(0, limit);
      }

      // 4. Smart Domain-Aware Fallback
      if (sec.type === 'kirana_packs') {
        const essentials = published.filter((p) =>
          ['cat-honey', 'cat-zamzam-water', 'cat-takmeeli-talbeena', 'cat-premium-dates'].includes(
            p.categoryId
          )
        );
        return (essentials.length >= limit ? essentials : published).slice(0, limit);
      }

      if (sec.type === 'flash_deals') {
        const discounted = published.filter(
          (p) =>
            p.variants[0]?.compareAtPriceInPaise &&
            p.variants[0].compareAtPriceInPaise > p.variants[0].priceInPaise
        );
        return (discounted.length >= limit ? discounted : published).slice(0, limit);
      }

      return published.slice(0, limit);
    },
    [allProducts, bestSellingProducts]
  );

  const handleQuickAdd = (product: Product, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const defaultVariant = product.variants[0];
    if (defaultVariant) {
      addItem(product, defaultVariant, 1);
    }
  };

  // Dynamic filter products for Tabbed Spotlight (driven by liveCategories + live products)
  const getTabbedProducts = (limit = 4) => {
    const published = allProducts.filter((p) => p.status === 'PUBLISHED');
    if (activeTab === 'all') {
      return published.slice(0, limit);
    }
    const matching = published.filter((p) => p.categoryId === activeTab);
    return (matching.length > 0 ? matching : published).slice(0, limit);
  };

  // ============================================================================
  // SECTION RENDERERS (Driven by Server Homepage CMS)
  // ============================================================================

  // 1. Hero Banner
  const renderHero = (sec: HomepageSection) => {
    const rawHeroItems: HeroItem[] =
      (sec.config?.heroItems as HeroItem[]) || (sec.heroItems as HeroItem[]) || [
        {
          id: 'hero-item-1',
          type: 'product',
          targetId: 'S-01-P-01',
          title: '100% Kashmiri Honey',
          badge: 'Bairgania, Bihar Dispatch',
          tagline: 'Pure Taste & Natural Sweetness',
          priceDisplay: '₹2,400',
          ctaText: 'Signature Harvest',
          linkUrl: '/product/100-kashmiri-honey',
          imageUrl:
            sec.imageUrl ||
            'https://images.unsplash.com/photo-1685773253905-915ce8dd470b?q=80&w=1073&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D',
          position: 'featured',
          displayOrder: 1,
          isEnabled: true,
        },
        {
          id: 'hero-item-2',
          type: 'product',
          targetId: 'S-01-P-02',
          title: 'Zamzam Water – 5 Litres',
          badge: 'Original Sealed Can',
          priceDisplay: '₹6,000',
          linkUrl: '/product/zamzam-water-5-litres',
          imageUrl:
            'https://zamzamstoreeg.com/cdn/shop/files/bottle.jpg?v=1758206902',
          position: 'secondary_top',
          displayOrder: 2,
          isEnabled: true,
        },
        {
          id: 'hero-item-3',
          type: 'product',
          targetId: 'S-01-P-03',
          title: 'Takmeeli Talbeena',
          badge: 'Healthy & Nourishing',
          priceDisplay: '₹300',
          linkUrl: '/product/takmeeli-talbeena',
          imageUrl:
            'https://rukminim2.flixcart.com/image/1536/1536/xif0q/ready-mix/q/5/l/1-talbeena-with-dry-fruits-combo-premium-pack-pack-4-250g-x-4-4-original-imahgt7br6ydh8rn.jpeg',
          position: 'secondary_bottom',
          displayOrder: 3,
          isEnabled: true,
        },
      ];

    const activeHeroItems = rawHeroItems
      .filter((i) => i.isEnabled !== false)
      .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

    const getHeroItemLink = (item: HeroItem) => {
      if (item.linkUrl && item.linkUrl.trim() !== '') return item.linkUrl.trim();
      if (item.type === 'category') {
        return `/shop?category=${item.targetId || 'all'}`;
      }
      if (item.type === 'product') {
        return `/product/${item.targetId || 'shop'}`;
      }
      return '/shop';
    };

    const featuredItem =
      activeHeroItems.find((i) => i.position === 'featured') || activeHeroItems[0];
    const topRightItem =
      activeHeroItems.find((i) => i.position === 'secondary_top') ||
      activeHeroItems.filter((i) => i.id !== featuredItem?.id)[0];
    const bottomRightItem =
      activeHeroItems.find((i) => i.position === 'secondary_bottom') ||
      activeHeroItems.filter(
        (i) => i.id !== featuredItem?.id && i.id !== topRightItem?.id
      )[0];

    return (
    <section key={sec.id} className="w-full bg-surface pt-8 pb-14 border-b border-border">
      <Container className="px-3 sm:px-6 lg:px-8">
        <div className="grid grid-cols-12 gap-6 lg:gap-10 items-center">
          {/* Left Column: Single-Owner Editorial Presentation */}
          <div className="col-span-12 lg:col-span-7 flex flex-col items-start pr-0 lg:pr-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent mb-4">
              <span className="text-xs">✦</span>
              <span className="font-mono text-[11px] font-bold tracking-wider uppercase">
                {sec.badge || "India's Premier Destination for Pure Living"}
              </span>
            </div>

            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.14] mb-4 text-primary">
              {sec.title}
            </h1>

            <p className="font-body text-sm sm:text-base text-neutral-700 leading-relaxed max-w-xl mb-6">
              {sec.subtitle}
            </p>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 mb-8">
              <Link
                href={sec.ctaLink || '/shop'}
                className="h-12 px-7 rounded-xl bg-accent hover:bg-accent-hover text-white font-body text-sm font-bold inline-flex items-center justify-center gap-2 shadow-level-1 hover:shadow-level-2 transition-all transform hover:-translate-y-0.5"
              >
                <span>{sec.ctaText || 'Explore Collections'}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href={sec.secondaryCtaLink || '/about'}
                className="h-12 px-6 rounded-xl bg-surface-dim hover:bg-surface-container text-primary font-body text-sm font-bold inline-flex items-center justify-center gap-2 border border-border transition-colors"
              >
                <Store className="w-4 h-4 text-accent" />
                <span>{sec.secondaryCtaText || 'Our Sourcing Story'}</span>
              </Link>
            </div>

            {/* Key Metrics Pills */}
            <div className="flex flex-wrap items-center gap-4 sm:gap-6 pt-4 border-t border-border/80 w-full">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-surface-dim flex items-center justify-center text-primary border border-border">
                  <ShieldCheck className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <span className="block font-mono text-sm sm:text-base font-bold text-primary">100% In-House</span>
                  <span className="block text-[11px] text-neutral-600 font-medium">Direct Sourcing</span>
                </div>
              </div>

              <div className="h-7 w-px bg-border hidden sm:block" />

              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-surface-dim flex items-center justify-center text-primary border border-border">
                  <FileCheck className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <span className="block font-mono text-sm sm:text-base font-bold text-primary">Zero Chemical</span>
                  <span className="block text-[11px] text-neutral-600 font-medium">Lab-Tested Batches</span>
                </div>
              </div>

              <div className="h-7 w-px bg-border hidden sm:block" />

              {/* Dynamic Customer Rating or Verified Origin Guarantee */}
              {reviewStats.hasGenuineReviews && reviewStats.totalReviews > 0 ? (
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-surface-dim flex items-center justify-center text-amber-500 border border-border">
                    <Star className="w-5 h-5 fill-current" />
                  </div>
                  <div>
                    <span className="block font-mono text-sm sm:text-base font-bold text-primary">
                      {reviewStats.averageRating.toFixed(1)} / 5.0
                    </span>
                    <span className="block text-[11px] text-neutral-600 font-medium">
                      Customer Rating ({reviewStats.totalReviews})
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-surface-dim flex items-center justify-center text-accent border border-border">
                    <Award className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <span className="block font-mono text-sm sm:text-base font-bold text-primary">100% Direct</span>
                    <span className="block text-[11px] text-neutral-600 font-medium">Verified Origin</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Dynamic Visual Mosaic Driven by Admin Hero Items */}
          <div className="col-span-12 lg:col-span-5 relative mt-6 lg:mt-0">
            {activeHeroItems.length === 0 ? (
              <div className="w-full h-[480px] rounded-2xl bg-surface-dim border border-border flex items-center justify-center p-6 text-center">
                <div>
                  <Sparkles className="w-8 h-8 text-accent mx-auto mb-2 opacity-60" />
                  <p className="text-sm font-bold text-primary">InfiniCharm Single-Origin Harvest</p>
                  <p className="text-xs text-muted mt-1">Configure Hero Showcase cards in Admin CMS</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-12 gap-3 h-auto sm:h-[480px]">
                {/* 1. Main Featured Large Card */}
                {featuredItem && (
                  <Link
                    href={getHeroItemLink(featuredItem)}
                    className={`${
                      activeHeroItems.length === 1
                        ? 'col-span-12 h-[380px] sm:h-[480px]'
                        : activeHeroItems.length === 2
                        ? 'col-span-12 sm:col-span-6 h-[280px] sm:h-[480px]'
                        : 'col-span-12 sm:col-span-7 row-span-2 h-[280px] sm:h-full'
                    } relative rounded-2xl overflow-hidden bg-stone-900 shadow-level-2 group block`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      alt={featuredItem.title}
                      src={
                        featuredItem.imageUrl ||
                        sec.imageUrl ||
                        'https://images.unsplash.com/photo-1685773253905-915ce8dd470b?q=80&w=1073&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D'
                      }
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                    {featuredItem.badge && (
                      <div className="absolute top-3 left-3 bg-surface/95 backdrop-blur-md px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-xs border border-border">
                        <MapPin className="w-3.5 h-3.5 text-accent" />
                        <span className="text-[10px] font-bold text-primary">{featuredItem.badge}</span>
                      </div>
                    )}
                    <div className="absolute bottom-4 left-4 right-4 text-white">
                      {featuredItem.tagline && (
                        <span className="font-mono text-[10px] uppercase tracking-wider text-accent font-bold block mb-0.5">
                          {featuredItem.tagline}
                        </span>
                      )}
                      <h3 className="font-display text-base font-bold mt-0.5 mb-1 text-white group-hover:text-accent-hover transition-colors">
                        {featuredItem.title}
                      </h3>
                      <div className="flex items-center justify-between">
                        {featuredItem.priceDisplay && (
                          <span className="font-mono text-sm font-bold text-white">
                            {featuredItem.priceDisplay}
                          </span>
                        )}
                        {featuredItem.ctaText && (
                          <span className="text-[10px] bg-accent text-white px-2 py-0.5 rounded font-bold uppercase tracking-wide">
                            {featuredItem.ctaText}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                )}

                {/* 2. Top Right Card */}
                {topRightItem && (
                  <Link
                    href={getHeroItemLink(topRightItem)}
                    className={`${
                      activeHeroItems.length === 2
                        ? 'col-span-12 sm:col-span-6 h-[280px] sm:h-[480px]'
                        : 'col-span-12 sm:col-span-5 h-[200px] sm:h-[234px]'
                    } relative rounded-2xl overflow-hidden bg-stone-900 shadow-level-1 group block`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      alt={topRightItem.title}
                      src={
                        topRightItem.imageUrl ||
                        'https://zamzamstoreeg.com/cdn/shop/files/bottle.jpg?v=1758206902'
                      }
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                    {topRightItem.badge && (
                      <div className="absolute top-2.5 left-2.5 bg-surface/95 backdrop-blur-md px-2 py-0.5 rounded-full flex items-center gap-1 text-[9px] font-bold text-primary border border-border">
                        <MapPin className="w-3 h-3 text-state-success" />
                        <span>{topRightItem.badge}</span>
                      </div>
                    )}
                    <div className="absolute bottom-3 left-3 right-3 text-white">
                      <h4 className="font-display text-xs font-bold text-white group-hover:text-accent transition-colors">
                        {topRightItem.title}
                      </h4>
                      {topRightItem.priceDisplay && (
                        <span className="font-mono text-xs text-white/90 font-bold">
                          {topRightItem.priceDisplay}
                        </span>
                      )}
                    </div>
                  </Link>
                )}

                {/* 3. Bottom Right Card */}
                {bottomRightItem && activeHeroItems.length >= 3 && (
                  <Link
                    href={getHeroItemLink(bottomRightItem)}
                    className="col-span-12 sm:col-span-5 h-[200px] sm:h-[234px] relative rounded-2xl overflow-hidden bg-stone-900 shadow-level-1 group block"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      alt={bottomRightItem.title}
                      src={
                        bottomRightItem.imageUrl ||
                        'https://rukminim2.flixcart.com/image/1536/1536/xif0q/ready-mix/q/5/l/1-talbeena-with-dry-fruits-combo-premium-pack-pack-4-250g-x-4-4-original-imahgt7br6ydh8rn.jpeg'
                      }
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                    {bottomRightItem.badge && (
                      <div className="absolute top-2.5 left-2.5 bg-surface/95 backdrop-blur-md px-2 py-0.5 rounded-full flex items-center gap-1 text-[9px] font-bold text-primary border border-border">
                        <MapPin className="w-3 h-3 text-accent" />
                        <span>{bottomRightItem.badge}</span>
                      </div>
                    )}
                    <div className="absolute bottom-3 left-3 right-3 text-white">
                      <h4 className="font-display text-xs font-bold text-white group-hover:text-accent transition-colors">
                        {bottomRightItem.title}
                      </h4>
                      {bottomRightItem.priceDisplay && (
                        <span className="font-mono text-xs text-white/90 font-bold">
                          {bottomRightItem.priceDisplay}
                        </span>
                      )}
                    </div>
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </Container>
    </section>
  );
};

  // 1.5 Best-Selling Products Section (Dynamic Sales Ranking Authority)
  const renderBestSellers = (sec: HomepageSection) => {
    const products = getSectionProducts(sec, sec.config?.productLimit || 99);
    const ctaButtonText = sec.config?.buttonText || 'Add to Bag';

    return (
      <section key={sec.id} className="w-full py-16 bg-surface border-y border-border">
        <Container className="px-3 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div>
              <span className="font-mono text-[11px] uppercase tracking-widest text-accent font-bold">
                {sec.badge || 'TOP RATED & MOST LOVED'}
              </span>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-primary mt-1">
                {sec.title}
              </h2>
              {sec.subtitle && (
                <p className="text-xs text-muted mt-1 max-w-xl">{sec.subtitle}</p>
              )}
            </div>
            <Link
              href={sec.ctaLink || '/shop'}
              className="text-xs font-bold text-accent hover:text-accent-hover flex items-center gap-1 transition-colors self-start sm:self-auto shrink-0"
            >
              <span>{sec.ctaText || 'View All Bestsellers'}</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {products.length === 0 ? (
            <div className="p-12 text-center bg-surface-dim rounded-2xl border border-border">
              <ShoppingBag className="w-8 h-8 mx-auto mb-2 text-muted" />
              <h3 className="font-bold text-primary text-sm">No Best-Selling Products Recorded</h3>
              <p className="text-xs text-muted mt-1">
                Customer favorites dynamically ranked by sales performance will appear here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  ctaText={ctaButtonText}
                />
              ))}
            </div>
          )}
        </Container>
      </section>
    );
  };

  // 2. Categories Carousel / Grid (Dynamic from Server / Admin Authority)
  const renderCategories = (sec: HomepageSection) => {
    const categoriesToRender =
      Array.isArray(sec.config?.categories) && sec.config.categories.length > 0
        ? sec.config.categories
        : liveCategories;

    return (
    <section key={sec.id} className="w-full py-16 bg-canvas">
      <Container className="px-3 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <span className="font-mono text-[11px] uppercase tracking-widest text-accent font-bold">
              {sec.badge || 'DIRECT-FROM-SOURCE TAXONOMY'}
            </span>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-primary mt-1">
              {sec.title}
            </h2>
            {sec.subtitle && (
              <p className="text-xs text-muted mt-1 max-w-xl">{sec.subtitle}</p>
            )}
          </div>
          <Link
            href={sec.ctaLink || '/shop'}
            className="text-xs font-bold text-accent hover:text-accent-hover flex items-center gap-1 transition-colors"
          >
            <span>{sec.ctaText || 'View All Categories'}</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Dynamic Category Grid: Renders exactly as many categories as active in Admin */}
        {categoriesToRender.length === 0 ? (
          <div className="p-12 text-center bg-surface rounded-2xl border border-border">
            <Layers className="w-8 h-8 mx-auto mb-2 text-muted" />
            <h3 className="font-bold text-primary text-sm">No Active Categories</h3>
            <p className="text-xs text-muted mt-1">Active categories configured in the Admin Panel will appear here.</p>
          </div>
        ) : (
          <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 ${categoriesToRender.length <= 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-4 xl:grid-cols-7'} gap-3 sm:gap-4`}>
            {categoriesToRender.map((cat: any) => (
              <Link
                key={cat.id}
                href={cat.linkUrl || `/shop?category=${cat.slug}`}
                className="group bg-surface p-3 rounded-2xl border border-border shadow-xs hover:shadow-level-2 hover:border-accent/40 transition-all duration-300 flex flex-col items-center text-center"
              >
                <div className="w-full aspect-square rounded-xl overflow-hidden bg-surface-dim mb-3 relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    alt={cat.alt || `${cat.name} category`}
                    src={cat.imageUrl || 'https://images.unsplash.com/photo-1685773253905-915ce8dd470b?q=80&w=1073&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D'}
                    onError={(e) => {
                      e.currentTarget.src = 'https://images.unsplash.com/photo-1685773253905-915ce8dd470b?q=80&w=1073&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D';
                    }}
                  />
                  <span className="absolute top-2 right-2 bg-surface/95 backdrop-blur-xs text-primary font-mono text-[9px] font-bold px-1.5 py-0.5 rounded border border-border/60">
                    {cat.badge || 'Verified'}
                  </span>
                </div>
                <h3 className="font-display text-xs sm:text-sm font-bold text-primary group-hover:text-accent transition-colors line-clamp-1">
                  {cat.name}
                </h3>
                <p className="text-[11px] text-neutral-600 line-clamp-1 mt-0.5 font-medium">
                  {cat.tagline || cat.hindiName || cat.description}
                </p>
              </Link>
            ))}
          </div>
        )}
      </Container>
    </section>
  );
};

  // 3. Flash Deals
  const renderFlashDeals = (sec: HomepageSection) => (
    <section key={sec.id} className="w-full py-16 bg-surface border-y border-border">
      <Container className="px-3 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <span className="font-mono text-[11px] uppercase tracking-widest text-accent font-bold">
              {sec.badge || 'Direct Harvest Handpicks'}
            </span>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-primary mt-1">
              {sec.title}
            </h2>
            {sec.subtitle && (
              <p className="text-xs text-muted mt-1 max-w-xl">{sec.subtitle}</p>
            )}
          </div>
          <Link
            href={sec.ctaLink || '/shop'}
            className="text-xs font-bold text-accent hover:text-accent-hover flex items-center gap-1 transition-colors"
          >
            <span>{sec.ctaText || 'View All Products'}</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* 5-Card Product Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {getSectionProducts(sec, 5).map((product) => {
            const defaultVariant = product.variants[0];
            const discountPercent =
              defaultVariant?.compareAtPriceInPaise &&
              defaultVariant.compareAtPriceInPaise > defaultVariant.priceInPaise
                ? Math.round(
                    ((defaultVariant.compareAtPriceInPaise - defaultVariant.priceInPaise) /
                      defaultVariant.compareAtPriceInPaise) *
                      100
                  )
                : 0;

            return (
              <div
                key={product.id}
                className="bg-surface rounded-2xl p-3 border border-border shadow-xs hover:shadow-level-2 hover:border-accent/40 transition-all flex flex-col group relative"
              >
                <div className="relative w-full aspect-[4/5] rounded-xl overflow-hidden bg-surface-dim mb-3">
                  <Link href={`/product/${product.slug}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      alt={product.title}
                      src={product.media[0]?.externalUrl || ''}
                    />
                  </Link>
                  {discountPercent > 0 && (
                    <span className="absolute top-2.5 left-2.5 bg-accent text-white font-mono text-[10px] font-bold px-2 py-0.5 rounded shadow-xs">
                      {discountPercent}% OFF
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => toggleWishlist(product.id, e)}
                    className={`absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-surface/90 backdrop-blur-xs flex items-center justify-center border border-border transition-colors shadow-xs ${
                      isInWishlist(product.id) ? 'text-rose-600' : 'text-muted hover:text-accent'
                    }`}
                    title={isInWishlist(product.id) ? 'Saved in Wishlist' : 'Add to Wishlist'}
                  >
                    <Heart
                      className={`w-3.5 h-3.5 ${
                        isInWishlist(product.id) ? 'fill-rose-600 text-rose-600' : ''
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center gap-1.5 mb-1">
                  <MapPin className="w-3 h-3 text-accent shrink-0" />
                  <span className="text-[10px] text-neutral-600 font-semibold truncate">
                    {product.originRegion || 'East Champaran, Bihar'}
                  </span>
                </div>

                <h3 className="font-display text-xs sm:text-sm font-bold text-primary group-hover:text-accent transition-colors line-clamp-1 mb-1">
                  <Link href={`/product/${product.slug}`}>{product.title}</Link>
                </h3>

                <div className="flex items-center gap-1.5 text-[11px] mb-3">
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    <span>Verified Pure</span>
                  </span>
                </div>

                <div className="flex items-center justify-between mt-auto pt-2 border-t border-border/60">
                  <div>
                    <span className="font-mono text-xs sm:text-sm font-bold text-primary block">
                      {defaultVariant ? formatPaiseToRupees(defaultVariant.priceInPaise) : '—'}
                    </span>
                    {defaultVariant?.compareAtPriceInPaise ? (
                      <span className="font-mono text-[10px] text-muted line-through">
                        {formatPaiseToRupees(defaultVariant.compareAtPriceInPaise)}
                      </span>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={(e) => handleQuickAdd(product, e)}
                    className="w-8 h-8 rounded-lg bg-surface-dim hover:bg-accent text-primary hover:text-white flex items-center justify-center border border-border transition-colors shadow-xs"
                    title="Quick Add to Cart"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );

  // 4. Tabbed Community Spotlight
  const renderTabbedSpotlight = (sec: HomepageSection) => (
    <section key={sec.id} className="w-full py-16 bg-canvas">
      <Container className="px-3 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-4 border-b border-border">
          <div>
            <span className="font-mono text-[11px] uppercase tracking-widest text-accent font-bold">
              {sec.badge || 'High Demand'}
            </span>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-primary mt-1">
              {sec.title}
            </h2>
            {sec.subtitle && (
              <p className="text-xs text-muted mt-1 max-w-xl">{sec.subtitle}</p>
            )}
          </div>

          {/* Filter Tabs — Driven Dynamically by Active Categories */}
          <div className="flex flex-wrap items-center gap-1.5 bg-surface-dim p-1.5 rounded-2xl sm:rounded-full border border-border">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                activeTab === 'all'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-neutral-700 hover:text-primary'
              }`}
            >
              All Selections
            </button>
            {liveCategories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveTab(cat.id)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                  activeTab === cat.id
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-neutral-700 hover:text-primary'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Tabbed Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {getTabbedProducts(sec.config?.productLimit || 4).map((product, idx) => {
            const defaultVariant = product.variants[0];
            return (
              <div
                key={product.id}
                className="bg-surface rounded-2xl p-4 border border-border shadow-xs hover:shadow-level-2 transition-all flex flex-col group"
              >
                <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-surface-dim mb-3">
                  <Link href={`/product/${product.slug}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      alt={product.title}
                      src={product.media[0]?.externalUrl || ''}
                    />
                  </Link>
                  <span className="absolute top-2.5 left-2.5 bg-primary text-white font-mono text-[10px] px-2.5 py-0.5 rounded-full flex items-center gap-1 font-bold">
                    <span className="text-accent">★</span> #{idx + 1} Best Seller
                  </span>
                </div>

                <span className="text-[11px] text-neutral-600 font-medium truncate">{product.originRegion}</span>
                <h3 className="font-display text-sm font-bold text-primary group-hover:text-accent transition-colors line-clamp-1 mt-0.5">
                  <Link href={`/product/${product.slug}`}>{product.title}</Link>
                </h3>

                <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/60">
                  <span className="font-mono text-sm font-bold text-primary">
                    {defaultVariant ? formatPaiseToRupees(defaultVariant.priceInPaise) : '—'}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => handleQuickAdd(product, e)}
                    className="px-3.5 py-1.5 rounded-lg bg-surface-dim hover:bg-accent text-primary hover:text-white font-mono text-xs font-bold transition-colors border border-border"
                  >
                    Add
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );

  // 5. Craft & Nutrition Spotlight Story Section (CMS-driven)
  const renderDegBhapka = (sec: HomepageSection) => {
    const spotlightCards = sec.config?.spotlightCards?.length
      ? sec.config.spotlightCards
      : [
          {
            id: 'sp-1',
            title: '100% Kashmiri Honey',
            description: 'Pure taste & natural sweetness sourced with zero added sugar.',
          },
          {
            id: 'sp-2',
            title: 'Takmeeli Talbeena',
            description: 'Healthy & nourishing traditional preparation with wholesome nutrition.',
          },
          {
            id: 'sp-3',
            title: 'Zamzam & Premium Dates',
            description: 'Naturally sweet soft dates paired with 5L original sealed Zamzam cans.',
          },
        ];

    return (
      <section key={sec.id} className="w-full py-16 bg-surface border-y border-border">
        <Container className="px-3 sm:px-6 lg:px-8">
          <div className="bg-surface rounded-3xl p-4 sm:p-10 lg:p-12 border border-border shadow-xs">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-center">
              <div className="col-span-1 lg:col-span-5 relative min-w-0">
                <div className="rounded-2xl overflow-hidden aspect-[4/5] bg-surface-dim shadow-xs">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="w-full h-full object-cover"
                    alt={sec.title || 'InfiniCharm Signature Quality Selection'}
                    src={
                      sec.imageUrl ||
                      'https://plus.unsplash.com/premium_photo-1676208753932-6e8bc83a0b0d?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D'
                    }
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
                <div
                  data-testid="spotlight-floating-card"
                  className="mt-3 sm:mt-0 sm:absolute sm:-bottom-4 sm:right-2 bg-surface p-4 rounded-xl shadow-level-2 sm:max-w-xs border border-border"
                >
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-accent">
                    {sec.config?.spotlightFloatingBadge || 'Bairgania, Bihar Dispatch'}
                  </span>
                  <p className="text-[11px] text-neutral-600 mt-1 leading-snug">
                    {sec.config?.spotlightFloatingText ||
                      'Every Honey jar, Talbeena pack, Dates box, and Zamzam Water can is batch-verified before dispatch.'}
                  </p>
                </div>
              </div>

              <div className="col-span-1 lg:col-span-7 pl-0 lg:pl-6 min-w-0">
                <span className="font-mono text-[11px] uppercase tracking-widest text-accent font-bold">
                  {sec.badge || 'Authenticity & Wellness'}
                </span>
                <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-primary mt-1 mb-3">
                  {sec.title}
                </h2>
                <p className="font-body text-xs sm:text-sm text-neutral-700 leading-relaxed mb-6">
                  {sec.subtitle}
                </p>

                {/* Spotlight Feature Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                  {spotlightCards.slice(0, 3).map((card, idx) => (
                    <div key={card.id || idx} className="bg-surface-dim p-3.5 rounded-xl border border-border">
                      <span className="font-display text-xs font-bold text-primary block">
                        {card.title}
                      </span>
                      <p className="text-[11px] text-neutral-600 mt-1">{card.description}</p>
                    </div>
                  ))}
                </div>

                <Link
                  href={sec.ctaLink || '/shop'}
                  className="h-11 px-6 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold inline-flex items-center gap-2 transition-colors shadow-xs"
                >
                  <span>{sec.ctaText || 'Explore Verified Catalogue'}</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </Container>
      </section>
    );
  };

  // 6. Kirana Value Packs
  const renderKiranaPacks = (sec: HomepageSection) => (
    <section key={sec.id} className="w-full py-16 bg-canvas">
      <Container className="px-3 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
          <div>
            <span className="font-mono text-[11px] uppercase tracking-widest text-accent font-bold">
              {sec.badge || 'Purity Guaranteed'}
            </span>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-primary mt-1">
              {sec.title}
            </h2>
            {sec.subtitle && (
              <p className="text-xs text-muted mt-1 max-w-xl">{sec.subtitle}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-600 flex items-center gap-1.5 font-medium bg-surface px-3.5 py-1.5 rounded-full border border-border shadow-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Lab-Tested Certified Purity</span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {(() => {
            const kiranaItems = getSectionProducts(sec, 4);
            if (kiranaItems.length === 0) {
              return (
                <div className="col-span-full py-12 text-center bg-surface-dim/40 rounded-2xl border border-dashed border-border">
                  <p className="text-sm font-bold text-primary">No items currently assigned to this pantry pack.</p>
                  <p className="text-xs text-neutral-500 mt-1">Configure in Admin &gt; Content CMS.</p>
                </div>
              );
            }
            return kiranaItems.map((prod) => {
              const defaultVariant = prod.variants[0];
              const price = defaultVariant ? formatPaiseToRupees(defaultVariant.priceInPaise) : '—';
              const mediaUrl = prod.media?.[0]?.externalUrl || '';
              return (
                <div
                  key={prod.id}
                  className="bg-surface p-4 rounded-2xl border border-border shadow-xs hover:shadow-level-2 transition-all flex flex-col group"
                >
                  <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-surface-dim mb-3">
                    <Link href={`/product/${prod.slug}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        alt={prod.media?.[0]?.altText || prod.title}
                        src={mediaUrl}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </Link>
                    <span className="absolute top-2 left-2 bg-surface/95 backdrop-blur-md px-2 py-0.5 rounded font-mono text-[10px] text-primary font-bold border border-border">
                      {prod.originRegion || 'Single Origin'}
                    </span>
                  </div>
                  <span className="text-[11px] text-neutral-500 font-medium">{prod.brand || 'InfiniCharm'}</span>
                  <h3 className="font-display text-sm font-bold text-primary mt-0.5 mb-2 line-clamp-1">
                    <Link href={`/product/${prod.slug}`} className="hover:text-accent transition-colors">
                      {prod.title}
                    </Link>
                  </h3>
                  <div className="flex items-center justify-between mt-auto pt-2">
                    <span className="font-mono text-sm font-bold text-primary">{price}</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (defaultVariant) addItem(prod, defaultVariant, 1);
                      }}
                      className="h-8 px-3 rounded-lg bg-primary hover:bg-accent text-white text-xs font-bold transition-colors shadow-xs"
                    >
                      Add to Bag
                    </button>
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </Container>
    </section>
  );

  // 7. Approved Category & Origin Highlights (CMS-driven)
  const renderSourcingCenters = (sec: HomepageSection) => {
    const centerCards = sec.config?.centerCards?.length
      ? sec.config.centerCards
      : [
          {
            title: '100% Kashmiri Honey',
            location: 'Bairgania, Sitamarhi, Bihar Dispatch',
            description:
              'Natural honey with pure taste & natural sweetness, packed cleanly for everyday wellness.',
            imageUrl:
              'https://images.unsplash.com/photo-1685773253905-915ce8dd470b?q=80&w=1073&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D',
            specLeft: 'Natural Honey',
            specRight: 'Unadulterated',
            linkUrl: '/product/100-kashmiri-honey',
            ctaText: 'View Kashmiri Honey',
          },
          {
            title: 'Zamzam Water 5 Litres',
            location: '5L Original Sealed Can',
            description:
              '100% pure, blessed 5L original sealed Zamzam Water packaged carefully for safe pan-India transit.',
            imageUrl:
              'https://zamzamstoreeg.com/cdn/shop/files/bottle.jpg?v=1758206902',
            specLeft: '5L Sealed Can',
            specRight: '100% Authentic',
            linkUrl: '/product/zamzam-water-5-litres',
            ctaText: 'View Zamzam Water',
          },
          {
            title: 'Takmeeli Talbeena',
            location: 'Healthy & Nourishing Choice',
            description:
              'Rich in nutrition wholesome barley & dry fruit Talbeena crafted for easy daily preparation.',
            imageUrl:
              'https://rukminim2.flixcart.com/image/1536/1536/xif0q/ready-mix/q/5/l/1-talbeena-with-dry-fruits-combo-premium-pack-pack-4-250g-x-4-4-original-imahgt7br6ydh8rn.jpeg',
            specLeft: 'Barley Blend',
            specRight: 'Wholesome Nutrition',
            linkUrl: '/product/takmeeli-talbeena',
            ctaText: 'View Talbeena',
          },
          {
            title: 'Premium Dates 1 KG',
            location: 'Fresh Quality & High Energy',
            description:
              'Soft, naturally sweet selected premium dates rich in essential nutrients and natural energy.',
            imageUrl:
              'https://plus.unsplash.com/premium_photo-1676208753932-6e8bc83a0b0d?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D',
            specLeft: 'Soft & Sweet',
            specRight: '1 KG Pack',
            linkUrl: '/product/premium-dates-1-kg',
            ctaText: 'View Premium Dates',
          },
        ];

    const centerIcons = [
      <Sparkles key="i0" className="w-6 h-6 text-accent" />,
      <ShieldCheck key="i1" className="w-6 h-6 text-state-success" />,
      <Leaf key="i2" className="w-6 h-6 text-accent" />,
      <FileCheck key="i3" className="w-6 h-6 text-accent" />,
    ];

    return (
      <section key={sec.id} className="w-full py-16 bg-surface border-y border-border">
        <Container className="px-3 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-8">
            <div>
              <span className="font-mono text-[11px] uppercase tracking-widest text-accent font-bold">
                {sec.badge || 'Direct From Source'}
              </span>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-primary mt-1">
                {sec.title}
              </h2>
              {sec.subtitle && (
                <p className="text-xs text-muted mt-1 max-w-xl">{sec.subtitle}</p>
              )}
            </div>
            <Link
              href={sec.ctaLink || '/about'}
              className="text-xs font-bold text-accent hover:text-accent-hover flex items-center gap-1 transition-colors"
            >
              <span>{sec.ctaText || 'Read Our Sourcing Story'}</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {centerCards.map((card, idx) => (
              <div
                key={idx}
                className="bg-surface-dim rounded-2xl overflow-hidden border border-border shadow-xs hover:shadow-level-2 transition-all flex flex-col group"
              >
                <div className="h-28 w-full relative bg-surface-container">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="w-full h-full object-cover"
                    alt={card.title}
                    src={card.imageUrl}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  <div className="absolute -bottom-5 left-4 w-12 h-12 rounded-xl bg-surface shadow-xs border border-border flex items-center justify-center">
                    {centerIcons[idx % centerIcons.length]}
                  </div>
                </div>
                <div className="p-4 pt-7 flex-1 flex flex-col">
                  <div className="flex items-center gap-1.5 mb-1">
                    <h3 className="font-display text-sm font-bold text-primary">{card.title}</h3>
                    <ShieldCheck className="w-3.5 h-3.5 text-accent" />
                  </div>
                  <p className="text-[11px] text-neutral-600 mb-2 font-medium">{card.location}</p>
                  <p className="text-xs text-neutral-700 mb-4 line-clamp-2">{card.description}</p>
                  <div className="flex items-center justify-between py-2 border-t border-b border-border/80 mb-4 font-mono text-[11px] text-neutral-600 font-semibold">
                    <span>{card.specLeft}</span>
                    <span>{card.specRight}</span>
                  </div>
                  <Link
                    href={card.linkUrl || '/shop'}
                    className="mt-auto w-full h-9 rounded-xl bg-surface hover:bg-primary hover:text-white text-primary text-xs font-bold flex items-center justify-center gap-1 border border-border shadow-xs transition-colors"
                  >
                    <span>{card.ctaText || 'Explore'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>
    );
  };

  // 8. Values Strip
  const renderValuesStrip = (sec: HomepageSection) => (
    <section key={sec.id} className="w-full py-16 bg-canvas">
      <Container className="px-3 sm:px-6 lg:px-8">
        <div className="text-center max-w-xl mx-auto mb-10">
          <span className="font-mono text-[11px] uppercase tracking-widest text-accent font-bold">
            {sec.badge || 'The InfiniCharm Guarantee'}
          </span>
          <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-primary mt-1">
            {sec.title}
          </h2>
          {sec.subtitle && (
            <p className="text-xs text-muted mt-1">{sec.subtitle}</p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-surface p-5 rounded-2xl border border-border shadow-xs flex flex-col items-start">
            <div className="w-10 h-10 rounded-xl bg-surface-dim flex items-center justify-center text-accent mb-3 border border-border">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-display text-xs sm:text-sm font-bold text-primary mb-1">
              Rigorous Batch Testing
            </h3>
            <p className="text-[11px] text-neutral-600 leading-relaxed">
              Every batch undergoes third-party lab testing and FSSAI quality verification before dispatch.
            </p>
          </div>

          <div className="bg-surface p-5 rounded-2xl border border-border shadow-xs flex flex-col items-start">
            <div className="w-10 h-10 rounded-xl bg-surface-dim flex items-center justify-center text-accent mb-3 border border-border">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="font-display text-xs sm:text-sm font-bold text-primary mb-1">
              Comprehensive Pure Range
            </h3>
            <p className="text-[11px] text-neutral-600 leading-relaxed">
              From 100% Kashmiri Honey to Zamzam Water, Takmeeli Talbeena, and Premium Dates in one unified checkout.
            </p>
          </div>

          <div className="bg-surface p-5 rounded-2xl border border-border shadow-xs flex flex-col items-start">
            <div className="w-10 h-10 rounded-xl bg-surface-dim flex items-center justify-center text-accent mb-3 border border-border">
              <Truck className="w-5 h-5" />
            </div>
            <h3 className="font-display text-xs sm:text-sm font-bold text-primary mb-1">
              Transparent Sourcing
            </h3>
            <p className="text-[11px] text-neutral-600 leading-relaxed">
              Clear weight metrics, real-time GPS courier tracking, and zero hidden platform fees.
            </p>
          </div>

          <div className="bg-surface p-5 rounded-2xl border border-border shadow-xs flex flex-col items-start">
            <div className="w-10 h-10 rounded-xl bg-surface-dim flex items-center justify-center text-accent mb-3 border border-border">
              <Award className="w-5 h-5" />
            </div>
            <h3 className="font-display text-xs sm:text-sm font-bold text-primary mb-1">
              100% Secure Checkout
            </h3>
            <p className="text-[11px] text-neutral-600 leading-relaxed">
              Encrypted UPI, Cards, NetBanking with immediate automated refund and dispatch tracking.
            </p>
          </div>

          <div className="bg-surface p-5 rounded-2xl border border-border shadow-xs flex flex-col items-start">
            <div className="w-10 h-10 rounded-xl bg-surface-dim flex items-center justify-center text-accent mb-3 border border-border">
              <Headphones className="w-5 h-5" />
            </div>
            <h3 className="font-display text-xs sm:text-sm font-bold text-primary mb-1">
              Dedicated Care
            </h3>
            <p className="text-[11px] text-neutral-600 leading-relaxed">
              Direct resolution assistance via email support@infinicharm.com and 24/7 live concierge.
            </p>
          </div>
        </div>
      </Container>
    </section>
  );

  // 9. Editorial Journal Preview
  const renderJournalPreview = (sec: HomepageSection) => (
    <section key={sec.id} className="w-full py-16 bg-surface border-y border-border">
      <Container className="px-3 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <span className="font-mono text-[11px] uppercase tracking-widest text-accent font-bold">
              {sec.badge || 'From Our Editorial'}
            </span>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-primary mt-1">
              {sec.title}
            </h2>
            {sec.subtitle && (
              <p className="text-xs text-muted mt-1 max-w-xl">{sec.subtitle}</p>
            )}
          </div>
          <Link
            href={sec.ctaLink || '/blog'}
            className="text-xs font-bold text-accent hover:text-accent-hover flex items-center gap-1 transition-colors"
          >
            <span>{sec.ctaText || 'View All Journal Guides'}</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {blogPosts.slice(0, 3).map((post) => (
            <div
              key={post.id}
              className="bg-surface rounded-2xl border border-border overflow-hidden shadow-xs hover:shadow-level-2 hover:border-accent/40 transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="relative aspect-video w-full bg-surface-dim overflow-hidden">
                  {post.featuredImageUrl && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={post.featuredImageUrl}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  )}
                </div>
                <div className="p-5 space-y-2">
                  <span className="font-mono text-[10px] font-bold text-accent uppercase tracking-wider">
                    {post.category}
                  </span>
                  <h3 className="font-display text-sm sm:text-base font-bold text-primary line-clamp-2 group-hover:text-accent transition-colors">
                    <Link href={`/blog/${post.slug}`}>{post.title}</Link>
                  </h3>
                  <p className="text-xs text-neutral-600 line-clamp-2 leading-relaxed">
                    {post.summary}
                  </p>
                </div>
              </div>

              <div className="p-5 pt-0">
                <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-muted">
                  <span className="font-medium text-neutral-700">{post.authorName}</span>
                  <Link
                    href={`/blog/${post.slug}`}
                    className="font-bold text-accent hover:underline flex items-center gap-1"
                  >
                    <span>Read Guide</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );

  // 10. Newsletter Subscription Circle
  const renderNewsletter = (sec: HomepageSection) => (
    <NewsletterCircleSection key={sec.id} section={sec} />
  );

  // 11. Custom Section Render
  const renderCustom = (sec: HomepageSection) => (
    <section key={sec.id} className="w-full py-16 bg-surface border-y border-border">
      <Container className="px-3 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            {sec.badge && (
              <span className="font-mono text-[11px] uppercase tracking-widest text-accent font-bold">
                {sec.badge}
              </span>
            )}
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-primary mt-1">
              {sec.title}
            </h2>
            {sec.subtitle && (
              <p className="font-body text-xs sm:text-sm text-neutral-700 mt-2 leading-relaxed">
                {sec.subtitle}
              </p>
            )}
            {sec.ctaText && (
              <Link
                href={sec.ctaLink || '/shop'}
                className="mt-6 inline-flex items-center gap-2 px-6 py-2.5 bg-accent hover:bg-accent-hover text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
              >
                <span>{sec.ctaText}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>
          {sec.imageUrl && (
            <div className="w-full md:w-80 h-48 rounded-2xl overflow-hidden bg-surface-dim shrink-0 border border-border shadow-xs">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={sec.imageUrl}
                alt={sec.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}
        </div>
      </Container>
    </section>
  );

  // Router for rendering each section by type
  const renderSection = (sec: HomepageSection) => {
    switch (sec.type) {
      case 'hero':
        return renderHero(sec);
      case 'best_sellers':
        return renderBestSellers(sec);
      case 'categories':
      case 'departments':
        return renderCategories(sec);
      case 'flash_deals':
        return renderFlashDeals(sec);
      case 'tabbed_spotlight':
        return renderTabbedSpotlight(sec);
      case 'deg_bhapka':
        return renderDegBhapka(sec);
      case 'kirana_packs':
        return renderKiranaPacks(sec);
      case 'sourcing_centers':
        return renderSourcingCenters(sec);
      case 'values_strip':
        return renderValuesStrip(sec);
      case 'journal_preview':
        return renderJournalPreview(sec);
      case 'newsletter':
        return renderNewsletter(sec);
      case 'custom':
      default:
        return renderCustom(sec);
    }
  };

  return (
    <div className="w-full bg-canvas text-primary">
      {sections
        .filter((sec) => sec.isEnabled)
        .map((sec) => (
          <React.Fragment key={sec.id}>
            {renderSection(sec)}
          </React.Fragment>
        ))}
    </div>
  );
}
