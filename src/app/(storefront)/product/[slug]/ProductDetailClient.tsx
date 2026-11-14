'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { notFound, useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getProductBySlug, getAllProducts } from '@/lib/data/products';
import { CATEGORIES } from '@/lib/constants/categories';
import { formatPaiseToRupees } from '@/lib/utils/currency';
import { useCart } from '@/lib/context/CartContext';
import { useWishlist } from '@/lib/context/WishlistContext';
import { Container } from '@/components/ui/Container';
import { ProductCard } from '@/components/shop/ProductCard';
import { ExternalMediaRenderer, ExternalImage } from '@/components/media';
import {
  generateProductSchema,
  generateBreadcrumbSchema,
} from '@/lib/services/structured-data';
import {
  ShieldCheck,
  Truck,
  RotateCcw,
  Star,
  Check,
  Plus,
  Minus,
  ShoppingBag,
  Zap,
  Info,
  ChevronRight,
  Sparkles,
  MapPin,
  FileCheck,
  Video,
  Music,
  FileText,
  ExternalLink,
  Heart,
  Lock,
  AlertCircle,
  CheckCircle2,
  CornerDownRight,
  Trash2,
  Edit3,
  LogIn,
  X,
} from 'lucide-react';
import { Product, StorefrontBadge } from '@/types';
import { ShareButton } from '@/components/common/ShareButton';

interface ReviewItem {
  id: string;
  customerId?: string;
  name: string;
  rating: number;
  date: string;
  title?: string;
  comment: string;
  verified: boolean;
  orderNumber?: string;
  adminReply?: string;
  adminReplyAt?: string;
}

