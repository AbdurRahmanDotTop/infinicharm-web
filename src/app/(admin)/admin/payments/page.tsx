'use client';

import React, { useState, useEffect } from 'react';
import { AdminHeader } from '@/components/admin/AdminHeader';
import {
  getPaymentGateways,
  fetchPaymentGateways,
  savePaymentGateway,
  createCustomGateway,
  deleteCustomGateway,
  testGatewayConnectivity,
  getPaymentTransactions,
  recordPaymentTransaction,
  processGatewayRefund,
  approveCustomUpiTransaction,
  rejectCustomUpiTransaction,
  getWebhookLogs,
  WebhookLogItem,
} from '@/lib/services/gateways';
import { formatPaiseToRupees } from '@/lib/utils/currency';
import { logAdminAction } from '@/lib/services/audit';
import { getWebhookUrl } from '@/lib/utils/env-urls';
import {
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Zap,
  Lock,
  Eye,
  EyeOff,
  Search,
  Filter,
  Check,
  X,
  RefreshCw,
  ExternalLink,
  Copy,
  Server,
  Activity,
  FileText,
  Sliders,
  DollarSign,
  AlertCircle,
  QrCode,
  Globe,
  Smartphone,
  Plus,
  Trash2,
} from 'lucide-react';
import { PaymentGatewayConfig, PaymentGatewayId, PaymentTransaction, PaymentMethod, Order } from '@/types';

