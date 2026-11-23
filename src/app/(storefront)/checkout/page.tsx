'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import QRCode from 'qrcode';
import { useCart } from '@/lib/context/CartContext';
import { formatPaiseToRupees } from '@/lib/utils/currency';
import { lookupPinCode } from '@/lib/utils/pincode';
import { Container } from '@/components/ui/Container';
import {
  ShieldCheck,
  CreditCard,
  QrCode,
  Banknote,
  Building,
  CheckCircle2,
  Lock,
  ArrowRight,
  ShoppingBag,
  Truck,
  MapPin,
  AlertCircle,
  Tag,
  Copy,
  Check,
  Download,
  ExternalLink,
  Globe,
  Smartphone,
  Phone,
  Home,
  UserCheck,
  UserPlus,
  LogIn,
  Info,
} from 'lucide-react';
import { Order, PaymentMethod, CustomerAddress, AddressType, PaymentGatewayConfig, PublicAuthSettings } from '@/types';
import { getPaymentGateways, fetchPaymentGateways, recordPaymentTransaction } from '@/lib/services/gateways';
import { generateInitialOrderTimeline } from '@/lib/services/orders';
import { PasswordInput } from '@/components/auth/PasswordInput';
import { ProductRecommendations } from '@/components/shop/ProductRecommendations';
import { ResendVerificationBox } from '@/components/auth/ResendVerificationBox';
import { InlineOtpVerification } from '@/components/auth/InlineOtpVerification';
import { persistClientCustomerSession } from '@/lib/auth/client-session';
import { isValidEmail, validatePasswordAgainstPolicy } from '@/lib/validation/auth';
import {
  generateUpiPaymentDetails,
  generateCheckoutOrderNumber,
  parseUtrInput,
  DEFAULT_UPI_CREDENTIALS,
} from '@/lib/services/upi';

