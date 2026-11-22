'use client';

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { CartItem, Product, ProductVariant, Coupon } from '@/types';
import { validateCouponWithServer } from '@/lib/data/coupons';
import { getPlatformSettings } from '@/lib/services/settings';

const CART_STORAGE_KEY = 'infinicharm_cart_v1';
const APPLIED_COUPON_KEY = 'infinicharm_applied_coupon_code_v1';

interface ApplyCouponOptions {
  customerEmail?: string;
  customerPhone?: string;
}

interface CartContextType {
  items: CartItem[];
  isDrawerOpen: boolean;
  appliedCoupon: Coupon | null;
  isApplyingCoupon: boolean;
  couponInvalidationMessage: string | null;
  subtotalInPaise: number;
  discountInPaise: number;
  shippingInPaise: number;
  totalInPaise: number;
  totalItemsCount: number;
  freeShippingThresholdPaise: number;
  amountNeededForFreeShippingPaise: number;
  addItem: (product: Product, variant: ProductVariant, quantity?: number, openDrawer?: boolean) => void;
  removeItem: (variantId: string) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  clearCart: () => void;
  applyCoupon: (
    code: string,
    options?: ApplyCouponOptions
  ) => Promise<{ success: boolean; message: string; discountInPaise?: number }>;
  removeCoupon: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [discountInPaise, setDiscountInPaise] = useState<number>(0);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [couponInvalidationMessage, setCouponInvalidationMessage] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [lastCouponOptions, setLastCouponOptions] = useState<ApplyCouponOptions | undefined>(undefined);

