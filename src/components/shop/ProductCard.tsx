'use client';

import React from 'react';
import Link from 'next/link';
import { Product } from '@/types';
import { formatPaiseToRupees } from '@/lib/utils/currency';
import { useCart } from '@/lib/context/CartContext';
import { useWishlist } from '@/lib/context/WishlistContext';
import { ShoppingBag, Star, Check, Heart, ShieldCheck } from 'lucide-react';
import { CATEGORIES } from '@/lib/constants/categories';
import { ExternalImage } from '@/components/media';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const { addItem } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const defaultVariant = product.variants[0];
  const category = CATEGORIES.find((c) => c.id === product.categoryId);
  const isWishlisted = isInWishlist(product.id);

  const discountPercent =
    defaultVariant?.compareAtPriceInPaise &&
    defaultVariant.compareAtPriceInPaise > defaultVariant.priceInPaise
      ? Math.round(
          ((defaultVariant.compareAtPriceInPaise - defaultVariant.priceInPaise) /
            defaultVariant.compareAtPriceInPaise) *
            100
        )
      : 0;

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (defaultVariant) {
      addItem(product, defaultVariant, 1);
    }
  };

  return (
    <div className="group bg-surface rounded-3xl border border-border overflow-hidden shadow-sm hover:shadow-md hover:border-accent/40 transition-all flex flex-col justify-between">
      <div>
        {/* Product Image Container */}
        <div className="relative aspect-square w-full bg-surface-dim overflow-hidden">
          <Link href={`/product/${product.slug}`} className="block w-full h-full">
            <ExternalImage
              src={product.media?.[0]?.externalUrl}
              alt={product.title}
              aspectRatio="square"
              className="w-full h-full group-hover:scale-105 transition-transform duration-500"
            />
          </Link>

          <div className="absolute top-3 left-3 flex flex-wrap gap-1 pointer-events-none max-w-[70%] z-10">
            {discountPercent > 0 && (
              <span className="bg-accent text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                Save {discountPercent}%
              </span>
            )}

            {product.customBadge ? (
              <span className="bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                {product.customBadge}
              </span>
            ) : product.isNewArrival ? (
              <span className="bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                New
              </span>
            ) : null}
          </div>

          {/* Quick Wishlist Toggle Button */}
          <button
            type="button"
            onClick={(e) => toggleWishlist(product.id, e)}
            className={`absolute top-3 right-3 p-2 rounded-full backdrop-blur-md transition-all shadow-sm z-10 ${
              isWishlisted
                ? 'bg-white text-rose-600 hover:bg-rose-50 shadow-md scale-105'
                : 'bg-white/80 text-muted hover:text-rose-600 hover:bg-white'
            }`}
            aria-label={isWishlisted ? `Remove ${product.title} from wishlist` : `Save ${product.title} to wishlist`}
            title={isWishlisted ? 'Saved in Wishlist' : 'Save to Wishlist'}
          >
            <Heart className={`w-3.5 h-3.5 ${isWishlisted ? 'fill-current text-rose-600' : ''}`} />
          </button>
        </div>

        {/* Product Details */}
        <div className="p-4 sm:p-5 space-y-2">
          {/* Category & Verified Purity Tag */}
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-accent uppercase tracking-wider">
              {category?.name || 'Essential'}
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              <span>Verified Pure</span>
            </span>
          </div>

          {/* Title */}
          <h3 className="font-display text-sm sm:text-base font-bold text-primary tracking-tight line-clamp-1 group-hover:text-accent transition-colors">
            <Link href={`/product/${product.slug}`}>{product.title}</Link>
          </h3>

          {/* Short description */}
          <p className="text-xs text-muted line-clamp-2 leading-relaxed">
            {product.shortDescription}
          </p>
        </div>
      </div>

      {/* Pricing & Quick Add CTA */}
      <div className="p-4 sm:p-5 pt-0">
        <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
          <div>
            <span className="text-[10px] text-muted block">From</span>
            <span className="font-display text-base font-extrabold text-primary">
              {defaultVariant ? formatPaiseToRupees(defaultVariant.priceInPaise) : '—'}
            </span>
          </div>

          <button
            type="button"
            onClick={handleQuickAdd}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-surface-dim hover:bg-accent text-primary hover:text-white text-xs font-bold rounded-xl transition-all border border-border hover:border-accent"
            aria-label={`Add ${product.title} to bag`}
          >
            <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
            <span>Add</span>
          </button>
        </div>
      </div>
    </div>
  );
}