export default function AdminPaymentsPage() {
  const [activeTab, setActiveTab] = useState<'gateways' | 'transactions' | 'refunds' | 'webhooks'>('gateways');
  const [gateways, setGateways] = useState<PaymentGatewayConfig[]>(() => getPaymentGateways());
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [webhookLogs, setWebhookLogs] = useState<WebhookLogItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  // Selected gateway for editing
  const [editingGateway, setEditingGateway] = useState<PaymentGatewayConfig | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; latencyMs?: number } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Transaction filter & search
  const [txSearchQuery, setTxSearchQuery] = useState('');
  const [txStatusFilter, setTxStatusFilter] = useState('ALL');
  const [selectedTx, setSelectedTx] = useState<PaymentTransaction | null>(null);

  // Refund Modal state
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundOrderNumber, setRefundOrderNumber] = useState('');
  const [refundAmountRupees, setRefundAmountRupees] = useState('');
  const [refundReason, setRefundReason] = useState('Customer Return Request');
  const [refundFeedback, setRefundFeedback] = useState<{ success: boolean; message: string } | null>(null);

  // Add Custom Gateway Modal state
  const [showAddGatewayModal, setShowAddGatewayModal] = useState(false);
  const [newGwId, setNewGwId] = useState('');
  const [newGwName, setNewGwName] = useState('');
  const [newGwDesc, setNewGwDesc] = useState('');
  const [newGwInstructions, setNewGwInstructions] = useState('');
  const [newGwIsTestMode, setNewGwIsTestMode] = useState(false);
  const [newGwMethods, setNewGwMethods] = useState<PaymentMethod[]>(['UPI']);
  const [newGwMinAmount, setNewGwMinAmount] = useState('0');
  const [newGwMaxAmount, setNewGwMaxAmount] = useState('100000');
  const [newGwFee, setNewGwFee] = useState('0');

  // Copy helper
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Custom UPI UTR Verification State
  const [verifyingTx, setVerifyingTx] = useState<PaymentTransaction | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  const handleApproveUpi = (txId: string) => {
    const res = approveCustomUpiTransaction(txId);
    if (res.success) {
      loadAllData();
      setVerifyingTx(null);
      showSuccessFeedback(res.message);
    } else {
      alert(res.message);
    }
  };

  const handleRejectUpi = (txId: string) => {
    if (!rejectionReasonInput.trim()) {
      alert('Please provide a specific rejection reason (e.g. UTR not found in IndusInd Bank statement).');
      return;
    }
    const res = rejectCustomUpiTransaction(txId, rejectionReasonInput.trim());
    if (res.success) {
      loadAllData();
      setVerifyingTx(null);
      setShowRejectForm(false);
      setRejectionReasonInput('');
      showSuccessFeedback(res.message);
    } else {
      alert(res.message);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    // 1. Instant local state load
    const gw = getPaymentGateways();
    setGateways(gw);

    const tx = getPaymentTransactions();
    setTransactions(tx);

    const wh = getWebhookLogs();
    setWebhookLogs(wh);

    try {
      const storedOrders = localStorage.getItem('infinicharm_orders');
      if (storedOrders) {
        setOrders(JSON.parse(storedOrders));
      }
    } catch {
      // ignore
    }

    // 2. Fresh server API sync
    try {
      const serverGw = await fetchPaymentGateways(false);
      if (serverGw && serverGw.length > 0) {
        setGateways(serverGw);
      }
    } catch (err) {
      console.error('Failed to sync gateways from server:', err);
    }
  };

  const showSuccessFeedback = (msg: string) => {
    setActionSuccessMsg(msg);
    setTimeout(() => setActionSuccessMsg(null), 3500);
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Test Gateway Connectivity
  const handleTestConnection = async () => {
    if (!editingGateway) return;
    setIsTesting(true);
    setTestResult(null);

    const res = await testGatewayConnectivity(
      editingGateway.id,
      editingGateway.credentials as Record<string, string>,
      editingGateway.isTestMode
    );

    setIsTesting(false);
    setTestResult(res);

    if (res.success) {
      const updated: PaymentGatewayConfig = {
        ...editingGateway,
        isValidated: true,
        lastTestedAt: new Date().toISOString(),
        testStatusMessage: `${res.message} • Latency: ${res.latencyMs}ms`,
      };
      setEditingGateway(updated);
      savePaymentGateway(updated);
      setGateways(getPaymentGateways());
    }
  };

  // Save Gateway Settings
  const handleSaveGateway = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGateway) return;

    if (editingGateway.isEnabled && !editingGateway.isValidated) {
      alert('Security Policy: A payment gateway cannot be enabled until its credentials and connectivity have been successfully validated via the Test Connection action.');
      return;
    }

    savePaymentGateway(editingGateway);
    setGateways(getPaymentGateways());
    setEditingGateway(null);
    setTestResult(null);
    showSuccessFeedback(`${editingGateway.name} configuration saved successfully.`);
  };

  // Toggle Gateway Active directly
  const handleToggleGateway = async (gw: PaymentGatewayConfig) => {
    if (!gw.isEnabled && !gw.isValidated) {
      setEditingGateway(gw);
      setTestResult({
        success: false,
        message: 'Please test gateway connectivity and validate credentials before activating this gateway.',
      });
      return;
    }

    const updated = { ...gw, isEnabled: !gw.isEnabled };
    // Optimistic UI update
    setGateways((prev) => prev.map((g) => (g.id === gw.id ? updated : g)));
    savePaymentGateway(updated);
    showSuccessFeedback(`${gw.name} is now ${updated.isEnabled ? 'ACTIVE' : 'DISABLED'}.`);

    try {
      await fetch('/api/admin/payments/gateways', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
    } catch (err) {
      console.error('Failed to sync gateway toggle to server:', err);
    }
  };

  // Create new Custom Gateway
  const handleCreateGateway = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGwId.trim() || !newGwName.trim()) {
      alert('Please provide a unique Gateway ID and Gateway Name.');
      return;
    }

    const formattedId = newGwId.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    if (gateways.some((g) => g.id === formattedId)) {
      alert(`A gateway with identifier "${formattedId}" already exists.`);
      return;
    }

    const newGateway: PaymentGatewayConfig = {
      id: formattedId,
      name: newGwName.trim(),
      description: newGwDesc.trim() || 'Custom payment method managed by store administration.',
      isEnabled: true,
      isTestMode: newGwIsTestMode,
      isValidated: true,
      isCustom: true,
      lastTestedAt: new Date().toISOString(),
      testStatusMessage: 'Custom gateway created and verified.',
      credentials: {
        instructions: newGwInstructions.trim(),
      },
      webhookUrl: getWebhookUrl(formattedId),
      supportedMethods: newGwMethods.length > 0 ? newGwMethods : ['UPI'],
      minOrderInPaise: Math.round(parseFloat(newGwMinAmount || '0') * 100),
      maxOrderInPaise: Math.round(parseFloat(newGwMaxAmount || '100000') * 100),
      convenienceFeeInPaise: Math.round(parseFloat(newGwFee || '0') * 100),
    };

    const res = await createCustomGateway(newGateway);
    if (res.success && res.gateways) {
      setGateways(res.gateways);
      setShowAddGatewayModal(false);
      setNewGwId('');
      setNewGwName('');
      setNewGwDesc('');
      setNewGwInstructions('');
      showSuccessFeedback(`Custom gateway "${newGateway.name}" created and active.`);
    } else {
      alert(res.error || 'Failed to create custom gateway.');
    }
  };

  // Delete Custom Gateway
  const handleDeleteGateway = async (gw: PaymentGatewayConfig) => {
    if (!confirm(`Are you sure you want to permanently delete custom gateway "${gw.name}"?`)) {
      return;
    }

    const res = await deleteCustomGateway(gw.id);
    if (res.success && res.gateways) {
      setGateways(res.gateways);
      showSuccessFeedback(`Gateway "${gw.name}" deleted.`);
    } else {
      alert(res.error || 'Failed to delete gateway.');
    }
  };

  // Handle Process Refund
  const handleProcessRefundSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundOrderNumber || !refundAmountRupees) return;

    const amountInPaise = Math.round(parseFloat(refundAmountRupees) * 100);
    const result = processGatewayRefund(refundOrderNumber, amountInPaise, refundReason);
    setRefundFeedback(result);

    if (result.success) {
      loadAllData();
      setTimeout(() => {
        setShowRefundModal(false);
        setRefundFeedback(null);
        setRefundOrderNumber('');
        setRefundAmountRupees('');
      }, 1500);
    }
  };

  // Filtered transactions
  const filteredTransactions = transactions.filter((tx) => {
    const matchesStatus = txStatusFilter === 'ALL' || tx.status === txStatusFilter;
    const matchesQuery =
      !txSearchQuery.trim() ||
      tx.orderNumber.toLowerCase().includes(txSearchQuery.toLowerCase()) ||
      tx.id.toLowerCase().includes(txSearchQuery.toLowerCase()) ||
      tx.customerEmail.toLowerCase().includes(txSearchQuery.toLowerCase()) ||
      (tx.gatewayTransactionId && tx.gatewayTransactionId.toLowerCase().includes(txSearchQuery.toLowerCase()));
    return matchesStatus && matchesQuery;
  });

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <AdminHeader />

      <main className="flex-1 p-6 sm:p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Module Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-accent bg-accent/10 px-2 py-0.5 rounded-full">
                Financial Authority & Gateways
              </span>
              <span className="text-xs text-muted">• PCI-DSS SAQ-A Compliant</span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-primary tracking-tight">
              Payment Gateway Management & Transactions
            </h1>
            <p className="text-xs text-muted mt-1">
              Configure supported payment gateways, test credentials, audit transaction ledgers, and manage refunds.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setShowRefundModal(true);
                setRefundFeedback(null);
              }}
              className="px-4 py-2 bg-surface hover:bg-surface-dim text-primary border border-border text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-accent" />
              <span>Issue Refund</span>
            </button>
            <button
              onClick={loadAllData}
              className="p-2 bg-surface hover:bg-surface-dim text-muted hover:text-primary border border-border rounded-xl transition-colors"
              title="Refresh Records"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Global Action Success Banner */}
        {actionSuccessMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 shadow-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccessMsg}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-border text-xs font-semibold overflow-x-auto scrollbar-none pb-px">
          <button
            onClick={() => setActiveTab('gateways')}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'gateways'
                ? 'border-accent text-accent'
                : 'border-transparent text-muted hover:text-primary'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Configured Gateways ({gateways.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('transactions')}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'transactions'
                ? 'border-accent text-accent'
                : 'border-transparent text-muted hover:text-primary'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Transactions Ledger ({transactions.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('refunds')}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'refunds'
                ? 'border-accent text-accent'
                : 'border-transparent text-muted hover:text-primary'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            <span>Refunds & Returns</span>
          </button>

          <button
            onClick={() => setActiveTab('webhooks')}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'webhooks'
                ? 'border-accent text-accent'
                : 'border-transparent text-muted hover:text-primary'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Webhook Diagnostics ({webhookLogs.length})</span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: GATEWAYS CONFIGURATION & MANAGEMENT */}
        {/* ========================================================================= */}
        {activeTab === 'gateways' && (
          <div className="space-y-6">
            {/* Header Control Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface p-4 rounded-2xl border border-border">
              <div>
                <h3 className="text-sm font-bold text-primary">Storefront Payment Gateways</h3>
                <p className="text-[11px] text-muted">Active gateways immediately appear on customer checkout; disabled gateways are hidden and rejected server-side.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddGatewayModal(true)}
                className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors shadow-2xs self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Add Custom Gateway</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {gateways.map((gw) => {
                const isEnabled = gw.isEnabled;
                const isValidated = gw.isValidated;

                return (
                  <div
                    key={gw.id}
                    className={`bg-surface rounded-3xl border p-6 shadow-sm transition-all flex flex-col justify-between ${
                      isEnabled ? 'border-accent/40 shadow-md ring-1 ring-accent/20' : 'border-border'
                    }`}
                  >
                    <div>
                      {/* Card Top Pill Bar */}
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm ${
                            isEnabled ? 'bg-accent text-white' : 'bg-surface-dim text-muted'
                          }`}>
                            {gw.id === 'CUSTOM_UPI' && 'UPI'}
                            {gw.id === 'PAYGLOCAL' && 'GL'}
                            {gw.id === 'RAZORPAY' && 'RZ'}
                            {gw.id === 'COD' && '₹'}
                            {gw.id === 'PHONEPE' && 'PE'}
                            {gw.id === 'STRIPE' && 'ST'}
                            {!['CUSTOM_UPI', 'PAYGLOCAL', 'RAZORPAY', 'COD', 'PHONEPE', 'STRIPE'].includes(gw.id) && 'PG'}
                          </div>
                          <div>
                            <h3 className="font-display text-base font-bold text-primary flex items-center gap-2">
                              <span>{gw.name}</span>
                              {isEnabled && (
                                <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                                  <Check className="w-3 h-3" /> Active
                                </span>
                              )}
                            </h3>
                            <p className="text-xs text-muted mt-0.5">{gw.description}</p>
                          </div>
                        </div>

                        {/* Status Toggle Switch */}
                        <button
                          type="button"
                          onClick={() => handleToggleGateway(gw)}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            isEnabled ? 'bg-accent' : 'bg-surface-dim border-border'
                          }`}
                          aria-label={`Toggle ${gw.name}`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              isEnabled ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      {/* Mode and Validation Badges */}
                      <div className="flex flex-wrap items-center gap-2 py-3 border-y border-border/60 text-xs">
                        <span className={`px-2.5 py-1 rounded-lg font-bold text-[10px] uppercase tracking-wider ${
                          gw.isTestMode
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}>
                          {gw.isTestMode ? 'Sandbox / Test Mode' : 'Live Production'}
                        </span>

                        <span className={`px-2.5 py-1 rounded-lg font-bold text-[10px] uppercase tracking-wider flex items-center gap-1 ${
                          isValidated
                            ? 'bg-blue-50 text-blue-800 border border-blue-200'
                            : 'bg-rose-50 text-rose-800 border border-rose-200'
                        }`}>
                          {isValidated ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-blue-600" />
                              <span>Validated</span>
                            </>
                          ) : (
                            <>
                              <AlertCircle className="w-3 h-3 text-rose-600" />
                              <span>Not Validated</span>
                            </>
                          )}
                        </span>

                        <span className="text-[11px] text-muted ml-auto font-mono">
                          {gw.supportedMethods.join(' • ')}
                        </span>
                      </div>

                      {/* Gateway Details & Credentials preview */}
                      <div className="py-3 text-xs space-y-2 text-muted">
                        {gw.id === 'CUSTOM_UPI' && gw.credentials.upiId && (
                          <div className="flex items-center justify-between font-mono text-[11px] bg-surface-dim px-3 py-1.5 rounded-lg">
                            <span className="text-muted">UPI ID (VPA):</span>
                            <span className="text-primary font-semibold">{gw.credentials.upiId}</span>
                          </div>
                        )}
                        {gw.id === 'CUSTOM_UPI' && gw.credentials.bankName && (
                          <div className="flex items-center justify-between font-mono text-[11px] bg-surface-dim px-3 py-1.5 rounded-lg">
                            <span className="text-muted">Bank A/C:</span>
                            <span className="text-primary font-semibold">
                              {gw.credentials.bankName} • {gw.credentials.accountNumber}
                            </span>
                          </div>
                        )}
                        {gw.id === 'PAYGLOCAL' && gw.credentials.merchantId && (
                          <div className="flex items-center justify-between font-mono text-[11px] bg-surface-dim px-3 py-1.5 rounded-lg">
                            <span className="text-muted">PayGlocal MID:</span>
                            <span className="text-primary font-semibold">{gw.credentials.merchantId}</span>
                          </div>
                        )}
                        {gw.id === 'PAYGLOCAL' && gw.credentials.mcaId && (
                          <div className="flex items-center justify-between font-mono text-[11px] bg-surface-dim px-3 py-1.5 rounded-lg">
                            <span className="text-muted">Multi-Curr MCA:</span>
                            <span className="text-primary font-semibold">{gw.credentials.mcaId}</span>
                          </div>
                        )}
                        {gw.id !== 'CUSTOM_UPI' && gw.id !== 'PAYGLOCAL' && gw.credentials.keyId && (
                          <div className="flex items-center justify-between font-mono text-[11px] bg-surface-dim px-3 py-1.5 rounded-lg">
                            <span className="text-muted">Key ID:</span>
                            <span className="text-primary font-semibold">{gw.credentials.keyId}</span>
                          </div>
                        )}
                        {gw.id !== 'CUSTOM_UPI' && gw.id !== 'PAYGLOCAL' && gw.credentials.merchantId && (
                          <div className="flex items-center justify-between font-mono text-[11px] bg-surface-dim px-3 py-1.5 rounded-lg">
                            <span className="text-muted">Merchant ID:</span>
                            <span className="text-primary font-semibold">{gw.credentials.merchantId}</span>
                          </div>
                        )}
                        {gw.testStatusMessage && (
                          <p className="text-[11px] text-muted italic flex items-center gap-1.5 pt-1">
                            <Activity className="w-3 h-3 text-accent shrink-0" />
                            <span>{gw.testStatusMessage}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="pt-4 border-t border-border flex items-center justify-between gap-3">
                      <span className="text-[11px] text-muted">
                        {gw.lastTestedAt
                          ? `Verified: ${new Date(gw.lastTestedAt).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              timeZone: 'Asia/Kolkata',
                            })}`
                          : 'Never verified'}
                      </span>

                      <div className="flex items-center gap-2">
                        {gw.isCustom && (
                          <button
                            type="button"
                            onClick={() => handleDeleteGateway(gw)}
                            className="p-2 bg-surface-dim hover:bg-rose-50 text-muted hover:text-rose-600 rounded-xl border border-border transition-colors"
                            title="Delete Custom Gateway"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setEditingGateway({ ...gw });
                            setTestResult(null);
                          }}
                          className="px-4 py-2 bg-surface-dim hover:bg-border text-primary font-bold text-xs rounded-xl border border-border transition-colors flex items-center gap-1.5"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                          <span>Configure & Test</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Security Notice Card */}
            <div className="bg-surface rounded-3xl border border-border p-6 text-xs text-muted flex items-start gap-4 shadow-sm">
              <div className="p-2.5 rounded-2xl bg-amber-500/10 text-accent shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="font-display font-bold text-primary text-sm">
                  PCI-DSS SAQ-A & Secret Protection Invariants
                </h4>
                <p className="leading-relaxed">
                  InfiniCharm enforces zero raw card storage. All client-side checkouts tokenize card and UPI data via direct provider SDKs. Secret keys and webhook secrets are stored exclusively server-side and masked with SHA-256 tokens in UI views. Gateways cannot be activated without passing live connectivity probes.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: TRANSACTIONS LEDGER */}
        {/* ========================================================================= */}
        {activeTab === 'transactions' && (
          <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface p-4 rounded-2xl border border-border">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  placeholder="Search by Order #, Tx ID, or customer email..."
                  value={txSearchQuery}
                  onChange={(e) => setTxSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                />
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <select
                  value={txStatusFilter}
                  onChange={(e) => setTxStatusFilter(e.target.value)}
                  className="px-3.5 py-2 text-xs bg-surface-dim border border-border rounded-xl text-primary font-medium focus:outline-none focus:border-accent"
                >
                  <option value="ALL">All Statuses ({transactions.length})</option>
                  <option value="SUCCESS">Success / Paid</option>
                  <option value="PENDING">Pending</option>
                  <option value="FAILED">Failed</option>
                  <option value="REFUNDED">Refunded</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="bg-surface rounded-3xl border border-border overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-dim/60 text-muted uppercase tracking-wider text-[10px] font-bold border-b border-border">
                    <tr>
                      <th className="py-3.5 px-4">Transaction ID</th>
                      <th className="py-3.5 px-4">Order Number</th>
                      <th className="py-3.5 px-4">Gateway</th>
                      <th className="py-3.5 px-4">Method</th>
                      <th className="py-3.5 px-4">Amount</th>
                      <th className="py-3.5 px-4">UTR / Ref</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4">Customer</th>
                      <th className="py-3.5 px-4">Date</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-12 text-center text-muted">
                          <CreditCard className="w-8 h-8 mx-auto text-muted/60 mb-2" />
                          <p className="font-semibold text-primary">No Payment Transactions Recorded</p>
                          <p className="text-[11px] mt-0.5">Transactions processed through customer checkouts will appear in this ledger.</p>
                        </td>
                      </tr>
                    ) : (
                      filteredTransactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-surface-dim/30 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-semibold text-primary">
                            {tx.id}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-medium text-accent">
                            {tx.orderNumber}
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-primary">
                            {tx.gatewayId}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 bg-surface-dim rounded text-[11px] font-mono">
                              {tx.method}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-bold text-primary">
                            {formatPaiseToRupees(tx.amountInPaise)}
                          </td>
                          <td className="py-3.5 px-4">
                            {tx.utrNumber ? (
                              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                {tx.utrNumber}
                              </span>
                            ) : (
                              <span className="text-muted text-[11px]">—</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="space-y-0.5">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                tx.status === 'SUCCESS'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : tx.status === 'PENDING'
                                  ? 'bg-amber-100 text-amber-800'
                                  : tx.status === 'REFUNDED'
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}>
                                {tx.status}
                              </span>
                              {tx.manualApprovalStatus && (
                                <span className="block text-[9px] font-bold text-muted">
                                  {tx.manualApprovalStatus === 'PENDING_REVIEW'
                                    ? 'Awaiting Bank Review'
                                    : tx.manualApprovalStatus}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-muted">
                            <div className="truncate max-w-[150px]">{tx.customerEmail}</div>
                          </td>
                          <td className="py-3.5 px-4 text-muted whitespace-nowrap">
                            {new Date(tx.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {tx.utrNumber && tx.status === 'PENDING' && (
                                <button
                                  onClick={() => {
                                    setVerifyingTx(tx);
                                    setShowRejectForm(false);
                                    setRejectionReasonInput('');
                                  }}
                                  className="px-2.5 py-1 bg-accent hover:bg-accent-hover text-white font-bold rounded-lg text-[11px] shadow-xs transition-colors flex items-center gap-1"
                                >
                                  <ShieldCheck className="w-3 h-3" />
                                  <span>Verify UTR</span>
                                </button>
                              )}
                              <button
                                onClick={() => setSelectedTx(tx)}
                                className="px-2.5 py-1 bg-surface-dim hover:bg-border text-primary font-medium rounded-lg text-[11px] transition-colors"
                              >
                                Inspect
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: REFUNDS & CANCELLATIONS */}
        {/* ========================================================================= */}
        {activeTab === 'refunds' && (
          <div className="space-y-6">
            <div className="bg-surface rounded-3xl border border-border p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
                <div>
                  <h3 className="font-display text-lg font-bold text-primary">
                    Automated Gateway Refund Initiator
                  </h3>
                  <p className="text-xs text-muted mt-0.5">
                    Execute full or partial refunds for customer cancellations or returns. Restocks inventory atomically.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setShowRefundModal(true);
                    setRefundFeedback(null);
                  }}
                  className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 self-start sm:self-auto"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Initiate New Refund</span>
                </button>
              </div>

              {/* Recent Refunded Transactions */}
              <div className="mt-6 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
                  Refunded Order Ledger
                </h4>

                {transactions.filter((t) => t.status === 'REFUNDED').length === 0 ? (
                  <div className="p-8 text-center bg-surface-dim/40 rounded-2xl border border-border text-xs text-muted">
                    No refunds processed yet. All customer transactions remain in settled status.
                  </div>
                ) : (
                  <div className="divide-y divide-border rounded-2xl border border-border overflow-hidden">
                    {transactions
                      .filter((t) => t.status === 'REFUNDED')
                      .map((refTx) => (
                        <div key={refTx.id} className="p-4 bg-surface flex items-center justify-between text-xs">
                          <div>
                            <span className="font-bold text-primary font-mono">{refTx.orderNumber}</span>
                            <span className="text-muted ml-2">via {refTx.gatewayId}</span>
                            <p className="text-[11px] text-muted mt-0.5">Customer: {refTx.customerEmail}</p>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-primary">{formatPaiseToRupees(refTx.amountInPaise)}</span>
                            <span className="block text-[10px] text-purple-700 font-bold uppercase tracking-wider">
                              PROCESSED
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: WEBHOOK LOGS & DIAGNOSTICS */}
        {/* ========================================================================= */}
        {activeTab === 'webhooks' && (
          <div className="space-y-6">
            {/* Endpoints Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-surface rounded-2xl border border-border p-4 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-primary">Razorpay Webhook Endpoint</span>
                  <button
                    onClick={() => handleCopy(getWebhookUrl('razorpay'), 'wh-rzp')}
                    className="text-accent hover:text-accent-hover flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{copiedKey === 'wh-rzp' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <code className="block bg-surface-dim px-3 py-1.5 rounded-lg text-primary font-mono text-[11px] truncate">
                  {getWebhookUrl('razorpay')}
                </code>
                <p className="text-[11px] text-muted">Events: payment.authorized, order.paid, payment.failed</p>
              </div>

              <div className="bg-surface rounded-2xl border border-border p-4 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-primary">PhonePe Callback Endpoint</span>
                  <button
                    onClick={() => handleCopy(getWebhookUrl('phonepe'), 'wh-pe')}
                    className="text-accent hover:text-accent-hover flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{copiedKey === 'wh-pe' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <code className="block bg-surface-dim px-3 py-1.5 rounded-lg text-primary font-mono text-[11px] truncate">
                  {getWebhookUrl('phonepe')}
                </code>
                <p className="text-[11px] text-muted">Events: checkout.session.completed, refund.successful</p>
              </div>
            </div>

            {/* Webhook Logs Table */}
            <div className="bg-surface rounded-3xl border border-border overflow-hidden shadow-sm">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="font-display text-base font-bold text-primary">
                  Recent Incoming Webhook Events
                </h3>
                <span className="text-xs text-muted">HMAC SHA-256 Signatures Enforced</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-dim/60 text-muted uppercase tracking-wider text-[10px] font-bold border-b border-border">
                    <tr>
                      <th className="py-3 px-4">Event ID</th>
                      <th className="py-3 px-4">Gateway</th>
                      <th className="py-3 px-4">Event Type</th>
                      <th className="py-3 px-4">Order #</th>
                      <th className="py-3 px-4">Payload Summary</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {webhookLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-surface-dim/30 font-mono text-[11px]">
                        <td className="py-3 px-4 font-semibold text-primary">{log.id}</td>
                        <td className="py-3 px-4 font-bold text-accent">{log.gatewayId}</td>
                        <td className="py-3 px-4 text-primary font-semibold">{log.event}</td>
                        <td className="py-3 px-4">{log.orderNumber || '—'}</td>
                        <td className="py-3 px-4 font-sans text-muted truncate max-w-xs">{log.payloadSummary}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            {log.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-muted whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* EDIT / CONFIGURE GATEWAY MODAL */}
        {/* ========================================================================= */}
        {editingGateway && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-surface border border-border rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <h3 className="font-display text-xl font-bold text-primary flex items-center gap-2">
                    <span>Configure {editingGateway.name}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-accent bg-accent/10 px-2 py-0.5 rounded-full">
                      {editingGateway.id}
                    </span>
                  </h3>
                  <p className="text-xs text-muted mt-1">
                    Manage API credentials, environment modes, webhook secrets, and checkout methods.
                  </p>
                </div>
                <button
                  onClick={() => setEditingGateway(null)}
                  className="p-1.5 text-muted hover:text-primary rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Connectivity Test Banner */}
              {testResult && (
                <div className={`p-4 rounded-2xl border text-xs font-medium flex items-start gap-3 ${
                  testResult.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}>
                  {testResult.success ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-0.5">
                    <p className="font-bold">{testResult.success ? 'Gateway Validation Successful' : 'Validation Failed'}</p>
                    <p className="text-[11px] leading-relaxed">{testResult.message}</p>
                    {testResult.latencyMs && (
                      <p className="text-[10px] opacity-80 pt-0.5">Handshake Latency: {testResult.latencyMs}ms</p>
                    )}
                  </div>
                </div>
              )}

              <form onSubmit={handleSaveGateway} className="space-y-5 text-xs">
                {/* Mode & Active Switch Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-surface-dim p-4 rounded-2xl border border-border">
                  <div>
                    <label className="block font-bold text-primary mb-1">Environment Mode</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setEditingGateway({ ...editingGateway, isTestMode: true, isValidated: false })
                        }
                        className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs transition-colors border ${
                          editingGateway.isTestMode
                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                            : 'bg-surface text-muted border-border'
                        }`}
                      >
                        Sandbox / Test
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setEditingGateway({ ...editingGateway, isTestMode: false, isValidated: false })
                        }
                        className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs transition-colors border ${
                          !editingGateway.isTestMode
                            ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                            : 'bg-surface text-muted border-border'
                        }`}
                      >
                        Live Production
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-primary mb-1">Gateway Status</label>
                    <button
                      type="button"
                      onClick={() =>
                        setEditingGateway({ ...editingGateway, isEnabled: !editingGateway.isEnabled })
                      }
                      className={`w-full py-2 px-3 rounded-xl font-bold text-xs transition-colors border flex items-center justify-center gap-2 ${
                        editingGateway.isEnabled
                          ? 'bg-accent text-white border-accent'
                          : 'bg-surface text-muted border-border'
                      }`}
                    >
                      <span>{editingGateway.isEnabled ? 'Enabled for Storefront' : 'Disabled (Inactive)'}</span>
                    </button>
                  </div>
                </div>

                {/* Gateway Metadata: Name & Description */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-primary mb-1">Gateway Display Name *</label>
                    <input
                      type="text"
                      required
                      value={editingGateway.name}
                      onChange={(e) => setEditingGateway({ ...editingGateway, name: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary font-semibold focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-primary mb-1">Short Description</label>
                    <input
                      type="text"
                      value={editingGateway.description}
                      onChange={(e) => setEditingGateway({ ...editingGateway, description: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>

                {/* Limits & Convenience Fee */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-primary mb-1">Min Order Amount (₹)</label>
                    <input
                      type="number"
                      value={editingGateway.minOrderInPaise ? editingGateway.minOrderInPaise / 100 : 0}
                      onChange={(e) =>
                        setEditingGateway({
                          ...editingGateway,
                          minOrderInPaise: Math.round(parseFloat(e.target.value || '0') * 100),
                        })
                      }
                      className="w-full px-3.5 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-primary mb-1">Max Order Limit (₹)</label>
                    <input
                      type="number"
                      value={editingGateway.maxOrderInPaise ? editingGateway.maxOrderInPaise / 100 : 500000}
                      onChange={(e) =>
                        setEditingGateway({
                          ...editingGateway,
                          maxOrderInPaise: Math.round(parseFloat(e.target.value || '0') * 100),
                        })
                      }
                      className="w-full px-3.5 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-primary mb-1">Handling / Surcharge (₹)</label>
                    <input
                      type="number"
                      value={editingGateway.convenienceFeeInPaise ? editingGateway.convenienceFeeInPaise / 100 : 0}
                      onChange={(e) =>
                        setEditingGateway({
                          ...editingGateway,
                          convenienceFeeInPaise: Math.round(parseFloat(e.target.value || '0') * 100),
                        })
                      }
                      className="w-full px-3.5 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>

                {/* Custom Gateway Instructions */}
                {editingGateway.isCustom && (
                  <div>
                    <label className="block font-semibold text-primary mb-1">Customer Instructions</label>
                    <textarea
                      rows={3}
                      value={editingGateway.credentials.instructions || ''}
                      onChange={(e) =>
                        setEditingGateway({
                          ...editingGateway,
                          credentials: { ...editingGateway.credentials, instructions: e.target.value },
                        })
                      }
                      className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    />
                  </div>
                )}

                {/* Gateway Credentials Fields */}
                <div className="space-y-4">
                  {/* Case 1: Custom UPI Gateway Credentials */}
                  {editingGateway.id === 'CUSTOM_UPI' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block font-semibold text-primary mb-1">
                            UPI ID (VPA) *
                          </label>
                          <input
                            type="text"
                            required
                            value={editingGateway.credentials.upiId || ''}
                            onChange={(e) =>
                              setEditingGateway({
                                ...editingGateway,
                                isValidated: false,
                                credentials: { ...editingGateway.credentials, upiId: e.target.value },
                              })
                            }
                            placeholder="e.g. AbdurRahmanIndusIndCurrent@ybl"
                            className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary font-mono focus:outline-none focus:border-accent"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-primary mb-1">
                            Registered UPI Mobile Number *
                          </label>
                          <input
                            type="text"
                            required
                            value={editingGateway.credentials.upiNumber || ''}
                            onChange={(e) =>
                              setEditingGateway({
                                ...editingGateway,
                                isValidated: false,
                                credentials: { ...editingGateway.credentials, upiNumber: e.target.value },
                              })
                            }
                            placeholder="e.g. 8825164657"
                            className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary font-mono focus:outline-none focus:border-accent"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block font-semibold text-primary mb-1">
                            UPI Account Holder / Business Name
                          </label>
                          <input
                            type="text"
                            value={editingGateway.credentials.payeeName || ''}
                            onChange={(e) =>
                              setEditingGateway({
                                ...editingGateway,
                                credentials: { ...editingGateway.credentials, payeeName: e.target.value },
                              })
                            }
                            placeholder="TechilyFly - InfiniCharm"
                            className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-primary mb-1">
                            Bank Name
                          </label>
                          <input
                            type="text"
                            value={editingGateway.credentials.bankName || ''}
                            onChange={(e) =>
                              setEditingGateway({
                                ...editingGateway,
                                credentials: { ...editingGateway.credentials, bankName: e.target.value },
                              })
                            }
                            placeholder="IndusInd Bank"
                            className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block font-semibold text-primary mb-1">
                            Bank Account Number
                          </label>
                          <input
                            type="text"
                            value={editingGateway.credentials.accountNumber || ''}
                            onChange={(e) =>
                              setEditingGateway({
                                ...editingGateway,
                                credentials: { ...editingGateway.credentials, accountNumber: e.target.value },
                              })
                            }
                            placeholder="258825164657"
                            className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary font-mono focus:outline-none focus:border-accent"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-primary mb-1">
                            IFSC Code
                          </label>
                          <input
                            type="text"
                            value={editingGateway.credentials.ifscCode || ''}
                            onChange={(e) =>
                              setEditingGateway({
                                ...editingGateway,
                                credentials: { ...editingGateway.credentials, ifscCode: e.target.value },
                              })
                            }
                            placeholder="INDB0001548"
                            className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary font-mono uppercase focus:outline-none focus:border-accent"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block font-semibold text-primary mb-1">
                          Customer-Facing Payment Instructions
                        </label>
                        <textarea
                          rows={3}
                          value={editingGateway.credentials.instructions || ''}
                          onChange={(e) =>
                            setEditingGateway({
                              ...editingGateway,
                              credentials: { ...editingGateway.credentials, instructions: e.target.value },
                            })
                          }
                          className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                        />
                      </div>
                    </div>
                  )}

                  {/* Case 2: PayGlocal Official Gateway Credentials */}
                  {editingGateway.id === 'PAYGLOCAL' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block font-semibold text-primary mb-1">
                            PayGlocal Merchant ID *
                          </label>
                          <input
                            type="text"
                            required
                            value={editingGateway.credentials.merchantId || ''}
                            onChange={(e) =>
                              setEditingGateway({
                                ...editingGateway,
                                isValidated: false,
                                credentials: { ...editingGateway.credentials, merchantId: e.target.value },
                              })
                            }
                            placeholder="ptplabdurrah9915"
                            className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary font-mono focus:outline-none focus:border-accent"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-primary mb-1">
                            Multi-Currency Account (MCA) ID
                          </label>
                          <input
                            type="text"
                            value={editingGateway.credentials.mcaId || ''}
                            onChange={(e) =>
                              setEditingGateway({
                                ...editingGateway,
                                credentials: { ...editingGateway.credentials, mcaId: e.target.value },
                              })
                            }
                            placeholder="ptplabdurrah9923"
                            className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary font-mono focus:outline-none focus:border-accent"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block font-semibold text-primary mb-1">
                            Public KID (Key Identifier) *
                          </label>
                          <input
                            type="text"
                            required
                            value={editingGateway.credentials.publicKid || ''}
                            onChange={(e) =>
                              setEditingGateway({
                                ...editingGateway,
                                isValidated: false,
                                credentials: { ...editingGateway.credentials, publicKid: e.target.value },
                              })
                            }
                            placeholder="8cc91c8d-8030-4660-a9c7-33de886fb495_payglocal_mid"
                            className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary font-mono text-[11px] focus:outline-none focus:border-accent"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-primary mb-1">
                            Private KID (Key Identifier) *
                          </label>
                          <input
                            type="text"
                            required
                            value={editingGateway.credentials.privateKid || ''}
                            onChange={(e) =>
                              setEditingGateway({
                                ...editingGateway,
                                isValidated: false,
                                credentials: { ...editingGateway.credentials, privateKid: e.target.value },
                              })
                            }
                            placeholder="kId-cTwVPjp5l2c3xHo3"
                            className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary font-mono text-[11px] focus:outline-none focus:border-accent"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block font-semibold text-primary mb-1">
                            GBP Sort Code (International Rail)
                          </label>
                          <input
                            type="text"
                            value={editingGateway.credentials.gbpSortCode || ''}
                            onChange={(e) =>
                              setEditingGateway({
                                ...editingGateway,
                                credentials: { ...editingGateway.credentials, gbpSortCode: e.target.value },
                              })
                            }
                            placeholder="608382"
                            className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary font-mono focus:outline-none focus:border-accent"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-primary mb-1">
                            GBP Account Number
                          </label>
                          <input
                            type="text"
                            value={editingGateway.credentials.gbpAccountNo || ''}
                            onChange={(e) =>
                              setEditingGateway({
                                ...editingGateway,
                                credentials: { ...editingGateway.credentials, gbpAccountNo: e.target.value },
                              })
                            }
                            placeholder="44576489"
                            className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary font-mono focus:outline-none focus:border-accent"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block font-semibold text-primary mb-1">Webhook URL</label>
                        <input
                          type="text"
                          value={editingGateway.webhookUrl}
                          onChange={(e) =>
                            setEditingGateway({ ...editingGateway, webhookUrl: e.target.value })
                          }
                          className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary font-mono text-[11px] focus:outline-none focus:border-accent"
                        />
                      </div>
                    </div>
                  )}

                  {/* Case 3: Standard Gateways (Razorpay, PhonePe, Stripe) */}
                  {editingGateway.id !== 'COD' && editingGateway.id !== 'CUSTOM_UPI' && editingGateway.id !== 'PAYGLOCAL' && (
                    <>
                      <div>
                        <label className="block font-semibold text-primary mb-1">
                          {editingGateway.id === 'PHONEPE' ? 'Merchant ID' : 'Public API Key / Key ID'}
                        </label>
                        <input
                          type="text"
                          required
                          value={editingGateway.credentials.keyId || editingGateway.credentials.merchantId || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditingGateway({
                              ...editingGateway,
                              isValidated: false,
                              credentials: {
                                ...editingGateway.credentials,
                                keyId: editingGateway.id !== 'PHONEPE' ? val : undefined,
                                merchantId: editingGateway.id === 'PHONEPE' ? val : undefined,
                              },
                            });
                          }}
                          placeholder={editingGateway.isTestMode ? 'rzp_test_...' : 'rzp_live_...'}
                          className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary font-mono focus:outline-none focus:border-accent"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="font-semibold text-primary">Secret Key / Salt</label>
                          <button
                            type="button"
                            onClick={() => setShowSecret(!showSecret)}
                            className="text-accent hover:text-accent-hover text-[11px] flex items-center gap-1 font-semibold"
                          >
                            {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            <span>{showSecret ? 'Hide' : 'Show'}</span>
                          </button>
                        </div>
                        <input
                          type={showSecret ? 'text' : 'password'}
                          required
                          value={editingGateway.credentials.keySecret || editingGateway.credentials.saltKey || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditingGateway({
                              ...editingGateway,
                              isValidated: false,
                              credentials: {
                                ...editingGateway.credentials,
                                keySecret: editingGateway.id !== 'PHONEPE' ? val : undefined,
                                saltKey: editingGateway.id === 'PHONEPE' ? val : undefined,
                              },
                            });
                          }}
                          className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary font-mono focus:outline-none focus:border-accent"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-primary mb-1">Webhook Secret</label>
                        <input
                          type="password"
                          value={editingGateway.credentials.webhookSecret || ''}
                          onChange={(e) =>
                            setEditingGateway({
                              ...editingGateway,
                              credentials: { ...editingGateway.credentials, webhookSecret: e.target.value },
                            })
                          }
                          placeholder="Optional HMAC webhook signature verification secret"
                          className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary font-mono focus:outline-none focus:border-accent"
                        />
                      </div>
                    </>
                  )}

                  {/* COD Specific Settings */}
                  {editingGateway.id === 'COD' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-semibold text-primary mb-1">
                          Maximum Order Amount for COD (INR ₹)
                        </label>
                        <input
                          type="number"
                          value={editingGateway.maxOrderInPaise ? editingGateway.maxOrderInPaise / 100 : 5000}
                          onChange={(e) =>
                            setEditingGateway({
                              ...editingGateway,
                              maxOrderInPaise: Math.round(parseFloat(e.target.value || '0') * 100),
                            })
                          }
                          className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                        />
                        <span className="text-[10px] text-muted mt-1 block">
                          Orders above this value must be prepaid via UPI or Cards.
                        </span>
                      </div>

                      <div>
                        <label className="block font-semibold text-primary mb-1">
                          COD Handling Fee (INR ₹)
                        </label>
                        <input
                          type="number"
                          value={editingGateway.convenienceFeeInPaise ? editingGateway.convenienceFeeInPaise / 100 : 0}
                          onChange={(e) =>
                            setEditingGateway({
                              ...editingGateway,
                              convenienceFeeInPaise: Math.round(parseFloat(e.target.value || '0') * 100),
                            })
                          }
                          className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                        />
                        <span className="text-[10px] text-muted mt-1 block">
                          Set to 0 for zero convenience fee.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Supported Payment Methods Checklist */}
                  <div>
                    <label className="block font-semibold text-primary mb-2">
                      Enabled Payment Methods on Checkout
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {(['UPI', 'CARDS', 'NET_BANKING', 'WALLET', 'COD'] as PaymentMethod[]).map((method) => {
                        const isChecked = editingGateway.supportedMethods.includes(method);
                        return (
                          <button
                            key={method}
                            type="button"
                            onClick={() => {
                              const next = isChecked
                                ? editingGateway.supportedMethods.filter((m) => m !== method)
                                : [...editingGateway.supportedMethods, method];
                              setEditingGateway({ ...editingGateway, supportedMethods: next });
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-colors ${
                              isChecked
                                ? 'bg-primary text-white border-primary'
                                : 'bg-surface-dim text-muted border-border hover:text-primary'
                            }`}
                          >
                            {isChecked && <Check className="w-3.5 h-3.5" />}
                            <span>{method}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Modal Footer Controls */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-border">
                  <button
                    type="button"
                    disabled={isTesting}
                    onClick={handleTestConnection}
                    className="w-full sm:w-auto px-5 py-2.5 bg-surface-dim hover:bg-border text-primary font-bold rounded-xl border border-border flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                  >
                    <Zap className="w-4 h-4 text-accent" />
                    <span>{isTesting ? 'Testing Handshake...' : 'Test Gateway Connectivity'}</span>
                  </button>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <button
                      type="button"
                      onClick={() => setEditingGateway(null)}
                      className="px-4 py-2.5 bg-surface-dim hover:bg-border text-primary font-semibold rounded-xl"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2.5 bg-accent hover:bg-accent-hover text-white font-bold rounded-xl shadow-xs transition-colors"
                    >
                      Save Gateway
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* CREATE / ADD CUSTOM GATEWAY MODAL */}
        {/* ========================================================================= */}
        {showAddGatewayModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-surface border border-border rounded-3xl max-w-xl w-full p-6 sm:p-8 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-accent text-white flex items-center justify-center font-bold text-sm">
                    <Plus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-bold text-primary">
                      Add Custom Payment Gateway
                    </h3>
                    <p className="text-xs text-muted">
                      Create and activate an administrative payment option on the checkout portal.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddGatewayModal(false)}
                  className="p-2 hover:bg-surface-dim text-muted hover:text-primary rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateGateway} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-primary mb-1">Gateway Identifier / Code *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. BANK_NEFT, WHATSAPP_PAY"
                      value={newGwId}
                      onChange={(e) => setNewGwId(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                      className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary font-mono uppercase focus:outline-none focus:border-accent"
                    />
                    <span className="text-[10px] text-muted mt-1 block">Unique UPPERCASE code without spaces.</span>
                  </div>

                  <div>
                    <label className="block font-semibold text-primary mb-1">Gateway Display Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Direct Bank Transfer (NEFT / IMPS)"
                      value={newGwName}
                      onChange={(e) => setNewGwName(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary font-medium focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-primary mb-1">Customer Description</label>
                  <input
                    type="text"
                    placeholder="e.g. Transfer directly to our IndusInd Current Account and submit reference."
                    value={newGwDesc}
                    onChange={(e) => setNewGwDesc(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-primary mb-1">Customer-Facing Payment Instructions</label>
                  <textarea
                    rows={3}
                    placeholder="Enter step-by-step instructions displayed when customer selects this payment method at checkout..."
                    value={newGwInstructions}
                    onChange={(e) => setNewGwInstructions(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-primary mb-1">Min Order Limit (₹)</label>
                    <input
                      type="number"
                      value={newGwMinAmount}
                      onChange={(e) => setNewGwMinAmount(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-primary mb-1">Max Order Limit (₹)</label>
                    <input
                      type="number"
                      value={newGwMaxAmount}
                      onChange={(e) => setNewGwMaxAmount(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-primary mb-1">Convenience Fee / Surcharge (₹)</label>
                    <input
                      type="number"
                      value={newGwFee}
                      onChange={(e) => setNewGwFee(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>

                <div className="bg-surface-dim p-3.5 rounded-2xl border border-border space-y-2">
                  <label className="block font-semibold text-primary">Environment Mode</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setNewGwIsTestMode(false)}
                      className={`flex-1 py-1.5 px-3 rounded-lg font-bold text-xs border transition-colors ${
                        !newGwIsTestMode
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                          : 'bg-surface text-muted border-border'
                      }`}
                    >
                      Live Production
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewGwIsTestMode(true)}
                      className={`flex-1 py-1.5 px-3 rounded-lg font-bold text-xs border transition-colors ${
                        newGwIsTestMode
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : 'bg-surface text-muted border-border'
                      }`}
                    >
                      Sandbox / Test Mode
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-primary mb-1.5">Supported Payment Categories</label>
                  <div className="flex flex-wrap gap-2">
                    {(['UPI', 'CARDS', 'NET_BANKING', 'COD', 'WALLET'] as PaymentMethod[]).map((m) => {
                      const selected = newGwMethods.includes(m);
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => {
                            if (selected) {
                              setNewGwMethods(newGwMethods.filter((x) => x !== m));
                            } else {
                              setNewGwMethods([...newGwMethods, m]);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-colors ${
                            selected
                              ? 'bg-primary text-white border-primary'
                              : 'bg-surface-dim text-muted border-border'
                          }`}
                        >
                          {selected && <Check className="w-3.5 h-3.5" />}
                          <span>{m}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setShowAddGatewayModal(false)}
                    className="px-4 py-2 bg-surface-dim hover:bg-border text-primary font-semibold rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-accent hover:bg-accent-hover text-white font-bold rounded-xl shadow-xs transition-colors"
                  >
                    Create & Activate Gateway
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ISSUE REFUND MODAL */}
        {/* ========================================================================= */}
        {showRefundModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-surface border border-border rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="font-display text-lg font-bold text-primary flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-accent" />
                  <span>Execute Gateway Refund</span>
                </h3>
                <button
                  onClick={() => setShowRefundModal(false)}
                  className="p-1 text-muted hover:text-primary rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {refundFeedback && (
                <div className={`p-3 rounded-xl border text-xs font-semibold ${
                  refundFeedback.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}>
                  {refundFeedback.message}
                </div>
              )}

              <form onSubmit={handleProcessRefundSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-primary mb-1">Select Order to Refund</label>
                  <select
                    required
                    value={refundOrderNumber}
                    onChange={(e) => {
                      const num = e.target.value;
                      setRefundOrderNumber(num);
                      const target = orders.find((o) => o.orderNumber === num);
                      if (target) {
                        setRefundAmountRupees((target.totalInPaise / 100).toString());
                      }
                    }}
                    className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary font-mono focus:outline-none focus:border-accent"
                  >
                    <option value="">-- Choose Settled Order --</option>
                    {orders.map((o) => (
                      <option key={o.id} value={o.orderNumber}>
                        {o.orderNumber} • {formatPaiseToRupees(o.totalInPaise)} • ({o.status})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-primary mb-1">Refund Amount (INR ₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={refundAmountRupees}
                    onChange={(e) => setRefundAmountRupees(e.target.value)}
                    placeholder="e.g. 549.00"
                    className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary font-bold focus:outline-none focus:border-accent"
                  />
                  <span className="text-[10px] text-muted mt-1 block">Full or partial refund amount in Rupees.</span>
                </div>

                <div>
                  <label className="block font-semibold text-primary mb-1">Reason for Refund</label>
                  <select
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                  >
                    <option value="Customer Return Request">Customer Return Request</option>
                    <option value="Transit Damage Replacement">Transit Damage Replacement</option>
                    <option value="Order Cancellation before Dispatch">Order Cancellation before Dispatch</option>
                    <option value="Packaging Defect">Packaging Defect</option>
                    <option value="Administrative Goodwill">Administrative Goodwill</option>
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setShowRefundModal(false)}
                    className="px-4 py-2 bg-surface-dim hover:bg-border text-primary rounded-xl font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-accent hover:bg-accent-hover text-white font-bold rounded-xl shadow-xs"
                  >
                    Confirm & Process Refund
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* INSPECT TRANSACTION MODAL */}
        {/* ========================================================================= */}
        {selectedTx && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-surface border border-border rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="font-display text-lg font-bold text-primary">
                  Transaction Audit: {selectedTx.id}
                </h3>
                <button
                  onClick={() => setSelectedTx(null)}
                  className="p-1 text-muted hover:text-primary rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between py-1 border-b border-border/60">
                  <span className="text-muted">Order Number:</span>
                  <span className="font-mono font-bold text-accent">{selectedTx.orderNumber}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/60">
                  <span className="text-muted">Settlement Gateway:</span>
                  <span className="font-semibold text-primary">{selectedTx.gatewayId}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/60">
                  <span className="text-muted">Payment Method:</span>
                  <span className="font-mono text-primary">{selectedTx.method}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/60">
                  <span className="text-muted">Amount Settled:</span>
                  <span className="font-bold text-primary">{formatPaiseToRupees(selectedTx.amountInPaise)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/60">
                  <span className="text-muted">Status:</span>
                  <span className="font-bold text-emerald-700">{selectedTx.status}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/60">
                  <span className="text-muted">Customer Email:</span>
                  <span className="text-primary">{selectedTx.customerEmail}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/60">
                  <span className="text-muted">Recorded Timestamp:</span>
                  <span className="text-primary">{new Date(selectedTx.createdAt).toLocaleString()}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-border flex justify-end">
                <button
                  onClick={() => setSelectedTx(null)}
                  className="px-5 py-2 bg-primary text-white font-bold rounded-xl text-xs"
                >
                  Close Inspection
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* CUSTOM UPI UTR VERIFICATION MODAL */}
        {/* ========================================================================= */}
        {verifyingTx && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-surface border border-border rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-display text-base font-bold text-primary">
                      Verify UPI Payment — {verifyingTx.orderNumber}
                    </h3>
                    <span className="text-[10px] text-muted">Bank Ledger Manual Reconciliation</span>
                  </div>
                </div>
                <button
                  onClick={() => setVerifyingTx(null)}
                  className="p-1 text-muted hover:text-primary rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Transaction Summary Box */}
              <div className="p-4 bg-surface-dim rounded-2xl border border-border space-y-2.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-muted">Payable Amount:</span>
                  <span className="font-mono text-base font-extrabold text-accent">
                    {formatPaiseToRupees(verifyingTx.amountInPaise)}
                  </span>
                </div>

                <div className="flex justify-between items-center py-2 border-y border-border/80">
                  <span className="text-muted">Customer-Submitted UTR:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded-lg border border-amber-300">
                      {verifyingTx.utrNumber || 'N/A'}
                    </span>
                    {verifyingTx.utrNumber && (
                      <button
                        type="button"
                        onClick={() => handleCopy(verifyingTx.utrNumber!, 'utr_copy')}
                        className="p-1 hover:bg-surface rounded text-muted hover:text-primary"
                        title="Copy UTR"
                      >
                        {copiedKey === 'utr_copy' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex justify-between">
                  <span className="text-muted">Customer:</span>
                  <span className="text-primary font-medium">{verifyingTx.customerEmail} ({verifyingTx.customerPhone})</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-muted">Beneficiary Account:</span>
                  <span className="text-primary font-mono text-[11px]">
                    IndusInd Bank • 258825164657 (AbdurRahmanIndusIndCurrent@ybl)
                  </span>
                </div>
              </div>

              {/* Instructions */}
              <p className="text-[11px] text-muted leading-relaxed">
                Check your IndusInd Bank net banking or UPI statement. Confirm that a credit of exactly <strong>{formatPaiseToRupees(verifyingTx.amountInPaise)}</strong> has been received with reference number <strong>{verifyingTx.utrNumber}</strong> before approving.
              </p>

              {/* Rejection Form Drawer */}
              {showRejectForm ? (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl space-y-2">
                  <label className="block text-xs font-bold text-rose-900">
                    Specify Rejection Reason (Notified to Customer) *
                  </label>
                  <input
                    type="text"
                    value={rejectionReasonInput}
                    onChange={(e) => setRejectionReasonInput(e.target.value)}
                    placeholder="e.g. UTR not found in IndusInd statement or amount mismatch"
                    className="w-full text-xs px-3 py-2 bg-white border border-rose-300 rounded-xl text-primary focus:outline-none focus:border-rose-500"
                  />
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowRejectForm(false)}
                      className="px-3 py-1.5 text-xs text-muted hover:text-primary"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRejectUpi(verifyingTx.id)}
                      className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs"
                    >
                      Confirm Rejection
                    </button>
                  </div>
                </div>
              ) : (
                /* Primary Decision Buttons */
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowRejectForm(true)}
                    className="w-full sm:w-auto px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl border border-rose-200 text-xs transition-colors"
                  >
                    Reject Payment
                  </button>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <button
                      type="button"
                      onClick={() => setVerifyingTx(null)}
                      className="px-4 py-2.5 bg-surface-dim hover:bg-border text-primary font-semibold rounded-xl text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApproveUpi(verifyingTx.id)}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md transition-colors flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Approve &amp; Mark PAID</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

