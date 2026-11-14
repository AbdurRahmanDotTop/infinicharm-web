'use client';

// ==============================================================================
// InfiniCharm — Global Wishlist Context & Customer Synchronization Engine
// Standards: 100% Real Data, Cross-Session Customer Sync, Optimistic UI
// ==============================================================================

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface WishlistContextType {
  wishlistProductIds: string[];
  wishlistCount: number;
  isLoading: boolean;
  isInWishlist: (productId: string) => boolean;
  toggleWishlist: (productId: string, e?: React.MouseEvent) => Promise<boolean>;
  addToWishlist: (productId: string) => Promise<void>;
  removeFromWishlist: (productId: string) => Promise<void>;
  refreshWishlist: () => Promise<void>;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'infinicharm_saved_wishlist';

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [wishlistProductIds, setWishlistProductIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Sync state to local storage and broadcast to other tabs/components
  const persistLocally = useCallback((ids: string[]) => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(ids));
      window.dispatchEvent(new CustomEvent('infinicharm_wishlist_updated', { detail: { ids } }));
    } catch {
      // ignore storage quotas
    }
  }, []);

  // Fetch authoritative customer wishlist from server
  const refreshWishlist = useCallback(async () => {
    try {
      // First check local storage for instantaneous initial display
      const localStr = typeof window !== 'undefined' ? localStorage.getItem(LOCAL_STORAGE_KEY) : null;
      let localIds: string[] = [];
      if (localStr) {
        try {
          const parsed = JSON.parse(localStr);
          if (Array.isArray(parsed)) localIds = parsed;
        } catch {}
      }

      // Check if user is authenticated via /api/customers/me only when session cookie exists
      const hasSessionCookie =
        typeof document !== 'undefined' && document.cookie.includes('infinicharm_customer_session=active');
      if (hasSessionCookie) {
        const res = await fetch('/api/customers/me');
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.customer) {
            const serverWishlist: string[] = Array.isArray(data.customer.wishlistProductIds)
              ? data.customer.wishlistProductIds
              : [];

            // Merge any locally saved items that might not have been pushed yet
            const merged = Array.from(new Set([...serverWishlist, ...localIds]));
            setWishlistProductIds(merged);
            persistLocally(merged);
            setIsLoading(false);
            return;
          }
        }
      }

      // If guest, use local items
      setWishlistProductIds(localIds);
    } catch (err) {
      console.warn('Wishlist sync warning:', err);
    } finally {
      setIsLoading(false);
    }
  }, [persistLocally]);

  useEffect(() => {
    refreshWishlist();

    // Listen for cross-tab or cross-component sync events
    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.ids && Array.isArray(customEvent.detail.ids)) {
        setWishlistProductIds(customEvent.detail.ids);
      } else {
        const localStr = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (localStr) {
          try {
            setWishlistProductIds(JSON.parse(localStr));
          } catch {}
        }
      }
    };

    const handleAuthEvent = () => {
      refreshWishlist();
    };

    window.addEventListener('infinicharm_wishlist_updated', handleUpdate);
    window.addEventListener('infinicharm_customer_login', handleAuthEvent);
    window.addEventListener('infinicharm_customer_logout', handleAuthEvent);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener('infinicharm_wishlist_updated', handleUpdate);
      window.removeEventListener('infinicharm_customer_login', handleAuthEvent);
      window.removeEventListener('infinicharm_customer_logout', handleAuthEvent);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [refreshWishlist]);

  const isInWishlist = useCallback(
    (productId: string) => {
      return wishlistProductIds.includes(productId);
    },
    [wishlistProductIds]
  );

  const toggleWishlist = useCallback(
    async (productId: string, e?: React.MouseEvent): Promise<boolean> => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }

      if (!productId) return false;

      const isCurrentlySaved = wishlistProductIds.includes(productId);
      const nextIds = isCurrentlySaved
        ? wishlistProductIds.filter((id) => id !== productId)
        : [...wishlistProductIds, productId];

      // Optimistic update
      setWishlistProductIds(nextIds);
      persistLocally(nextIds);

      // Persist to server if authenticated
      try {
        await fetch('/api/customers/me/wishlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId,
            action: isCurrentlySaved ? 'REMOVE' : 'ADD',
          }),
        });
      } catch (err) {
        console.warn('Failed to sync wishlist to server:', err);
      }

      return !isCurrentlySaved;
    },
    [wishlistProductIds, persistLocally]
  );

  const addToWishlist = useCallback(
    async (productId: string) => {
      if (!productId || wishlistProductIds.includes(productId)) return;
      const nextIds = [...wishlistProductIds, productId];
      setWishlistProductIds(nextIds);
      persistLocally(nextIds);
      try {
        await fetch('/api/customers/me/wishlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId, action: 'ADD' }),
        });
      } catch {}
    },
    [wishlistProductIds, persistLocally]
  );

  const removeFromWishlist = useCallback(
    async (productId: string) => {
      if (!productId) return;
      const nextIds = wishlistProductIds.filter((id) => id !== productId);
      setWishlistProductIds(nextIds);
      persistLocally(nextIds);
      try {
        await fetch('/api/customers/me/wishlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId, action: 'REMOVE' }),
        });
      } catch {}
    },
    [wishlistProductIds, persistLocally]
  );

  return (
    <WishlistContext.Provider
      value={{
        wishlistProductIds,
        wishlistCount: wishlistProductIds.length,
        isLoading,
        isInWishlist,
        toggleWishlist,
        addToWishlist,
        removeFromWishlist,
        refreshWishlist,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return context;
}

