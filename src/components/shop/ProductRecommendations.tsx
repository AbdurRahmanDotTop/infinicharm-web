'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Product } from '@/types';
import { useCart } from '@/lib/context/CartContext';
import { formatPaiseToRupees } from '@/lib/utils/currency';
import { getProductRecommendations, getProductDiscountInfo } from '@/lib/services/recommendations';
import { ExternalImage } from '@/components/media';
import { Plus, Check, Sparkles, ShoppingBag } from 'lucide-react';

interface ProductRecommendationsProps {
  title?: string;
  subtitle?: string;
  badgeText?: string;
  limit?: number;
  layout?: 'drawer' | 'sidebar' | 'grid';
  currentProductId?: string;
  catalog?: Product[];
  className?: string;
}

export function ProductRecommendations({
  title = 'Limited Time Offers',
  subtitle = 'Curated complements for your bag',
  badgeText = 'Up to 25% OFF',
  limit = 3,
  layout = 'drawer',
  currentProductId,
  catalog,
  className = '',
}: ProductRecommendationsProps) {
  const { items, addItem } = useCart();
  const [addedVariantId, setAddedVariantId] = useState<string | null>(null);

  // Dynamically compute recommendations based on current cart items and target product
  const recommendations = getProductRecommendations({
    cartItems: items,
    currentProductId,
    limit,
    catalog,
  });

  if (recommendations.length === 0) {
    return null;
  }

  const handleQuickAdd = (product: Product, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const defaultVariant = product.variants[0];
    if (!defaultVariant) return;

    // Do not open drawer if inside checkout sidebar or cart page
    const shouldOpenDrawer = layout === 'drawer';
    addItem(product, defaultVariant, 1, shouldOpenDrawer);
    setAddedVariantId(defaultVariant.id);
    setTimeout(() => {
      setAddedVariantId(null);
    }, 1500);
  };

  return (
    <div
      data-testid="product-recommendations-section"
      className={`rounded-2xl border border-border/80 bg-surface-dim/40 p-4 transition-all ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5 min-w-0">
          <Sparkles className="w-3.5 h-3.5 text-accent shrink-0" />
          <h4 className="font-display text-xs font-bold uppercase tracking-wider text-primary truncate">
            {title}
          </h4>
        </div>
        {badgeText && (
          <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-full shrink-0 border border-emerald-200">
            {badgeText}
          </span>
        )}
      </div>

      {subtitle && (
        <p className="text-[11px] text-muted mb-3 line-clamp-1 -mt-1">{subtitle}</p>
      )}

      {/* Product List */}
      <div
        className={
          layout === 'grid'
            ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'
            : 'space-y-2.5'
        }
      >
        {recommendations.map((product) => {
          const defaultVariant = product.variants[0];
          const discountInfo = getProductDiscountInfo(product);
          const isJustAdded = addedVariantId === defaultVariant?.id;

          return (
            <div
              key={product.id}
              data-testid={`recommended-item-${product.id}`}
              className="group flex items-center justify-between gap-3 p-2.5 rounded-xl bg-surface border border-border/60 hover:border-accent/40 hover:shadow-xs transition-all"
            >
              {/* Product Thumbnail & Details */}
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <Link
                  href={`/product/${product.slug}`}
                  className="w-12 h-12 rounded-lg bg-surface-dim border border-border/80 overflow-hidden shrink-0 relative block"
                  aria-label={product.title}
                >
                  {product.media?.[0]?.externalUrl ? (
                    <ExternalImage
                      src={product.media[0].externalUrl}
                      alt={product.title}
                      aspectRatio="square"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted">
                      <ShoppingBag className="w-5 h-5" />
                    </div>
                  )}
                </Link>

                <div className="min-w-0 flex-1">
                  <h5 className="text-xs font-semibold text-primary truncate group-hover:text-accent transition-colors">
                    <Link href={`/product/${product.slug}`}>{product.title}</Link>
                  </h5>
                  <p className="text-[10px] text-muted truncate">
                    {defaultVariant?.title || 'Standard Pack'}
                  </p>

                  <div className="flex items-baseline gap-1.5 mt-0.5 flex-wrap">
                    <span className="text-xs font-bold text-primary font-mono">
                      {formatPaiseToRupees(defaultVariant?.priceInPaise || 0)}
                    </span>
                    {discountInfo.hasDiscount && (
                      <>
                        <span className="text-[10px] text-muted line-through font-mono">
                          {discountInfo.compareAtPriceFormatted}
                        </span>
                        <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200/60">
                          {discountInfo.discountPercent}% OFF
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Add CTA */}
              <button
                type="button"
                data-testid={`quick-add-${product.id}`}
                onClick={(e) => handleQuickAdd(product, e)}
                disabled={isJustAdded || !defaultVariant || defaultVariant.stockQuantity <= 0}
                className={`inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg transition-all shrink-0 shadow-2xs ${
                  isJustAdded
                    ? 'bg-emerald-600 text-white'
                    : 'bg-primary hover:bg-neutral-800 text-white hover:shadow-xs active:scale-95'
                }`}
                aria-label={
                  isJustAdded ? `Added ${product.title}` : `Add ${product.title} to bag`
                }
              >
                {isJustAdded ? (
                  <>
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Added</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Add</span>
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