  const getStoredCustomerContact = useCallback(() => {
    if (typeof window === 'undefined') return { email: undefined, phone: undefined };
    try {
      const raw = localStorage.getItem('infinicharm_customer_user');
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          email: parsed?.email ? String(parsed.email).trim() : undefined,
          phone: parsed?.phone ? String(parsed.phone).trim() : undefined,
        };
      }
    } catch {}
    return { email: undefined, phone: undefined };
  }, []);

  const mapItemsForCouponApi = useCallback((cartItems: CartItem[]) => {
    return cartItems.map((item) => ({
      productId: item.product.id,
      variantId: item.variantId,
      categoryId: item.product.categoryId,
      priceInPaise: item.variant.priceInPaise,
      quantity: item.quantity,
    }));
  }, []);

  // Load cart and persisted coupon code on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setItems(parsed);
          const savedCode = sessionStorage.getItem(APPLIED_COUPON_KEY);
          if (savedCode && parsed.length > 0) {
            const sub = parsed.reduce(
              (acc: number, i: CartItem) => acc + i.variant.priceInPaise * i.quantity,
              0
            );
            const contact = getStoredCustomerContact();
            validateCouponWithServer({
              code: savedCode,
              items: mapItemsForCouponApi(parsed),
              subtotalInPaise: sub,
              customerEmail: contact.email,
              customerPhone: contact.phone,
            }).then((res) => {
              if (res.valid && res.coupon) {
                setAppliedCoupon(res.coupon);
                setDiscountInPaise(res.discountInPaise);
                setCouponInvalidationMessage(null);
              } else {
                sessionStorage.removeItem(APPLIED_COUPON_KEY);
                setAppliedCoupon(null);
                setDiscountInPaise(0);
              }
            });
          }
        }
      }
    } catch {
      // Local storage unreadable or disabled
    } finally {
      setIsInitialized(true);
    }
  }, [mapItemsForCouponApi]);

  // Save cart to localStorage on update
  useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Ignore storage quota errors
    }
  }, [items, isInitialized]);

  // Derived financial computations in integer paise
  const { subtotalInPaise, totalItemsCount } = useMemo(() => {
    let subtotal = 0;
    let count = 0;
    for (const item of items) {
      subtotal += item.variant.priceInPaise * item.quantity;
      count += item.quantity;
    }
    return { subtotalInPaise: subtotal, totalItemsCount: count };
  }, [items]);

  // Re-validate applied coupon whenever cart items change
  useEffect(() => {
    if (!isInitialized || !appliedCoupon) return;
    if (items.length === 0) {
      setAppliedCoupon(null);
      setDiscountInPaise(0);
      sessionStorage.removeItem(APPLIED_COUPON_KEY);
      return;
    }

    let cancelled = false;
    const contact = getStoredCustomerContact();
    const effectiveEmail = lastCouponOptions?.customerEmail || contact.email;
    const effectivePhone = lastCouponOptions?.customerPhone || contact.phone;

    validateCouponWithServer({
      code: appliedCoupon.code,
      items: mapItemsForCouponApi(items),
      subtotalInPaise,
      customerEmail: effectiveEmail,
      customerPhone: effectivePhone,
    }).then((res) => {
      if (cancelled) return;
      if (res.valid && res.coupon) {
        setAppliedCoupon(res.coupon);
        setDiscountInPaise(res.discountInPaise);
        setCouponInvalidationMessage(null);
      } else {
        setAppliedCoupon(null);
        setDiscountInPaise(0);
        sessionStorage.removeItem(APPLIED_COUPON_KEY);
        setCouponInvalidationMessage(res.message);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [items, subtotalInPaise, isInitialized, appliedCoupon?.code, mapItemsForCouponApi]);

  const [shippingConfig, setShippingConfig] = useState<{
    freeShippingThresholdPaise: number;
    standardShippingFeePaise: number;
  }>(() => {
    const ps = getPlatformSettings();
    return {
      freeShippingThresholdPaise: ps.freeShippingThresholdPaise || 499900,
      standardShippingFeePaise: ps.standardShippingFeePaise || 6000,
    };
  });

  useEffect(() => {
    const fetchShippingSettings = async () => {
      try {
        const res = await fetch('/api/settings/shipping', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.settings) {
            setShippingConfig({
              freeShippingThresholdPaise:
                data.settings.freeShippingThresholdPaise || 499900,
              standardShippingFeePaise:
                data.settings.standardShippingFeePaise || 6000,
            });
          }
        }
      } catch {
        // preserve current config
      }
    };

    fetchShippingSettings();

    const handleShippingUpdate = () => {
      const ps = getPlatformSettings();
      setShippingConfig({
        freeShippingThresholdPaise: ps.freeShippingThresholdPaise || 499900,
        standardShippingFeePaise: ps.standardShippingFeePaise || 6000,
      });
      fetchShippingSettings();
    };

    window.addEventListener('infinicharm_shipping_settings_updated', handleShippingUpdate);
    window.addEventListener('storage', handleShippingUpdate);
    return () => {
      window.removeEventListener('infinicharm_shipping_settings_updated', handleShippingUpdate);
      window.removeEventListener('storage', handleShippingUpdate);
    };
  }, []);

  const freeShippingThresholdPaise = shippingConfig.freeShippingThresholdPaise;
  const standardShippingFeePaise = shippingConfig.standardShippingFeePaise;

  const shippingInPaise = useMemo(() => {
    if (subtotalInPaise === 0) return 0;
    if (subtotalInPaise >= freeShippingThresholdPaise) return 0;
    return standardShippingFeePaise;
  }, [subtotalInPaise, freeShippingThresholdPaise, standardShippingFeePaise]);

  const totalInPaise = useMemo(() => {
    return Math.max(0, subtotalInPaise - discountInPaise + shippingInPaise);
  }, [subtotalInPaise, discountInPaise, shippingInPaise]);

  const amountNeededForFreeShippingPaise = useMemo(() => {
    if (subtotalInPaise >= freeShippingThresholdPaise) return 0;
    return freeShippingThresholdPaise - subtotalInPaise;
  }, [subtotalInPaise, freeShippingThresholdPaise]);

  const addItem = (product: Product, variant: ProductVariant, quantity = 1, openDrawer = true) => {
    setItems((prevItems) => {
      const existingIndex = prevItems.findIndex((item) => item.variantId === variant.id);
      if (existingIndex > -1) {
        const updated = [...prevItems];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + quantity,
        };
        return updated;
      }
      return [
        ...prevItems,
        {
          id: `cart-${variant.id}-${Date.now()}`,
          variantId: variant.id,
          product,
          variant,
          quantity,
        },
      ];
    });
    if (openDrawer) {
      setIsDrawerOpen(true);
    }
  };

  const removeItem = (variantId: string) => {
    setItems((prev) => prev.filter((item) => item.variantId !== variantId));
  };

  const updateQuantity = (variantId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(variantId);
      return;
    }
    setItems((prev) =>
      prev.map((item) => (item.variantId === variantId ? { ...item, quantity } : item))
    );
  };

  const clearCart = () => {
    setItems([]);
    setAppliedCoupon(null);
    setDiscountInPaise(0);
    setCouponInvalidationMessage(null);
    try {
      sessionStorage.removeItem(APPLIED_COUPON_KEY);
    } catch {}
  };

  const applyCoupon = async (code: string, options?: ApplyCouponOptions) => {
    setIsApplyingCoupon(true);
    setCouponInvalidationMessage(null);
    try {
      const contact = getStoredCustomerContact();
      const effectiveEmail = options?.customerEmail || contact.email;
      const effectivePhone = options?.customerPhone || contact.phone;
      if (options) {
        setLastCouponOptions(options);
      }

      const result = await validateCouponWithServer({
        code,
        items: mapItemsForCouponApi(items),
        subtotalInPaise,
        customerEmail: effectiveEmail,
        customerPhone: effectivePhone,
      });

      if (result.valid && result.coupon) {
        setAppliedCoupon(result.coupon);
        setDiscountInPaise(result.discountInPaise);
        try {
          sessionStorage.setItem(APPLIED_COUPON_KEY, result.coupon.code);
        } catch {}
        return {
          success: true,
          message: result.message,
          discountInPaise: result.discountInPaise,
        };
      }

      return { success: false, message: result.message };
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setDiscountInPaise(0);
    setCouponInvalidationMessage(null);
    setLastCouponOptions(undefined);
    try {
      sessionStorage.removeItem(APPLIED_COUPON_KEY);
    } catch {}
  };

  const openDrawer = () => setIsDrawerOpen(true);
  const closeDrawer = () => setIsDrawerOpen(false);
  const toggleDrawer = () => setIsDrawerOpen((prev) => !prev);

  return (
    <CartContext.Provider
      value={{
        items,
        isDrawerOpen,
        appliedCoupon,
        isApplyingCoupon,
        couponInvalidationMessage,
        subtotalInPaise,
        discountInPaise,
        shippingInPaise,
        totalInPaise,
        totalItemsCount,
        freeShippingThresholdPaise,
        amountNeededForFreeShippingPaise,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        applyCoupon,
        removeCoupon,
        openDrawer,
        closeDrawer,
        toggleDrawer,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
