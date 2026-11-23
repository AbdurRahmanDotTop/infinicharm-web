'use client';

// ==============================================================================
// InfiniCharm — Primary Storefront Header
// Reference: All_Docs/Designs/home_ecommerce_stitch/code.html
// Brand Standards: Centralized BrandLogo, Warm Editorial Styling, Zero Layout Shift
// ==============================================================================

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ShoppingBag,
  User,
  Search,
  Menu,
  X,
  Truck,
  Headphones,
  ChevronDown,
  Heart,
  Layers,
  Sparkles,
  ArrowRight,
  ChevronRight,
  Tag,
  Compass,
  Package,
  MapPin,
  LogOut,
} from 'lucide-react';
import { BRAND } from '@/lib/constants/brand';
import { CATEGORIES } from '@/lib/constants/categories';
import { getAllProducts } from '@/lib/data/products';
import { Container } from '@/components/ui/Container';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { useCart } from '@/lib/context/CartContext';
import { useWishlist } from '@/lib/context/WishlistContext';
import { AnnouncementItem } from '@/lib/server/announcements-store';
import { Product, Category } from '@/types';
import { formatPaiseToRupees } from '@/lib/utils/currency';

export function Header() {
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [autocompleteOpen, setAutocompleteOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const pathname = usePathname();
  const { totalItemsCount, subtotalInPaise, openDrawer } = useCart();
  const { wishlistCount } = useWishlist();

  // Announcement Bar dynamic configuration
  const [announcementConfig, setAnnouncementConfig] = useState<{
    isMasterEnabled: boolean;
    leftItems: AnnouncementItem[];
    rightItems: AnnouncementItem[];
  }>({
    isMasterEnabled: true,
    leftItems: [
      {
        id: 'ann-1794473026858-405',
        type: 'coupon',
        text: "Use Code 'WELCOME10' for 10% Off",
        href: '/deals',
        isClickable: true,
        position: 'left',
        displayOrder: 1,
        isEnabled: true,
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'ann-delivery-01',
        type: 'delivery',
        text: 'Free Express Delivery over ₹4,999',
        deliveryThresholdInRupees: 4999,
        href: '/shop',
        isClickable: true,
        position: 'left',
        displayOrder: 2,
        isEnabled: true,
        createdAt: '',
        updatedAt: '',
      },
    ],
    rightItems: [
      {
        id: 'ann-care-01',
        type: 'support',
        text: '24/7 Care: support@infinicharm.com',
        href: 'mailto:support@infinicharm.com',
        isClickable: true,
        position: 'right',
        displayOrder: 4,
        isEnabled: true,
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'ann-track-01',
        type: 'track_order',
        text: 'Track Order',
        href: '/track-order',
        isClickable: true,
        position: 'right',
        displayOrder: 5,
        isEnabled: true,
        createdAt: '',
        updatedAt: '',
      },
    ],
  });

  useEffect(() => {
    const fetchAnnouncements = () => {
      fetch('/api/announcements')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.success) {
            const isMasterEnabled = data.isMasterEnabled !== false;
            const rawItems: AnnouncementItem[] = Array.isArray(data.items) ? data.items : [];
            const activeItems = rawItems
              .filter((i: AnnouncementItem) => i.isEnabled !== false)
              .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

            const left = Array.isArray(data.leftItems) && data.leftItems.length > 0
              ? data.leftItems.filter((i: AnnouncementItem) => i.isEnabled !== false)
              : activeItems.filter((i: AnnouncementItem) => i.position === 'left');

            const right = Array.isArray(data.rightItems) && data.rightItems.length > 0
              ? data.rightItems.filter((i: AnnouncementItem) => i.isEnabled !== false)
              : activeItems.filter((i: AnnouncementItem) => i.position === 'right');

            setAnnouncementConfig({
              isMasterEnabled,
              leftItems: left,
              rightItems: right,
            });
          }
        })
        .catch(() => {});
    };

    fetchAnnouncements();
    window.addEventListener('infinicharm_announcements_updated', fetchAnnouncements);
    return () => {
      window.removeEventListener('infinicharm_announcements_updated', fetchAnnouncements);
    };
  }, []);

  // Prevent background scrolling when mobile navigation drawer is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  // Close mobile drawer on route navigation
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Close mobile drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Authoritative live categories state, synchronizing with /api/categories
  const [liveCategories, setLiveCategories] = useState<Category[]>(() =>
    (CATEGORIES as Category[]).filter((c) => c.isActive !== false)
  );

  // Authenticated customer state
  const [customer, setCustomer] = useState<{
    id?: string;
    firstName?: string;
    lastName?: string;
    fullName?: string;
    email?: string;
  } | null>(null);

  useEffect(() => {
    const loadCustomer = () => {
      try {
        const stored = localStorage.getItem('infinicharm_customer_user');
        if (stored) {
          const parsed = JSON.parse(stored);
          setCustomer(parsed);
        } else {
          setCustomer(null);
        }
      } catch {
        setCustomer(null);
      }
    };

    loadCustomer();

    // Verify session asynchronously from server only when a customer session cookie is present
    const hasSessionCookie =
      typeof document !== 'undefined' && document.cookie.includes('infinicharm_customer_session=active');
    if (hasSessionCookie) {
      fetch('/api/customers/me')
        .then((res) => (res.ok ? res.json() : { success: false, status: res.status }))
        .then((data) => {
          if (data?.success && data?.customer) {
            setCustomer(data.customer);
            localStorage.setItem('infinicharm_customer_user', JSON.stringify(data.customer));
          } else if (data && !data.success) {
            setCustomer(null);
            localStorage.removeItem('infinicharm_customer_user');
            document.cookie = 'infinicharm_customer_session=; Path=/; Max-Age=0';
            document.cookie = 'infinicharm_customer_id=; Path=/; Max-Age=0';
          }
        })
        .catch(() => {});
    }

    window.addEventListener('infinicharm_customer_updated', loadCustomer);
    window.addEventListener('storage', loadCustomer);

    return () => {
      window.removeEventListener('infinicharm_customer_updated', loadCustomer);
      window.removeEventListener('storage', loadCustomer);
    };
  }, []);

  const customerFirstName = useMemo(() => {
    if (!customer) return null;
    if (customer.firstName?.trim()) return customer.firstName.trim();
    if (customer.fullName?.trim()) return customer.fullName.trim().split(' ')[0];
    return 'Customer';
  }, [customer]);

  const customerInitial = useMemo(() => {
    if (!customerFirstName) return 'U';
    return customerFirstName.charAt(0).toUpperCase();
  }, [customerFirstName]);

  // Close autocomplete on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setAutocompleteOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Authoritative live products state, synchronizing with /api/products
  const [liveCatalogProducts, setLiveCatalogProducts] = useState<Product[]>(() => getAllProducts());

  useEffect(() => {
    const syncProducts = async () => {
      try {
        const res = await fetch('/api/products');
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.products)) {
            setLiveCatalogProducts(data.products);
            try {
              localStorage.setItem('infinicharm_authoritative_products', JSON.stringify(data.products));
            } catch {
              // ignore
            }
          }
        }
      } catch {
        // ignore
      }
    };

    syncProducts();

    const syncCategories = async () => {
      try {
        const res = await fetch('/api/categories?activeOnly=true');
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.categories)) {
            setLiveCategories(data.categories);
          }
        }
      } catch {
        // ignore
      }
    };

    syncCategories();

    const handleUpdate = () => {
      syncProducts();
      syncCategories();
    };
    window.addEventListener('infinicharm_products_updated', handleUpdate);
    window.addEventListener('infinicharm_categories_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('infinicharm_products_updated', handleUpdate);
      window.removeEventListener('infinicharm_categories_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setAutocompleteOpen(false);
    const catQuery = selectedCategory !== 'all' ? `&category=${selectedCategory}` : '';
    window.location.href = `/search?q=${encodeURIComponent(searchQuery.trim())}${catQuery}`;
  };

  const selectedCategoryObj = liveCategories.find((c) => c.slug === selectedCategory);
  const selectedCategoryLabel = selectedCategoryObj ? selectedCategoryObj.name : 'All Categories';

  // Live matching products for autocomplete preview — strictly published and strictly matching
  const matchingProducts = useMemo(() => {
    const published = liveCatalogProducts.filter((p) => p.status === 'PUBLISHED');
    if (!searchQuery.trim()) {
      return published.slice(0, 4);
    }
    const q = searchQuery.toLowerCase().trim();
    const matched = published.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.shortDescription && p.shortDescription.toLowerCase().includes(q)) ||
        p.brand.toLowerCase().includes(q) ||
        (p.originRegion && p.originRegion.toLowerCase().includes(q)) ||
        p.variants?.some((v) => v.sku?.toLowerCase().includes(q))
    );
    // CRITICAL: NEVER fall back to unrelated products when there are zero matches!
    return matched.slice(0, 4);
  }, [searchQuery, liveCatalogProducts]);

  return (
    <>
      {/* 1. Sticky Top Announcement Bar — Remains Fixed/Sticky at Top While Main Header Scrolls Away */}
      {announcementConfig.isMasterEnabled &&
        (announcementConfig.leftItems.length > 0 || announcementConfig.rightItems.length > 0) && (
          <div
            id="top-announcement-bar"
            data-testid="announcement-bar"
            className="sticky top-0 z-40 w-full bg-primary text-white text-[10px] sm:text-[11px] py-1.5 px-2.5 sm:px-6 border-b border-white/10 shadow-xs"
          >
            <div className="max-w-canvas mx-auto flex flex-wrap items-center justify-center sm:justify-between gap-x-3 gap-y-1 text-center sm:text-left">
              {/* Left Promotional / Value Proposition Items */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-2.5 gap-y-0.5 sm:gap-y-1">
                {announcementConfig.leftItems.map((item, idx) => {
                  const content = (
                    <span className="inline-flex items-center gap-1 font-medium text-white/95 leading-snug">
                      {item.type === 'delivery' && <Truck className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-accent shrink-0" />}
                      {item.type === 'coupon' && <Tag className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-accent shrink-0" />}
                      {item.type === 'support' && <Headphones className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-accent shrink-0" />}
                      {item.type === 'track_order' && <Compass className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-accent shrink-0" />}
                      <span className="break-words">{item.text}</span>
                    </span>
                  );
                  return (
                    <React.Fragment key={item.id}>
                      {idx > 0 && <span className="hidden sm:inline-block h-3 w-px bg-white/20 shrink-0" />}
                      {item.href ? (
                        <Link
                          href={item.href}
                          target={item.openInNewTab ? '_blank' : undefined}
                          rel={item.openInNewTab ? 'noopener noreferrer' : undefined}
                          className="hover:text-accent transition-colors"
                        >
                          {content}
                        </Link>
                      ) : (
                        content
                      )}
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Right Care & Tracking Utilities */}
              <div className="flex flex-wrap items-center justify-center sm:justify-end gap-x-3 gap-y-0.5 sm:gap-y-1 text-white/90">
                {announcementConfig.rightItems.map((item, idx) => {
                  const content = (
                    <span className="inline-flex items-center gap-1 font-medium hover:text-white transition-colors leading-snug">
                      {item.type === 'support' && <Headphones className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-accent shrink-0" />}
                      {item.type === 'track_order' && <Compass className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-accent shrink-0" />}
                      {item.type === 'delivery' && <Truck className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-accent shrink-0" />}
                      {item.type === 'coupon' && <Tag className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-accent shrink-0" />}
                      <span className="break-words">{item.text}</span>
                    </span>
                  );
                  return (
                    <React.Fragment key={item.id}>
                      {idx > 0 && <span className="hidden sm:inline-block h-3 w-px bg-white/20 shrink-0" />}
                      {item.href ? (
                        item.href.startsWith('mailto:') ? (
                          <a href={item.href} className="hover:text-accent transition-colors">
                            {content}
                          </a>
                        ) : (
                          <Link
                            href={item.href}
                            target={item.openInNewTab ? '_blank' : undefined}
                            rel={item.openInNewTab ? 'noopener noreferrer' : undefined}
                            className="hover:text-accent transition-colors"
                          >
                            {content}
                          </Link>
                        )
                      ) : (
                        content
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </div>
        )}

      <header
        data-testid="main-header"
        className="relative z-30 w-full border-b border-border bg-surface shadow-level-1"
      >
      <Container className="px-2 sm:px-6 lg:px-8">
        <div className="flex h-16 sm:h-20 items-center justify-between gap-1 sm:gap-4 lg:gap-6">
          {/* Left: Mobile Menu Trigger & Official BrandLogo */}
          <div className="flex items-center gap-1 sm:gap-3 min-w-0 shrink-0">
            <button
              type="button"
              data-testid="mobile-menu-toggle"
              className="xl:hidden p-1.5 sm:p-2 text-primary hover:bg-surface-dim rounded-lg transition-colors shrink-0"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label="Toggle Navigation Menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            {/* Centralized Brand Logo */}
            <BrandLogo variant="light" size="md" href="/" showTagline={true} />
          </div>

          {/* Center: Search with Category Dropdown & Live Predictive Discovery */}
          <div ref={searchContainerRef} className="hidden md:flex flex-1 min-w-0 max-w-2xl mx-1 lg:mx-2 relative">
            <form onSubmit={handleSearchSubmit} className="w-full">
              <div className="flex items-center w-full bg-surface-dim rounded-full pl-3 pr-1 py-1 border border-border focus-within:border-primary transition-all shadow-xs">
                {/* Category Selector Pill */}
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
                    className="flex items-center gap-1 text-xs font-semibold text-muted hover:text-primary pr-3 border-r border-border/80 focus:outline-none"
                  >
                    <Layers className="w-3.5 h-3.5 text-muted" />
                    <span className="max-w-[105px] truncate">{selectedCategoryLabel}</span>
                    <ChevronDown className="w-3 h-3 text-muted" />
                  </button>

                  {/* Dropdown Menu */}
                  {categoryDropdownOpen && (
                    <div className="absolute top-9 left-0 w-52 bg-surface border border-border rounded-xl shadow-level-2 py-2 z-50">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCategory('all');
                          setCategoryDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 text-xs font-medium hover:bg-surface-dim transition-colors ${
                          selectedCategory === 'all' ? 'text-accent font-bold' : 'text-primary'
                        }`}
                      >
                        All Categories
                      </button>
                      {liveCategories.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            setSelectedCategory(cat.slug);
                            setCategoryDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 text-xs font-medium hover:bg-surface-dim transition-colors ${
                            selectedCategory === cat.slug ? 'text-accent font-bold' : 'text-primary'
                          }`}
                        >
                          {cat.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Search Text Input */}
                <input
                  type="text"
                  placeholder="Search 100% Kashmiri Honey, Zamzam Water, Takmeeli Talbeena, Dates..."
                  value={searchQuery}
                  onFocus={() => setAutocompleteOpen(true)}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setAutocompleteOpen(true);
                  }}
                  className="flex-1 min-w-0 w-full bg-transparent px-2.5 lg:px-3 text-xs text-primary placeholder:text-muted focus:outline-none"
                />

                {/* Submit Button */}
                <button
                  type="submit"
                  className="w-8 h-8 rounded-full bg-accent hover:bg-accent-hover text-white flex items-center justify-center shrink-0 transition-colors shadow-xs"
                  aria-label="Search Catalog"
                >
                  <Search className="w-4 h-4" />
                </button>
              </div>
            </form>

            {/* Live Predictive Discovery Dropdown Simulation (Reference: code.html lines 5-87) */}
            {autocompleteOpen && (
              <div
                id="autocomplete-preview"
                className="absolute top-12 left-0 right-0 bg-surface rounded-2xl shadow-level-3 border border-border p-4 z-50 animate-in fade-in slide-in-from-top-2"
              >
                <div className="flex items-center justify-between pb-2 mb-3 border-b border-border/80">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-accent" />
                    <span className="text-[11px] uppercase tracking-wider text-primary font-bold font-mono">
                      Live Predictive Discovery
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAutocompleteOpen(false)}
                    className="text-[11px] text-neutral-500 hover:text-primary transition-colors flex items-center gap-1 font-medium"
                  >
                    <span>Dismiss preview</span>
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-12 gap-4">
                  {/* Left Column: Matching Harvests & Products */}
                  <div className="col-span-6 space-y-2 border-r border-border/80 pr-2">
                    <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block">
                      Matching Harvests &amp; Products
                    </span>
                    {matchingProducts.length === 0 ? (
                      <div className="py-4 px-2 text-center bg-surface-dim/50 rounded-xl border border-dashed border-border/80">
                        <p className="text-xs font-semibold text-neutral-700">
                          {searchQuery.trim()
                            ? `No harvests match "${searchQuery.trim()}"`
                            : 'No products available'}
                        </p>
                        <p className="text-[10px] text-neutral-500 mt-0.5">
                          Try searching for Kashmiri honey, Zamzam water, Talbeena, Barliva or dates.
                        </p>
                      </div>
                    ) : (
                      matchingProducts.map((p) => {
                        const defVar = p.variants[0];
                        return (
                          <Link
                            key={p.id}
                            href={`/product/${p.slug}`}
                            onClick={() => setAutocompleteOpen(false)}
                            className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-surface-dim transition-colors group"
                          >
                            <div className="w-8 h-8 rounded-lg bg-surface-dim flex items-center justify-center text-accent shrink-0 overflow-hidden border border-border/60">
                              {p.media?.[0]?.externalUrl ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img
                                  src={p.media[0].externalUrl}
                                  alt={p.title}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                />
                              ) : (
                                <ShoppingBag className="w-4 h-4" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-primary truncate group-hover:text-accent transition-colors">
                                {p.title}
                              </p>
                              <p className="font-mono text-[11px] text-neutral-600">
                                {defVar ? formatPaiseToRupees(defVar.priceInPaise) : '—'} • In Stock
                              </p>
                            </div>
                          </Link>
                        );
                      })
                    )}
                  </div>

                  {/* Right Column: Approved Categories & Catalogue Dispatch */}
                  <div className="col-span-6 space-y-3 pl-1">
                    <div>
                      <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">
                        Featured Categories
                      </span>
                      <div className="space-y-1">
                        {liveCategories.slice(0, 4).map((cat) => {
                          const catCount = liveCatalogProducts.filter(
                            (p) => p.status === 'PUBLISHED' && p.categoryId === cat.id
                          ).length;
                          return (
                            <Link
                              key={cat.id}
                              href={`/shop?category=${cat.slug}`}
                              onClick={() => setAutocompleteOpen(false)}
                              className="flex items-center justify-between text-xs text-primary hover:text-accent transition-colors py-0.5"
                            >
                              <span>
                                {cat.primaryCategory ? `${cat.primaryCategory} > ` : ''}
                                <strong>{cat.name}</strong>
                              </span>
                              <span className="font-mono text-[10px] bg-surface-dim px-2 py-0.5 rounded-full text-neutral-600">
                                {catCount}
                              </span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>

                    <div className="pt-1">
                      <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">
                        Verified Brands &amp; Dispatch
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {['East Champaran, Bihar - 845427', 'IC-HONEY', 'IC-ZAM-ZAM', 'IC-TALBEENA', 'IC-DATES'].map((fac) => (
                          <Link
                            key={fac}
                            href={`/search?q=${encodeURIComponent(fac)}`}
                            onClick={() => setAutocompleteOpen(false)}
                            className="px-2 py-0.5 bg-surface-dim hover:bg-border text-primary rounded-full text-[10px] font-medium transition-colors"
                          >
                            {fac}
                          </Link>
                        ))}
                      </div>
                    </div>

                    <div className="pt-1">
                      <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">
                        Trending Terms
                      </span>
                      <div className="flex items-center gap-1.5 text-xs text-neutral-600 flex-wrap">
                        {['100% Kashmiri Honey', 'Zamzam Water', 'Takmeeli Talbeena', 'Premium Dates'].map((term, idx) => (
                          <React.Fragment key={term}>
                            {idx > 0 && <span>•</span>}
                            <Link
                              href={`/search?q=${encodeURIComponent(term)}`}
                              onClick={() => setAutocompleteOpen(false)}
                              className="hover:text-accent underline-offset-2 hover:underline"
                            >
                              {term}
                            </Link>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right: User, Wishlist, Cart Pill */}
          <div className="flex items-center gap-0.5 sm:gap-2.5 shrink-0">
            {/* Mobile Search Button */}
            <button
              type="button"
              className="md:hidden p-1 sm:p-2 text-primary hover:bg-surface-dim rounded-full transition-colors"
              onClick={() => setSearchOpen((prev) => !prev)}
              aria-label="Open Search"
              aria-expanded={searchOpen}
            >
              <Search className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* Account Link */}
            <Link
              href={customer ? '/account' : '/login'}
              className="flex items-center gap-1 sm:gap-2 p-0.5 sm:px-2.5 sm:py-1.5 text-primary hover:bg-surface-dim rounded-full transition-colors"
              aria-label={customer ? `My Account (${customerFirstName})` : 'Sign In to Account'}
            >
              {customer ? (
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-accent text-white flex items-center justify-center font-bold text-[11px] sm:text-xs shrink-0 shadow-xs">
                  {customerInitial}
                </div>
              ) : (
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-primary flex items-center justify-center text-white shrink-0">
                  <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
              )}
              <div className="text-left hidden sm:block">
                <span className="block text-[10px] text-muted font-normal leading-tight">
                  {customer ? `Hello, ${customerFirstName}` : 'Hello, Sign In'}
                </span>
                <span className="block text-xs font-bold text-primary leading-tight">
                  My Account
                </span>
              </div>
            </Link>

            {/* Wishlist Link — Responsive on All Screen Sizes with Live Badge */}
            <Link
              href="/account/wishlist"
              className="relative p-1 sm:p-2 text-primary hover:bg-surface-dim rounded-full transition-colors flex items-center justify-center"
              aria-label={`Wishlist (${wishlistCount} items)`}
              title="Saved Wishlist"
            >
              <Heart
                className={`w-4 h-4 sm:w-5 sm:h-5 transition-colors ${
                  wishlistCount > 0 ? 'text-accent fill-accent/20' : 'text-muted hover:text-accent'
                }`}
              />
              {wishlistCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-1 rounded-full bg-accent text-white font-mono text-[9px] font-bold flex items-center justify-center shadow-xs">
                  {wishlistCount}
                </span>
              )}
            </Link>

            {/* Cart Pill Button */}
            <button
              type="button"
              onClick={openDrawer}
              className="relative flex items-center gap-1 sm:gap-2 bg-surface-dim hover:bg-surface-container border border-border px-2 sm:px-3 py-1.5 rounded-full text-primary transition-colors shadow-xs shrink-0"
              aria-label="View Shopping Bag"
            >
              <div className="relative flex items-center">
                <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                {totalItemsCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 h-4 min-w-[16px] px-1 rounded-full bg-accent text-white font-mono text-[9px] font-bold flex items-center justify-center">
                    {totalItemsCount}
                  </span>
                )}
              </div>
              <span className="hidden min-[380px]:inline font-mono text-[10px] sm:text-xs font-bold text-primary">
                {totalItemsCount > 0 ? formatPaiseToRupees(subtotalInPaise) : '₹0'}
              </span>
            </button>
          </div>
        </div>

        {/* Mobile Search Drawer with Category Filter & Instant Results */}
        {searchOpen && (
          <div className="md:hidden py-3 border-t border-border space-y-2.5">
            <form onSubmit={handleSearchSubmit} className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5 bg-surface-dim border border-border rounded-2xl p-1">
                <select
                  aria-label="Filter Search Category"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="max-w-[125px] bg-surface text-xs font-semibold text-primary rounded-xl px-2 py-2 border border-border/80 focus:outline-none truncate"
                >
                  <option value="all">All Categories</option>
                  {liveCategories.map((cat) => (
                    <option key={cat.id} value={cat.slug}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                <div className="relative flex-1 min-w-0 flex items-center">
                  <input
                    type="text"
                    placeholder="Search Honey, Zamzam, Talbeena, Dates..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-9 pl-2.5 pr-2 text-xs bg-transparent text-primary placeholder:text-muted focus:outline-none"
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  className="w-9 h-9 rounded-xl bg-accent hover:bg-accent-hover text-white flex items-center justify-center shrink-0 transition-colors"
                  aria-label="Submit Mobile Search"
                >
                  <Search className="w-4 h-4" />
                </button>
              </div>
            </form>

            {searchQuery.trim() && (
              <div className="bg-surface border border-border rounded-2xl p-2.5 space-y-1.5 shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted px-1">
                  Matching Harvests
                </span>
                {matchingProducts.length === 0 ? (
                  <p className="text-xs text-muted px-1 py-2">
                    No harvests match &ldquo;{searchQuery.trim()}&rdquo;
                  </p>
                ) : (
                  matchingProducts.map((p) => (
                    <Link
                      key={p.id}
                      href={`/product/${p.slug}`}
                      onClick={() => setSearchOpen(false)}
                      className="flex items-center justify-between gap-2 p-2 rounded-xl hover:bg-surface-dim transition-colors"
                    >
                      <span className="text-xs font-semibold text-primary truncate">{p.title}</span>
                      <span className="font-mono text-[11px] font-bold text-accent shrink-0">
                        {p.variants[0] ? formatPaiseToRupees(p.variants[0].priceInPaise) : '—'}
                      </span>
                    </Link>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </Container>

      {/* 3. Sub-Navbar: Curated Categories & Quick Category Navigation */}
      <div className="hidden md:block border-t border-border/80 bg-surface">
        <Container className="px-3 sm:px-6 lg:px-8">
          <nav className="flex flex-wrap items-center gap-x-1.5 gap-y-1 py-2 text-xs">
            {/* All Categories Trigger */}
            <Link
              href="/shop"
              className="flex items-center gap-1.5 font-bold text-primary pr-3 mr-1 border-r border-border hover:text-accent transition-colors shrink-0"
            >
              <Menu className="w-4 h-4" />
              <span>All Categories</span>
            </Link>

            {/* Quick Deals Link */}
            <Link
              href="/shop?filter=deals"
              className="flex items-center gap-1 text-accent font-bold px-2.5 py-1 rounded-full hover:bg-accent/10 transition-colors whitespace-nowrap shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Deals &amp; Offers</span>
            </Link>

            {/* Dynamic Category Links */}
            {liveCategories.map((cat) => (
              <Link
                key={cat.id}
                href={`/shop?category=${cat.slug}`}
                className={`px-2.5 py-1 rounded-full font-medium transition-colors whitespace-nowrap shrink-0 ${
                  pathname === `/shop` && selectedCategory === cat.slug
                    ? 'bg-primary text-white'
                    : 'text-muted hover:text-primary hover:bg-surface-dim'
                }`}
              >
                {cat.name}
              </Link>
            ))}

            <div className="ml-auto flex items-center gap-3 pl-2 shrink-0">
              <Link
                href="/about"
                className="text-muted hover:text-primary font-medium transition-colors whitespace-nowrap"
              >
                Our Story
              </Link>
              <Link
                href="/blog"
                className="text-muted hover:text-primary font-medium transition-colors whitespace-nowrap"
              >
                Journal
              </Link>
            </div>
          </nav>
        </Container>
      </div>

      {/* 4. Complete Mobile Navigation Drawer System (Portalled to document.body to escape sticky backdrop-blur containing block) */}
      {mounted &&
        mobileMenuOpen &&
        createPortal(
          <div
            data-testid="mobile-nav-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile Storefront Navigation"
            className="xl:hidden fixed inset-0 z-[100] flex w-screen h-[100dvh]"
          >
            {/* Backdrop Overlay — tap to dismiss */}
            <div
              className="fixed inset-0 bg-neutral-900/60 backdrop-blur-xs transition-opacity duration-200"
              onClick={() => setMobileMenuOpen(false)}
              aria-hidden="true"
            />

            {/* Slide-in Navigation Panel */}
            <div className="relative w-[86vw] max-w-xs sm:max-w-sm bg-surface h-[100dvh] flex flex-col shadow-2xl z-10 overflow-hidden animate-in slide-in-from-left duration-200">
              {/* Drawer Header */}
              <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-surface-dim/50 shrink-0">
                <BrandLogo variant="light" size="sm" href="/" />
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 text-primary hover:bg-surface-dim rounded-full transition-colors border border-border/60"
                  aria-label="Close Navigation Menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Navigation Body */}
              <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-5">
                {/* Inline Quick Search inside Drawer */}
                <form
                  onSubmit={(e) => {
                    setMobileMenuOpen(false);
                    handleSearchSubmit(e);
                  }}
                  className="flex items-center gap-1.5 bg-surface-dim border border-border rounded-xl p-1"
                >
                  <Search className="w-4 h-4 text-muted ml-2 shrink-0" />
                  <input
                    type="text"
                    placeholder="Search Honey, Zamzam, Talbeena, Dates..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 min-w-0 bg-transparent text-xs text-primary placeholder:text-muted px-1.5 py-2 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-accent text-white text-[11px] font-bold rounded-lg shrink-0"
                  >
                    Search
                  </button>
                </form>

                {/* Account / Authentication Card */}
                {customer ? (
                  <div className="p-4 bg-surface-dim rounded-2xl border border-border space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-accent text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                        {customerInitial}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <span className="block text-[11px] text-muted font-medium">
                          Hello, {customerFirstName}
                        </span>
                        <span className="block text-sm font-bold text-primary truncate">
                          {customer.fullName || 'Valued Customer'}
                        </span>
                      </div>
                    </div>

                    {/* Account Quick Links */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/80 text-xs">
                      <Link
                        href="/account"
                        onClick={() => setMobileMenuOpen(false)}
                        className="px-2.5 py-2 bg-surface hover:bg-surface-container rounded-lg font-medium text-primary text-center transition-colors border border-border/50"
                      >
                        My Account
                      </Link>
                      <Link
                        href="/account/orders"
                        onClick={() => setMobileMenuOpen(false)}
                        className="px-2.5 py-2 bg-surface hover:bg-surface-container rounded-lg font-medium text-primary text-center transition-colors border border-border/50"
                      >
                        Orders
                      </Link>
                      <Link
                        href="/account/wishlist"
                        onClick={() => setMobileMenuOpen(false)}
                        className="px-2.5 py-2 bg-surface hover:bg-surface-container rounded-lg font-medium text-primary text-center transition-colors border border-border/50 flex items-center justify-center gap-1"
                      >
                        <span>Wishlist</span>
                        {wishlistCount > 0 && (
                          <span className="bg-accent text-white text-[9px] px-1 rounded-full font-bold">
                            {wishlistCount}
                          </span>
                        )}
                      </Link>
                      <Link
                        href="/account/addresses"
                        onClick={() => setMobileMenuOpen(false)}
                        className="px-2.5 py-2 bg-surface hover:bg-surface-container rounded-lg font-medium text-primary text-center transition-colors border border-border/50"
                      >
                        Addresses
                      </Link>
                      <Link
                        href="/account/profile"
                        onClick={() => setMobileMenuOpen(false)}
                        className="px-2.5 py-2 bg-surface hover:bg-surface-container rounded-lg font-medium text-primary text-center transition-colors border border-border/50"
                      >
                        Profile
                      </Link>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await fetch('/api/auth/customer/logout', { method: 'POST' });
                          } catch {}
                          localStorage.removeItem('infinicharm_customer_user');
                          setCustomer(null);
                          window.dispatchEvent(new CustomEvent('infinicharm_customer_updated'));
                          setMobileMenuOpen(false);
                        }}
                        className="px-2.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg font-semibold text-center transition-colors border border-rose-200 flex items-center justify-center gap-1"
                      >
                        <LogOut className="w-3 h-3" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <Link
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-between p-4 bg-accent/10 hover:bg-accent/15 border border-accent/25 rounded-2xl text-accent font-semibold text-sm transition-colors shadow-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-accent text-white flex items-center justify-center shadow-xs shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <span className="block text-[10px] text-accent/80 font-medium">
                          Hello, Sign In
                        </span>
                        <span className="block text-xs font-bold text-accent">
                          My Account / Register
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-accent shrink-0" />
                  </Link>
                )}

                {/* Shopping & Wishlist Shortcuts */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <Link
                    href="/account/wishlist"
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-3 bg-surface rounded-xl border border-border hover:border-accent flex items-center gap-2.5 transition-colors group"
                  >
                    <Heart
                      className={`w-4 h-4 shrink-0 ${
                        wishlistCount > 0 ? 'text-accent fill-accent/20' : 'text-muted'
                      }`}
                    />
                    <div className="text-left min-w-0">
                      <span className="block text-[10px] text-muted">Saved</span>
                      <span className="font-bold text-primary group-hover:text-accent truncate block">
                        Wishlist ({wishlistCount})
                      </span>
                    </div>
                  </Link>

                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      openDrawer();
                    }}
                    className="p-3 bg-surface rounded-xl border border-border hover:border-accent flex items-center gap-2.5 transition-colors text-left group"
                  >
                    <ShoppingBag className="w-4 h-4 text-accent shrink-0" />
                    <div className="text-left min-w-0">
                      <span className="block text-[10px] text-muted">Bag</span>
                      <span className="font-bold text-primary group-hover:text-accent truncate block">
                        Cart ({totalItemsCount})
                      </span>
                    </div>
                  </button>
                </div>

                {/* Curated Categories */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-border/80">
                    <p className="text-[11px] font-bold text-muted uppercase tracking-wider">
                      Curated Categories
                    </p>
                    <Link
                      href="/shop"
                      onClick={() => setMobileMenuOpen(false)}
                      className="text-[11px] font-bold text-accent hover:underline"
                    >
                      View All
                    </Link>
                  </div>

                  <Link
                    href="/shop"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-between py-2 text-sm font-semibold text-primary hover:text-accent border-b border-border/40"
                  >
                    <span>All Products &amp; Harvests</span>
                    <ChevronRight className="w-3.5 h-3.5 text-muted" />
                  </Link>

                  {liveCategories.map((cat) => (
                    <Link
                      key={cat.id}
                      href={`/shop?category=${cat.slug}`}
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center justify-between py-2 text-xs font-medium text-primary hover:text-accent border-b border-border/30"
                    >
                      <span>
                        {cat.name}
                        {cat.hindiName && (
                          <span className="text-[11px] text-muted ml-1.5 font-normal">
                            ({cat.hindiName})
                          </span>
                        )}
                      </span>
                      <ChevronRight className="w-3 h-3 text-muted/60" />
                    </Link>
                  ))}
                </div>

                {/* InfiniCharm Living Navigation */}
                <div className="space-y-1.5 pt-4 border-t border-border">
                  <p className="text-[11px] font-bold text-muted uppercase tracking-wider mb-2">
                    InfiniCharm Living
                  </p>
                  <Link
                    href="/deals"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 py-1.5 text-xs text-primary hover:text-accent"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-accent" />
                    <span>Deals &amp; Promotional Offers</span>
                  </Link>
                  <Link
                    href="/about"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 py-1.5 text-xs text-primary hover:text-accent"
                  >
                    <Compass className="w-3.5 h-3.5 text-muted" />
                    <span>Our Sourcing Story &amp; Leadership</span>
                  </Link>
                  <Link
                    href="/blog"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 py-1.5 text-xs text-primary hover:text-accent"
                  >
                    <Tag className="w-3.5 h-3.5 text-muted" />
                    <span>Editorial Journal &amp; Guides</span>
                  </Link>
                  <Link
                    href="/track-order"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 py-1.5 text-xs text-primary hover:text-accent"
                  >
                    <Truck className="w-3.5 h-3.5 text-muted" />
                    <span>Track Your Consignment</span>
                  </Link>
                  <Link
                    href="/contact"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 py-1.5 text-xs text-primary hover:text-accent"
                  >
                    <Headphones className="w-3.5 h-3.5 text-muted" />
                    <span>Help &amp; Customer Care</span>
                  </Link>
                  <Link
                    href="/admin/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 py-2 text-[11px] text-muted hover:text-primary pt-3 border-t border-border/40"
                  >
                    <Package className="w-3 h-3 text-muted" />
                    <span>Administrative Operations Hub</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
      </header>
    </>
  );
}

export default Header;