export default function CheckoutPage() {
  const router = useRouter();
  const {
    items,
    closeDrawer,
    subtotalInPaise,
    discountInPaise,
    shippingInPaise,
    totalInPaise,
    appliedCoupon,
    isApplyingCoupon,
    couponInvalidationMessage,
    applyCoupon,
    removeCoupon,
    clearCart,
  } = useCart();

  // Close cart drawer on checkout mount so sidebar order summary is unobstructed
  useEffect(() => {
    closeDrawer();
  }, [closeDrawer]);

  // Form states
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');

  // Customer Account & Address Book Integration
  const [customerId, setCustomerId] = useState<string>('guest');
  const [signedInEmail, setSignedInEmail] = useState<string>('');
  const [savedAddresses, setSavedAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [saveNewAddressToAccount, setSaveNewAddressToAccount] = useState<boolean>(true);
  const [addressType, setAddressType] = useState<AddressType>('HOME');
  const [addressLabel, setAddressLabel] = useState<string>('');
  const [makeDefaultShipping, setMakeDefaultShipping] = useState<boolean>(false);

  // Checkout Auth & WooCommerce-style Inline Login / Account Creation
  const [authPolicy, setAuthPolicy] = useState<PublicAuthSettings | null>(null);
  const [showInlineLogin, setShowInlineLogin] = useState(false);
  const [inlineLoginEmail, setInlineLoginEmail] = useState('');
  const [inlineLoginPassword, setInlineLoginPassword] = useState('');
  const [inlineLoginLoading, setInlineLoginLoading] = useState(false);
  const [inlineLoginError, setInlineLoginError] = useState<string | null>(null);
  const [inlineUnverifiedEmail, setInlineUnverifiedEmail] = useState<string | null>(null);
  const [inlineVerifiedNotice, setInlineVerifiedNotice] = useState<string | null>(null);
  const [createAccountDuringCheckout, setCreateAccountDuringCheckout] = useState(false);
  const [checkoutAccountPassword, setCheckoutAccountPassword] = useState('');
  const [checkoutAccountConfirmPassword, setCheckoutAccountConfirmPassword] = useState('');
  const [pendingCheckoutVerificationEmail, setPendingCheckoutVerificationEmail] = useState<string | null>(null);

  // Payment states
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CUSTOM_UPI');
  const [upiId, setUpiId] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [selectedBank, setSelectedBank] = useState('HDFC Bank');

  // Custom UPI Gateway States
  const [customUpiQrDataUrl, setCustomUpiQrDataUrl] = useState<string>('');
  const [customUpiUtr, setCustomUpiUtr] = useState<string>('');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [checkoutOrderNumber, setCheckoutOrderNumber] = useState<string>('');
  const [desktopUpiNotice, setDesktopUpiNotice] = useState<boolean>(false);
  const [remoteSyncNotice, setRemoteSyncNotice] = useState<string | null>(null);

  // Initialize or restore stable checkout order number (per-session only)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const existing = sessionStorage.getItem('infinicharm_checkout_order_id');
      if (existing && existing.startsWith('INF-')) {
        setCheckoutOrderNumber(existing);
        return;
      }
    } catch {}
    const newOrderNum = generateCheckoutOrderNumber();
    setCheckoutOrderNumber(newOrderNum);
    try {
      sessionStorage.setItem('infinicharm_checkout_order_id', newOrderNum);
      localStorage.removeItem('infinicharm_checkout_order_id');
    } catch {}
  }, []);

  // Real-Time Synchronization with Dedicated Payment Page (/pay) across tabs, windows, and devices
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const activeOrderNum = checkoutOrderNumber;
    if (!activeOrderNum) return;

    let isCompleted = false;

    const completeCheckoutFromRemote = (orderNum: string, utr?: string) => {
      if (isCompleted) return;
      isCompleted = true;
      if (utr) setCustomUpiUtr(utr);
      clearCart();
      try {
        sessionStorage.removeItem('infinicharm_checkout_order_id');
        localStorage.removeItem('infinicharm_checkout_order_id');
        localStorage.removeItem('infinicharm_checkout_draft');
      } catch {}
      setRemoteSyncNotice(
        `Order #${orderNum} placed & payment submitted via Payment Desk! Redirecting to confirmation...`
      );
      setTimeout(() => {
        router.push(`/checkout/success?order_id=${encodeURIComponent(orderNum)}`);
      }, 1200);
    };

    // 1. BroadcastChannel API for instant cross-tab sync in same browser
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel('infinicharm_checkout_sync');
      channel.onmessage = (event) => {
        const data = event.data;
        if (!data) return;
        if (
          data.type === 'ORDER_SUBMITTED_FROM_PAYMENT_PAGE' &&
          (data.orderNumber === activeOrderNum || data.orderId === activeOrderNum)
        ) {
          completeCheckoutFromRemote(data.orderNumber || activeOrderNum, data.utrNumber);
        }
      };
    } catch {}

    // 2. Storage event for cross-window / tab localStorage fallback
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === 'infinicharm_active_order_completed' && e.newValue) {
        try {
          const payload = JSON.parse(e.newValue);
          if (payload?.orderNumber === activeOrderNum || payload?.orderId === activeOrderNum) {
            completeCheckoutFromRemote(payload.orderNumber || activeOrderNum, payload.utrNumber);
          }
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorageEvent);

    // 3. Server-side polling for cross-device synchronization (e.g. PC checkout + Mobile payment page)
    const pollTimer = setInterval(async () => {
      if (isCompleted || paymentMethod !== 'CUSTOM_UPI') return;
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(activeOrderNum)}`, {
          cache: 'no-store',
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.order) {
            const ord = json.order;
            if (
              ord.utrNumber &&
              (ord.manualApprovalStatus === 'PENDING_REVIEW' ||
                ord.paymentStatus === 'PAID' ||
                ord.status === 'CONFIRMED')
            ) {
              completeCheckoutFromRemote(activeOrderNum, ord.utrNumber);
            }
          }
        }
      } catch {}
    }, 3000);

    return () => {
      if (channel) channel.close();
      window.removeEventListener('storage', handleStorageEvent);
      clearInterval(pollTimer);
    };
  }, [checkoutOrderNumber, paymentMethod, clearCart, router]);

  // PayGlocal States
  const [payglocalCurrency, setPayglocalCurrency] = useState<'INR' | 'USD' | 'GBP' | 'EUR'>('INR');

  // Gateway state
  const [gateways, setGateways] = useState<PaymentGatewayConfig[]>(() => getPaymentGateways());
  const [isLoadingGateways, setIsLoadingGateways] = useState<boolean>(true);

  // Active gateway and method helpers
  const isCustomUpiActive = gateways.some((g) => g.id === 'CUSTOM_UPI' && g.isEnabled);
  const isPayGlocalActive = gateways.some((g) => g.id === 'PAYGLOCAL' && g.isEnabled);
  const isCodActive = gateways.some((g) => g.id === 'COD' && g.isEnabled);
  const isCardsActive = gateways.some(
    (g) => g.isEnabled && g.supportedMethods.includes('CARDS') && (g.id === 'RAZORPAY' || g.id === 'STRIPE')
  );
  const isNetBankingActive = gateways.some(
    (g) => g.isEnabled && g.supportedMethods.includes('NET_BANKING') && g.id === 'RAZORPAY'
  );
  const customGateways = gateways.filter(
    (g) =>
      g.isEnabled &&
      !['CUSTOM_UPI', 'PAYGLOCAL', 'RAZORPAY', 'COD', 'PHONEPE', 'STRIPE'].includes(g.id)
  );

  // List of all active payment method keys currently enabled
  const availableMethods: PaymentMethod[] = [];
  if (isCustomUpiActive) availableMethods.push('CUSTOM_UPI');
  if (isPayGlocalActive) availableMethods.push('PAYGLOCAL');
  if (isCardsActive) availableMethods.push('CARDS');
  if (isNetBankingActive) availableMethods.push('NET_BANKING');
  if (isCodActive) availableMethods.push('COD');
  customGateways.forEach((cg) => {
    availableMethods.push(cg.id as PaymentMethod);
  });

  // Fetch gateways from server API and keep in sync
  const refreshGateways = async () => {
    try {
      const gw = await fetchPaymentGateways(true);
      setGateways(gw);
      setIsLoadingGateways(false);
    } catch {
      const fallbackGw = getPaymentGateways();
      setGateways(fallbackGw);
      setIsLoadingGateways(false);
    }
  };

  const loadCustomerData = async (preserveExistingInputs = false) => {
    try {
      const res = await fetch('/api/customers/me', { cache: 'no-store', credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.customer) {
          setCustomerId(data.customer.id);
          if (data.customer.email) {
            setSignedInEmail(data.customer.email);
            setEmail((prev) => prev || data.customer.email);
          }
          if (data.customer.fullName) setFullName((prev) => prev || data.customer.fullName);
          if (data.customer.phone) setPhone((prev) => prev || data.customer.phone);

          let customerAddresses: CustomerAddress[] = Array.isArray(data.customer.addresses) ? data.customer.addresses : [];

          // If customer has no saved addresses and has never explicitly cleared addresses, synthesize from latest order
          let orderList = Array.isArray(data.orders) ? data.orders : [];
          if (orderList.length === 0 && typeof window !== 'undefined') {
            try {
              const localOrd = JSON.parse(localStorage.getItem('infinicharm_orders') || '[]');
              if (Array.isArray(localOrd) && localOrd.length > 0) {
                orderList = localOrd;
              }
            } catch {}
          }

          const latestOrderWithAddr = orderList.find(
            (o: any) => o.shippingAddress && o.shippingAddress.addressLine1 && o.shippingAddress.postalCode
          );

          if (!data.customer.phone && latestOrderWithAddr) {
            const fallbackPhone = latestOrderWithAddr.customerPhone || latestOrderWithAddr.shippingAddress?.phone;
            if (fallbackPhone) setPhone((prev) => prev || fallbackPhone);
          }

          if (!data.customer.hasExplicitlyClearedAddresses && customerAddresses.length === 0 && latestOrderWithAddr?.shippingAddress) {
            const s = latestOrderWithAddr.shippingAddress;
            const synthesized: CustomerAddress = {
              id: s.id && !s.id.startsWith('addr-draft-') ? s.id : `addr-order-${latestOrderWithAddr.orderNumber}`,
              customerId: data.customer.id,
              fullName: s.fullName || data.customer.fullName || '',
              phone: s.phone || data.customer.phone || latestOrderWithAddr.customerPhone || '',
              addressLine1: s.addressLine1,
              addressLine2: s.addressLine2 || '',
              city: s.city,
              state: s.state,
              postalCode: s.postalCode,
              country: s.country || 'India',
              type: (s.type as AddressType) || 'HOME',
              label: s.label || 'Home',
              isDefaultShipping: true,
              isDefaultBilling: true,
            };
            customerAddresses = [synthesized];
          }

          if (customerAddresses.length > 0) {
            setSavedAddresses(customerAddresses);
            if (!preserveExistingInputs) {
              const def =
                customerAddresses.find((a: CustomerAddress) => a.isDefaultShipping) ||
                customerAddresses[0];
              if (def) {
                setSelectedAddressId(def.id);
                setFullName(def.fullName || data.customer.fullName || '');
                setPhone(def.phone || data.customer.phone || '');
                setAddressLine1(def.addressLine1);
                setAddressLine2(def.addressLine2 || '');
                setPinCode(def.postalCode);
                setCity(def.city);
                setStateName(def.state);
                setAddressType((def.type as AddressType) || 'HOME');
                setAddressLabel(def.label || '');
                setMakeDefaultShipping(Boolean(def.isDefaultShipping));
              }
            }
            return;
          }
        }
      }
    } catch (err) {
      console.warn('Could not fetch customer data in checkout:', err);
    }

    // Fallback to localStorage
    try {
      const storedAddrs = localStorage.getItem('infinicharm_customer_addresses');
      if (storedAddrs) {
        const addrs: CustomerAddress[] = JSON.parse(storedAddrs);
        if (Array.isArray(addrs) && addrs.length > 0) {
          setSavedAddresses(addrs);
          const def = addrs.find((a) => a.isDefaultShipping) || addrs[0];
          if (def && !preserveExistingInputs) {
            setSelectedAddressId(def.id);
            setFullName((prev) => prev || def.fullName);
            setPhone((prev) => prev || def.phone);
            setAddressLine1((prev) => prev || def.addressLine1);
            setAddressLine2((prev) => prev || def.addressLine2 || '');
            setPinCode((prev) => prev || def.postalCode);
            setCity((prev) => prev || def.city);
            setStateName((prev) => prev || def.state);
            setAddressType((prev) => prev || (def.type as AddressType) || 'HOME');
            setAddressLabel((prev) => prev || def.label || '');
            setMakeDefaultShipping(Boolean(def.isDefaultShipping));
          }
        }
      }

      const storedUser = localStorage.getItem('infinicharm_customer_user');
      if (storedUser) {
        const u = JSON.parse(storedUser);
        if (u.id) setCustomerId(u.id);
        if (u.email) {
          setSignedInEmail(u.email);
          setEmail((prev) => prev || u.email);
        }
        if (u.name || u.fullName) setFullName((prev) => prev || u.name || u.fullName);
        if (u.phone) setPhone((prev) => prev || u.phone);
      }
    } catch {}
  };

  useEffect(() => {
    refreshGateways();

    fetch('/api/auth/settings', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (d?.success && d.settings) setAuthPolicy(d.settings);
      })
      .catch(() => {});

    // Restore checkout form draft if present (e.g. after returning from email verification)
    try {
      const rawDraft = localStorage.getItem('infinicharm_checkout_draft');
      if (rawDraft) {
        const draft = JSON.parse(rawDraft);
        if (draft.fullName) setFullName(draft.fullName);
        if (draft.email) setEmail(draft.email);
        if (draft.phone) setPhone(draft.phone);
        if (draft.addressLine1) setAddressLine1(draft.addressLine1);
        if (draft.addressLine2) setAddressLine2(draft.addressLine2);
        if (draft.pinCode) setPinCode(draft.pinCode);
        if (draft.city) setCity(draft.city);
        if (draft.stateName) setStateName(draft.stateName);
        if (draft.deliveryNotes) setDeliveryNotes(draft.deliveryNotes);
        if (draft.paymentMethod) setPaymentMethod(draft.paymentMethod);
      }

      const params = new URLSearchParams(window.location.search);
      if (params.get('verified') === '1') {
        const verifiedEmail = params.get('email') || '';
        setInlineVerifiedNotice(
          verifiedEmail
            ? `Email ${verifiedEmail} verified! Sign in below to link this order to your new account.`
            : 'Email verified! Sign in below to link this order to your account.'
        );
        if (verifiedEmail) {
          setInlineLoginEmail(verifiedEmail);
          setEmail((prev) => prev || verifiedEmail);
        }
        setShowInlineLogin(true);
      }
    } catch {}

    // Cross-tab and in-tab synchronization event listeners
    const handleSync = () => {
      refreshGateways();
    };

    window.addEventListener('infinicharm_gateways_updated', handleSync);
    window.addEventListener('storage', handleSync);

    loadCustomerData(false);

    return () => {
      window.removeEventListener('infinicharm_gateways_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  // Persist guest checkout form draft cleanly so email verification / sign-in never loses inputs
  useEffect(() => {
    try {
      if (fullName || email || phone || addressLine1 || pinCode) {
        localStorage.setItem(
          'infinicharm_checkout_draft',
          JSON.stringify({
            fullName,
            email,
            phone,
            addressLine1,
            addressLine2,
            pinCode,
            city,
            stateName,
            deliveryNotes,
            paymentMethod,
          })
        );
      }
    } catch {}
  }, [fullName, email, phone, addressLine1, addressLine2, pinCode, city, stateName, deliveryNotes, paymentMethod]);

  // Auto-switch selected payment method if currently selected one was disabled
  useEffect(() => {
    if (!isLoadingGateways && availableMethods.length > 0) {
      if (!availableMethods.includes(paymentMethod)) {
        setPaymentMethod(availableMethods[0]);
      }
    }
  }, [isLoadingGateways, gateways, paymentMethod]);

  // Custom UPI dynamic URI, QR & Direct Payment Link Generation (Centralized Authority)
  const customUpiGateway = gateways.find((g) => g.id === 'CUSTOM_UPI');
  const effectiveUpiCreds = customUpiGateway?.credentials || DEFAULT_UPI_CREDENTIALS;
  const effectiveOrderId = checkoutOrderNumber || 'INF-ORDER';

  const upiPaymentData = useMemo(() => {
    return generateUpiPaymentDetails({
      credentials: effectiveUpiCreds,
      totalInPaise,
      orderId: effectiveOrderId,
    });
  }, [effectiveUpiCreds, totalInPaise, effectiveOrderId]);

  const upiIntentUri = upiPaymentData.upiIntentUri;

  useEffect(() => {
    if (totalInPaise > 0 && upiPaymentData.upiIntentUri) {
      QRCode.toDataURL(upiPaymentData.upiIntentUri, {
        width: 280,
        margin: 1,
        color: { dark: '#09090b', light: '#ffffff' },
      })
        .then((url) => setCustomUpiQrDataUrl(url))
        .catch((err) => console.error('Failed to generate dynamic UPI QR:', err));
    }
  }, [upiPaymentData.upiIntentUri, totalInPaise]);

  const handleDirectUpiClick = () => {
    if (typeof window === 'undefined') return;
    const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(
      navigator.userAgent
    );
    if (!isMobile) {
      setDesktopUpiNotice(true);
      setTimeout(() => setDesktopUpiNotice(false), 9000);
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(key);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const syncPendingOrderDraft = async () => {
    try {
      const orderRef = checkoutOrderNumber || effectiveOrderId;
      if (!orderRef || items.length === 0) return;

      await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: orderRef,
          orderNumber: orderRef,
          status: 'PENDING',
          paymentStatus: 'PENDING',
          paymentMethod: 'CUSTOM_UPI',
          isDraft: true,
          saveAddressToBook: false,
          items: items.map((i) => ({
            id: `item-${i.product.id}-${i.variantId}`,
            orderId: orderRef,
            productId: i.product.id,
            variantId: i.variantId,
            productTitle: i.product.title,
            variantTitle: i.variant.title || 'Standard',
            sku: i.variant.sku || i.product.id,
            priceInPaise: i.variant.priceInPaise,
            quantity: i.quantity,
            totalInPaise: i.variant.priceInPaise * i.quantity,
          })),
          subtotalInPaise,
          shippingInPaise,
          discountInPaise,
          totalInPaise,
          customerEmail: email || 'guest@infinicharm.com',
          customerPhone: phone || '8825164657',
          shippingAddress: {
            id: `addr-draft-${Date.now()}`,
            customerId: customerId || 'guest',
            fullName: fullName || 'Valued Guest',
            phone: phone || '8825164657',
            addressLine1: addressLine1 || 'Pending Customer Checkout Address',
            addressLine2: addressLine2 || '',
            city: city || 'East Champaran',
            state: stateName || 'Bihar',
            postalCode: pinCode || '845427',
            country: 'India',
            isDefaultShipping: true,
            isDefaultBilling: false,
          },
        }),
      });

      if (typeof window !== 'undefined') {
        try {
          const draftRecord = {
            id: orderRef,
            orderNumber: orderRef,
            status: 'PENDING',
            paymentStatus: 'PENDING',
            paymentMethod: 'CUSTOM_UPI',
            items: items.map((i) => ({
              id: `item-${i.product.id}-${i.variantId}`,
              orderId: orderRef,
              productId: i.product.id,
              variantId: i.variantId,
              productTitle: i.product.title,
              variantTitle: i.variant.title || 'Standard',
              sku: i.variant.sku || i.product.id,
              priceInPaise: i.variant.priceInPaise,
              quantity: i.quantity,
              totalInPaise: i.variant.priceInPaise * i.quantity,
            })),
            subtotalInPaise,
            shippingInPaise,
            discountInPaise,
            totalInPaise,
            customerEmail: email || 'guest@infinicharm.com',
            customerPhone: phone || '8825164657',
            shippingAddress: {
              id: `addr-draft-${Date.now()}`,
              customerId: customerId || 'guest',
              fullName: fullName || 'Valued Guest',
              phone: phone || '8825164657',
              addressLine1: addressLine1 || 'Pending Customer Checkout Address',
              city: city || 'East Champaran',
              state: stateName || 'Bihar',
              postalCode: pinCode || '845427',
              country: 'India',
            },
            createdAt: new Date().toISOString(),
          };
          const prev = JSON.parse(localStorage.getItem('infinicharm_orders') || '[]');
          if (!prev.some((o: any) => o.orderNumber === orderRef || o.id === orderRef)) {
            localStorage.setItem('infinicharm_orders', JSON.stringify([draftRecord, ...prev]));
          }
        } catch {}
      }
    } catch {
      // Non-blocking sync
    }
  };

  const [couponInput, setCouponInput] = useState('');
  const [couponError, setCouponError] = useState<string | null>(null);

  // Submitting
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Auto-fill address from PIN Code
  const handlePinCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setPinCode(val);
    if (selectedAddressId) setSelectedAddressId(null);

    if (val.length === 6) {
      const info = lookupPinCode(val);
      if (info) {
        setCity(info.city);
        setStateName(info.state);
      }
    }
  };

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponInput.trim() || isApplyingCoupon) return;
    const res = await applyCoupon(couponInput.trim(), {
      customerEmail: email.trim() || undefined,
      customerPhone: phone.trim() || undefined,
    });
    if (!res.success) {
      setCouponError(res.message);
    } else {
      setCouponError(null);
      setCouponInput('');
    }
  };

  const handleSelectSavedAddress = (addr: CustomerAddress) => {
    setSelectedAddressId(addr.id);
    setFullName(addr.fullName);
    setPhone(addr.phone);
    setAddressLine1(addr.addressLine1);
    setAddressLine2(addr.addressLine2 || '');
    setPinCode(addr.postalCode);
    setCity(addr.city);
    setStateName(addr.state);
    setAddressType((addr.type as AddressType) || 'HOME');
    setAddressLabel(addr.label || '');
    setMakeDefaultShipping(Boolean(addr.isDefaultShipping));
  };

  const handleUseNewAddress = () => {
    setSelectedAddressId(null);
    setAddressLine1('');
    setAddressLine2('');
    setPinCode('');
    setCity('');
    setStateName('');
    setAddressType('HOME');
    setAddressLabel('');
    setMakeDefaultShipping(false);
    setSaveNewAddressToAccount(true);
  };

  const handleInlineLoginSubmit = async () => {
    setInlineLoginError(null);
    setInlineUnverifiedEmail(null);
    const cleanEmail = inlineLoginEmail.trim().toLowerCase();
    if (!cleanEmail || !inlineLoginPassword) {
      setInlineLoginError('Please enter your registered email and password.');
      return;
    }

    setInlineLoginLoading(true);
    try {
      const res = await fetch('/api/auth/customer/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password: inlineLoginPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        if (data?.code === 'EMAIL_NOT_VERIFIED' || data?.requiresVerification) {
          setInlineUnverifiedEmail(cleanEmail);
        }
        setInlineLoginError(data?.error || 'Unable to sign in with those credentials.');
        setInlineLoginLoading(false);
        return;
      }

      persistClientCustomerSession(data.customer);
      setCustomerId(data.customer.id);
      setSignedInEmail(data.customer.email);
      setEmail((prev) => prev || data.customer.email);
      if (data.customer.fullName) setFullName((prev) => prev || data.customer.fullName);
      if (data.customer.phone) setPhone((prev) => prev || data.customer.phone);
      if (Array.isArray(data.customer.addresses)) {
        setSavedAddresses(data.customer.addresses);
      }
      setShowInlineLogin(false);
      setPendingCheckoutVerificationEmail(null);
      setCreateAccountDuringCheckout(false);
      setInlineVerifiedNotice(null);
      await loadCustomerData(true);
    } catch {
      setInlineLoginError('Network error while signing in. Please try again.');
    } finally {
      setInlineLoginLoading(false);
    }
  };

  const handleCustomerVerified = async (cust: any) => {
    if (!cust) return;
    persistClientCustomerSession(cust);
    if (cust.id) setCustomerId(cust.id);
    if (cust.email) {
      setSignedInEmail(cust.email);
      setEmail((prev) => prev || cust.email);
    }
    if (cust.fullName) setFullName((prev) => prev || cust.fullName);
    if (cust.phone) setPhone((prev) => prev || cust.phone);
    if (Array.isArray(cust.addresses)) {
      setSavedAddresses(cust.addresses);
    }
    setInlineUnverifiedEmail(null);
    setPendingCheckoutVerificationEmail(null);
    setShowInlineLogin(false);
    setCreateAccountDuringCheckout(false);
    setInlineVerifiedNotice(null);
    await loadCustomerData(true);
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (items.length === 0) {
      setFormError('Your cart is empty. Please add products before checking out.');
      return;
    }

    if (!fullName.trim() || !phone.trim() || !addressLine1.trim() || pinCode.length !== 6 || !city.trim() || !stateName.trim()) {
      setFormError('Please complete all mandatory delivery address fields.');
      return;
    }

    if (phone.replace(/\D/g, '').length < 10) {
      setFormError('Please enter a valid 10-digit mobile number for dispatch updates.');
      return;
    }

    let resolvedCustomerId = customerId;

    // WooCommerce-like Checkout Account Creation (enforces centralized verification & policy)
    if (customerId === 'guest' && createAccountDuringCheckout) {
      const normalizedEmail = email.trim().toLowerCase();
      if (!isValidEmail(normalizedEmail)) {
        setFormError('Please enter a valid email address to create your InfiniCharm account.');
        return;
      }

      const pwCheck = validatePasswordAgainstPolicy(
        checkoutAccountPassword,
        authPolicy || undefined
      );
      if (!pwCheck.valid) {
        setFormError(pwCheck.errors[0] || 'Please choose a stronger account password.');
        return;
      }

      if (checkoutAccountPassword !== checkoutAccountConfirmPassword) {
        setFormError('Account passwords do not match. Please verify.');
        return;
      }

      setIsSubmitting(true);
      try {
        const regRes = await fetch('/api/auth/customer/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fullName: fullName.trim(),
            email: normalizedEmail,
            phone: phone.trim(),
            password: checkoutAccountPassword,
            source: 'CHECKOUT',
            redirectPath: '/checkout',
          }),
        });
        const regData = await regRes.json();

        if (!regRes.ok || !regData?.success) {
          setFormError(
            regData?.code === 'EMAIL_EXISTS'
              ? 'An account with this email already exists. Please use "Returning customer? Sign in" above or uncheck account creation to proceed as guest.'
              : regData?.error || 'Could not create customer account.'
          );
          setIsSubmitting(false);
          return;
        }

        if (regData.requiresVerification) {
          setPendingCheckoutVerificationEmail(normalizedEmail);
          setCreateAccountDuringCheckout(false);
          setInlineLoginEmail(normalizedEmail);
          setIsSubmitting(false);
          return;
        }

        persistClientCustomerSession(regData.customer);
        setCustomerId(regData.customer.id);
        setSignedInEmail(regData.customer.email);
        resolvedCustomerId = regData.customer.id;
      } catch {
        setFormError('Network error creating your account. Your bag and form inputs are preserved.');
        setIsSubmitting(false);
        return;
      }
      setIsSubmitting(false);
    }

    if (resolvedCustomerId === 'guest' && authPolicy && !authPolicy.guestCheckoutEnabled) {
      setShowInlineLogin(true);
      setFormError(
        'Guest checkout is disabled by store administration. Please sign in or create & verify your account above before placing your order.'
      );
      return;
    }

    // Validation for Custom UPI: Must provide valid UTR (single or comma-separated)
    let parsedUtrCleaned: string | undefined = undefined;
    if (paymentMethod === 'CUSTOM_UPI') {
      const utrResult = parseUtrInput(customUpiUtr);
      if (!utrResult.isValid) {
        setFormError(
          utrResult.error ||
            'Please enter the 12-digit UPI Transaction UTR / Reference Number after completing your payment.'
        );
        return;
      }
      parsedUtrCleaned = utrResult.rawCleaned;
    }

    // Client verification: Ensure chosen method is active
    if (!availableMethods.includes(paymentMethod)) {
      setFormError('The selected payment method has been disabled by store administration. Please choose an active payment method.');
      return;
    }

    // Server Authority Check: Validate active payment gateway via backend API
    try {
      const valRes = await fetch('/api/checkout/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethod, amountInPaise: totalInPaise }),
      });
      const valData = await valRes.json();
      if (!valRes.ok || !valData.valid) {
        setFormError(valData.error || 'Selected payment method is currently disabled.');
        return;
      }
    } catch (valErr) {
      console.error('Server payment validation check error:', valErr);
    }

    setIsSubmitting(true);

    const finalOrderNumber =
      checkoutOrderNumber ||
      `INF-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.floor(
        1000 + Math.random() * 9000
      )}`;

    const isCustomUpi = paymentMethod === 'CUSTOM_UPI';
    const isPayGlocal = paymentMethod === 'PAYGLOCAL';
    const isCod = paymentMethod === 'COD';

    const isExistingMatch = Boolean(
      selectedAddressId &&
      savedAddresses.some(
        (a) =>
          a.id === selectedAddressId &&
          a.fullName.trim().toLowerCase() === fullName.trim().toLowerCase() &&
          a.phone.replace(/\D/g, '').slice(-10) === phone.replace(/\D/g, '').slice(-10) &&
          a.addressLine1.trim().toLowerCase() === addressLine1.trim().toLowerCase() &&
          a.postalCode.replace(/\D/g, '') === pinCode.replace(/\D/g, '')
      )
    );
    const effectiveAddressId = isExistingMatch && selectedAddressId ? selectedAddressId : `addr-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

    const orderData: Order = {
      id: `ord-${Date.now()}`,
      orderNumber: finalOrderNumber,
      customerId: resolvedCustomerId || 'guest',
      customerEmail: email || `${phone}@infinicharm.customer`,
      customerPhone: phone,
      status: isCustomUpi || isPayGlocal || isCod ? 'PENDING' : 'CONFIRMED',
      subtotalInPaise,
      discountInPaise,
      shippingInPaise,
      taxInPaise: 0,
      totalInPaise,
      couponCode: appliedCoupon?.code,
      paymentMethod,
      paymentStatus: isCod || isCustomUpi || isPayGlocal ? 'PENDING' : 'PAID',
      manualApprovalStatus: isCustomUpi ? 'PENDING_REVIEW' : undefined,
      utrNumber: isCustomUpi ? parsedUtrCleaned : undefined,
      customerNotes: deliveryNotes,
      shippingAddress: {
        id: effectiveAddressId,
        customerId: resolvedCustomerId || 'guest',
        fullName: fullName.trim(),
        phone: phone.trim(),
        addressLine1: addressLine1.trim(),
        addressLine2: addressLine2.trim() || undefined,
        city: city.trim(),
        state: stateName.trim(),
        postalCode: pinCode.trim(),
        country: 'India',
        type: addressType,
        label: addressLabel.trim() || (addressType === 'OFFICE' ? 'Office' : addressType === 'OTHER' ? 'Other' : 'Home'),
        isDefaultShipping: Boolean(makeDefaultShipping) || !selectedAddressId,
        isDefaultBilling: true,
      },
      billingAddress: {
        id: effectiveAddressId,
        customerId: resolvedCustomerId || 'guest',
        fullName: fullName.trim(),
        phone: phone.trim(),
        addressLine1: addressLine1.trim(),
        city: city.trim(),
        state: stateName.trim(),
        postalCode: pinCode.trim(),
        country: 'India',
        isDefaultShipping: true,
        isDefaultBilling: true,
      },
      items: items.map((item) => ({
        id: `item-${item.variantId}-${Date.now()}`,
        orderId: finalOrderNumber,
        productId: item.product.id,
        variantId: item.variant.id,
        productTitle: item.product.title,
        variantTitle: item.variant.title,
        sku: item.variant.sku,
        priceInPaise: item.variant.priceInPaise,
        quantity: item.quantity,
        totalInPaise: item.variant.priceInPaise * item.quantity,
      })),
      timeline: generateInitialOrderTimeline({
        orderNumber: finalOrderNumber,
        paymentMethod,
        paymentStatus: isCod || isCustomUpi || isPayGlocal ? 'PENDING' : 'PAID',
        status: isCustomUpi || isPayGlocal || isCod ? 'PENDING' : 'CONFIRMED',
        utrNumber: isCustomUpi ? parsedUtrCleaned : undefined,
      }),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Determine target gateway ID
    let gatewayId: any = 'RAZORPAY';
    if (isCustomUpi) {
      gatewayId = 'CUSTOM_UPI';
    } else if (isPayGlocal) {
      gatewayId = 'PAYGLOCAL';
    } else if (isCod) {
      gatewayId = 'COD';
    } else if (gateways.find((g) => g.id === 'PHONEPE' && g.isEnabled)) {
      gatewayId = 'PHONEPE';
    } else if (gateways.find((g) => g.id === 'STRIPE' && g.isEnabled)) {
      gatewayId = 'STRIPE';
    }

    recordPaymentTransaction({
      id: `tx-${Date.now()}`,
      orderNumber: finalOrderNumber,
      gatewayId,
      gatewayTransactionId: `${gatewayId.toLowerCase()}_${Date.now().toString(36)}`,
      amountInPaise: totalInPaise,
      currency: isPayGlocal ? payglocalCurrency : 'INR',
      method: paymentMethod,
      status: isCod || isCustomUpi || isPayGlocal ? 'PENDING' : 'SUCCESS',
      utrNumber: isCustomUpi ? parsedUtrCleaned : undefined,
      manualApprovalStatus: isCustomUpi ? 'PENDING_REVIEW' : undefined,
      customerEmail: email || `${phone}@infinicharm.customer`,
      customerPhone: phone,
      createdAt: new Date().toISOString(),
    });

    // Save order & customer to server API and localStorage
    let savedServerOrder: Order = orderData;
    try {
      // 1. Persist to server API (enforces coupon & financial verification)
      const orderRes = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...orderData,
          addressType,
          addressLabel,
          saveAddressToBook: saveNewAddressToAccount,
          makeDefaultShipping: makeDefaultShipping || !selectedAddressId,
          isOrderConfirmation: true,
        }),
      });
      const orderResData = await orderRes.json();

      if (!orderRes.ok || !orderResData.success) {
        setFormError(orderResData.error || 'Failed to validate and save your order. Please verify your coupon and items.');
        setIsSubmitting(false);
        return;
      }

      if (orderResData.order) {
        savedServerOrder = orderResData.order;
      }

      if (orderResData.customer) {
        if (Array.isArray(orderResData.customer.addresses)) {
          localStorage.setItem('infinicharm_customer_addresses', JSON.stringify(orderResData.customer.addresses));
          setSavedAddresses(orderResData.customer.addresses);
        }
        try {
          const storedUser = localStorage.getItem('infinicharm_customer_user');
          const existingUser = storedUser ? JSON.parse(storedUser) : {};
          localStorage.setItem('infinicharm_customer_user', JSON.stringify({
            ...existingUser,
            ...orderResData.customer,
          }));
        } catch {}
        window.dispatchEvent(new Event('infinicharm_customer_addresses_updated'));
        window.dispatchEvent(new Event('infinicharm_customer_updated'));
      }

      // 2. Local storage sync & cross-tab notification
      const stored = localStorage.getItem('infinicharm_orders');
      const existing = stored ? JSON.parse(stored) : [];
      localStorage.setItem('infinicharm_orders', JSON.stringify([savedServerOrder, ...existing]));
      window.dispatchEvent(new Event('infinicharm_orders_updated'));
    } catch {
      setFormError('Network error submitting order. Please try again.');
      setIsSubmitting(false);
      return;
    }

    // PayGlocal Payment Flow: Call Initiate API and redirect
    if (isPayGlocal) {
      try {
        const initRes = await fetch('/api/payments/payglocal/initiate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderNumber: finalOrderNumber,
            amountInPaise: totalInPaise,
            currency: payglocalCurrency,
            customerEmail: email || `${phone}@infinicharm.customer`,
            customerPhone: phone,
            customerName: fullName.trim(),
            billingAddress: `${addressLine1}, ${city}, ${stateName} - ${pinCode}`,
          }),
        });

        const initData = await initRes.json();
        clearCart();
        try {
          sessionStorage.removeItem('infinicharm_checkout_order_id');
        } catch {}
        if (initData?.redirectUrl) {
          window.location.href = initData.redirectUrl;
          return;
        }
      } catch (paygErr) {
        console.error('PayGlocal initiation error:', paygErr);
        // Fallback to mock page directly
        clearCart();
        try {
          sessionStorage.removeItem('infinicharm_checkout_order_id');
        } catch {}
        window.location.href = `/checkout/payglocal-mock?orderNumber=${encodeURIComponent(
          finalOrderNumber
        )}&amount=${(totalInPaise / 100).toFixed(2)}&currency=${payglocalCurrency}`;
        return;
      }
    }

    // Clear cart & checkout draft, then redirect to order success
    clearCart();
    try {
      localStorage.removeItem('infinicharm_checkout_draft');
      sessionStorage.removeItem('infinicharm_checkout_order_id');
      localStorage.removeItem('infinicharm_checkout_order_id');
    } catch {}
    setTimeout(() => {
      router.push(`/checkout/success?order_id=${orderData.orderNumber}`);
    }, 600);
  };

  if (items.length === 0) {
    return (
      <div className="py-20 bg-surface-dim/30 min-h-[60vh] flex items-center justify-center">
        <Container className="max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-surface-dim border border-border flex items-center justify-center text-muted mx-auto mb-4">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <h2 className="font-display text-2xl font-bold text-primary">Your Bag is Empty</h2>
          <p className="text-xs text-muted mt-2 mb-6">
            You don&apos;t have any products in your shopping bag to checkout.
          </p>
          <Link
            href="/shop"
            className="inline-flex items-center justify-center px-6 py-3 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl transition-colors uppercase tracking-wider"
          >
            Explore Authentic Pantry
          </Link>
        </Container>
      </div>
    );
  }

  return (
    <div className="py-10 bg-surface-dim/40 min-h-screen">
      <Container>
        {/* Checkout Header */}
        <div className="mb-8">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-primary tracking-tight">
            Secure Checkout
          </h1>
          <p className="text-xs text-muted mt-1 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-accent" />
            <span>256-Bit Encrypted Direct Dispatch from East Champaran, Bihar</span>
          </p>
        </div>

        {remoteSyncNotice && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3 text-emerald-900 text-xs sm:text-sm font-semibold animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <span>{remoteSyncNotice}</span>
          </div>
        )}

        {formError && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-800 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmitOrder}>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            {/* Left 7 Columns: Delivery & Payment Details */}
            <div className="lg:col-span-7 space-y-6">
              {/* Section 1: Customer Contact & Delivery Address */}
              <div className="bg-surface rounded-3xl border border-border p-6 sm:p-8 shadow-sm space-y-4">
                <div className="flex items-center justify-between gap-2.5 pb-3 border-b border-border flex-wrap">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-accent text-white flex items-center justify-center text-xs font-bold">
                      1
                    </div>
                    <h2 className="font-display text-lg font-bold text-primary">
                      Delivery Address &amp; Contact
                    </h2>
                  </div>

                  {customerId !== 'guest' ? (
                    <span
                      data-testid="checkout-signed-in-badge"
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold"
                    >
                      <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Signed in as {signedInEmail || email || 'Verified Customer'}</span>
                    </span>
                  ) : authPolicy?.checkoutInlineLoginEnabled !== false ? (
                    <button
                      type="button"
                      data-testid="checkout-login-toggle"
                      onClick={() => {
                        setShowInlineLogin((prev) => !prev);
                        setInlineLoginError(null);
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Returning customer? Sign in</span>
                    </button>
                  ) : null}
                </div>

                {/* WooCommerce-like Inline Returning Customer Sign-In (formless inside outer order form) */}
                {customerId === 'guest' && showInlineLogin && authPolicy?.checkoutInlineLoginEnabled !== false && (
                  <div
                    data-testid="checkout-inline-login"
                    className="p-4 sm:p-5 rounded-2xl bg-surface-dim/80 border border-border space-y-3.5 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-bold text-primary text-sm">Sign in to your InfiniCharm account</p>
                        <p className="text-[11px] text-muted">
                          Your bag and shipping details remain intact.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowInlineLogin(false)}
                        className="text-[11px] font-semibold text-muted hover:text-primary"
                      >
                        Close
                      </button>
                    </div>

                    {inlineVerifiedNotice && (
                      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="font-semibold">{inlineVerifiedNotice}</span>
                      </div>
                    )}

                    {inlineLoginError && (
                      <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <span className="font-semibold">{inlineLoginError}</span>
                      </div>
                    )}

                    {inlineUnverifiedEmail && (
                      <InlineOtpVerification
                        email={inlineUnverifiedEmail}
                        redirectPath="/checkout"
                        compact
                        autoRedirect={false}
                        onSuccess={handleCustomerVerified}
                        onCancel={() => setInlineUnverifiedEmail(null)}
                      />
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                      <div>
                        <label className="block font-medium text-primary mb-1.5">
                          Email Address *
                        </label>
                        <input
                          type="email"
                          data-testid="checkout-inline-login-email"
                          value={inlineLoginEmail}
                          onChange={(e) => setInlineLoginEmail(e.target.value)}
                          placeholder="name@example.com"
                          className="flex h-11 w-full rounded-md border border-border bg-surface px-3.5 py-2 text-sm text-primary placeholder:text-muted/60 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                        />
                      </div>

                      <PasswordInput
                        data-testid="checkout-inline-login-password"
                        label="Password *"
                        value={inlineLoginPassword}
                        onChange={(e) => setInlineLoginPassword(e.target.value)}
                        placeholder="Enter password"
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      <Link
                        href="/forgot-password?redirect=/checkout"
                        className="text-[11px] font-semibold text-accent hover:underline"
                      >
                        Forgot your password?
                      </Link>
                      <button
                        type="button"
                        data-testid="checkout-inline-login-submit"
                        disabled={inlineLoginLoading}
                        onClick={handleInlineLoginSubmit}
                        className="px-5 py-2.5 bg-primary hover:bg-neutral-800 text-white font-bold rounded-xl transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
                      >
                        <LogIn className="w-3.5 h-3.5" />
                        <span>{inlineLoginLoading ? 'Signing In...' : 'Sign In & Continue'}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Pending Email Verification Gate after Checkout Registration */}
                {customerId === 'guest' && pendingCheckoutVerificationEmail && (
                  <div
                    data-testid="checkout-pending-verification-banner"
                    className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-3 text-xs text-amber-950"
                  >
                    <div className="flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="font-bold text-sm">
                          Verify {pendingCheckoutVerificationEmail} to activate your account
                        </p>
                        <p className="text-[11px] text-amber-900">
                          We sent a single-use verification link to your email. Click the link in your inbox, then return here to sign in and place your order. Your cart and delivery form have been saved.
                        </p>
                      </div>
                    </div>

                    <InlineOtpVerification
                      email={pendingCheckoutVerificationEmail}
                      redirectPath="/checkout"
                      compact
                      autoRedirect={false}
                      onSuccess={handleCustomerVerified}
                      onCancel={() => setPendingCheckoutVerificationEmail(null)}
                    />

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setShowInlineLogin(true);
                          setInlineLoginEmail(pendingCheckoutVerificationEmail);
                        }}
                        className="font-bold text-primary hover:underline"
                      >
                        Already clicked the link? Sign in here
                      </button>

                      {authPolicy?.guestCheckoutEnabled !== false && (
                        <button
                          type="button"
                          data-testid="checkout-continue-guest-btn"
                          onClick={() => {
                            setPendingCheckoutVerificationEmail(null);
                            setCreateAccountDuringCheckout(false);
                          }}
                          className="px-3 py-1.5 rounded-lg border border-amber-300 bg-white font-semibold text-amber-900 hover:bg-amber-100/60"
                        >
                          Place Order as Guest Instead
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Saved Address Book Selector (Shopify / WooCommerce Style) */}
                {savedAddresses.length > 0 && (
                  <div className="p-4 sm:p-5 rounded-2xl bg-surface-dim/60 border border-border/80 space-y-3.5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="font-semibold text-primary text-xs flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-accent" />
                        <span>Choose From Saved Delivery Addresses</span>
                      </span>
                      <Link
                        href="/account/addresses"
                        className="text-[11px] font-semibold text-accent hover:underline"
                      >
                        Manage Address Book &rarr;
                      </Link>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {savedAddresses.map((addr) => {
                        const isSelected = selectedAddressId === addr.id;
                        const aType = (addr.type as AddressType) || 'HOME';
                        return (
                          <div
                            key={addr.id}
                            data-testid={`checkout-saved-address-${addr.id}`}
                            role="button"
                            tabIndex={0}
                            onClick={() => handleSelectSavedAddress(addr)}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSelectSavedAddress(addr); }}
                            className={`p-3.5 rounded-xl border cursor-pointer transition-all text-xs space-y-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                              isSelected
                                ? 'border-accent bg-accent/10 ring-1 ring-accent'
                                : 'border-border bg-surface hover:border-accent/40'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1 flex-wrap">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="font-bold text-primary truncate max-w-[130px]">{addr.fullName}</span>
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded-full shrink-0">
                                  {aType === 'OFFICE' ? <Building className="w-2.5 h-2.5" /> : aType === 'OTHER' ? <MapPin className="w-2.5 h-2.5" /> : <Home className="w-2.5 h-2.5" />}
                                  <span>{addr.label || (aType === 'OFFICE' ? 'Office' : aType === 'OTHER' ? 'Other' : 'Home')}</span>
                                </span>
                              </div>
                              {addr.isDefaultShipping && (
                                <span className="text-[9px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full shrink-0 uppercase tracking-wider">
                                  Default
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-muted flex items-center gap-1">
                              <Phone className="w-3 h-3 text-accent shrink-0" />
                              <span>{addr.phone}</span>
                            </p>
                            <p className="text-muted line-clamp-1">{addr.addressLine1}</p>
                            <p className="text-[11px] text-muted">
                              {addr.city}, {addr.state} - <span className="font-semibold text-primary">{addr.postalCode}</span>
                            </p>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
                      <button
                        type="button"
                        data-testid="checkout-use-new-address-btn"
                        onClick={handleUseNewAddress}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-colors ${
                          !selectedAddressId
                            ? 'bg-accent text-white border-accent'
                            : 'bg-surface hover:bg-surface-dim text-accent border-accent/40 hover:underline'
                        }`}
                      >
                        + Deliver to a different address
                      </button>
                      {selectedAddressId && (
                        <span className="text-[11px] text-muted">Selected address auto-filled below (editable)</span>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-semibold text-primary mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. AbdurRahman"
                      className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-primary mb-1">
                      10-Digit Mobile Number *
                    </label>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                      placeholder="e.g. 9876543210"
                      className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-primary mb-1">
                      {createAccountDuringCheckout
                        ? 'Email Address * (Used for your new account & verification link)'
                        : 'Email Address (Optional for e-Receipt)'}
                    </label>
                    <input
                      type="email"
                      data-testid="checkout-email-input"
                      required={createAccountDuringCheckout}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. customer@gmail.com"
                      className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    />
                  </div>

                  {/* WooCommerce-style Optional Account Creation During Checkout */}
                  {customerId === 'guest' && authPolicy?.checkoutRegistrationEnabled !== false && (
                    <div className="sm:col-span-2 rounded-2xl border border-border bg-surface-dim/50 p-4 space-y-3">
                      <label className="flex items-start gap-2.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          data-testid="checkout-create-account-checkbox"
                          checked={createAccountDuringCheckout}
                          onChange={(e) => {
                            setCreateAccountDuringCheckout(e.target.checked);
                            if (e.target.checked) {
                              setPendingCheckoutVerificationEmail(null);
                            }
                          }}
                          className="mt-0.5 h-4 w-4 rounded border-border accent-accent"
                        />
                        <div className="space-y-0.5">
                          <span className="font-bold text-primary inline-flex items-center gap-1.5">
                            <UserPlus className="w-3.5 h-3.5 text-accent" />
                            <span>Create an account with my checkout details</span>
                          </span>
                          <p className="text-[11px] text-muted">
                            {authPolicy?.requireEmailVerification !== false
                              ? 'A mandatory verification link will be sent before your account becomes active. Your cart and delivery inputs stay preserved.'
                              : 'Save addresses and track deliveries inside your customer account.'}
                          </p>
                        </div>
                      </label>

                      {createAccountDuringCheckout && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          <PasswordInput
                            data-testid="checkout-account-password"
                            label="Account Password *"
                            value={checkoutAccountPassword}
                            onChange={(e) => setCheckoutAccountPassword(e.target.value)}
                            showStrengthMeter
                            policy={authPolicy}
                            placeholder="Create a secure password"
                          />
                          <PasswordInput
                            data-testid="checkout-account-confirm-password"
                            label="Confirm Password *"
                            value={checkoutAccountConfirmPassword}
                            onChange={(e) => setCheckoutAccountConfirmPassword(e.target.value)}
                            placeholder="Re-enter password"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* PIN Code Auto-Fill */}
                  <div>
                    <label className="block font-semibold text-primary mb-1">
                      PIN Code (6 digits) *
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        maxLength={6}
                        value={pinCode}
                        onChange={handlePinCodeChange}
                        placeholder="e.g. 845427 or 110001"
                        className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                      />
                      <MapPin className="w-4 h-4 text-muted absolute right-3 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-primary mb-1">
                      City / District *
                    </label>
                    <input
                      type="text"
                      required
                      value={city}
                      onChange={(e) => {
                        setCity(e.target.value);
                        if (selectedAddressId) setSelectedAddressId(null);
                      }}
                      placeholder="Auto-filled or type city"
                      className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-primary mb-1">
                      State / UT *
                    </label>
                    <input
                      type="text"
                      required
                      value={stateName}
                      onChange={(e) => {
                        setStateName(e.target.value);
                        if (selectedAddressId) setSelectedAddressId(null);
                      }}
                      placeholder="e.g. Bihar, Delhi, Karnataka"
                      className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-primary mb-1">
                      House / Flat / Street / Landmark Address *
                    </label>
                    <input
                      type="text"
                      required
                      value={addressLine1}
                      onChange={(e) => {
                        setAddressLine1(e.target.value);
                        if (selectedAddressId) setSelectedAddressId(null);
                      }}
                      placeholder="e.g. Ward No. 07, Lahsaniya, Near Central Mosque"
                      className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-primary mb-1">
                      Delivery Instructions (Optional)
                    </label>
                    <input
                      type="text"
                      value={deliveryNotes}
                      onChange={(e) => setDeliveryNotes(e.target.value)}
                      placeholder="e.g. Leave with security or call on arrival"
                      className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    />
                  </div>

                  {customerId !== 'guest' && (
                    <div className="sm:col-span-2 pt-3 border-t border-border/80 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <span className="font-semibold text-primary text-xs">Address Category &amp; Nickname</span>
                        <div className="flex items-center gap-1.5" role="group" aria-label="Address Category">
                          <button
                            type="button"
                            data-testid="checkout-addr-type-home"
                            onClick={() => {
                              setAddressType('HOME');
                              if (!addressLabel || addressLabel === 'Office' || addressLabel === 'Other') setAddressLabel('Home');
                            }}
                            className={`px-3 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
                              addressType === 'HOME'
                                ? 'bg-accent text-white border-accent shadow-xs'
                                : 'bg-surface-dim text-muted border-border hover:text-primary'
                            }`}
                          >
                            <Home className="w-3.5 h-3.5" />
                            <span>Home</span>
                          </button>
                          <button
                            type="button"
                            data-testid="checkout-addr-type-office"
                            onClick={() => {
                              setAddressType('OFFICE');
                              if (!addressLabel || addressLabel === 'Home' || addressLabel === 'Other') setAddressLabel('Office');
                            }}
                            className={`px-3 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
                              addressType === 'OFFICE'
                                ? 'bg-accent text-white border-accent shadow-xs'
                                : 'bg-surface-dim text-muted border-border hover:text-primary'
                            }`}
                          >
                            <Building className="w-3.5 h-3.5" />
                            <span>Office</span>
                          </button>
                          <button
                            type="button"
                            data-testid="checkout-addr-type-other"
                            onClick={() => {
                              setAddressType('OTHER');
                              if (!addressLabel || addressLabel === 'Home' || addressLabel === 'Office') setAddressLabel('Other');
                            }}
                            className={`px-3 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
                              addressType === 'OTHER'
                                ? 'bg-accent text-white border-accent shadow-xs'
                                : 'bg-surface-dim text-muted border-border hover:text-primary'
                            }`}
                          >
                            <MapPin className="w-3.5 h-3.5" />
                            <span>Other</span>
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                        <div>
                          <label className="block text-[11px] font-medium text-muted mb-1">
                            Address Nickname / Label (Optional)
                          </label>
                          <input
                            type="text"
                            data-testid="checkout-address-label-input"
                            value={addressLabel}
                            onChange={(e) => setAddressLabel(e.target.value)}
                            placeholder={addressType === 'OFFICE' ? 'Office' : addressType === 'OTHER' ? 'Other' : 'Home'}
                            className="w-full px-3.5 py-2 bg-surface-dim border border-border rounded-xl text-primary text-xs focus:outline-none focus:border-accent"
                          />
                        </div>

                        <div className="space-y-1.5 pt-1 sm:pt-4">
                          <label className="flex items-center gap-2 cursor-pointer text-xs text-muted">
                            <input
                              type="checkbox"
                              data-testid="checkout-save-address-checkbox"
                              checked={saveNewAddressToAccount}
                              onChange={(e) => setSaveNewAddressToAccount(e.target.checked)}
                              className="w-4 h-4 text-accent rounded accent-accent"
                            />
                            <span className="font-medium text-primary">Save address to account for 1-click checkout</span>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer text-xs text-muted">
                            <input
                              type="checkbox"
                              data-testid="checkout-make-default-shipping-checkbox"
                              checked={makeDefaultShipping}
                              onChange={(e) => setMakeDefaultShipping(e.target.checked)}
                              className="w-4 h-4 text-accent rounded accent-accent"
                            />
                            <span className="font-medium text-primary">Make this my primary default delivery address</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Section 2: Payment Method */}
              <div className="bg-surface rounded-3xl border border-border p-6 sm:p-8 shadow-sm space-y-4">
                <div className="flex items-center gap-2.5 pb-3 border-b border-border">
                  <div className="w-7 h-7 rounded-full bg-accent text-white flex items-center justify-center text-xs font-bold">
                    2
                  </div>
                  <h2 className="font-display text-lg font-bold text-primary">
                    Select Payment Method
                  </h2>
                </div>

                {isLoadingGateways ? (
                  <div className="space-y-3 py-2">
                    <div className="h-16 bg-surface-dim/60 rounded-2xl animate-pulse" />
                    <div className="h-16 bg-surface-dim/60 rounded-2xl animate-pulse" />
                  </div>
                ) : availableMethods.length === 0 ? (
                  <div className="p-5 bg-amber-50/80 border border-amber-200 rounded-2xl text-amber-900 text-xs flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">No Payment Gateways Currently Active</p>
                      <p className="mt-0.5 text-muted leading-relaxed">
                        Online and offline payment methods are temporarily paused for scheduled maintenance. Please check back shortly or contact our 24/7 care team.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Option 1: Custom UPI Direct (Dynamic QR + UTR Submission) */}
                    {isCustomUpiActive && (
                      <div
                        className={`rounded-2xl border transition-all overflow-hidden ${
                          paymentMethod === 'CUSTOM_UPI'
                            ? 'border-accent bg-accent/5 ring-1 ring-accent'
                            : 'border-border bg-surface hover:bg-surface-dim'
                        }`}
                      >
                        <label className="flex items-start gap-3 p-4 cursor-pointer">
                          <input
                            type="radio"
                            name="paymentMethod"
                            checked={paymentMethod === 'CUSTOM_UPI'}
                            onChange={() => setPaymentMethod('CUSTOM_UPI')}
                            className="mt-1 accent-accent"
                          />
                          <div className="flex-1">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <span className="text-xs font-bold text-primary flex items-center gap-2">
                                <QrCode className="w-4 h-4 text-accent" />
                                Custom UPI Direct (Dynamic QR / GPay / PhonePe / Paytm / BHIM)
                              </span>
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                RECOMMENDED • 0% EXTRA FEE
                              </span>
                            </div>
                            <p className="text-[11px] text-muted mt-1">
                              Scan order-specific dynamic QR with any UPI app, transfer exact payable amount, and submit 12-digit UTR for verified order confirmation.
                            </p>
                          </div>
                        </label>

                        {/* Expanded Dynamic QR Code & UTR Verification Drawer */}
                        {paymentMethod === 'CUSTOM_UPI' && (
                          <div className="p-4 sm:p-5 bg-surface border-t border-border/80 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                              {/* QR Code Presentation */}
                              <div className="md:col-span-5 flex flex-col items-center justify-center p-3.5 sm:p-4 bg-surface-dim rounded-2xl border border-border">
                                <div className="w-full flex items-center justify-between text-[11px] mb-2 px-1">
                                  <span className="text-muted font-medium">Order Ref:</span>
                                  <div className="flex items-center gap-1">
                                    <span
                                      className="font-mono font-bold text-primary"
                                      data-testid="checkout-order-ref"
                                    >
                                      {effectiveOrderId}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleCopy(effectiveOrderId, 'order_ref')}
                                      className="p-1 hover:bg-surface rounded text-muted hover:text-primary transition-colors"
                                      title="Copy Order Reference"
                                    >
                                      {copiedField === 'order_ref' ? (
                                        <Check className="w-3 h-3 text-emerald-600" />
                                      ) : (
                                        <Copy className="w-3 h-3" />
                                      )}
                                    </button>
                                  </div>
                                </div>

                                <div className="w-48 h-48 bg-white p-2 rounded-xl shadow-xs border border-border/80 flex items-center justify-center">
                                  {customUpiQrDataUrl ? (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img
                                      src={customUpiQrDataUrl}
                                      alt={`InfiniCharm Dynamic UPI QR - Order ${effectiveOrderId}`}
                                      className="w-full h-full object-contain"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-xs text-muted">
                                      Generating QR...
                                    </div>
                                  )}
                                </div>

                                <div className="mt-2.5 text-center w-full">
                                  <span className="font-mono text-xs sm:text-sm font-extrabold text-accent block">
                                    Exact Payable: ₹{upiPaymentData.amountInRupees}
                                  </span>
                                  <span
                                    className="text-[10px] text-muted block mt-0.5 truncate"
                                    title={upiPaymentData.transactionNote}
                                    data-testid="upi-transaction-note"
                                  >
                                    Note: <strong className="text-primary font-mono">{upiPaymentData.transactionNote}</strong>
                                  </span>
                                  <span className="text-[9px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full inline-block mt-1 font-medium">
                                    ✓ Auto-filled in your UPI App
                                  </span>
                                </div>

                                <div className="flex flex-col gap-2 mt-3 w-full">
                                  <a
                                    href={upiPaymentData.upiIntentUri}
                                    data-testid="pay-via-upi-btn"
                                    onClick={handleDirectUpiClick}
                                    className="w-full py-2.5 px-3 bg-accent hover:bg-accent-hover text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors text-center"
                                  >
                                    <Smartphone className="w-4 h-4 shrink-0" />
                                    <span>Pay via UPI App</span>
                                  </a>

                                  <div className="grid grid-cols-2 gap-2 w-full">
                                    <button
                                      type="button"
                                      data-testid="copy-upi-link-btn"
                                      data-shareable-url={upiPaymentData.shareablePaymentUrl}
                                      onClick={() => {
                                        handleCopy(upiPaymentData.shareablePaymentUrl, 'upi_link');
                                        syncPendingOrderDraft();
                                      }}
                                      className="py-1.5 px-2 bg-surface hover:bg-surface-container text-primary border border-border rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1 shadow-2xs transition-colors"
                                      title="Copy Universal Shareable HTTPS Payment Link (WhatsApp / SMS / Browser)"
                                    >
                                      {copiedField === 'upi_link' ? (
                                        <Check className="w-3 h-3 text-emerald-600" />
                                      ) : (
                                        <Copy className="w-3 h-3 text-accent" />
                                      )}
                                      <span className="truncate">
                                        {copiedField === 'upi_link' ? 'Copied Link!' : 'Copy Payment Link'}
                                      </span>
                                    </button>

                                    {customUpiQrDataUrl && (
                                      <a
                                        href={customUpiQrDataUrl}
                                        download={`infinicharm-qr-${effectiveOrderId}.png`}
                                        className="py-1.5 px-2 bg-surface hover:bg-surface-container text-primary border border-border rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1 shadow-2xs transition-colors"
                                        title="Download QR code image to device"
                                      >
                                        <Download className="w-3 h-3 text-accent" />
                                        <span>Save QR</span>
                                      </a>
                                    )}
                                  </div>

                                  {/* WhatsApp Click-to-Pay Share Link */}
                                  <a
                                    href={upiPaymentData.whatsAppShareUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    data-testid="share-whatsapp-checkout-btn"
                                    onClick={() => syncPendingOrderDraft()}
                                    className="w-full py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1.5 shadow-2xs transition-colors text-center"
                                    title="Share payment request directly to WhatsApp"
                                  >
                                    <span>💬</span>
                                    <span>Share on WhatsApp</span>
                                  </a>
                                </div>
                              </div>

                              {/* VPA, Account Details & Steps */}
                              <div className="md:col-span-7 space-y-3 text-xs">
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface-dim border border-border">
                                    <div>
                                      <span className="text-[10px] text-muted block">Official UPI ID (VPA)</span>
                                      <span className="font-mono text-xs font-bold text-primary select-all">
                                        {upiPaymentData.upiId}
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleCopy(upiPaymentData.upiId, 'upi_id')}
                                      className="p-1.5 hover:bg-surface rounded-lg text-muted hover:text-primary transition-colors"
                                      title="Copy UPI ID"
                                    >
                                      {copiedField === 'upi_id' ? (
                                        <Check className="w-4 h-4 text-emerald-600" />
                                      ) : (
                                        <Copy className="w-4 h-4" />
                                      )}
                                    </button>
                                  </div>

                                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface-dim border border-border">
                                    <div>
                                      <span className="text-[10px] text-muted block">Registered Mobile / Payee</span>
                                      <span className="font-mono text-xs font-bold text-primary">
                                        {upiPaymentData.upiNumber} • {upiPaymentData.payeeName}
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleCopy(upiPaymentData.upiNumber, 'upi_phone')}
                                      className="p-1.5 hover:bg-surface rounded-lg text-muted hover:text-primary transition-colors"
                                      title="Copy Mobile"
                                    >
                                      {copiedField === 'upi_phone' ? (
                                        <Check className="w-4 h-4 text-emerald-600" />
                                      ) : (
                                        <Copy className="w-4 h-4" />
                                      )}
                                    </button>
                                  </div>

                                  <div className="p-2.5 rounded-xl bg-surface-dim border border-border text-[11px] text-neutral-600">
                                    <div className="flex justify-between">
                                      <span>
                                        Bank: <strong>{upiPaymentData.bankName}</strong> (Current)
                                      </span>
                                      <span>
                                        IFSC: <strong className="font-mono">{upiPaymentData.ifscCode}</strong>
                                      </span>
                                    </div>
                                    <div className="mt-1">
                                      Account No: <strong className="font-mono">{upiPaymentData.accountNumber}</strong>
                                    </div>
                                  </div>
                                </div>

                                {/* UPI Limit / High Value Warning Banner */}
                                {upiPaymentData.limitWarningMessage && (
                                  <div
                                    className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                                      upiPaymentData.isAmountExceedingLimit
                                        ? 'bg-amber-50 border-amber-300 text-amber-900'
                                        : 'bg-blue-50 border-blue-200 text-blue-900'
                                    }`}
                                  >
                                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                                    <div className="text-[11px] leading-relaxed">
                                      <p className="font-bold">
                                        {upiPaymentData.isAmountExceedingLimit
                                          ? 'NPCI UPI Amount Limit Notice'
                                          : 'Bank Daily UPI Limit Advisory'}
                                      </p>
                                      <p className="mt-0.5">{upiPaymentData.limitWarningMessage}</p>
                                    </div>
                                  </div>
                                )}

                                {/* Desktop Notice Banner */}
                                {desktopUpiNotice && (
                                  <div className="p-3 rounded-xl bg-surface-dim border border-accent/40 text-primary text-xs flex items-start gap-2.5 transition-all">
                                    <Info className="w-4 h-4 shrink-0 mt-0.5 text-accent" />
                                    <div className="text-[11px] leading-relaxed">
                                      <p className="font-bold">Launching UPI Application...</p>
                                      <p className="mt-0.5 text-muted">
                                        If your browser does not have a desktop UPI app installed, scan the QR code with your mobile phone camera or GPay / PhonePe / Paytm, or click <strong>&quot;Copy UPI Link&quot;</strong> to send the link to your mobile device.
                                      </p>
                                    </div>
                                  </div>
                                )}

                                {/* QR vs Direct Link Troubleshooting Guidance */}
                                <div className="p-2.5 rounded-xl bg-surface-dim/70 border border-border text-[11px] text-muted space-y-1">
                                  <div className="flex items-center gap-1.5 font-semibold text-primary">
                                    <Info className="w-3.5 h-3.5 text-accent shrink-0" />
                                    <span>Encountering QR scanning or amount restrictions?</span>
                                  </div>
                                  <p className="text-[10px] leading-normal">
                                    If your camera fails to scan or your app imposes QR amount restrictions, click <strong>&quot;Pay via UPI App&quot;</strong> to open your UPI app directly, or copy our VPA <code className="font-mono text-primary bg-surface px-1 py-0.5 rounded border border-border select-all">{upiPaymentData.upiId}</code>. Both methods automatically include your exact order amount and Order Reference note.
                                  </p>
                                </div>

                                {/* Mandatory UTR Input (Supports Single & Multiple Split Transfers) */}
                                <div className="pt-2">
                                  <label className="block text-xs font-bold text-primary mb-1">
                                    Enter 12-Digit UPI Transaction Reference / UTR Number(s) *
                                  </label>
                                  <input
                                    type="text"
                                    maxLength={64}
                                    value={customUpiUtr}
                                    onChange={(e) =>
                                      setCustomUpiUtr(e.target.value.replace(/[^a-zA-Z0-9,;\s]/g, ''))
                                    }
                                    placeholder="e.g. 431902847190 (or comma-separated if split payment)"
                                    className="w-full px-3.5 py-2.5 bg-surface border border-accent/60 rounded-xl font-mono text-sm tracking-wider text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                                  />
                                  <span className="text-[10px] text-muted block mt-1">
                                    Found in your UPI app receipt under &quot;UPI Ref No.&quot; or &quot;UTR&quot;. If paid in multiple split transfers due to bank daily caps, enter all UTRs separated by commas. Orders are verified before dispatch.
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Option 2: PayGlocal Global Gateway (Cards & International Multi-Currency) */}
                    {isPayGlocalActive && (
                      <div
                        className={`rounded-2xl border transition-all overflow-hidden ${
                          paymentMethod === 'PAYGLOCAL'
                            ? 'border-accent bg-accent/5 ring-1 ring-accent'
                            : 'border-border bg-surface hover:bg-surface-dim'
                        }`}
                      >
                        <label className="flex items-start gap-3 p-4 cursor-pointer">
                          <input
                            type="radio"
                            name="paymentMethod"
                            checked={paymentMethod === 'PAYGLOCAL'}
                            onChange={() => setPaymentMethod('PAYGLOCAL')}
                            className="mt-1 accent-accent"
                          />
                          <div className="flex-1">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <span className="text-xs font-bold text-primary flex items-center gap-2">
                                <Globe className="w-4 h-4 text-sky-600" />
                                PayGlocal Global Multi-Currency Gateway (Cards, USD, GBP, EUR, INR)
                              </span>
                              <span className="text-[10px] font-bold text-sky-700 bg-sky-100 px-2 py-0.5 rounded-full">
                                INTERNATIONAL &amp; DOMESTIC
                              </span>
                            </div>
                            <p className="text-[11px] text-muted mt-1">
                              Pay securely with international credit/debit cards, UK Sort Code &amp; multi-currency settlement powered by PayGlocal.
                            </p>
                          </div>
                        </label>

                        {paymentMethod === 'PAYGLOCAL' && (
                          <div className="p-4 bg-surface border-t border-border/80 space-y-3 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-muted">Settlement Currency:</span>
                              <div className="flex gap-1.5">
                                {(['INR', 'USD', 'GBP', 'EUR'] as const).map((curr) => (
                                  <button
                                    key={curr}
                                    type="button"
                                    onClick={() => setPayglocalCurrency(curr)}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                                      payglocalCurrency === curr
                                        ? 'bg-accent text-white shadow-xs'
                                        : 'bg-surface-dim text-primary border border-border hover:bg-surface-container'
                                    }`}
                                  >
                                    {curr}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div className="p-3 bg-surface-dim rounded-xl border border-border text-[11px] text-muted flex items-start gap-2">
                              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                              <span>
                                You will be redirected to PayGlocal&apos;s 256-bit encrypted checkout hosted environment (Merchant: TechilyFly / ptplabdurrah9915) to complete payment.
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Option 3: Standard Cards (Razorpay / Stripe) */}
                    {isCardsActive && (
                      <label
                        className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${
                          paymentMethod === 'CARDS'
                            ? 'border-accent bg-accent/5 ring-1 ring-accent'
                            : 'border-border bg-surface hover:bg-surface-dim'
                        }`}
                      >
                        <input
                          type="radio"
                          name="paymentMethod"
                          checked={paymentMethod === 'CARDS'}
                          onChange={() => setPaymentMethod('CARDS')}
                          className="mt-1 accent-accent"
                        />
                        <div className="flex-1">
                          <span className="text-xs font-bold text-primary flex items-center gap-2">
                            <CreditCard className="w-4 h-4 text-accent" />
                            Credit / Debit Card (Visa, MasterCard, RuPay via Secured Gateway)
                          </span>
                          <p className="text-[11px] text-muted mt-1">
                            Secured via RBI-compliant tokenization and 3D Secure OTP.
                          </p>
                          {paymentMethod === 'CARDS' && (
                            <div className="mt-3 pt-3 border-t border-border/80 grid grid-cols-2 gap-2 text-xs">
                              <div className="col-span-2">
                                <input
                                  type="text"
                                  value={cardNumber}
                                  onChange={(e) => setCardNumber(e.target.value)}
                                  placeholder="Card Number (4000 1234 5678 9010)"
                                  className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-primary focus:outline-none focus:border-accent"
                                />
                              </div>
                              <div>
                                <input
                                  type="text"
                                  value={cardExpiry}
                                  onChange={(e) => setCardExpiry(e.target.value)}
                                  placeholder="MM / YY"
                                  className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-primary focus:outline-none focus:border-accent"
                                />
                              </div>
                              <div>
                                <input
                                  type="password"
                                  maxLength={4}
                                  value={cardCvv}
                                  onChange={(e) => setCardCvv(e.target.value)}
                                  placeholder="CVV"
                                  className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-primary focus:outline-none focus:border-accent"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </label>
                    )}

                    {/* Option 4: Net Banking (Razorpay) */}
                    {isNetBankingActive && (
                      <label
                        className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${
                          paymentMethod === 'NET_BANKING'
                            ? 'border-accent bg-accent/5 ring-1 ring-accent'
                            : 'border-border bg-surface hover:bg-surface-dim'
                        }`}
                      >
                        <input
                          type="radio"
                          name="paymentMethod"
                          checked={paymentMethod === 'NET_BANKING'}
                          onChange={() => setPaymentMethod('NET_BANKING')}
                          className="mt-1 accent-accent"
                        />
                        <div className="flex-1">
                          <span className="text-xs font-bold text-primary flex items-center gap-2">
                            <Building className="w-4 h-4 text-accent" />
                            Net Banking
                          </span>
                          <p className="text-[11px] text-muted mt-1">
                            Select from 50+ supported Indian banking institutions.
                          </p>
                          {paymentMethod === 'NET_BANKING' && (
                            <div className="mt-3 pt-3 border-t border-border/80">
                              <select
                                value={selectedBank}
                                onChange={(e) => setSelectedBank(e.target.value)}
                                className="w-full text-xs px-3 py-2 bg-surface border border-border rounded-lg text-primary focus:outline-none focus:border-accent"
                              >
                                <option value="HDFC Bank">HDFC Bank</option>
                                <option value="State Bank of India">State Bank of India (SBI)</option>
                                <option value="ICICI Bank">ICICI Bank</option>
                                <option value="Axis Bank">Axis Bank</option>
                                <option value="Punjab National Bank">Punjab National Bank</option>
                              </select>
                            </div>
                          )}
                        </div>
                      </label>
                    )}

                    {/* Option 5: Cash on Delivery (Completely omitted when disabled!) */}
                    {isCodActive && (
                      <label
                        className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${
                          paymentMethod === 'COD'
                            ? 'border-accent bg-accent/5 ring-1 ring-accent'
                            : 'border-border bg-surface hover:bg-surface-dim'
                        }`}
                      >
                        <input
                          type="radio"
                          name="paymentMethod"
                          checked={paymentMethod === 'COD'}
                          onChange={() => setPaymentMethod('COD')}
                          className="mt-1 accent-accent"
                        />
                        <div className="flex-1">
                          <span className="text-xs font-bold text-primary flex items-center gap-2">
                            <Banknote className="w-4 h-4 text-accent" />
                            Cash on Delivery (COD)
                          </span>
                          <p className="text-[11px] text-muted mt-1">
                            Pay in cash or via courier UPI QR upon parcel handover at your doorstep.
                          </p>
                        </div>
                      </label>
                    )}

                    {/* Dynamic Custom Gateways Added by Store Admin */}
                    {customGateways.map((cg) => (
                      <div
                        key={cg.id}
                        className={`rounded-2xl border transition-all overflow-hidden ${
                          paymentMethod === cg.id
                            ? 'border-accent bg-accent/5 ring-1 ring-accent'
                            : 'border-border bg-surface hover:bg-surface-dim'
                        }`}
                      >
                        <label className="flex items-start gap-3 p-4 cursor-pointer">
                          <input
                            type="radio"
                            name="paymentMethod"
                            checked={paymentMethod === cg.id}
                            onChange={() => setPaymentMethod(cg.id as PaymentMethod)}
                            className="mt-1 accent-accent"
                          />
                          <div className="flex-1">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <span className="text-xs font-bold text-primary flex items-center gap-2">
                                <ShieldCheck className="w-4 h-4 text-accent" />
                                {cg.name}
                              </span>
                              {cg.convenienceFeeInPaise ? (
                                <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                                  +₹{(cg.convenienceFeeInPaise / 100).toFixed(0)} Surcharge
                                </span>
                              ) : null}
                            </div>
                            <p className="text-[11px] text-muted mt-1">{cg.description}</p>
                          </div>
                        </label>
                        {paymentMethod === cg.id && cg.credentials?.instructions && (
                          <div className="p-4 bg-surface border-t border-border/80 text-xs text-muted whitespace-pre-line leading-relaxed">
                            {cg.credentials.instructions}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right 5 Columns: Order Summary & Placement */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-surface rounded-3xl border border-border p-6 sm:p-8 shadow-sm space-y-4">
                <h3 className="font-display text-lg font-bold text-primary pb-3 border-b border-border">
                  Order Summary ({items.reduce((s, i) => s + i.quantity, 0)} items)
                </h3>

                {/* Items List */}
                <div className="divide-y divide-border/60 max-h-72 overflow-y-auto pr-1">
                  {items.map((item) => (
                    <div key={item.variantId} className="py-3 flex gap-3 text-xs">
                      <div className="w-12 h-12 rounded-lg bg-surface-dim border border-border overflow-hidden shrink-0">
                        {item.product.media?.[0]?.externalUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={item.product.media[0].externalUrl}
                            alt={item.product.title}
                            className="w-full h-full object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-primary truncate">{item.product.title}</p>
                        <p className="text-[11px] text-muted">{item.variant.title} × {item.quantity}</p>
                        <div className="flex items-baseline gap-1.5 mt-1">
                          <span className="text-xs font-bold text-primary">
                            {formatPaiseToRupees(item.variant.priceInPaise * item.quantity)}
                          </span>
                          {item.variant.compareAtPriceInPaise &&
                            item.variant.compareAtPriceInPaise > item.variant.priceInPaise && (
                              <span className="text-[10px] text-muted line-through font-mono">
                                {formatPaiseToRupees(item.variant.compareAtPriceInPaise * item.quantity)}
                              </span>
                            )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Inline Coupon */}
                <div className="pt-3 border-t border-border">
                  {appliedCoupon ? (
                    <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-xs text-emerald-800">
                      <span>
                        Coupon <strong>{appliedCoupon.code}</strong> applied
                      </span>
                      <button
                        type="button"
                        onClick={removeCoupon}
                        className="text-rose-600 font-bold hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={couponInput}
                          onChange={(e) => setCouponInput(e.target.value)}
                          placeholder="Enter coupon code"
                          className="flex-1 text-xs px-3 py-2 bg-surface-dim border border-border rounded-xl uppercase tracking-wider focus:outline-none focus:border-accent"
                        />
                        <button
                          type="button"
                          onClick={handleApplyCoupon}
                          disabled={isApplyingCoupon}
                          className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-xl disabled:opacity-60"
                        >
                          {isApplyingCoupon ? 'Checking...' : 'Apply'}
                        </button>
                      </div>
                      {(couponError || couponInvalidationMessage) && (
                        <p className="text-[11px] text-rose-600">
                          {couponInvalidationMessage || couponError}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Calculation Rows */}
                <div className="space-y-2 text-xs text-muted pt-3 border-t border-border">
                  <div className="flex justify-between">
                    <span>Items Subtotal</span>
                    <span className="font-semibold text-primary">{formatPaiseToRupees(subtotalInPaise)}</span>
                  </div>

                  {discountInPaise > 0 && (
                    <div className="flex justify-between text-emerald-700 font-medium">
                      <span>Promotional Discount</span>
                      <span>-{formatPaiseToRupees(discountInPaise)}</span>
                    </div>
                  )}

                  {items.some(
                    (i) =>
                      i.variant.compareAtPriceInPaise &&
                      i.variant.compareAtPriceInPaise > i.variant.priceInPaise
                  ) && (
                    <div className="flex justify-between text-emerald-700 font-medium">
                      <span>Catalogue Savings</span>
                      <span>
                        -
                        {formatPaiseToRupees(
                          items.reduce((acc, i) => {
                            if (
                              i.variant.compareAtPriceInPaise &&
                              i.variant.compareAtPriceInPaise > i.variant.priceInPaise
                            ) {
                              return (
                                acc +
                                (i.variant.compareAtPriceInPaise - i.variant.priceInPaise) *
                                  i.quantity
                              );
                            }
                            return acc;
                          }, 0)
                        )}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <span>Standard Express Shipping</span>
                    <span className="font-semibold text-primary">
                      {shippingInPaise === 0 ? (
                        <span className="text-emerald-700 font-bold">FREE</span>
                      ) : (
                        formatPaiseToRupees(shippingInPaise)
                      )}
                    </span>
                  </div>

                  <div className="flex justify-between border-t border-border pt-3 text-sm font-bold text-primary">
                    <span>Grand Total</span>
                    <span className="text-lg text-accent font-extrabold">
                      {formatPaiseToRupees(totalInPaise)}
                    </span>
                  </div>
                </div>

                {/* Submit Order Button */}
                <button
                  type="submit"
                  disabled={isSubmitting || availableMethods.length === 0}
                  className="w-full mt-4 flex items-center justify-center gap-2 py-4 bg-accent hover:bg-accent-hover text-white text-xs sm:text-sm font-bold uppercase tracking-wider rounded-xl shadow-lg transition-all disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span>Placing Your Order...</span>
                  ) : availableMethods.length === 0 ? (
                    <span>Checkout Unavailable (No Active Gateways)</span>
                  ) : (
                    <>
                      <span>Confirm & Place Order</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <p className="text-[10px] text-muted text-center pt-2">
                  By clicking Place Order, you confirm acceptance of InfiniCharm terms, privacy policy, and return guidelines.
                </p>
              </div>

              {/* Checkout Sidebar Recommendations (Frequently Added Together) */}
              <ProductRecommendations
                title="Frequently Added Together"
                subtitle="Complete your order with genuine pantry essentials"
                badgeText="Up to 25% OFF"
                limit={3}
                layout="sidebar"
              />
            </div>
          </div>
        </form>
      </Container>
    </div>
  );
}

