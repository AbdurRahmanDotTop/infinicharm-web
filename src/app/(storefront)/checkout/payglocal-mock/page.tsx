'use client';

// ==============================================================================
// InfiniCharm — PayGlocal Hosted Checkout Sandbox Simulator
// Merchant ID: ptplabdurrah9915 | Multi-Currency: ptplabdurrah9923
// ==============================================================================

import React, { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  ShieldCheck,
  Lock,
  CreditCard,
  Building,
  CheckCircle2,
  XCircle,
  Globe,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';

function PayGlocalMockCheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const gid = searchParams.get('gid') || `gl_${Date.now()}`;
  const orderNumber = searchParams.get('orderNumber') || 'INF-202611-SAMPLE';
  const amount = searchParams.get('amount') || '149.00';
  const currency = (searchParams.get('currency') || 'INR').toUpperCase();
  const email = searchParams.get('email') || 'customer@infinicharm.com';

  const [selectedMethod, setSelectedMethod] = useState<'CARD' | 'NET_BANKING' | 'INTERNATIONAL'>('CARD');
  const [cardNumber, setCardNumber] = useState('4242 •••• •••• 4242');
  const [expiry, setExpiry] = useState('12/28');
  const [cvv, setCvv] = useState('•••');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSimulateAction = (status: 'SUCCESS' | 'FAILED' | 'CANCELLED') => {
    setIsProcessing(true);

    setTimeout(() => {
      if (status === 'SUCCESS') {
        // Update order in local storage if present
        try {
          const storedOrders = localStorage.getItem('infinicharm_orders');
          if (storedOrders) {
            const orders = JSON.parse(storedOrders);
            const updated = orders.map((o: any) =>
              o.orderNumber === orderNumber
                ? {
                    ...o,
                    status: 'CONFIRMED',
                    paymentStatus: 'PAID',
                    paymentMethod: 'PAYGLOCAL',
                    updatedAt: new Date().toISOString(),
                  }
                : o
            );
            localStorage.setItem('infinicharm_orders', JSON.stringify(updated));
          }

          // Record payment transaction
          const storedTxs = localStorage.getItem('infinicharm_payment_transactions');
          const txs = storedTxs ? JSON.parse(storedTxs) : [];
          const newTx = {
            id: `tx-${Date.now()}`,
            orderNumber,
            gatewayId: 'PAYGLOCAL',
            gatewayTransactionId: gid,
            amountInPaise: Math.round(parseFloat(amount) * 100),
            currency,
            method: 'PAYGLOCAL',
            status: 'SUCCESS',
            customerEmail: email,
            customerPhone: '8825164657',
            payglocalGid: gid,
            createdAt: new Date().toISOString(),
          };
          localStorage.setItem('infinicharm_payment_transactions', JSON.stringify([newTx, ...txs]));
        } catch {
          // ignore
        }

        window.location.href = `/api/payments/payglocal/callback?orderNumber=${encodeURIComponent(
          orderNumber
        )}&gid=${encodeURIComponent(gid)}&status=SUCCESS`;
      } else if (status === 'FAILED') {
        window.location.href = `/api/payments/payglocal/callback?orderNumber=${encodeURIComponent(
          orderNumber
        )}&gid=${encodeURIComponent(gid)}&status=FAILED`;
      } else {
        window.location.href = `/checkout?payment_error=Transaction+cancelled+by+customer`;
      }
    }, 400);
  };

  return (
    <div className="min-h-screen bg-neutral-900 text-white flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
      <div className="max-w-md w-full bg-neutral-950 border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* PayGlocal Branding Header */}
        <div className="flex items-center justify-between pb-5 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <span className="font-display font-extrabold text-base tracking-tight text-white block">
                PayGlocal™
              </span>
              <span className="text-[10px] text-sky-400 font-mono">
                Global Gateway • Sandbox UAT
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-800 text-neutral-400 text-[10px] font-mono">
            <Lock className="w-3 h-3 text-emerald-400" />
            <span>256-Bit SSL</span>
          </div>
        </div>

        {/* Merchant & Order Info */}
        <div className="my-5 p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-neutral-400">Merchant</span>
            <span className="font-semibold text-white">TechilyFly (ptplabdurrah9915)</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-neutral-400">Order ID</span>
            <span className="font-mono text-white font-bold">{orderNumber}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-neutral-400">Session GID</span>
            <span className="font-mono text-[11px] text-neutral-400 truncate max-w-[180px]">
              {gid}
            </span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-neutral-800 text-sm font-bold">
            <span className="text-white">Amount Due</span>
            <span className="text-sky-400 font-mono text-base">
              {currency === 'INR' ? '₹' : currency === 'GBP' ? '£' : '$'}
              {amount} {currency}
            </span>
          </div>
        </div>

        {/* Method Selector */}
        <div className="space-y-3 mb-6">
          <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block">
            Select Payment Method
          </label>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <button
              type="button"
              onClick={() => setSelectedMethod('CARD')}
              className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                selectedMethod === 'CARD'
                  ? 'border-sky-500 bg-sky-500/10 text-white'
                  : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span className="text-[11px] font-medium">Card</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedMethod('NET_BANKING')}
              className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                selectedMethod === 'NET_BANKING'
                  ? 'border-sky-500 bg-sky-500/10 text-white'
                  : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white'
              }`}
            >
              <Building className="w-4 h-4" />
              <span className="text-[11px] font-medium">NetBanking</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedMethod('INTERNATIONAL')}
              className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                selectedMethod === 'INTERNATIONAL'
                  ? 'border-sky-500 bg-sky-500/10 text-white'
                  : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white'
              }`}
            >
              <Globe className="w-4 h-4" />
              <span className="text-[11px] font-medium">Multi-Curr</span>
            </button>
          </div>

          {/* Simulated Card Form */}
          {selectedMethod === 'CARD' && (
            <div className="p-3.5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-2.5 text-xs">
              <div>
                <label className="text-[10px] text-neutral-400 block mb-1">Card Number</label>
                <input
                  type="text"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-sky-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-neutral-400 block mb-1">Expiry</label>
                  <input
                    type="text"
                    value={expiry}
                    onChange={(e) => setExpiry(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-neutral-400 block mb-1">CVV</label>
                  <input
                    type="text"
                    value={cvv}
                    onChange={(e) => setCvv(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>
            </div>
          )}

          {selectedMethod === 'INTERNATIONAL' && (
            <div className="p-3.5 rounded-2xl bg-neutral-900 border border-neutral-800 text-xs space-y-1.5 text-neutral-300">
              <p className="font-semibold text-white">GBP / EUR Multi-Currency Direct Rail</p>
              <p className="text-[11px] text-neutral-400">
                Sort Code: <span className="font-mono text-white">608382</span> • Account:{' '}
                <span className="font-mono text-white">44576489</span>
              </p>
              <p className="text-[11px] text-neutral-400">Beneficiary: Techily Fly By Ibn Ghufran</p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5">
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => handleSimulateAction('SUCCESS')}
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-sky-900/30 transition-all disabled:opacity-50"
          >
            {isProcessing ? (
              <span>Authorizing with PayGlocal...</span>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Simulate Successful Payment (Authorize & Capture)</span>
              </>
            )}
          </button>

          <button
            type="button"
            disabled={isProcessing}
            onClick={() => handleSimulateAction('FAILED')}
            className="w-full py-2.5 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-rose-400 font-semibold text-xs flex items-center justify-center gap-1.5 border border-neutral-800 transition-colors"
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>Simulate Card Decline / Failure</span>
          </button>

          <button
            type="button"
            disabled={isProcessing}
            onClick={() => handleSimulateAction('CANCELLED')}
            className="w-full py-2 text-center text-neutral-500 hover:text-neutral-300 text-xs transition-colors"
          >
            Cancel &amp; Return to Store
          </button>
        </div>

        {/* Security Footer */}
        <div className="mt-6 pt-4 border-t border-neutral-900 flex items-center justify-between text-[10px] text-neutral-500">
          <span>PCI-DSS SAQ-A Certified</span>
          <span>PayGlocal Merchant ptplabdurrah9915</span>
        </div>
      </div>
    </div>
  );
}

export default function PayGlocalMockCheckout() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-neutral-900 flex items-center justify-center text-white text-xs">
          Loading PayGlocal Secure Gateway...
        </div>
      }
    >
      <PayGlocalMockCheckoutContent />
    </Suspense>
  );
}

