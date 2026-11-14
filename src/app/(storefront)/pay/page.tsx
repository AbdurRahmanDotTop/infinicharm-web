'use client';

// ==============================================================================
// InfiniCharm — Dedicated Shareable UPI Payment Gateway & Settlement Page
// Governing PRD: PRD 09 (Payment Architecture, Universal Shareable Links & Direct Intent)
// Features: Dynamic Order Resolution, 100% Server Authority, Direct UPI Intent,
//           App-Specific Schemes (GPay, PhonePe, Paytm, BHIM, Cred), High-Res QR,
//           Universal Sharing (WhatsApp, Web Share API, Clipboard), UTR Self-Service
// ==============================================================================

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import QRCode from 'qrcode';
import { Order } from '@/types';
import {
  generateUpiPaymentDetails,
  DEFAULT_UPI_CREDENTIALS,
  parseUtrInput,
  verifyPaymentToken,
} from '@/lib/services/upi';
import { getAppOrigin, getOrderTrackingUrl } from '@/lib/utils/env-urls';

function PaymentPageContent() {
  const searchParams = useSearchParams();

  const tokenParam = useMemo(() => {
    return searchParams.get('token') || '';
  }, [searchParams]);

  // Extract order reference from URL query params or pathname
  const orderParam = useMemo(() => {
    const fromQuery =
      searchParams.get('id') ||
      searchParams.get('order') ||
      searchParams.get('order_id') ||
      searchParams.get('ref');
    if (fromQuery && fromQuery.trim()) return fromQuery.trim();

    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname;
      const match = pathname.match(/\/pay\/([^/?#]+)/i);
      if (match && match[1] && match[1] !== 'page') {
        return decodeURIComponent(match[1].trim());
      }
    }
    return '';
  }, [searchParams]);

  const [orderId, setOrderId] = useState<string>(orderParam);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [notFound, setNotFound] = useState<boolean>(false);

  // UTR submission state
  const [utrInput, setUtrInput] = useState<string>('');
  const [payerName, setPayerName] = useState<string>('');
  const [isSubmittingUtr, setIsSubmittingUtr] = useState<boolean>(false);
  const [utrError, setUtrError] = useState<string | null>(null);
  const [utrSuccessMessage, setUtrSuccessMessage] = useState<string | null>(null);

  // UI state
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [showDesktopPrompt, setShowDesktopPrompt] = useState<boolean>(false);

  // Fallback search input if no order ID provided in URL
  const [searchOrderIdInput, setSearchOrderIdInput] = useState<string>('');

  // 1. Fetch Authoritative Order Data from Server API or Cryptographic Token
  useEffect(() => {
    let isMounted = true;
    const effectiveId = orderParam || orderId;

    // Check if cryptographic token is present in query or path
    const effectiveToken = tokenParam || (effectiveId && effectiveId.includes('.') ? effectiveId : '');
    const decodedFromToken = effectiveToken ? verifyPaymentToken(effectiveToken) : null;

    if (decodedFromToken && isMounted) {
      const tokenOrder: Order = {
        id: decodedFromToken.orderId || decodedFromToken.orderNumber,
        orderNumber: decodedFromToken.orderNumber || decodedFromToken.orderId,
        customerId: 'guest',
        customerEmail: decodedFromToken.customerEmail || 'guest@infinicharm.com',
        customerPhone: decodedFromToken.customerPhone || '8825164657',
        status: 'PENDING',
        subtotalInPaise: decodedFromToken.totalInPaise,
        discountInPaise: 0,
        shippingInPaise: 0,
        taxInPaise: 0,
        totalInPaise: decodedFromToken.totalInPaise,
        paymentMethod: 'CUSTOM_UPI',
        paymentStatus: 'PENDING',
        shippingAddress: {
          id: 'addr-token',
          customerId: 'guest',
          fullName: decodedFromToken.customerName || 'Valued Patron',
          phone: decodedFromToken.customerPhone || '8825164657',
          addressLine1: 'Consignment Delivery Address',
          city: 'East Champaran',
          state: 'Bihar',
          postalCode: '845427',
          country: 'India',
          isDefaultShipping: true,
          isDefaultBilling: false,
        },
        billingAddress: {
          id: 'bill-token',
          customerId: 'guest',
          fullName: decodedFromToken.customerName || 'Valued Patron',
          phone: decodedFromToken.customerPhone || '8825164657',
          addressLine1: 'Consignment Delivery Address',
          city: 'East Champaran',
          state: 'Bihar',
          postalCode: '845427',
          country: 'India',
          isDefaultShipping: true,
          isDefaultBilling: false,
        },
        items: decodedFromToken.items?.map((it, idx) => ({
          id: `item-token-${idx}`,
          orderId: decodedFromToken.orderNumber,
          productId: 'prod-item',
          variantId: 'var-item',
          productTitle: it.title,
          variantTitle: 'Standard',
          sku: 'SKU-UPI',
          priceInPaise: it.priceInPaise,
          quantity: it.quantity,
          totalInPaise: it.priceInPaise * it.quantity,
        })) || [],
        timeline: [],
        createdAt: decodedFromToken.createdAt || new Date().toISOString(),
        updatedAt: decodedFromToken.createdAt || new Date().toISOString(),
      };
      setOrder(tokenOrder);
      setOrderId(tokenOrder.orderNumber);
    }

    if (!effectiveId && !decodedFromToken) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setNotFound(false);
    setUtrError(null);

    async function fetchOrderDetails() {
      try {
        const queryUrl = `/api/orders/${encodeURIComponent(effectiveId || decodedFromToken?.orderNumber || '')}${
          effectiveToken ? `?token=${encodeURIComponent(effectiveToken)}` : ''
        }`;
        const res = await fetch(queryUrl, { cache: 'no-store' });
        if (!isMounted) return;

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.order) {
            setOrder(data.order);
            setOrderId(data.order.orderNumber || data.order.id);
            if (data.order.utrNumber) {
              setUtrInput(data.order.utrNumber);
            }
            return;
          }
        }

        // Check client localStorage fallback (both infinicharm_orders and infinicharm_recent_orders)
        if (typeof window !== 'undefined') {
          try {
            const raw =
              localStorage.getItem('infinicharm_orders') ||
              localStorage.getItem('infinicharm_recent_orders');
            if (raw) {
              const list: Order[] = JSON.parse(raw);
              const searchId = (effectiveId || decodedFromToken?.orderNumber || '').toUpperCase();
              const found = list.find(
                (o) =>
                  o.orderNumber?.toUpperCase() === searchId ||
                  o.id?.toUpperCase() === searchId
              );
              if (found && isMounted) {
                setOrder(found);
                setOrderId(found.orderNumber || found.id);
                if (found.utrNumber) setUtrInput(found.utrNumber);
                return;
              }
            }
          } catch {
            // Ignore storage parse errors
          }
        }

        // If verified cryptographic token is active, we have authoritative order info even without server match
        if (decodedFromToken && isMounted) {
          return;
        }

        if (isMounted) {
          setNotFound(true);
        }
      } catch (err) {
        console.error('Error fetching order for payment page:', err);
        if (isMounted && !decodedFromToken) setNotFound(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchOrderDetails();
    return () => {
      isMounted = false;
    };
  }, [orderParam, orderId, tokenParam]);

  // 2. Authoritative Payment Details Calculation
  const totalInPaise = useMemo(() => {
    if (!order) return 0;
    return Math.max(0, Math.round(Number(order.totalInPaise) || 0));
  }, [order]);

  const activeOrderId = order?.orderNumber || orderId || 'INF-ORDER';

  const upiDetails = useMemo(() => {
    return generateUpiPaymentDetails({
      totalInPaise,
      orderId: activeOrderId,
    });
  }, [totalInPaise, activeOrderId]);

  // 3. Dynamic QR Code Generation
  useEffect(() => {
    let active = true;
    if (upiDetails.upiIntentUri) {
      QRCode.toDataURL(upiDetails.upiIntentUri, {
        margin: 1,
        width: 320,
        errorCorrectionLevel: 'M',
      })
        .then((url) => {
          if (active) setQrCodeDataUrl(url);
        })
        .catch((err) => {
          console.error('QR code generation failed:', err);
        });
    }
    return () => {
      active = false;
    };
  }, [upiDetails.upiIntentUri]);

  // 4. Copy Handler with Feedback
  const handleCopy = (text: string, key: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2500);
    }
  };

  // 5. Native Device Share Sheet
  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `InfiniCharm Order Payment — ${activeOrderId}`,
          text: `Please complete the payment of ₹${upiDetails.amountInRupees} for InfiniCharm Order #${activeOrderId}:`,
          url: upiDetails.shareablePaymentUrl,
        });
      } catch {
        // User cancelled share
      }
    } else {
      // Fallback to copying payment link
      handleCopy(upiDetails.shareablePaymentUrl, 'shareable_link');
    }
  };

  // 6. UTR Submission Handler
  const handleSubmitUtr = async (e: React.FormEvent) => {
    e.preventDefault();
    setUtrError(null);
    setUtrSuccessMessage(null);

    const validation = parseUtrInput(utrInput);
    if (!validation.isValid) {
      setUtrError(validation.error || 'Please enter a valid 12-digit UPI UTR number.');
      return;
    }

    setIsSubmittingUtr(true);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(activeOrderId)}/utr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          utr: validation.rawCleaned,
          payerName: payerName.trim() || order?.shippingAddress?.fullName || 'Customer / Payer',
          token: tokenParam || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.order) {
        setOrder(data.order);
        setUtrSuccessMessage(
          `Payment Reference "${validation.rawCleaned}" submitted successfully! Our banking desk is reconciling this with our IndusInd Bank Current Account. Your order will be confirmed upon verification.`
        );
      } else {
        setUtrError(data.error || 'Failed to submit UTR. Please verify details and try again.');
      }
    } catch (err: any) {
      console.error('Error submitting UTR:', err);
      setUtrError('Network error while submitting UTR. Please try again.');
    } finally {
      setIsSubmittingUtr(false);
    }
  };

  // State guards
  const isPaid = order?.paymentStatus === 'PAID' || order?.status === 'CONFIRMED';
  const isCancelled = ['CANCELLED', 'RETURNED', 'REFUNDED'].includes(order?.status || '');
  const isPendingReview = order?.manualApprovalStatus === 'PENDING_REVIEW';

  // ---------------------------------------------------------------------------
  // RENDER: Loading State
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 border-3 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />
        <h2 className="font-editorial text-xl font-bold text-slate">Loading Secure Payment Page...</h2>
        <p className="text-xs text-muted mt-1">Retrieving authoritative order details & UPI payment intent...</p>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER: Order Not Found / Search State
  // ---------------------------------------------------------------------------
  if (notFound || !order) {
    return (
      <div className="min-h-[70vh] max-w-xl mx-auto px-4 py-16 flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center text-2xl font-bold mb-4 shadow-sm border border-amber-200">
          !
        </div>
        <h1 className="font-editorial text-2xl md:text-3xl font-bold text-slate">
          Order Payment Reference Not Found
        </h1>
        <p className="text-xs md:text-sm text-muted mt-2 max-w-md">
          We could not locate an active order for reference{' '}
          <strong className="font-mono text-primary font-bold">"{activeOrderId}"</strong>. Please verify
          your Order Number or enter it below to load your payment link.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (searchOrderIdInput.trim()) {
              setOrderId(searchOrderIdInput.trim());
            }
          }}
          className="w-full max-w-md mt-6 flex gap-2"
        >
          <input
            type="text"
            placeholder="e.g. INF-202611-2527"
            value={searchOrderIdInput}
            onChange={(e) => setSearchOrderIdInput(e.target.value)}
            className="flex-1 px-4 py-2.5 text-xs md:text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary uppercase font-mono"
          />
          <button
            type="submit"
            className="px-5 py-2.5 bg-primary text-white text-xs md:text-sm font-semibold rounded-lg hover:bg-primary/95 transition-all shadow-sm"
          >
            Find Order
          </button>
        </form>

        <div className="mt-8 flex flex-wrap gap-3 justify-center text-xs">
          <Link
            href="/shop"
            className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-slate rounded-lg font-medium transition-colors"
          >
            ← Explore Catalog
          </Link>
          <Link
            href="/contact"
            className="px-4 py-2 border border-stone-200 hover:bg-stone-50 text-muted rounded-lg font-medium transition-colors"
          >
            Contact Customer Support
          </Link>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER: Full Authoritative Payment Page
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#FAF7F2] py-8 md:py-12 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Top Header & Security Banner */}
        <div className="bg-white border border-stone-200 rounded-2xl p-5 md:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                Official Secure Payment Desk
              </span>
              <span className="text-[11px] font-medium text-muted hidden sm:inline">
                • 256-Bit SSL Encrypted
              </span>
            </div>
            <h1 className="font-editorial text-2xl md:text-3xl font-bold text-slate">
              Complete Payment for Order #{order.orderNumber}
            </h1>
            <p className="text-xs text-muted mt-1">
              Placed on {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}{' '}
              by <strong className="text-slate font-medium">{order.shippingAddress?.fullName || 'Valued Customer'}</strong>
            </p>
          </div>

          {/* Status Badge */}
          <div className="flex flex-col items-start md:items-end gap-1">
            {isPaid ? (
              <span className="px-3.5 py-1.5 bg-emerald-500 text-white text-xs font-bold rounded-full shadow-sm flex items-center gap-1.5">
                ✓ Payment Verified & Confirmed
              </span>
            ) : isCancelled ? (
              <span className="px-3.5 py-1.5 bg-rose-500 text-white text-xs font-bold rounded-full shadow-sm">
                Order Cancelled
              </span>
            ) : isPendingReview ? (
              <span className="px-3.5 py-1.5 bg-amber-500 text-white text-xs font-bold rounded-full shadow-sm">
                ⏳ UTR Under Bank Verification
              </span>
            ) : (
              <span className="px-3.5 py-1.5 bg-primary text-white text-xs font-bold rounded-full shadow-sm animate-pulse">
                Awaiting Payment
              </span>
            )}
            <span className="text-[11px] font-mono text-muted">
              Ref: <strong className="text-slate">{activeOrderId}</strong>
            </span>
          </div>
        </div>

        {/* Status Alert Banners */}
        {isPaid && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
            <span className="text-emerald-700 font-bold text-lg">✓</span>
            <div className="text-xs text-emerald-900 leading-relaxed">
              <strong className="font-semibold block text-sm text-emerald-950 mb-0.5">
                This order has already been paid and confirmed!
              </strong>
              Your payment has been reconciled with our accounts desk. No further payment is needed.{' '}
              <Link href={getOrderTrackingUrl(activeOrderId)} className="underline font-bold text-emerald-900">
                Track your shipment here →
              </Link>
            </div>
          </div>
        )}

        {isCancelled && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3">
            <span className="text-rose-700 font-bold text-lg">✕</span>
            <div className="text-xs text-rose-900 leading-relaxed">
              <strong className="font-semibold block text-sm text-rose-950 mb-0.5">
                This order was cancelled.
              </strong>
              This order reference is no longer active. If you wish to purchase these products, please place a new order on our store.
            </div>
          </div>
        )}

        {/* Main Grid: Left = Payment Actions & QR; Right = Order Summary & UTR */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* ================================================================= */}
          {/* LEFT COLUMN: UPI Gateway, Direct Intent & QR Code (7 cols)       */}
          {/* ================================================================= */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white border border-stone-200 rounded-2xl p-5 md:p-6 shadow-sm space-y-6">
              {/* Amount Highlight */}
              <div className="bg-gradient-to-br from-stone-50 to-[#FAF7F2] border border-stone-200/80 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-muted font-bold block">
                    Exact Amount Payable
                  </span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-3xl md:text-4xl font-extrabold text-slate font-editorial">
                      ₹{upiDetails.amountInRupees}
                    </span>
                    <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      0% Payment Surcharge
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(upiDetails.amountInRupees, 'amount')}
                  className="text-[11px] font-semibold text-primary hover:underline px-2.5 py-1 rounded bg-white border border-stone-200 shadow-2xs"
                >
                  {copiedKey === 'amount' ? '✓ Copied' : 'Copy Amount'}
                </button>
              </div>

              {/* Direct UPI App Launch Button (Primary CTA) */}
              {!isPaid && !isCancelled && (
                <div className="space-y-3">
                  <a
                    href={upiDetails.upiIntentUri}
                    data-testid="payment-page-pay-btn"
                    onClick={() => {
                      // Desktop trigger
                      if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
                        setShowDesktopPrompt(true);
                      }
                    }}
                    className="w-full flex items-center justify-center gap-2.5 py-3.5 px-4 bg-primary text-white rounded-xl font-bold text-sm md:text-base hover:bg-primary/95 transition-all shadow-md active:scale-[0.99] text-center"
                  >
                    <span>⚡ Pay via UPI App</span>
                    <span className="text-xs font-normal opacity-90 hidden sm:inline">
                      (GPay, PhonePe, Paytm, BHIM)
                    </span>
                  </a>

                  {/* App-Specific 1-Tap Pills (Gold Standard for iOS Safari) */}
                  <div>
                    <span className="text-[11px] text-muted font-semibold block mb-2 text-center">
                      Or select your preferred UPI application directly:
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      <a
                        href={upiDetails.appUris.phonePe}
                        className="flex items-center justify-center py-2 px-2.5 bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 rounded-lg text-xs font-bold transition-all text-center"
                      >
                        PhonePe
                      </a>
                      <a
                        href={upiDetails.appUris.gPay}
                        className="flex items-center justify-center py-2 px-2.5 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 rounded-lg text-xs font-bold transition-all text-center"
                      >
                        Google Pay
                      </a>
                      <a
                        href={upiDetails.appUris.paytm}
                        className="flex items-center justify-center py-2 px-2.5 bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200 rounded-lg text-xs font-bold transition-all text-center"
                      >
                        Paytm
                      </a>
                      <a
                        href={upiDetails.appUris.bhim}
                        className="flex items-center justify-center py-2 px-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 rounded-lg text-xs font-bold transition-all text-center"
                      >
                        BHIM UPI
                      </a>
                      <a
                        href={upiDetails.appUris.cred}
                        className="flex items-center justify-center py-2 px-2.5 bg-stone-100 hover:bg-stone-200 text-stone-900 border border-stone-300 rounded-lg text-xs font-bold transition-all text-center col-span-2 sm:col-span-1"
                      >
                        CRED
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* Desktop click guidance prompt */}
              {showDesktopPrompt && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start justify-between gap-2">
                  <span>
                    <strong>Launching UPI Application...</strong> If your desktop browser does not have a registered UPI app, please scan the QR code below using your mobile phone.
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowDesktopPrompt(false)}
                    className="font-bold text-amber-900 hover:text-black"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Dynamic QR Code Section */}
              <div className="pt-2 border-t border-stone-100">
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <div className="relative p-3 bg-white border-2 border-dashed border-stone-300 rounded-2xl shadow-inner flex flex-col items-center">
                    {qrCodeDataUrl ? (
                      <img
                        src={qrCodeDataUrl}
                        alt={`InfiniCharm Dynamic UPI QR for ${activeOrderId}`}
                        className="w-48 h-48 md:w-52 md:h-52 object-contain"
                      />
                    ) : (
                      <div className="w-48 h-48 md:w-52 md:h-52 bg-stone-100 animate-pulse rounded-lg flex items-center justify-center text-xs text-muted">
                        Generating Dynamic QR...
                      </div>
                    )}
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full mt-2 border border-emerald-200">
                      ✓ Auto-filled in your UPI App
                    </span>
                  </div>

                  <div className="space-y-3 flex-1 text-center sm:text-left">
                    <h3 className="font-bold text-sm text-slate">
                      Scan with any UPI Application
                    </h3>
                    <p className="text-xs text-muted leading-relaxed">
                      Point your phone camera or open Google Pay, PhonePe, Paytm, or BHIM to scan. The payable amount and order note will be populated automatically.
                    </p>

                    <div className="text-[11px] bg-stone-50 p-2.5 rounded-lg border border-stone-200">
                      <span className="text-muted block text-[10px] font-bold uppercase">
                        Transaction Note auto-populated:
                      </span>
                      <strong className="text-primary font-mono font-bold block truncate">
                        {upiDetails.transactionNote}
                      </strong>
                    </div>

                    {qrCodeDataUrl && (
                      <a
                        href={qrCodeDataUrl}
                        download={`infinicharm-qr-${activeOrderId}.png`}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate hover:text-primary transition-colors py-1.5 px-3 bg-stone-100 rounded-lg border border-stone-200"
                      >
                        📥 Download QR Code
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Official Payee Bank Details (Transparency & Copy) */}
              <div className="space-y-2 pt-2 border-t border-stone-100">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">
                  Official Payee Information (Merchant Authority)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 bg-stone-50 rounded-lg border border-stone-200 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-muted block">Official UPI ID (VPA):</span>
                      <strong className="font-mono text-slate text-xs">{upiDetails.upiId}</strong>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(upiDetails.upiId, 'vpa')}
                      className="text-xs text-primary font-semibold hover:underline px-2 py-1"
                    >
                      {copiedKey === 'vpa' ? '✓' : 'Copy'}
                    </button>
                  </div>

                  <div className="p-2.5 bg-stone-50 rounded-lg border border-stone-200 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-muted block">Payee / Mobile:</span>
                      <strong className="text-slate text-xs">
                        {upiDetails.upiNumber} • {upiDetails.payeeName}
                      </strong>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(upiDetails.upiNumber, 'phone')}
                      className="text-xs text-primary font-semibold hover:underline px-2 py-1"
                    >
                      {copiedKey === 'phone' ? '✓' : 'Copy'}
                    </button>
                  </div>

                  <div className="p-2.5 bg-stone-50 rounded-lg border border-stone-200 col-span-1 sm:col-span-2 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-muted block">Bank Settlement:</span>
                      <span className="text-xs text-slate">
                        <strong>IndusInd Bank (Current)</strong> • A/C: <span className="font-mono">258825164657</span> • IFSC: <span className="font-mono">INDB0001548</span>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy('258825164657', 'bank_ac')}
                      className="text-xs text-primary font-semibold hover:underline px-2 py-1"
                    >
                      {copiedKey === 'bank_ac' ? '✓' : 'Copy A/C'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Universal Sharing & Copy Section */}
              <div className="pt-2 border-t border-stone-100 space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">
                  Share Payment Request (Universal HTTPS Link)
                </span>
                <p className="text-xs text-muted">
                  Share this secure link with whoever is paying (via WhatsApp, SMS, or Telegram). Anyone with this link can view the order and pay via their UPI app.
                </p>

                <div className="flex flex-wrap gap-2">
                  {/* Copy HTTPS Link Button */}
                  <button
                    type="button"
                    onClick={() => handleCopy(upiDetails.shareablePaymentUrl, 'payment_link')}
                    className="flex-1 min-w-[160px] py-2.5 px-4 bg-stone-100 hover:bg-stone-200 text-slate text-xs font-bold rounded-xl border border-stone-300 transition-all flex items-center justify-center gap-1.5"
                  >
                    <span>🔗</span>
                    <span>{copiedKey === 'payment_link' ? '✓ Copied Link!' : 'Copy Payment Link'}</span>
                  </button>

                  {/* Share on WhatsApp */}
                  <a
                    href={upiDetails.whatsAppShareUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 min-w-[160px] py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <span>💬</span>
                    <span>Share on WhatsApp</span>
                  </a>

                  {/* Native Device Share */}
                  <button
                    type="button"
                    onClick={handleNativeShare}
                    className="py-2.5 px-4 bg-white hover:bg-stone-50 text-slate text-xs font-bold rounded-xl border border-stone-200 transition-all flex items-center justify-center gap-1.5"
                  >
                    <span>📤</span>
                    <span>Share Link</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ================================================================= */}
          {/* RIGHT COLUMN: Order Summary & UTR Self-Service Form (5 cols)     */}
          {/* ================================================================= */}
          <div className="lg:col-span-5 space-y-6">
            {/* Order Items & Financial Summary */}
            <div className="bg-white border border-stone-200 rounded-2xl p-5 md:p-6 shadow-sm space-y-4">
              <h3 className="font-bold text-sm text-slate border-b border-stone-100 pb-3 flex items-center justify-between">
                <span>Order Summary</span>
                <span className="text-xs font-mono font-normal text-muted">
                  {order.items?.length || 0} items
                </span>
              </h3>

              <div className="divide-y divide-stone-100 max-h-56 overflow-y-auto pr-1">
                {order.items?.map((item, idx) => (
                  <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                    <div className="pr-2">
                      <strong className="text-slate block font-medium truncate max-w-[200px]">
                        {item.productTitle || (item as any).title}
                      </strong>
                      <span className="text-muted text-[11px]">
                        Qty: {item.quantity} × ₹{((item.priceInPaise || 0) / 100).toFixed(2)}
                      </span>
                    </div>
                    <span className="font-mono font-semibold text-slate">
                      ₹{(((item.quantity || 1) * (item.priceInPaise || 0)) / 100).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-stone-100 space-y-1.5 text-xs text-muted">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-mono text-slate">₹{((order.subtotalInPaise || 0) / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Delivery / Shipping</span>
                  <span className="font-mono text-slate">
                    {(order.shippingInPaise || 0) === 0 ? 'FREE' : `₹${((order.shippingInPaise || 0) / 100).toFixed(2)}`}
                  </span>
                </div>
                {Number(order.discountInPaise || 0) > 0 && (
                  <div className="flex justify-between text-emerald-700 font-semibold">
                    <span>Discount Applied</span>
                    <span className="font-mono">-₹{((order.discountInPaise || 0) / 100).toFixed(2)}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-stone-200 flex justify-between text-sm font-bold text-slate">
                  <span>Total Amount</span>
                  <span className="font-mono text-primary text-base">₹{upiDetails.amountInRupees}</span>
                </div>
              </div>
            </div>

            {/* UTR Submission Card (Self-Service Settlement) */}
            <div className="bg-white border border-stone-200 rounded-2xl p-5 md:p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                  2
                </span>
                <h3 className="font-bold text-sm text-slate">
                  Submit Payment Reference (UTR)
                </h3>
              </div>

              <p className="text-xs text-muted leading-relaxed">
                After completing your transfer in your UPI app, enter the <strong>12-digit UTR Number</strong> (found in your UPI transaction receipt under "UPI Ref No." or "UTR") below.
              </p>

              {utrSuccessMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 leading-relaxed">
                  {utrSuccessMessage}
                </div>
              )}

              {utrError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 leading-relaxed">
                  {utrError}
                </div>
              )}

              {order.utrNumber && !utrSuccessMessage && (
                <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs">
                  <span className="text-muted block text-[10px] font-bold uppercase">
                    Submitted Reference on Record:
                  </span>
                  <span className="font-mono font-bold text-slate text-sm">
                    {order.utrNumber}
                  </span>
                  <span className="block text-[11px] text-amber-700 mt-1">
                    ⏳ Payment is under bank statement verification.
                  </span>
                </div>
              )}

              {!isPaid && !isCancelled && (
                <form onSubmit={handleSubmitUtr} className="space-y-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1">
                      12-Digit UPI Transaction Reference / UTR *
                    </label>
                    <input
                      type="text"
                      maxLength={64}
                      value={utrInput}
                      onChange={(e) => setUtrInput(e.target.value)}
                      placeholder="e.g. 431902847190 (or comma-separated if split)"
                      className="w-full px-3.5 py-2.5 bg-white border border-stone-200 rounded-xl font-mono text-xs md:text-sm focus:outline-none focus:ring-1 focus:ring-primary uppercase tracking-wide"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1">
                      Payer Full Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={payerName}
                      onChange={(e) => setPayerName(e.target.value)}
                      placeholder={order.shippingAddress?.fullName || 'Name on bank account'}
                      className="w-full px-3.5 py-2.5 bg-white border border-stone-200 rounded-xl text-xs md:text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingUtr}
                    className="w-full py-3 px-4 bg-slate text-white text-xs md:text-sm font-bold rounded-xl hover:bg-black transition-all shadow-sm disabled:opacity-50"
                  >
                    {isSubmittingUtr ? 'Verifying Reference...' : 'Submit UTR for Verification'}
                  </button>
                </form>
              )}

              <div className="pt-2 text-[11px] text-muted space-y-1">
                <span className="font-semibold block text-slate">Verification Policy:</span>
                <p>
                  Orders are dispatched upon confirmation of funds in our IndusInd Bank Current account. Please allow 15–30 minutes during banking hours.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PaymentPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
          <div className="w-10 h-10 border-2 border-primary/20 border-t-primary rounded-full animate-spin mb-3" />
          <span className="text-xs text-muted">Loading payment interface...</span>
        </div>
      }
    >
      <PaymentPageContent />
    </Suspense>
  );
}