export default function ProductDetailClient({ initialSlug }: { initialSlug?: string } = {}) {
  const params = useParams();
  const router = useRouter();
  const slug = (params?.slug as string) || initialSlug || '';

  const initialProduct = useMemo(() => {
    return getProductBySlug(slug);
  }, [slug]);

  const [liveProduct, setLiveProduct] = useState<Product | undefined>(initialProduct);
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);

  useEffect(() => {
    const syncProduct = async () => {
      try {
        const [prodRes, listRes] = await Promise.all([
          fetch(`/api/products/${encodeURIComponent(slug)}`, { cache: 'no-store' }),
          fetch('/api/products', { cache: 'no-store' }),
        ]);
        if (prodRes.ok) {
          const data = await prodRes.json();
          if (data.success && data.product) {
            setLiveProduct(data.product);
          }
        }
        if (listRes.ok) {
          const listData = await listRes.json();
          if (listData.success && Array.isArray(listData.products)) {
            setCatalogProducts(listData.products);
          }
        }
      } catch {
        // ignore
      }
    };

    syncProduct();

    const handleUpdate = () => syncProduct();
    window.addEventListener('infinicharm_products_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('infinicharm_products_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [slug]);

  const product = liveProduct || initialProduct;

  const relatedProducts = useMemo(() => {
    if (!product) return [];
    const pool = (catalogProducts.length > 0 ? catalogProducts : getAllProducts(false)).filter(
      (p) => p.id !== product.id && p.status === 'PUBLISHED'
    );
    if (product.relatedProductIds && product.relatedProductIds.length > 0) {
      const explicit = product.relatedProductIds
        .map((id) => pool.find((p) => p.id === id))
        .filter((p): p is Product => Boolean(p));
      if (explicit.length > 0) return explicit;
    }
    const sameCategory = pool.filter((p) => p.categoryId === product.categoryId);
    if (sameCategory.length > 0) return sameCategory.slice(0, 4);
    return pool.slice(0, 4);
  }, [product, catalogProducts]);

  if (!product) {
    notFound();
  }

  const { addItem } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const isWishlisted = isInWishlist(product.id);

  const [selectedVariantId, setSelectedVariantId] = useState(product?.variants[0]?.id);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'details' | 'specs' | 'reviews'>('details');

  useEffect(() => {
    if (product?.variants[0]?.id && !selectedVariantId) {
      setSelectedVariantId(product.variants[0].id);
    }
  }, [product, selectedVariantId]);

  // Dynamic server-backed reviews & real average ratings
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [reviewStats, setReviewStats] = useState<{ totalReviews: number; averageRating: number }>({
    totalReviews: 0,
    averageRating: 0,
  });

  // Dynamic Storefront Badges & Guarantees (Admin Controlled)
  const [badges, setBadges] = useState<StorefrontBadge[]>([
    {
      id: 'badge-free-shipping',
      key: 'free_shipping',
      title: 'Free Shipping on orders above ₹4,999',
      icon: 'Truck',
      isEnabled: true,
      displayOrder: 1,
      thresholdRupees: 4999,
      linkUrl: '/policies/shipping',
    },
    {
      id: 'badge-replacement-guarantee',
      key: 'replacement_guarantee',
      title: 'Transit Damage Replacement Guarantee',
      icon: 'RotateCcw',
      isEnabled: true,
      displayOrder: 2,
      linkUrl: '/policies/refunds',
    },
  ]);

  useEffect(() => {
    const fetchBadges = async () => {
      try {
        const res = await fetch('/api/settings/badges', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.badges)) {
            setBadges(data.badges);
          }
        }
      } catch {
        // preserve fallback
      }
    };
    fetchBadges();

    const handleBadgesUpdate = () => fetchBadges();
    window.addEventListener('infinicharm_badges_updated', handleBadgesUpdate);
    return () => {
      window.removeEventListener('infinicharm_badges_updated', handleBadgesUpdate);
    };
  }, []);

  const renderBadgeIcon = (iconName: string) => {
    switch (iconName) {
      case 'Truck':
        return <Truck className="w-4 h-4 text-accent shrink-0" />;
      case 'RotateCcw':
        return <RotateCcw className="w-4 h-4 text-accent shrink-0" />;
      case 'ShieldCheck':
        return <ShieldCheck className="w-4 h-4 text-accent shrink-0" />;
      case 'Sparkles':
        return <Sparkles className="w-4 h-4 text-accent shrink-0" />;
      case 'FileCheck':
        return <FileCheck className="w-4 h-4 text-accent shrink-0" />;
      case 'Lock':
        return <Lock className="w-4 h-4 text-accent shrink-0" />;
      case 'Zap':
        return <Zap className="w-4 h-4 text-accent shrink-0" />;
      default:
        return <ShieldCheck className="w-4 h-4 text-accent shrink-0" />;
    }
  };

  // Purchase verification eligibility state
  const [eligibility, setEligibility] = useState<{
    checked: boolean;
    authenticated: boolean;
    eligible: boolean;
    reason?: string;
    customer?: { id: string; fullName: string; email: string };
    orderNumber?: string;
    orderId?: string;
    existingReview?: any;
  }>({
    checked: false,
    authenticated: false,
    eligible: false,
  });

  // Review modal state
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [newReviewRating, setNewReviewRating] = useState(5);
  const [newReviewTitle, setNewReviewTitle] = useState('');
  const [newReviewComment, setNewReviewComment] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccessMessage, setSubmitSuccessMessage] = useState<string | null>(null);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const fetchProductReviews = async () => {
    try {
      const res = await fetch(`/api/reviews?productId=${encodeURIComponent(product.id)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.reviews)) {
          const mapped: ReviewItem[] = data.reviews.map((r: any) => ({
            id: r.id,
            customerId: r.customerId,
            name: r.customerName || 'Verified Customer',
            rating: r.rating || 5,
            date: new Date(r.createdAt || Date.now()).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            }),
            title: r.title,
            comment: r.comment || '',
            verified: Boolean(r.isVerifiedPurchase),
            orderNumber: r.orderNumber,
            adminReply: r.adminReply,
            adminReplyAt: r.adminReplyAt,
          }));
          setReviews(mapped);
          if (data.stats) {
            setReviewStats({
              totalReviews: data.stats.totalReviews || 0,
              averageRating: data.stats.averageRating || 0,
            });
          }
          return;
        }
      }
      setReviews([]);
    } catch {
      setReviews([]);
    }
  };

  const fetchReviewEligibility = async () => {
    try {
      const res = await fetch(`/api/reviews/eligibility?productId=${encodeURIComponent(product.id)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setEligibility({
            checked: true,
            authenticated: Boolean(data.authenticated),
            eligible: Boolean(data.eligible),
            reason: data.reason,
            customer: data.customer,
            orderNumber: data.orderNumber,
            orderId: data.orderId,
            existingReview: data.existingReview,
          });
          if (data.existingReview) {
            setNewReviewRating(data.existingReview.rating || 5);
            setNewReviewTitle(data.existingReview.title || '');
            setNewReviewComment(data.existingReview.comment || '');
          }
          return;
        }
      }
    } catch (err) {
      console.error('Failed fetching review eligibility:', err);
    }
    setEligibility({ checked: true, authenticated: false, eligible: false });
  };

  useEffect(() => {
    fetchProductReviews();
    fetchReviewEligibility();

    const handleReviewsUpdate = () => {
      fetchProductReviews();
      fetchReviewEligibility();
    };

    window.addEventListener('infinicharm_reviews_updated', handleReviewsUpdate);
    window.addEventListener('storage', handleReviewsUpdate);
    return () => {
      window.removeEventListener('infinicharm_reviews_updated', handleReviewsUpdate);
      window.removeEventListener('storage', handleReviewsUpdate);
    };
  }, [product.id]);

  const category = CATEGORIES.find((c) => c.id === product.categoryId);

  const selectedVariant = useMemo(() => {
    return (
      product.variants.find((v) => v.id === selectedVariantId) ||
      product.variants[0]
    );
  }, [product, selectedVariantId]);

  const discountPercent = useMemo(() => {
    if (
      selectedVariant.compareAtPriceInPaise &&
      selectedVariant.compareAtPriceInPaise > selectedVariant.priceInPaise
    ) {
      return Math.round(
        ((selectedVariant.compareAtPriceInPaise - selectedVariant.priceInPaise) /
          selectedVariant.compareAtPriceInPaise) *
          100
      );
    }
    return 0;
  }, [selectedVariant]);

  const images = useMemo(() => {
    const variantMedia = (selectedVariant as any)?.media;
    if (Array.isArray(variantMedia) && variantMedia.length > 0) {
      return variantMedia;
    }
    return product.media && product.media.length > 0 ? product.media : [];
  }, [product.media, selectedVariant]);

  useEffect(() => {
    setSelectedImageIndex(0);
  }, [selectedVariantId]);

  const handleAddToCart = () => {
    if (!selectedVariant) return;
    addItem(product, selectedVariant, quantity);
  };

  const handleBuyNow = () => {
    if (!selectedVariant) return;
    addItem(product, selectedVariant, quantity);
    router.push('/checkout');
  };

  const handleAddReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setIsSubmittingReview(true);

    if (!newReviewComment.trim() || newReviewComment.trim().length < 10) {
      setSubmitError('Please enter at least 10 characters describing your experience.');
      setIsSubmittingReview(false);
      return;
    }

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          rating: newReviewRating,
          title: newReviewTitle.trim() || undefined,
          comment: newReviewComment.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setSubmitError(data.error || 'Review submission failed.');
        setIsSubmittingReview(false);
        return;
      }

      setShowReviewModal(false);
      setIsSubmittingReview(false);
      setSubmitSuccessMessage(data.message || 'Review submitted successfully!');
      setTimeout(() => setSubmitSuccessMessage(null), 4000);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('infinicharm_reviews_updated'));
        localStorage.setItem('infinicharm_reviews_sync', Date.now().toString());
      }

      fetchProductReviews();
      fetchReviewEligibility();
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed connecting to server.');
      setIsSubmittingReview(false);
    }
  };

  const handleDeleteOwnReview = async (reviewId: string) => {
    if (!confirm('Are you sure you want to delete your review?')) return;
    try {
      const res = await fetch(`/api/reviews?id=${encodeURIComponent(reviewId)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('infinicharm_reviews_updated'));
          localStorage.setItem('infinicharm_reviews_sync', Date.now().toString());
        }
        fetchProductReviews();
        fetchReviewEligibility();
      }
    } catch (err) {
      console.error('Failed deleting review:', err);
    }
  };

  const productJsonLd = generateProductSchema(product, selectedVariant);
  const breadcrumbJsonLd = generateBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Shop', url: '/shop' },
    ...(category ? [{ name: category.name, url: `/shop?category=${category.slug}` }] : []),
    { name: product.title, url: `/product/${product.slug}` },
  ]);

  return (
    <div className="py-8 bg-surface-dim/30 min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <Container>
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center gap-1.5 text-xs text-muted mb-6 flex-wrap">
          <Link href="/" className="hover:text-primary transition-colors">
            Home
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <Link href="/shop" className="hover:text-primary transition-colors">
            Shop
          </Link>
          {category && (
            <>
              <ChevronRight className="w-3.5 h-3.5" />
              <Link
                href={`/shop?category=${category.slug}`}
                className="hover:text-primary transition-colors"
              >
                {category.name}
              </Link>
            </>
          )}
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-primary font-medium truncate max-w-[200px] sm:max-w-none">
            {product.title}
          </span>
        </nav>

        {/* Main Product Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 bg-surface rounded-3xl border border-border p-5 sm:p-8 lg:p-10 shadow-sm">
          {/* Left Column: Image Gallery (5 Cols) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Primary Featured Media */}
            <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-surface-dim border border-border">
              <ExternalMediaRenderer
                media={images[selectedImageIndex]}
                aspectRatio="square"
                priority={selectedImageIndex === 0}
                className="w-full h-full"
              />

              {/* Promotional Badges Container */}
              <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 z-10 pointer-events-none max-w-[70%]">
                {discountPercent > 0 && (
                  <span className="bg-accent text-white text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-sm">
                    Save {discountPercent}%
                  </span>
                )}
                {product.customBadge ? (
                  <span className="bg-primary text-white text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-sm">
                    {product.customBadge}
                  </span>
                ) : product.isNewArrival ? (
                  <span className="bg-primary text-white text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-sm">
                    New Arrival
                  </span>
                ) : null}
              </div>

              {/* Floating Action Buttons on Primary Media */}
              <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
                <ShareButton
                  title={product.title}
                  text={`Check out ${product.title} on InfiniCharm! Pure, unadulterated, direct from harvesters.`}
                  imageUrl={images[0]?.externalUrl}
                  subtitle={formatPaiseToRupees(selectedVariant.priceInPaise)}
                  variant="floating"
                />
                <button
                  type="button"
                  onClick={(e) => toggleWishlist(product.id, e)}
                  className={`p-2.5 rounded-full backdrop-blur-md transition-all shadow-md ${
                    isWishlisted
                      ? 'bg-white text-rose-600 scale-105'
                      : 'bg-white/80 text-muted hover:text-rose-600 hover:bg-white'
                  }`}
                  aria-label={isWishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
                  title={isWishlisted ? 'Saved in Wishlist' : 'Save to Wishlist'}
                >
                  <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-current text-rose-600' : ''}`} />
                </button>
              </div>
            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="flex gap-2.5 overflow-x-auto pb-1">
                {images.map((img, idx) => (
                  <button
                    key={img.id}
                    onClick={() => setSelectedImageIndex(idx)}
                    className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border-2 transition-all shrink-0 flex items-center justify-center bg-surface-dim ${
                      selectedImageIndex === idx
                        ? 'border-accent ring-2 ring-accent/20'
                        : 'border-border opacity-70 hover:opacity-100'
                    }`}
                  >
                    {img.mediaType === 'VIDEO' ? (
                      <Video className="w-6 h-6 text-accent" />
                    ) : img.mediaType === 'AUDIO' ? (
                      <Music className="w-6 h-6 text-accent" />
                    ) : img.mediaType === 'PDF' ? (
                      <FileCheck className="w-6 h-6 text-emerald-600" />
                    ) : (
                      <ExternalImage
                        src={img.externalUrl}
                        alt={img.altText || product.title}
                        aspectRatio="square"
                        className="w-full h-full"
                      />
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Sourcing & Authenticity Highlights Card */}
            <div className="bg-surface-dim/70 rounded-2xl p-4 border border-border space-y-2.5 text-xs text-muted">
              <div className="flex items-center gap-2 text-primary font-semibold">
                <MapPin className="w-4 h-4 text-accent shrink-0" />
                <span>Origin: {product.originRegion || 'East Champaran, Bihar, India'}</span>
              </div>
              {product.fssaiLicenseNumber && (
                <div className="flex items-center gap-2 text-primary font-medium">
                  <FileCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{product.fssaiLicenseNumber}</span>
                </div>
              )}
              {product.highlights && product.highlights.length > 0 ? (
                product.highlights.map((h, i) => (
                  <div key={i} className="flex items-center gap-2 text-primary font-medium">
                    <Sparkles className="w-4 h-4 text-accent shrink-0" />
                    <span>{h}</span>
                  </div>
                ))
              ) : (
                <div className="flex items-center gap-2 text-primary font-medium">
                  <ShieldCheck className="w-4 h-4 text-accent shrink-0" />
                  <span>100% Authentic • Zero Synthetic Adulteration</span>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Pricing, Variant Selector & Actions (7 Cols) */}
          <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
            <div>
              {/* Category & Dynamic Genuine Rating */}
              <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                <span className="text-[11px] font-bold uppercase tracking-wider text-accent bg-accent/10 px-2.5 py-0.5 rounded-full">
                  {category?.name || 'Everyday Essential'}
                </span>
                {reviewStats.totalReviews > 0 ? (
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                    <div className="flex text-amber-500">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-3.5 h-3.5 ${
                            i < Math.round(reviewStats.averageRating) ? 'fill-current' : 'text-neutral-300'
                          }`}
                        />
                      ))}
                    </div>
                    <span>
                      ({reviewStats.averageRating.toFixed(1)} • {reviewStats.totalReviews}{' '}
                      {reviewStats.totalReviews === 1 ? 'review' : 'reviews'})
                    </span>
                  </div>
                ) : (
                  <span className="text-[11px] text-muted font-medium">
                    Verified Direct Sourcing • No reviews yet
                  </span>
                )}
              </div>

              {/* Title & Tagline */}
              <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold text-primary tracking-tight">
                {product.title}
              </h1>

              {product.tagline && (
                <p className="text-xs sm:text-sm text-muted mt-2 font-medium">
                  {product.tagline}
                </p>
              )}

              {/* Price Row */}
              <div className="mt-4 flex items-baseline gap-3">
                <span className="font-display text-3xl font-extrabold text-primary">
                  {formatPaiseToRupees(selectedVariant.priceInPaise)}
                </span>

                {selectedVariant.compareAtPriceInPaise &&
                  selectedVariant.compareAtPriceInPaise > selectedVariant.priceInPaise && (
                    <span className="text-sm text-muted line-through">
                      {formatPaiseToRupees(selectedVariant.compareAtPriceInPaise)}
                    </span>
                  )}

                <span className="text-[11px] text-muted font-normal">
                  (Inclusive of all taxes)
                </span>
              </div>

              {/* Stock Status Badge */}
              <div className="mt-3 flex items-center gap-2 text-xs">
                {selectedVariant.stockQuantity > selectedVariant.lowStockThreshold ? (
                  <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    <Check className="w-3.5 h-3.5" />
                    In Stock ({selectedVariant.stockQuantity} units available)
                  </span>
                ) : selectedVariant.stockQuantity > 0 ? (
                  <span className="inline-flex items-center gap-1.5 text-amber-700 font-semibold bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                    Only {selectedVariant.stockQuantity} left in stock - order soon
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-rose-700 font-semibold bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                    Temporarily Out of Stock
                  </span>
                )}
                <span className="text-muted font-mono text-[11px]">
                  SKU: {selectedVariant.sku}
                </span>
              </div>

              {/* Variant Selector Pills */}
              <div className="mt-6 space-y-2.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Select Pack Size / Option:
                </label>
                <div className="flex flex-wrap gap-2.5">
                  {product.variants.map((v) => {
                    const isSelected = v.id === selectedVariantId;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => {
                          setSelectedVariantId(v.id);
                          setQuantity(1);
                        }}
                        className={`px-4 py-2.5 rounded-xl text-xs font-medium border transition-all text-left ${
                          isSelected
                            ? 'bg-primary text-white border-primary shadow-sm ring-2 ring-primary/20'
                            : 'bg-surface text-primary border-border hover:border-primary/50'
                        }`}
                      >
                        <span className="font-bold">{v.title}</span>
                        <span className={`block text-[11px] ${isSelected ? 'text-surface/80' : 'text-muted'}`}>
                          {formatPaiseToRupees(v.priceInPaise)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quantity Stepper & Action Buttons */}
              <div className="mt-8 space-y-4">
                <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                  <div className="inline-flex items-center border border-border rounded-xl bg-surface-dim p-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="p-2 text-primary hover:bg-border/60 rounded-lg transition-colors"
                      disabled={quantity <= 1}
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-10 text-center font-bold text-sm text-primary">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setQuantity((q) => Math.min(selectedVariant.stockQuantity, q + 1))
                      }
                      className="p-2 text-primary hover:bg-border/60 rounded-lg transition-colors"
                      disabled={quantity >= selectedVariant.stockQuantity}
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Add to Bag CTA */}
                  <button
                    type="button"
                    onClick={handleAddToCart}
                    disabled={selectedVariant.stockQuantity <= 0}
                    className="flex-1 min-w-[130px] sm:min-w-[145px] flex items-center justify-center gap-2 py-3.5 px-4 sm:px-6 bg-accent hover:bg-accent-hover text-white text-xs sm:text-sm font-bold uppercase tracking-wider rounded-xl shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ShoppingBag className="w-4 h-4 shrink-0" />
                    <span>Add to Bag</span>
                  </button>

                  {/* Buy Now CTA */}
                  <button
                    type="button"
                    onClick={handleBuyNow}
                    disabled={selectedVariant.stockQuantity <= 0}
                    className="flex-1 min-w-[125px] sm:min-w-[140px] flex items-center justify-center gap-2 py-3.5 px-4 sm:px-6 bg-primary hover:bg-primary-hover text-white text-xs sm:text-sm font-bold uppercase tracking-wider rounded-xl shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Zap className="w-4 h-4 shrink-0" />
                    <span>Buy Now</span>
                  </button>

                  {/* Wishlist Toggle CTA */}
                  <button
                    type="button"
                    onClick={(e) => toggleWishlist(product.id, e)}
                    className={`py-3.5 px-4 rounded-xl border transition-all flex items-center justify-center shrink-0 shadow-sm ${
                      isWishlisted
                        ? 'bg-rose-50 border-rose-300 text-rose-600'
                        : 'bg-surface-dim hover:bg-surface border-border text-primary hover:text-rose-600'
                    }`}
                    aria-label={isWishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
                    title={isWishlisted ? 'Saved in Wishlist' : 'Save to Wishlist'}
                  >
                    <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-current text-rose-600' : ''}`} />
                  </button>

                  {/* Share CTA (Amazon-style) */}
                  <ShareButton
                    title={product.title}
                    text={`Check out ${product.title} on InfiniCharm! Pure, authentic, and direct from regional harvesters.`}
                    imageUrl={images[0]?.externalUrl}
                    subtitle={formatPaiseToRupees(selectedVariant.priceInPaise)}
                    variant="button"
                  />
                </div>

                {/* Shipping & Delivery Guarantee Bar (Dynamic from Server Store / Admin Settings) */}
                {badges.filter((b) => b.isEnabled).length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
                    {badges
                      .filter((b) => b.isEnabled)
                      .sort((a, b) => a.displayOrder - b.displayOrder)
                      .map((badge) => {
                        let displayTitle = badge.title;
                        if (badge.icon === 'Truck' && product.customShippingText) {
                          displayTitle = product.customShippingText;
                        } else if (badge.icon === 'RotateCcw' && product.customGuaranteeText) {
                          displayTitle = product.customGuaranteeText;
                        }

                        const innerContent = (
                          <>
                            {renderBadgeIcon(badge.icon)}
                            <span className="truncate">{displayTitle}</span>
                          </>
                        );

                        if (badge.linkUrl) {
                          return (
                            <Link
                              key={badge.id}
                              href={badge.linkUrl}
                              className="flex items-center gap-2.5 p-3 rounded-xl bg-surface-dim hover:bg-surface border border-transparent hover:border-border text-xs text-muted hover:text-primary transition-all shadow-xs"
                            >
                              {innerContent}
                            </Link>
                          );
                        }

                        return (
                          <div
                            key={badge.id}
                            className="flex items-center gap-2.5 p-3 rounded-xl bg-surface-dim text-xs text-muted"
                          >
                            {innerContent}
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tabbed Specification & Reviews Section */}
        <div className="mt-12 bg-surface rounded-3xl border border-border overflow-hidden shadow-sm">
          {/* Tab Navigation */}
          <div className="flex border-b border-border bg-surface-dim/40 px-6 sm:px-8">
            <button
              onClick={() => setActiveTab('details')}
              className={`py-4 px-4 text-xs sm:text-sm font-bold border-b-2 transition-all ${
                activeTab === 'details'
                  ? 'border-accent text-accent'
                  : 'border-transparent text-muted hover:text-primary'
              }`}
            >
              Description & Sourcing
            </button>
            <button
              onClick={() => setActiveTab('specs')}
              className={`py-4 px-4 text-xs sm:text-sm font-bold border-b-2 transition-all ${
                activeTab === 'specs'
                  ? 'border-accent text-accent'
                  : 'border-transparent text-muted hover:text-primary'
              }`}
            >
              Product Specifications & Compliance
            </button>
            <button
              onClick={() => setActiveTab('reviews')}
              className={`py-4 px-4 text-xs sm:text-sm font-bold border-b-2 transition-all ${
                activeTab === 'reviews'
                  ? 'border-accent text-accent'
                  : 'border-transparent text-muted hover:text-primary'
              }`}
            >
              Customer Reviews ({reviews.length})
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-6 sm:p-8 lg:p-10">
            {activeTab === 'details' && (
              <div className="prose prose-sm max-w-none text-muted space-y-4">
                <div className="whitespace-pre-line text-xs sm:text-sm leading-relaxed text-primary/90">
                  {product.fullDescription || product.shortDescription}
                </div>
              </div>
            )}

            {activeTab === 'specs' && (
              <div className="max-w-2xl">
                <table className="w-full text-xs text-left">
                  <tbody className="divide-y divide-border">
                    <tr className="py-2.5">
                      <th className="py-3 font-semibold text-primary w-1/3">Brand</th>
                      <td className="py-3 text-muted">{product.brand}</td>
                    </tr>
                    <tr className="py-2.5">
                      <th className="py-3 font-semibold text-primary">Country of Origin</th>
                      <td className="py-3 text-muted">{product.originCountry}</td>
                    </tr>
                    <tr className="py-2.5">
                      <th className="py-3 font-semibold text-primary">Region of Sourcing</th>
                      <td className="py-3 text-muted">{product.originRegion || 'East Champaran, Bihar'}</td>
                    </tr>
                    {product.ingredients && (
                      <tr className="py-2.5">
                        <th className="py-3 font-semibold text-primary">Ingredients</th>
                        <td className="py-3 text-muted">{product.ingredients}</td>
                      </tr>
                    )}
                    {product.storageInstructions && (
                      <tr className="py-2.5">
                        <th className="py-3 font-semibold text-primary">Storage Instructions</th>
                        <td className="py-3 text-muted">{product.storageInstructions}</td>
                      </tr>
                    )}
                    {product.fssaiLicenseNumber && (
                      <tr className="py-2.5">
                        <th className="py-3 font-semibold text-primary">FSSAI License</th>
                        <td className="py-3 text-muted">{product.fssaiLicenseNumber}</td>
                      </tr>
                    )}
                    {product.returnPolicyText && (
                      <tr className="py-2.5">
                        <th className="py-3 font-semibold text-primary">Return & Replacement</th>
                        <td className="py-3 text-muted">{product.returnPolicyText}</td>
                      </tr>
                    )}
                    {product.specifications &&
                      product.specifications.length > 0 &&
                      product.specifications.map((spec, idx) => (
                        <tr key={idx} className="py-2.5">
                          <th className="py-3 font-semibold text-primary">{spec.label}</th>
                          <td className="py-3 text-muted">{spec.value}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="space-y-8">
                {/* Notification toast if any */}
                {submitSuccessMessage && (
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-semibold">{submitSuccessMessage}</span>
                  </div>
                )}

                {/* Reviews Header & Eligibility Bar */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border">
                  <div>
                    <h3 className="font-display text-xl font-bold text-primary">Customer Experiences</h3>
                    <p className="text-xs text-muted mt-0.5">
                      Verified purchasers of {product.title}
                    </p>
                  </div>

                  {/* Dynamic Call to Action based on Purchase Eligibility */}
                  <div className="flex items-center gap-3">
                    {!eligibility.authenticated ? (
                      <Link
                        href={`/login?redirect=/product/${product.slug}`}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl transition-all shadow-xs"
                      >
                        <LogIn className="w-3.5 h-3.5" />
                        <span>Sign In to Review</span>
                      </Link>
                    ) : !eligibility.eligible ? (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-3.5 py-2 rounded-xl">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>Purchase Required to Review</span>
                        </span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setSubmitError(null);
                          setShowReviewModal(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-accent hover:bg-accent/90 text-white text-xs font-bold rounded-xl transition-all shadow-xs"
                      >
                        <Star className="w-3.5 h-3.5 fill-current" />
                        <span>{eligibility.existingReview ? 'Edit Your Review' : 'Write a Review'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Purchase Verification Eligibility Notice */}
                {eligibility.authenticated && !eligibility.eligible && (
                  <div className="p-4 rounded-2xl bg-surface-dim border border-border text-xs flex items-start gap-3">
                    <ShieldCheck className="w-5 h-5 text-muted shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-semibold text-primary">Verified Purchase Requirement</p>
                      <p className="text-muted text-[11px] leading-relaxed">
                        To maintain 100% genuine reviews with zero fabricated ratings, only customers who have purchased and received this product can submit a review. We could not find a qualifying delivered order for this harvest in your account.
                      </p>
                    </div>
                  </div>
                )}

                {eligibility.authenticated && eligibility.eligible && (
                  <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="font-semibold text-emerald-900">
                        Verified Purchaser • Order #{eligibility.orderNumber}
                      </span>
                    </div>
                    {eligibility.existingReview && (
                      <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-700 bg-white/80 px-2.5 py-0.5 rounded-full border border-emerald-300">
                        {eligibility.existingReview.status === 'APPROVED' ? 'Published' : 'Pending Moderation'}
                      </span>
                    )}
                  </div>
                )}

                {/* Reviews List */}
                {reviews.length === 0 ? (
                  <div className="py-12 text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-accent/10 text-accent flex items-center justify-center mx-auto">
                      <Star className="w-6 h-6" />
                    </div>
                    <h4 className="font-display font-bold text-base text-primary">No Customer Reviews Yet</h4>
                    <p className="text-xs text-muted max-w-sm mx-auto leading-relaxed">
                      Be the first verified customer to share your thoughts and experiences with this authentic harvest.
                    </p>
                    <div className="pt-2">
                      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full font-medium">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>100% Authentic • Zero Synthetic Adulteration</span>
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {reviews.map((rev) => (
                      <div key={rev.id} className="py-5 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-primary">{rev.name}</span>
                            {rev.verified && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold border border-emerald-200">
                                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                <span>Verified Buyer</span>
                                {rev.orderNumber && (
                                  <span className="text-[9px] text-emerald-600 font-mono">
                                    #{rev.orderNumber}
                                  </span>
                                )}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-muted">{rev.date}</span>
                        </div>

                        <div className="flex items-center gap-1 text-amber-500">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`w-3.5 h-3.5 ${
                                i < rev.rating
                                  ? 'fill-current text-amber-500'
                                  : 'text-border fill-border'
                              }`}
                            />
                          ))}
                          <span className="text-xs font-bold text-primary ml-1">
                            {rev.rating}.0
                          </span>
                        </div>

                        {rev.title && (
                          <h5 className="font-bold text-xs sm:text-sm text-primary pt-0.5">
                            {rev.title}
                          </h5>
                        )}

                        <p className="text-xs sm:text-sm text-muted leading-relaxed whitespace-pre-line">
                          {rev.comment}
                        </p>

                        {/* Official Brand Response */}
                        {rev.adminReply && (
                          <div className="mt-3 p-3.5 rounded-2xl bg-surface-dim border border-border text-xs flex items-start gap-2.5">
                            <CornerDownRight className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                            <div className="flex-1 space-y-0.5">
                              <div className="flex items-center justify-between">
                                <strong className="block text-primary font-bold">
                                  Official Response from InfiniCharm:
                                </strong>
                                {rev.adminReplyAt && (
                                  <span className="text-[10px] text-muted">
                                    {new Date(rev.adminReplyAt).toLocaleDateString('en-IN')}
                                  </span>
                                )}
                              </div>
                              <p className="text-muted text-[11px] leading-relaxed">
                                {rev.adminReply}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Customer Own Review Actions */}
                        {eligibility.authenticated &&
                          rev.customerId === eligibility.customer?.id && (
                            <div className="flex items-center gap-3 pt-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setNewReviewRating(rev.rating);
                                  setNewReviewTitle(rev.title || '');
                                  setNewReviewComment(rev.comment);
                                  setSubmitError(null);
                                  setShowReviewModal(true);
                                }}
                                className="text-[11px] font-semibold text-accent hover:underline flex items-center gap-1"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>Edit Review</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteOwnReview(rev.id)}
                                className="text-[11px] font-semibold text-rose-600 hover:underline flex items-center gap-1"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Delete Review</span>
                              </button>
                            </div>
                          )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Related Products Section (Admin Managed) */}
        {relatedProducts.length > 0 && (
          <div className="mt-14 space-y-6">
            <div className="flex items-end justify-between border-b border-border pb-4">
              <div>
                <h2 className="font-display text-2xl font-bold text-primary tracking-tight">
                  You May Also Appreciate
                </h2>
                <p className="text-xs text-muted mt-1">
                  Curated authentic selections from our direct-origin pantry
                </p>
              </div>
              <Link
                href="/shop"
                className="text-xs font-bold text-accent hover:underline flex items-center gap-1"
              >
                <span>View Full Catalogue</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {relatedProducts.map((relProduct) => (
                <ProductCard key={relProduct.id} product={relProduct} />
              ))}
            </div>
          </div>
        )}

        {/* Review Modal */}
        {showReviewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-sm">
            <div className="bg-surface rounded-3xl border border-border p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-4 animate-scale-up">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <h3 className="font-display text-lg font-bold text-primary">
                    {eligibility.existingReview ? 'Update Your Experience' : 'Share Your Experience'}
                  </h3>
                  <p className="text-xs text-muted mt-0.5">
                    Verified purchaser review for {product.title}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowReviewModal(false)}
                  className="p-1.5 text-muted hover:text-primary rounded-xl"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {submitError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              <form onSubmit={handleAddReviewSubmit} className="space-y-4 text-xs">
                {/* Verified Purchase Info */}
                <div className="p-3 rounded-2xl bg-surface-dim border border-border flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5 text-emerald-800 font-bold">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Verified Purchase</span>
                  </div>
                  {eligibility.orderNumber && (
                    <span className="font-mono text-muted">Order #{eligibility.orderNumber}</span>
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-primary mb-1.5">
                    Your Rating (1 to 5 Stars) *
                  </label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setNewReviewRating(star)}
                        className={`p-2 rounded-xl border transition-all ${
                          newReviewRating >= star
                            ? 'text-amber-500 border-amber-300 bg-amber-50 scale-105'
                            : 'text-muted border-border hover:border-amber-200'
                        }`}
                        title={`${star} Star${star > 1 ? 's' : ''}`}
                      >
                        <Star className="w-5 h-5 fill-current" />
                      </button>
                    ))}
                    <span className="text-xs font-bold text-primary ml-2">
                      {newReviewRating === 5
                        ? '5 - Excellent'
                        : newReviewRating === 4
                        ? '4 - Very Good'
                        : newReviewRating === 3
                        ? '3 - Good'
                        : newReviewRating === 2
                        ? '2 - Fair'
                        : '1 - Poor'}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-primary mb-1">
                    Review Headline (Optional)
                  </label>
                  <input
                    type="text"
                    value={newReviewTitle}
                    onChange={(e) => setNewReviewTitle(e.target.value)}
                    placeholder="e.g. Pure wild raw honey with incredible aroma"
                    className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent text-xs"
                    maxLength={100}
                  />
                </div>

                <div>
                  <label className="block font-semibold text-primary mb-1">
                    Your Detailed Review (Minimum 10 Characters) *
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={newReviewComment}
                    onChange={(e) => setNewReviewComment(e.target.value)}
                    placeholder="Describe the aroma, taste, purity, and texture of this harvest..."
                    className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent text-xs leading-relaxed"
                  />
                  <span className="text-[10px] text-muted block mt-1">
                    {newReviewComment.length} / 10 minimum characters
                  </span>
                </div>

                <div className="flex justify-end gap-2.5 pt-2 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setShowReviewModal(false)}
                    className="px-4 py-2 bg-surface-dim hover:bg-border text-primary rounded-xl font-semibold text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingReview}
                    className="px-5 py-2 bg-accent hover:bg-accent/90 text-white font-bold rounded-xl text-xs shadow-xs flex items-center gap-1.5"
                  >
                    {isSubmittingReview ? 'Submitting...' : eligibility.existingReview ? 'Update Review' : 'Submit Review'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </Container>
    </div>
  );
}

