'use client';

// ==============================================================================
// InfiniCharm — Customer Account Saved Wishlist Suite
// Standards: 100% Real Customer Data, Real Time Sync, Zero Mock Fallbacks
// ==============================================================================

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { formatPaiseToRupees } from '@/lib/utils/currency';
import { useCart } from '@/lib/context/CartContext';
import { useWishlist } from '@/lib/context/WishlistContext';
import { Heart, ShoppingBag, Trash2, ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Product } from '@/types';

export default function AccountWishlistPage() {
  const { addItem } = useCart();
  const { wishlistProductIds, removeFromWishlist, isLoading: wishlistLoading } = useWishlist();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [cartSuccessId, setCartSuccessId] = useState<string | null>(null);

  useEffect(() => {
    async function loadPublishedProducts() {
      setIsLoadingProducts(true);
      try {
        const prodRes = await fetch('/api/products');
        if (prodRes.ok) {
          const pData = await prodRes.json();
          if (pData.success && Array.isArray(pData.products)) {
            // Strictly published and non-deleted products
            setProducts(pData.products.filter((p: Product) => p.status === 'PUBLISHED'));
          }
        }
      } catch (err) {
        console.error('Failed to load products for wishlist:', err);
      } finally {
        setIsLoadingProducts(false);
      }
    }

    loadPublishedProducts();
  }, []);

  const handleRemoveFromWishlist = async (id: string) => {
    await removeFromWishlist(id);
  };

  const handleMoveToCart = (product: Product) => {
    if (product.variants && product.variants[0]) {
      addItem(product, product.variants[0], 1);
      setCartSuccessId(product.id);
      setTimeout(() => setCartSuccessId(null), 2500);
    }
  };

  // Only display valid, existing, published products currently in wishlist
  const wishlistProducts = products.filter((p) => wishlistProductIds.includes(p.id));
  const isLoading = wishlistLoading || isLoadingProducts;

  return (
    <div className="py-10 bg-surface-dim/40 min-h-screen">
      <Container className="max-w-4xl">
        <Link
          href="/account"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-primary transition-colors mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Account Overview</span>
        </Link>

        <div className="bg-surface rounded-3xl border border-border p-6 sm:p-8 shadow-sm mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-primary">Saved Wishlist</h1>
            <p className="text-xs text-muted mt-1">
              Your favorite Kashmiri Honey, Zamzam Water, Takmeeli Talbeena, and Premium Dates saved for later.
            </p>
          </div>
          <span className="text-xs bg-surface-dim border border-border px-3.5 py-1.5 rounded-xl font-bold text-primary">
            {wishlistProducts.length} {wishlistProducts.length === 1 ? 'Item' : 'Items'}
          </span>
        </div>

        {wishlistProducts.length === 0 ? (
          <div className="bg-surface rounded-3xl border border-border p-12 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-surface-dim mx-auto flex items-center justify-center text-muted">
              <Heart className="w-8 h-8" />
            </div>
            <h3 className="font-display text-lg font-bold text-primary">
              {isLoading ? 'Loading your saved items...' : 'Your Wishlist is Empty'}
            </h3>
            <p className="text-xs text-muted max-w-sm mx-auto">
              Save 100% Kashmiri Honey, Zamzam Water, Takmeeli Talbeena, and Premium Dates to review anytime.
            </p>
            <Link
              href="/shop"
              className="inline-flex px-6 py-3 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl uppercase tracking-wider transition-colors"
            >
              Explore Products
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {wishlistProducts.map((product) => {
              const defaultVariant = product.variants?.[0];
              const price = defaultVariant ? defaultVariant.priceInPaise : 0;
              const compareAt = defaultVariant?.compareAtPriceInPaise;

              return (
                <div
                  key={product.id}
                  className="bg-surface rounded-3xl border border-border overflow-hidden shadow-sm flex flex-col justify-between group"
                >
                  <div>
                    {/* Image */}
                    <div className="relative aspect-video w-full bg-surface-dim overflow-hidden border-b border-border">
                      {product.media?.[0]?.externalUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={product.media[0].externalUrl}
                          alt={product.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : null}
                      <button
                        onClick={() => handleRemoveFromWishlist(product.id)}
                        className="absolute top-3 right-3 p-2 rounded-full bg-white/90 text-rose-600 hover:bg-white transition-colors shadow-sm"
                        aria-label="Remove from wishlist"
                        title="Remove from wishlist"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Details */}
                    <div className="p-5 space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-accent bg-accent/10 px-2 py-0.5 rounded-full">
                        {product.categoryId?.replace('cat-', '').replace(/-/g, ' ')}
                      </span>
                      <h3 className="font-display text-base font-bold text-primary line-clamp-1 group-hover:text-accent transition-colors">
                        <Link href={`/product/${product.slug}`}>{product.title}</Link>
                      </h3>
                      <p className="text-xs text-muted line-clamp-2">{product.shortDescription}</p>
                    </div>
                  </div>

                  {/* Actions & Price */}
                  <div className="p-5 pt-0">
                    <div className="pt-3 border-t border-border flex items-center justify-between gap-4">
                      <div>
                        <span className="font-display text-lg font-bold text-primary">
                          {formatPaiseToRupees(price)}
                        </span>
                        {compareAt && compareAt > price && (
                          <span className="text-xs text-muted line-through ml-2">
                            {formatPaiseToRupees(compareAt)}
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => handleMoveToCart(product)}
                        className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
                      >
                        {cartSuccessId === product.id ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Added to Bag</span>
                          </>
                        ) : (
                          <>
                            <ShoppingBag className="w-3.5 h-3.5" />
                            <span>Move to Bag</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Container>
    </div>
  );
}
