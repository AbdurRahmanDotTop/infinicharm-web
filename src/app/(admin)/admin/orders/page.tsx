'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { formatPaiseToRupees } from '@/lib/utils/currency';
import { logAdminAction } from '@/lib/services/audit';
import {
  ShoppingBag,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Truck,
  MapPin,
  Calendar,
  AlertCircle,
  ExternalLink,
  Printer,
  X,
  FileText,
  Copy,
  Check,
  ShieldCheck,
  ShieldAlert,
  Building,
  RefreshCw,
  PlusCircle,
  ArrowRight,
  Eye,
  Plus,
  Pencil,
  Trash2,
  CheckSquare,
  Square,
} from 'lucide-react';
import { Order, OrderStatus, PaymentStatus, OrderItem, ManualApprovalStatus } from '@/types';
import {
  SUPPORTED_COURIERS,
  ORDER_STATUS_LABELS,
  isValidOrderTransition,
  getCourierTrackingUrl,
} from '@/lib/services/orders';

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [paymentFilter, setPaymentFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Bulk Selection State
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  // Create Order Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    addressLine1: '',
    addressLine2: '',
    city: 'East Champaran',
    state: 'Bihar',
    postalCode: '845427',
    paymentMethod: 'CUSTOM_UPI' as Order['paymentMethod'],
    paymentStatus: 'PAID' as Order['paymentStatus'],
    status: 'CONFIRMED' as OrderStatus,
    shippingInPaise: 0,
    discountInPaise: 0,
    adminNotes: '',
    items: [
      {
        id: 'item-1',
        productId: 'S-01-P-03',
        variantId: 'var-S-01-P-03-01',
        productTitle: 'Takmeeli Talbeena – Traditional Barley Breakfast',
        variantTitle: 'Standard Pack',
        sku: 'S-01-P-03',
        priceInPaise: 30000,
        quantity: 1,
        totalInPaise: 30000,
      },
    ],
  });

  // Edit Order Modal State
  const [editOrderTarget, setEditOrderTarget] = useState<Order | null>(null);
  const [editForm, setEditForm] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
    status: 'PENDING' as OrderStatus,
    paymentStatus: 'PENDING' as Order['paymentStatus'],
    adminNotes: '',
  });

  // Delete Order Confirmation Modal State
  const [deleteOrderTarget, setDeleteOrderTarget] = useState<Order | null>(null);
  const [isPermanentDelete, setIsPermanentDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Real-time broadcast channel reference
  const channelRef = useRef<BroadcastChannel | null>(null);

  // Modals
  const [reviewUtrOrder, setReviewUtrOrder] = useState<Order | null>(null);
  const [logisticsOrder, setLogisticsOrder] = useState<Order | null>(null);
  const [inspectorOrder, setInspectorOrder] = useState<Order | null>(null);

  // Logistics form state
  const [logisticsCourier, setLogisticsCourier] = useState('Delhivery Surface / Express');
  const [logisticsAwb, setLogisticsAwb] = useState('');
  const [logisticsEdd, setLogisticsEdd] = useState('');
  const [logisticsNotes, setLogisticsNotes] = useState('');

  // Rejection reason state
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  // Timeline note state
  const [newTimelineTitle, setNewTimelineTitle] = useState('');
  const [newTimelineDesc, setNewTimelineDesc] = useState('');
  const [newTimelineLocation, setNewTimelineLocation] = useState('East Champaran Operations');

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const broadcastOrderChange = useCallback((type: string, payload?: Record<string, any>) => {
    try {
      channelRef.current?.postMessage({ type, timestamp: Date.now(), ...payload });
    } catch {}
    try {
      localStorage.setItem('infinicharm_orders_sync', Date.now().toString());
      window.dispatchEvent(new Event('infinicharm_orders_updated'));
    } catch {}
  }, []);

  // Fetch orders from server API with localStorage fallback
  const fetchOrders = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      const res = await fetch('/api/admin/orders', { cache: 'no-store' });
      if (res.status === 401) {
        window.location.href = `/admin/login?redirect=${encodeURIComponent(window.location.pathname)}`;
        return;
      }
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.orders)) {
          setOrders(data.orders);
          try {
            localStorage.setItem('infinicharm_orders', JSON.stringify(data.orders));
          } catch {}
          if (showLoading) setIsLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn('Server orders fetch error, checking localStorage:', err);
    }

    // Fallback to localStorage
    try {
      const stored = localStorage.getItem('infinicharm_orders');
      if (stored) {
        setOrders(JSON.parse(stored));
      } else {
        setOrders([]);
      }
    } catch {
      setOrders([]);
    }
    if (showLoading) setIsLoading(false);
  }, []);

  // Real-time listener: BroadcastChannel + Visibility Polling
  useEffect(() => {
    fetchOrders(true);

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        channelRef.current = new BroadcastChannel('infinicharm_orders_channel');
        channelRef.current.onmessage = (event) => {
          if (
            event.data?.type === 'ORDER_UPDATED' ||
            event.data?.type === 'ORDER_CREATED' ||
            event.data?.type === 'ORDER_DELETED'
          ) {
            fetchOrders(false);
          }
        };
      } catch (e) {
        console.warn('BroadcastChannel error:', e);
      }
    }

    const handleSync = () => fetchOrders(false);
    window.addEventListener('infinicharm_orders_updated', handleSync);
    window.addEventListener('storage', handleSync);

    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchOrders(false);
      }
    }, 4000);

    return () => {
      clearInterval(interval);
      window.removeEventListener('infinicharm_orders_updated', handleSync);
      window.removeEventListener('storage', handleSync);
      try {
        channelRef.current?.close();
      } catch {}
    };
  }, [fetchOrders]);

  // Update Status Action with real-time sync & optimistic update
  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus) => {
    const targetOrder = orders.find((o) => o.id === orderId || o.orderNumber === orderId);
    if (!targetOrder) return;

    const isPaidStatus = ['PAYMENT_RECEIVED', 'CONFIRMED', 'PROCESSING', 'PACKED', 'READY_FOR_DISPATCH', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(newStatus);
    const isFailedStatus = newStatus === 'PAYMENT_NOT_RECEIVED';

    // Optimistic local state update
    const updated = orders.map((o) =>
      o.id === orderId || o.orderNumber === orderId
        ? {
            ...o,
            status: newStatus,
            paymentStatus: isPaidStatus ? ('PAID' as PaymentStatus) : isFailedStatus ? ('FAILED' as PaymentStatus) : o.paymentStatus,
            manualApprovalStatus: isPaidStatus ? ('APPROVED' as ManualApprovalStatus) : isFailedStatus ? ('REJECTED' as ManualApprovalStatus) : o.manualApprovalStatus,
            updatedAt: new Date().toISOString(),
          }
        : o
    );
    setOrders(updated);
    try {
      localStorage.setItem('infinicharm_orders', JSON.stringify(updated));
    } catch {}

    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_STATUS',
          status: newStatus,
          actor: 'Operations Admin',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.order) {
          const finalOrders = orders.map((o) =>
            o.id === orderId || o.orderNumber === orderId ? data.order : o
          );
          setOrders(finalOrders);
          try {
            localStorage.setItem('infinicharm_orders', JSON.stringify(finalOrders));
          } catch {}
          if (inspectorOrder && (inspectorOrder.id === orderId || inspectorOrder.orderNumber === orderId)) {
            setInspectorOrder(data.order);
          }
          broadcastOrderChange('ORDER_UPDATED', { orderId, order: data.order });
          logAdminAction('UPDATE_ORDER_STATUS', 'orders', orderId, {
            previousStatus: targetOrder.status,
            newStatus,
          });
          return;
        }
      }
    } catch (err) {
      console.error('Failed to update status on server:', err);
    }
    broadcastOrderChange('ORDER_UPDATED', { orderId, newStatus });
  };

  // Bulk Selection Handlers
  const toggleSelectOrder = (id: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedOrderIds.length === orders.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(orders.map((o) => o.id));
    }
  };

  // Bulk Status Change Handler
  const handleBulkStatusChange = async (targetStatus: OrderStatus) => {
    if (selectedOrderIds.length === 0) return;
    setIsBulkUpdating(true);
    try {
      const res = await fetch('/api/admin/orders/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderIds: selectedOrderIds,
          updates: { status: targetStatus },
          actor: 'Operations Admin',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        const isPaidStatus = ['PAYMENT_RECEIVED', 'CONFIRMED', 'PROCESSING', 'PACKED', 'READY_FOR_DISPATCH', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(targetStatus);
        const isFailedStatus = targetStatus === 'PAYMENT_NOT_RECEIVED';

        setOrders((prev) =>
          prev.map((o) =>
            selectedOrderIds.includes(o.id) || selectedOrderIds.includes(o.orderNumber)
              ? {
                  ...o,
                  status: targetStatus,
                  paymentStatus: isPaidStatus ? ('PAID' as PaymentStatus) : isFailedStatus ? ('FAILED' as PaymentStatus) : o.paymentStatus,
                  manualApprovalStatus: isPaidStatus ? ('APPROVED' as ManualApprovalStatus) : isFailedStatus ? ('REJECTED' as ManualApprovalStatus) : o.manualApprovalStatus,
                  updatedAt: new Date().toISOString(),
                }
              : o
          )
        );
        setSelectedOrderIds([]);
        broadcastOrderChange('ORDER_UPDATED', { bulk: true, targetStatus });
        return;
      }
      alert(data.error || 'Failed to update selected orders.');
    } catch (err: any) {
      alert(err.message || 'Bulk update error.');
    } finally {
      setIsBulkUpdating(false);
    }
  };

  // Bulk Delete Handler
  const handleBulkDelete = async () => {
    if (selectedOrderIds.length === 0) return;
    if (!confirm(`Are you sure you want to permanently delete ${selectedOrderIds.length} orders?`)) return;
    setIsBulkUpdating(true);
    try {
      const res = await fetch('/api/admin/orders/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderIds: selectedOrderIds,
          permanent: true,
          actor: 'Operations Admin',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setOrders((prev) =>
          prev.filter(
            (o) => !selectedOrderIds.includes(o.id) && !selectedOrderIds.includes(o.orderNumber)
          )
        );
        setSelectedOrderIds([]);
        broadcastOrderChange('ORDER_DELETED', { bulk: true });
        return;
      }
      alert(data.error || 'Failed to delete selected orders.');
    } catch (err: any) {
      alert(err.message || 'Bulk delete error.');
    } finally {
      setIsBulkUpdating(false);
    }
  };

  // Create Manual Order Handler
  const handleCreateOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.customerName.trim()) {
      alert('Please enter customer full name.');
      return;
    }
    if (createForm.items.length === 0) {
      alert('Please add at least one item to the order.');
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        customerName: createForm.customerName.trim(),
        customerEmail: createForm.customerEmail.trim(),
        customerPhone: createForm.customerPhone.trim(),
        shippingAddress: {
          fullName: createForm.customerName.trim(),
          phone: createForm.customerPhone.trim(),
          addressLine1: createForm.addressLine1.trim() || 'Storefront Fulfillment Desk',
          addressLine2: createForm.addressLine2.trim() || '',
          city: createForm.city.trim() || 'East Champaran',
          state: createForm.state.trim() || 'Bihar',
          postalCode: createForm.postalCode.trim() || '845427',
          country: 'India',
        },
        paymentMethod: createForm.paymentMethod,
        paymentStatus: createForm.paymentStatus,
        status: createForm.status,
        shippingInPaise: Number(createForm.shippingInPaise) || 0,
        discountInPaise: Number(createForm.discountInPaise) || 0,
        adminNotes: createForm.adminNotes.trim(),
        items: createForm.items,
        actor: 'Operations Admin',
      };

      const res = await fetch('/api/admin/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.order) {
        setOrders((prev) => [data.order, ...prev.filter((o) => o.id !== data.order.id && o.orderNumber !== data.order.orderNumber)]);
        setShowCreateModal(false);
        broadcastOrderChange('ORDER_CREATED', { order: data.order });
        logAdminAction('CREATE_ORDER', 'orders', data.order.orderNumber, {
          totalInPaise: data.order.totalInPaise,
          customer: createForm.customerName,
        });
        return;
      }
      alert(data.error || 'Failed to create manual order.');
    } catch (err: any) {
      alert(err.message || 'Error creating order.');
    } finally {
      setIsLoading(false);
    }
  };

  // Edit Order Handler
  const handleEditOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editOrderTarget) return;

    setIsLoading(true);
    try {
      let resolvedPaymentStatus = editForm.paymentStatus;
      if (['PAYMENT_RECEIVED', 'CONFIRMED', 'PROCESSING', 'PACKED', 'READY_FOR_DISPATCH', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(editForm.status)) {
        resolvedPaymentStatus = 'PAID';
      } else if (editForm.status === 'PAYMENT_NOT_RECEIVED') {
        resolvedPaymentStatus = 'FAILED';
      }

      const updates = {
        customerName: editForm.customerName.trim(),
        customerEmail: editForm.customerEmail.trim(),
        customerPhone: editForm.customerPhone.trim(),
        shippingAddress: {
          ...(editOrderTarget.shippingAddress || {}),
          fullName: editForm.customerName.trim(),
          phone: editForm.customerPhone.trim(),
          addressLine1: editForm.addressLine1.trim(),
          addressLine2: editForm.addressLine2.trim(),
          city: editForm.city.trim(),
          state: editForm.state.trim(),
          postalCode: editForm.postalCode.trim(),
        },
        status: editForm.status,
        paymentStatus: resolvedPaymentStatus,
        adminNotes: editForm.adminNotes.trim(),
        actor: 'Operations Admin',
      };

      const res = await fetch(`/api/orders/${encodeURIComponent(editOrderTarget.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.order) {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === editOrderTarget.id || o.orderNumber === editOrderTarget.orderNumber ? data.order : o
          )
        );
        setEditOrderTarget(null);
        broadcastOrderChange('ORDER_UPDATED', { order: data.order });
        logAdminAction('EDIT_ORDER', 'orders', editOrderTarget.orderNumber, updates);
        return;
      }
      alert(data.error || 'Failed to save order changes.');
    } catch (err: any) {
      alert(err.message || 'Error updating order.');
    } finally {
      setIsLoading(false);
    }
  };

  // Delete Order Execution Handler
  const handleDeleteOrderExecute = async () => {
    if (!deleteOrderTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(
        `/api/orders/${encodeURIComponent(deleteOrderTarget.id)}?permanent=${isPermanentDelete}&actor=Operations+Admin`,
        { method: 'DELETE' }
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        if (isPermanentDelete) {
          setOrders((prev) =>
            prev.filter(
              (o) => o.id !== deleteOrderTarget.id && o.orderNumber !== deleteOrderTarget.orderNumber
            )
          );
        } else {
          setOrders((prev) =>
            prev.map((o) =>
              o.id === deleteOrderTarget.id || o.orderNumber === deleteOrderTarget.orderNumber
                ? { ...o, status: 'CANCELLED' as OrderStatus }
                : o
            )
          );
        }
        broadcastOrderChange('ORDER_DELETED', { orderId: deleteOrderTarget.id });
        setDeleteOrderTarget(null);
        logAdminAction('DELETE_ORDER', 'orders', deleteOrderTarget.orderNumber, {
          permanent: isPermanentDelete,
        });
        return;
      }
      alert(data.error || 'Failed to delete order.');
    } catch (err: any) {
      alert(err.message || 'Error deleting order.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Approve Custom UPI Payment
  const handleApproveUtr = async (order: Order) => {
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(order.orderNumber)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'APPROVE_UTR',
          adminName: 'Finance Admin',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.order) {
          const updated = orders.map((o) =>
            o.id === order.id || o.orderNumber === order.orderNumber ? data.order : o
          );
          setOrders(updated);
          localStorage.setItem('infinicharm_orders', JSON.stringify(updated));
          window.dispatchEvent(new Event('infinicharm_orders_updated'));
          setReviewUtrOrder(null);
          logAdminAction('APPROVE_UPI_PAYMENT', 'payments', order.orderNumber, {
            utrNumber: order.utrNumber,
            amountInPaise: order.totalInPaise,
          });
          return;
        }
      }
    } catch (err) {
      console.error('Failed to approve UTR:', err);
    }
  };

  // Reject Custom UPI Payment
  const handleRejectUtr = async (order: Order) => {
    if (!rejectReason.trim()) {
      alert('Please provide a reason for rejecting this payment.');
      return;
    }

    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(order.orderNumber)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'REJECT_UTR',
          reason: rejectReason.trim(),
          adminName: 'Finance Admin',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.order) {
          const updated = orders.map((o) =>
            o.id === order.id || o.orderNumber === order.orderNumber ? data.order : o
          );
          setOrders(updated);
          localStorage.setItem('infinicharm_orders', JSON.stringify(updated));
          window.dispatchEvent(new Event('infinicharm_orders_updated'));
          setReviewUtrOrder(null);
          setShowRejectInput(false);
          setRejectReason('');
          logAdminAction('REJECT_UPI_PAYMENT', 'payments', order.orderNumber, {
            utrNumber: order.utrNumber,
            reason: rejectReason.trim(),
          });
          return;
        }
      }
    } catch (err) {
      console.error('Failed to reject UTR:', err);
    }
  };

  // Mark Payment Not Received (allows customer to retry payment)
  const handleMarkPaymentNotReceived = async (order: Order) => {
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(order.orderNumber)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_STATUS',
          status: 'PAYMENT_NOT_RECEIVED',
          adminNotes: rejectReason.trim() || 'Payment not received / bank statement reconciliation pending',
          actor: 'Finance Admin',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.order) {
          const updated = orders.map((o) =>
            o.id === order.id || o.orderNumber === order.orderNumber ? data.order : o
          );
          setOrders(updated);
          localStorage.setItem('infinicharm_orders', JSON.stringify(updated));
          window.dispatchEvent(new Event('infinicharm_orders_updated'));
          setReviewUtrOrder(null);
          setShowRejectInput(false);
          setRejectReason('');
          logAdminAction('UPDATE_ORDER_STATUS', 'orders', order.orderNumber, {
            status: 'PAYMENT_NOT_RECEIVED',
            reason: rejectReason.trim(),
          });
          return;
        }
      }
    } catch (err) {
      console.error('Failed to mark payment not received:', err);
    }
  };

  // Save Logistics & Tracking Info
  const handleSaveLogistics = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logisticsOrder || !logisticsCourier || !logisticsAwb.trim()) {
      alert('Please select a courier and enter the AWB tracking number.');
      return;
    }

    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(logisticsOrder.orderNumber)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_TRACKING',
          courierName: logisticsCourier,
          trackingNumber: logisticsAwb.trim(),
          estimatedDeliveryDate: logisticsEdd || undefined,
          checkpointNotes: logisticsNotes.trim() || undefined,
          actor: 'Logistics Desk',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.order) {
          const updated = orders.map((o) =>
            o.id === logisticsOrder.id || o.orderNumber === logisticsOrder.orderNumber ? data.order : o
          );
          setOrders(updated);
          localStorage.setItem('infinicharm_orders', JSON.stringify(updated));
          window.dispatchEvent(new Event('infinicharm_orders_updated'));
          setLogisticsOrder(null);
          logAdminAction('ASSIGN_COURIER_TRACKING', 'orders', logisticsOrder.orderNumber, {
            courierName: logisticsCourier,
            trackingNumber: logisticsAwb.trim(),
          });
          return;
        }
      }
    } catch (err) {
      console.error('Failed to update tracking:', err);
    }
  };

  // Add Custom Timeline Event
  const handleAddTimelineNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectorOrder || !newTimelineTitle.trim() || !newTimelineDesc.trim()) return;

    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(inspectorOrder.orderNumber)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ADD_TIMELINE_EVENT',
          title: newTimelineTitle.trim(),
          description: newTimelineDesc.trim(),
          location: newTimelineLocation.trim(),
          actor: 'Operations Desk',
          status: inspectorOrder.status,
          type: 'LOGISTICS',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.order) {
          const updated = orders.map((o) =>
            o.id === inspectorOrder.id || o.orderNumber === inspectorOrder.orderNumber ? data.order : o
          );
          setOrders(updated);
          setInspectorOrder(data.order);
          localStorage.setItem('infinicharm_orders', JSON.stringify(updated));
          window.dispatchEvent(new Event('infinicharm_orders_updated'));
          setNewTimelineTitle('');
          setNewTimelineDesc('');
        }
      }
    } catch (err) {
      console.error('Failed to add timeline event:', err);
    }
  };

  // Filtered orders
  const filteredOrders = orders.filter((o) => {
    const matchesStatus = statusFilter === 'ALL' || o.status === statusFilter;
    const matchesPayment =
      paymentFilter === 'ALL' ||
      (paymentFilter === 'PENDING' && o.paymentStatus === 'PENDING') ||
      (paymentFilter === 'PAID' && o.paymentStatus === 'PAID') ||
      (paymentFilter === 'FAILED' && o.paymentStatus === 'FAILED') ||
      (paymentFilter === 'REVIEW' && o.manualApprovalStatus === 'PENDING_REVIEW');

    const cleanQ = searchQuery.trim().toLowerCase();
    const matchesQuery =
      !cleanQ ||
      o.orderNumber.toLowerCase().includes(cleanQ) ||
      o.customerPhone.includes(cleanQ) ||
      (o.utrNumber && o.utrNumber.toLowerCase().includes(cleanQ)) ||
      o.shippingAddress.fullName.toLowerCase().includes(cleanQ);

    return matchesStatus && matchesPayment && matchesQuery;
  });

  const pendingUtrCount = orders.filter(
    (o) => o.paymentMethod === 'CUSTOM_UPI' && o.manualApprovalStatus === 'PENDING_REVIEW'
  ).length;

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <AdminHeader />

      <main className="flex-1 p-6 sm:p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Header & Stats Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
          <div>
            <h1 className="font-display text-2xl font-bold text-primary tracking-tight">
              Order Fulfillment & Shipments
            </h1>
            <p className="text-xs text-muted mt-1">
              Verify UPI payments, manage fulfillment state machines, assign courier AWB tracking, and print tax invoices.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {pendingUtrCount > 0 && (
              <button
                onClick={() => {
                  setPaymentFilter('REVIEW');
                  setStatusFilter('ALL');
                }}
                className="text-xs font-bold bg-amber-500/15 border border-amber-500/40 text-amber-800 dark:text-amber-200 px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 animate-pulse"
              >
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>{pendingUtrCount} UTR Reviews Pending</span>
              </button>
            )}

            <span className="text-xs font-bold bg-surface-dim border border-border px-3.5 py-1.5 rounded-xl text-primary">
              {orders.length} Consignments Recorded
            </span>

            <button
              onClick={() => fetchOrders(true)}
              className="p-2 text-muted hover:text-primary rounded-xl hover:bg-surface border border-border"
              title="Refresh Orders"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={() => {
                setCreateForm({
                  customerName: '',
                  customerEmail: '',
                  customerPhone: '',
                  addressLine1: '',
                  addressLine2: '',
                  city: 'East Champaran',
                  state: 'Bihar',
                  postalCode: '845427',
                  paymentMethod: 'CUSTOM_UPI',
                  paymentStatus: 'PAID',
                  status: 'CONFIRMED',
                  shippingInPaise: 0,
                  discountInPaise: 0,
                  adminNotes: '',
                  items: [
                    {
                      id: `item-${Date.now()}`,
                      productId: 'S-01-P-03',
                      variantId: 'var-S-01-P-03-01',
                      productTitle: 'Takmeeli Talbeena – Traditional Barley Breakfast',
                      variantTitle: 'Standard Pack',
                      sku: 'S-01-P-03',
                      priceInPaise: 30000,
                      quantity: 1,
                      totalInPaise: 30000,
                    },
                  ],
                });
                setShowCreateModal(true);
              }}
              className="text-xs font-bold bg-accent text-accent-fg hover:opacity-95 px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-sm transition-opacity"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Create Order</span>
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Order ID, customer name, phone, or 12-digit UTR..."
              className="w-full text-xs pl-10 pr-4 py-2.5 bg-surface border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
            />
          </div>

          {/* Fulfillment Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs px-3.5 py-2.5 bg-surface border border-border rounded-xl text-primary focus:outline-none focus:border-accent font-medium"
          >
            <option value="ALL">All Order States</option>
            <option value="PENDING">PENDING</option>
            <option value="PAYMENT_RECEIVED">PAYMENT_RECEIVED</option>
            <option value="PAYMENT_NOT_RECEIVED">PAYMENT_NOT_RECEIVED</option>
            <option value="CONFIRMED">CONFIRMED</option>
            <option value="PROCESSING">PROCESSING</option>
            <option value="PACKED">PACKED</option>
            <option value="READY_FOR_DISPATCH">READY_FOR_DISPATCH</option>
            <option value="SHIPPED">SHIPPED</option>
            <option value="OUT_FOR_DELIVERY">OUT_FOR_DELIVERY</option>
            <option value="DELIVERED">DELIVERED</option>
            <option value="CANCELLED">CANCELLED</option>
            <option value="RETURNED">RETURNED</option>
          </select>

          {/* Payment Status Filter */}
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="text-xs px-3.5 py-2.5 bg-surface border border-border rounded-xl text-primary focus:outline-none focus:border-accent font-medium"
          >
            <option value="ALL">All Payment States</option>
            <option value="REVIEW">Needs UTR Review</option>
            <option value="PENDING">Payment Pending</option>
            <option value="PAID">Paid / Verified</option>
            <option value="FAILED">Payment Failed</option>
          </select>
        </div>

        {/* Bulk Action Floating Bar */}
        {selectedOrderIds.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-accent/10 border border-accent/30 text-primary">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-accent" />
              <span className="text-xs font-bold">
                {selectedOrderIds.length} {selectedOrderIds.length === 1 ? 'order' : 'orders'} selected
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted">Bulk Status:</span>
              <select
                disabled={isBulkUpdating}
                onChange={(e) => {
                  if (e.target.value) {
                    handleBulkStatusChange(e.target.value as OrderStatus);
                    e.target.value = '';
                  }
                }}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-border bg-surface text-primary font-semibold"
                defaultValue=""
              >
                <option value="" disabled>Change Status To...</option>
                <option value="CONFIRMED">CONFIRMED</option>
                <option value="PROCESSING">PROCESSING</option>
                <option value="PACKED">PACKED</option>
                <option value="READY_FOR_DISPATCH">READY_FOR_DISPATCH</option>
                <option value="SHIPPED">SHIPPED</option>
                <option value="OUT_FOR_DELIVERY">OUT_FOR_DELIVERY</option>
                <option value="DELIVERED">DELIVERED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
              <button
                onClick={handleBulkDelete}
                disabled={isBulkUpdating}
                className="text-xs font-bold px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white flex items-center gap-1 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Selected</span>
              </button>
              <button
                onClick={() => setSelectedOrderIds([])}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-border bg-surface hover:bg-surface-dim text-muted hover:text-primary transition-colors"
              >
                Deselect All
              </button>
            </div>
          </div>
        )}

        {/* Orders Table */}
        {filteredOrders.length === 0 ? (
          <div className="bg-surface border border-border rounded-2xl p-12 text-center max-w-xl mx-auto space-y-4 shadow-sm">
            <div className="w-14 h-14 bg-accent/10 text-accent rounded-full flex items-center justify-center mx-auto">
              <ShoppingBag className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="font-display text-lg font-bold text-primary">
                {orders.length === 0
                  ? 'No Customer Orders Recorded Yet'
                  : 'No Consignments Match Your Filters'}
              </h3>
              <p className="text-xs text-muted max-w-md mx-auto leading-relaxed">
                {orders.length === 0
                  ? 'Genuine customer orders placed via the storefront checkout appear here immediately with server authority.'
                  : 'Try selecting a different filter or clearing search keywords.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Mobile & Tablet Order Fulfillment Cards (< lg) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:hidden">
              {filteredOrders.map((ord) => {
                const statusMeta = ORDER_STATUS_LABELS[ord.status];
                const isCustomUpi = ord.paymentMethod === 'CUSTOM_UPI';
                const needsReview = isCustomUpi && ord.manualApprovalStatus === 'PENDING_REVIEW';

                return (
                  <div
                    key={ord.id}
                    className="bg-surface rounded-2xl border border-border p-4 shadow-sm space-y-3 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedOrderIds.includes(ord.id)}
                          onChange={() => toggleSelectOrder(ord.id)}
                          className="rounded border-border text-accent focus:ring-accent mt-0.5"
                        />
                        <div>
                          <button
                            onClick={() => setInspectorOrder(ord)}
                            className="font-mono font-bold text-sm text-primary hover:text-accent flex items-center gap-1.5 text-left"
                          >
                            <span>{ord.orderNumber}</span>
                            <Eye className="w-3.5 h-3.5 text-muted" />
                          </button>
                          <span className="text-[11px] text-muted flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3 h-3 text-accent" />
                            {new Date(ord.createdAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-accent text-sm block">
                          {formatPaiseToRupees(ord.totalInPaise)}
                        </span>
                        <span className="text-[10px] text-muted">
                          {ord.items.length} {ord.items.length === 1 ? 'item' : 'items'}
                        </span>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-surface-dim/60 border border-border/60 space-y-0.5">
                      <span className="font-bold text-primary block">{ord.shippingAddress.fullName}</span>
                      <span className="text-[11px] text-muted block break-words">
                        {ord.shippingAddress.city}, {ord.shippingAddress.state} • {ord.shippingAddress.phone}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-primary">{ord.paymentMethod}</span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            ord.paymentStatus === 'PAID'
                              ? 'bg-emerald-100 text-emerald-800'
                              : ord.paymentStatus === 'PENDING'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {ord.paymentStatus}
                        </span>
                      </div>

                      {ord.utrNumber && (
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-mono bg-surface-dim border border-border px-1.5 py-0.5 rounded text-primary">
                            UTR: {ord.utrNumber}
                          </span>
                          <button
                            onClick={() => handleCopy(ord.utrNumber!, `utr-m-${ord.id}`)}
                            className="p-1 text-muted hover:text-primary rounded"
                            title="Copy UTR"
                          >
                            {copiedKey === `utr-m-${ord.id}` ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>

                    {needsReview && (
                      <button
                        onClick={() => {
                          setReviewUtrOrder(ord);
                          setShowRejectInput(false);
                          setRejectReason('');
                        }}
                        className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white px-3 py-2 rounded-xl shadow-sm transition-colors"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>Review UTR Payment Proof</span>
                      </button>
                    )}

                    <div className="pt-2 border-t border-border/60 space-y-2">
                      <select
                        value={ord.status}
                        onChange={(e) => handleUpdateStatus(ord.id, e.target.value as OrderStatus)}
                        className={`w-full text-xs px-3 py-2 rounded-xl border font-bold uppercase tracking-wider ${
                          statusMeta?.badgeClass || 'bg-surface text-primary border-border'
                        }`}
                      >
                        <option value="PENDING">PENDING</option>
                        <option value="PAYMENT_RECEIVED">PAYMENT_RECEIVED</option>
                        <option value="PAYMENT_NOT_RECEIVED">PAYMENT_NOT_RECEIVED</option>
                        <option value="CONFIRMED">CONFIRMED</option>
                        <option value="PROCESSING">PROCESSING</option>
                        <option value="PACKED">PACKED</option>
                        <option value="READY_FOR_DISPATCH">READY_FOR_DISPATCH</option>
                        <option value="SHIPPED">SHIPPED</option>
                        <option value="OUT_FOR_DELIVERY">OUT_FOR_DELIVERY</option>
                        <option value="DELIVERED">DELIVERED</option>
                        <option value="DELIVERY_ATTEMPTED">DELIVERY_ATTEMPTED</option>
                        <option value="RTO_INITIATED">RTO_INITIATED</option>
                        <option value="RTO_DELIVERED">RTO_DELIVERED</option>
                        <option value="CANCELLED">CANCELLED</option>
                        <option value="RETURN_REQUESTED">RETURN_REQUESTED</option>
                        <option value="RETURN_APPROVED">RETURN_APPROVED</option>
                        <option value="RETURNED">RETURNED</option>
                        <option value="REFUNDED">REFUNDED</option>
                      </select>

                      <div className="flex flex-wrap items-center justify-between gap-2">
                        {ord.trackingNumber ? (
                          <button
                            onClick={() => {
                              setLogisticsOrder(ord);
                              setLogisticsCourier(ord.courierName || 'Delhivery Surface / Express');
                              setLogisticsAwb(ord.trackingNumber || '');
                              setLogisticsEdd(ord.estimatedDeliveryDate ? ord.estimatedDeliveryDate.slice(0, 10) : '');
                            }}
                            className="text-left hover:opacity-80"
                          >
                            <span className="font-semibold text-primary block text-[11px]">{ord.courierName}</span>
                            <span className="font-mono text-[10px] text-accent block">{ord.trackingNumber}</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setLogisticsOrder(ord);
                              setLogisticsCourier('Delhivery Surface / Express');
                              setLogisticsAwb(`DLV${Math.floor(10000000000 + Math.random() * 90000000000)}`);
                              setLogisticsEdd('');
                            }}
                            className="px-2.5 py-1.5 bg-surface-dim hover:bg-border text-primary rounded-lg text-xs font-semibold border border-border"
                          >
                            + Assign AWB
                          </button>
                        )}

                        <div className="flex items-center gap-1.5 ml-auto">
                          {ord.trackingNumber && (
                            <a
                              href={getCourierTrackingUrl(ord.courierName, ord.trackingNumber) || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 bg-surface-dim hover:bg-border rounded-lg text-primary"
                              title="Open Live Courier Portal"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <button
                            onClick={() => {
                              setSelectedOrder(ord);
                              setShowInvoiceModal(true);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-surface-dim hover:bg-border rounded-lg text-primary font-semibold border border-border"
                            title="Generate GST Tax Invoice"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Invoice</span>
                          </button>

                          <button
                            onClick={() => {
                              setEditOrderTarget(ord);
                              setEditForm({
                                customerName: ord.shippingAddress?.fullName || ord.customerName || '',
                                customerEmail: ord.customerEmail || '',
                                customerPhone: ord.shippingAddress?.phone || ord.customerPhone || '',
                                addressLine1: ord.shippingAddress?.addressLine1 || '',
                                addressLine2: ord.shippingAddress?.addressLine2 || '',
                                city: ord.shippingAddress?.city || '',
                                state: ord.shippingAddress?.state || '',
                                postalCode: ord.shippingAddress?.postalCode || '',
                                status: ord.status,
                                paymentStatus: ord.paymentStatus,
                                adminNotes: ord.adminNotes || '',
                              });
                            }}
                            className="p-1.5 bg-surface-dim hover:bg-border rounded-lg text-primary"
                            title="Edit Order"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => {
                              setDeleteOrderTarget(ord);
                              setIsPermanentDelete(false);
                            }}
                            className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 rounded-lg"
                            title="Delete Order"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Order Fulfillment Table (lg+) */}
            <div className="hidden lg:block bg-surface rounded-2xl border border-border overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-border bg-surface-dim/40 text-muted uppercase text-[10px] tracking-wider">
                    <th className="py-3.5 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={orders.length > 0 && selectedOrderIds.length === orders.length}
                        onChange={toggleSelectAll}
                        className="rounded border-border text-accent focus:ring-accent"
                        title="Select All"
                      />
                    </th>
                    <th className="py-3.5 px-4">Order Reference</th>
                    <th className="py-3.5 px-4">Customer Details</th>
                    <th className="py-3.5 px-4">Items / Total</th>
                    <th className="py-3.5 px-4">Payment Method & UTR</th>
                    <th className="py-3.5 px-4">Status & Action</th>
                    <th className="py-3.5 px-4 text-right">Actions & Logistics</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredOrders.map((ord) => {
                    const statusMeta = ORDER_STATUS_LABELS[ord.status];
                    const isCustomUpi = ord.paymentMethod === 'CUSTOM_UPI';
                    const needsReview = isCustomUpi && ord.manualApprovalStatus === 'PENDING_REVIEW';

                    return (
                      <tr key={ord.id} className="hover:bg-surface-dim/30 transition-colors">
                        {/* Checkbox */}
                        <td className="py-3.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={selectedOrderIds.includes(ord.id)}
                            onChange={() => toggleSelectOrder(ord.id)}
                            className="rounded border-border text-accent focus:ring-accent"
                          />
                        </td>

                        {/* Reference */}
                        <td className="py-3.5 px-4">
                          <button
                            onClick={() => setInspectorOrder(ord)}
                            className="font-mono font-bold text-primary hover:text-accent transition-colors flex items-center gap-1.5 text-left"
                            title="Inspect Order Journey"
                          >
                            <span>{ord.orderNumber}</span>
                            <Eye className="w-3.5 h-3.5 text-muted hover:text-accent" />
                          </button>
                          <span className="text-[10px] text-muted flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3 h-3 text-accent" />
                            {new Date(ord.createdAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        </td>

                        {/* Customer */}
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-primary block">
                            {ord.shippingAddress.fullName}
                          </span>
                          <span className="text-[11px] text-muted">
                            {ord.shippingAddress.city}, {ord.shippingAddress.state} ({ord.shippingAddress.phone})
                          </span>
                        </td>

                        {/* Items / Total */}
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-accent block">
                            {formatPaiseToRupees(ord.totalInPaise)}
                          </span>
                          <span className="text-[10px] text-muted">
                            {ord.items.length} {ord.items.length === 1 ? 'item' : 'items'}
                          </span>
                        </td>

                        {/* Payment & UTR Review */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-primary">{ord.paymentMethod}</span>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                ord.paymentStatus === 'PAID'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                                  : ord.paymentStatus === 'PENDING'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                              }`}
                            >
                              {ord.paymentStatus}
                            </span>
                          </div>

                          {/* UTR chip & Review trigger */}
                          {ord.utrNumber && (
                            <div className="mt-1.5 space-y-1">
                              <div className="flex items-center gap-1">
                                <span className="text-[9px] font-mono bg-surface-dim border border-border px-1.5 py-0.5 rounded text-primary">
                                  UTR: {ord.utrNumber}
                                </span>
                                <button
                                  onClick={() => handleCopy(ord.utrNumber!, `utr-${ord.id}`)}
                                  className="p-0.5 text-muted hover:text-primary rounded"
                                  title="Copy UTR"
                                >
                                  {copiedKey === `utr-${ord.id}` ? (
                                    <Check className="w-3 h-3 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </div>

                              {needsReview ? (
                                <button
                                  onClick={() => {
                                    setReviewUtrOrder(ord);
                                    setShowRejectInput(false);
                                    setRejectReason('');
                                  }}
                                  className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-500 hover:bg-amber-600 text-white px-2 py-0.5 rounded shadow-sm transition-colors"
                                >
                                  <Clock className="w-3 h-3" />
                                  <span>Review UTR</span>
                                </button>
                              ) : ord.manualApprovalStatus === 'APPROVED' ? (
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-700 dark:text-emerald-400">
                                  <ShieldCheck className="w-3 h-3" />
                                  <span>UTR Reconciled</span>
                                </span>
                              ) : ord.manualApprovalStatus === 'REJECTED' ? (
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-rose-700 dark:text-rose-400">
                                  <ShieldAlert className="w-3 h-3" />
                                  <span>UTR Rejected</span>
                                </span>
                              ) : null}
                            </div>
                          )}
                        </td>

                        {/* Status Dropdown */}
                        <td className="py-3.5 px-4">
                          <select
                            value={ord.status}
                            onChange={(e) =>
                              handleUpdateStatus(ord.id, e.target.value as OrderStatus)
                            }
                            className={`text-xs px-2.5 py-1.5 rounded-lg border font-bold uppercase tracking-wider ${
                              statusMeta?.badgeClass || 'bg-surface text-primary border-border'
                            }`}
                          >
                            <option value="PENDING">PENDING</option>
                            <option value="PAYMENT_RECEIVED">PAYMENT_RECEIVED</option>
                            <option value="PAYMENT_NOT_RECEIVED">PAYMENT_NOT_RECEIVED</option>
                            <option value="CONFIRMED">CONFIRMED</option>
                            <option value="PROCESSING">PROCESSING</option>
                            <option value="PACKED">PACKED</option>
                            <option value="READY_FOR_DISPATCH">READY_FOR_DISPATCH</option>
                            <option value="SHIPPED">SHIPPED</option>
                            <option value="OUT_FOR_DELIVERY">OUT_FOR_DELIVERY</option>
                            <option value="DELIVERED">DELIVERED</option>
                            <option value="DELIVERY_ATTEMPTED">DELIVERY_ATTEMPTED</option>
                            <option value="RTO_INITIATED">RTO_INITIATED</option>
                            <option value="RTO_DELIVERED">RTO_DELIVERED</option>
                            <option value="CANCELLED">CANCELLED</option>
                            <option value="RETURN_REQUESTED">RETURN_REQUESTED</option>
                            <option value="RETURN_APPROVED">RETURN_APPROVED</option>
                            <option value="RETURNED">RETURNED</option>
                            <option value="REFUNDED">REFUNDED</option>
                          </select>
                        </td>

                        {/* Logistics & Invoice Action */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {ord.trackingNumber ? (
                              <button
                                onClick={() => {
                                  setLogisticsOrder(ord);
                                  setLogisticsCourier(ord.courierName || 'Delhivery Surface / Express');
                                  setLogisticsAwb(ord.trackingNumber || '');
                                  setLogisticsEdd(ord.estimatedDeliveryDate ? ord.estimatedDeliveryDate.slice(0, 10) : '');
                                }}
                                className="text-right hover:opacity-80 transition-opacity"
                                title="Edit Tracking Details"
                              >
                                <span className="font-semibold text-primary block text-[11px]">
                                  {ord.courierName}
                                </span>
                                <span className="font-mono text-[10px] text-accent block">
                                  {ord.trackingNumber}
                                </span>
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  setLogisticsOrder(ord);
                                  setLogisticsCourier('Delhivery Surface / Express');
                                  setLogisticsAwb(`DLV${Math.floor(10000000000 + Math.random() * 90000000000)}`);
                                  setLogisticsEdd('');
                                }}
                                className="px-2.5 py-1 bg-surface-dim hover:bg-border text-primary rounded-lg text-xs font-semibold border border-border"
                              >
                                + Assign AWB
                              </button>
                            )}

                            {ord.trackingNumber && (
                              <a
                                href={getCourierTrackingUrl(ord.courierName, ord.trackingNumber) || '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 hover:bg-surface-dim rounded-lg text-muted hover:text-accent transition-colors"
                                title="Open Live Courier Portal"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}

                            <button
                              onClick={() => {
                                setSelectedOrder(ord);
                                setShowInvoiceModal(true);
                              }}
                              className="p-1.5 hover:bg-surface-dim rounded-lg text-muted hover:text-primary transition-colors"
                              title="Generate GST Tax Invoice"
                            >
                              <FileText className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => {
                                setEditOrderTarget(ord);
                                setEditForm({
                                  customerName: ord.shippingAddress?.fullName || ord.customerName || '',
                                  customerEmail: ord.customerEmail || '',
                                  customerPhone: ord.shippingAddress?.phone || ord.customerPhone || '',
                                  addressLine1: ord.shippingAddress?.addressLine1 || '',
                                  addressLine2: ord.shippingAddress?.addressLine2 || '',
                                  city: ord.shippingAddress?.city || '',
                                  state: ord.shippingAddress?.state || '',
                                  postalCode: ord.shippingAddress?.postalCode || '',
                                  status: ord.status,
                                  paymentStatus: ord.paymentStatus,
                                  adminNotes: ord.adminNotes || '',
                                });
                              }}
                              className="p-1.5 hover:bg-surface-dim rounded-lg text-muted hover:text-accent transition-colors"
                              title="Edit Order Details"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => {
                                setDeleteOrderTarget(ord);
                                setIsPermanentDelete(false);
                              }}
                              className="p-1.5 hover:bg-rose-500/10 rounded-lg text-muted hover:text-rose-600 transition-colors"
                              title="Delete / Cancel Order"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </div>
          </div>
        )}

        {/* UTR REVIEW & RECONCILIATION MODAL */}
        {reviewUtrOrder && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-surface border border-border rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-400">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-bold text-primary">
                      Reconcile UPI Payment UTR
                    </h3>
                    <p className="text-xs text-muted">
                      Order Reference: <strong>{reviewUtrOrder.orderNumber}</strong>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setReviewUtrOrder(null)}
                  className="p-1 text-muted hover:text-primary rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Bank Reconciliation Card */}
              <div className="p-4 rounded-xl bg-surface-dim border border-border text-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted">Total Payable Amount:</span>
                  <span className="font-display font-bold text-base text-accent">
                    {formatPaiseToRupees(reviewUtrOrder.totalInPaise)}
                  </span>
                </div>

                <div className="flex items-center justify-between border-t border-border/60 pt-2">
                  <span className="text-muted">Customer Submitted UTR:</span>
                  <div className="flex items-center gap-2">
                    <strong className="font-mono text-xs bg-surface px-2 py-0.5 rounded border border-border text-primary">
                      {reviewUtrOrder.utrNumber || 'N/A'}
                    </strong>
                    {reviewUtrOrder.utrNumber && (
                      <button
                        onClick={() => handleCopy(reviewUtrOrder.utrNumber!, 'modal-utr')}
                        className="p-1 rounded text-muted hover:text-primary"
                        title="Copy UTR"
                      >
                        {copiedKey === 'modal-utr' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </div>

                <div className="border-t border-border/60 pt-2 space-y-1">
                  <span className="font-semibold text-primary block">Merchant IndusInd Bank Statement to Check:</span>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-muted bg-surface p-2.5 rounded-lg border border-border/60">
                    <div>
                      <span>Account Number:</span>
                      <strong className="block text-primary font-mono">258825164657</strong>
                    </div>
                    <div>
                      <span>IFSC Code:</span>
                      <strong className="block text-primary font-mono">INDB0001548</strong>
                    </div>
                    <div>
                      <span>VPA:</span>
                      <strong className="block text-primary">AbdurRahmanIndusIndCurrent@ybl</strong>
                    </div>
                    <div>
                      <span>Account Holder:</span>
                      <strong className="block text-primary">TechilyFly - InfiniCharm</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Reject Reason input if active */}
              {showRejectInput && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs space-y-2 dark:bg-rose-950/40 dark:border-rose-800">
                  <label className="font-bold text-rose-900 dark:text-rose-200 block">
                    Reason for Rejecting Payment:
                  </label>
                  <input
                    type="text"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="e.g. UTR not found on IndusInd Bank statement, amount mismatch..."
                    className="w-full text-xs px-3 py-2 bg-surface border border-rose-300 rounded-lg text-primary focus:outline-none"
                  />
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                <div className="flex flex-wrap items-center gap-2">
                  {!showRejectInput ? (
                    <>
                      <button
                        onClick={() => handleMarkPaymentNotReceived(reviewUtrOrder)}
                        className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold rounded-xl border border-amber-200 transition-colors"
                        title="Mark status as PAYMENT_NOT_RECEIVED so customer can retry payment without cancelling"
                      >
                        Payment Not Received
                      </button>
                      <button
                        onClick={() => setShowRejectInput(true)}
                        className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl border border-rose-200 transition-colors"
                      >
                        Reject & Cancel...
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleMarkPaymentNotReceived(reviewUtrOrder)}
                        className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-colors"
                      >
                        Confirm Payment Not Received
                      </button>
                      <button
                        onClick={() => handleRejectUtr(reviewUtrOrder)}
                        className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-colors"
                      >
                        Confirm Rejection & Cancel
                      </button>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setReviewUtrOrder(null)}
                    className="px-4 py-2 bg-surface border border-border text-xs font-bold text-muted hover:text-primary rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleApproveUtr(reviewUtrOrder)}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Approve Payment & Confirm Order</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* LOGISTICS & COURIER ASSIGNMENT MODAL */}
        {logisticsOrder && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-surface border border-border rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-accent/15 text-accent">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-bold text-primary">
                      Logistics & Shipment Details
                    </h3>
                    <p className="text-xs text-muted">
                      Consignment: <strong>{logisticsOrder.orderNumber}</strong>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setLogisticsOrder(null)}
                  className="p-1 text-muted hover:text-primary rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveLogistics} className="space-y-4 text-xs">
                {/* Courier Selection */}
                <div>
                  <label className="font-semibold text-primary block mb-1.5">
                    Courier Partner
                  </label>
                  <select
                    value={logisticsCourier}
                    onChange={(e) => setLogisticsCourier(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary font-medium focus:outline-none focus:border-accent"
                  >
                    {SUPPORTED_COURIERS.map((c) => (
                      <option key={c.shortCode} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                    <option value="Self-Operated Regional Fleet">Self-Operated Regional Fleet</option>
                  </select>
                </div>

                {/* AWB Tracking Number */}
                <div>
                  <label className="font-semibold text-primary block mb-1.5">
                    Air Waybill (AWB) Tracking Number
                  </label>
                  <input
                    type="text"
                    value={logisticsAwb}
                    onChange={(e) => setLogisticsAwb(e.target.value)}
                    placeholder="e.g. DLV21693550161, 89312019"
                    required
                    className="w-full text-xs px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary font-mono focus:outline-none focus:border-accent"
                  />
                  {logisticsCourier && logisticsAwb && (
                    <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted">
                      <ExternalLink className="w-3 h-3 text-accent" />
                      <span className="truncate">
                        Preview:{' '}
                        <code>{getCourierTrackingUrl(logisticsCourier, logisticsAwb)}</code>
                      </span>
                    </div>
                  )}
                </div>

                {/* Estimated Delivery Date */}
                <div>
                  <label className="font-semibold text-primary block mb-1.5">
                    Estimated Delivery Date (EDD)
                  </label>
                  <input
                    type="date"
                    value={logisticsEdd}
                    onChange={(e) => setLogisticsEdd(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                  />
                </div>

                {/* Dispatch / Checkpoint Notes */}
                <div>
                  <label className="font-semibold text-primary block mb-1.5">
                    Operational Dispatch Notes (Optional)
                  </label>
                  <textarea
                    value={logisticsNotes}
                    onChange={(e) => setLogisticsNotes(e.target.value)}
                    rows={2}
                    placeholder="e.g. Handed over to Patna sorting facility, bag seal #91823"
                    className="w-full text-xs p-3 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
                  <button
                    type="button"
                    onClick={() => setLogisticsOrder(null)}
                    className="px-4 py-2 bg-surface border border-border text-xs font-bold text-muted hover:text-primary rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
                  >
                    Save & Mark In Transit
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ORDER INSPECTOR & TIMELINE DRAWER */}
        {inspectorOrder && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-end">
            <div className="bg-surface border-l border-border w-full max-w-xl h-full p-6 sm:p-8 shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right">
              <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted tracking-wider">
                      Consignment Inspector
                    </span>
                    <h3 className="font-mono text-xl font-bold text-primary">
                      {inspectorOrder.orderNumber}
                    </h3>
                    <p className="text-xs text-muted">
                      Placed: {new Date(inspectorOrder.createdAt).toLocaleString('en-IN')}
                    </p>
                  </div>
                  <button
                    onClick={() => setInspectorOrder(null)}
                    className="p-1 text-muted hover:text-primary rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Status Badges */}
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className={`px-2.5 py-1 rounded-full font-bold border ${ORDER_STATUS_LABELS[inspectorOrder.status]?.badgeClass}`}>
                    Fulfillment: {inspectorOrder.status}
                  </span>
                  <span className={`px-2.5 py-1 rounded-full font-bold ${
                    inspectorOrder.paymentStatus === 'PAID'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    Payment: {inspectorOrder.paymentStatus} ({inspectorOrder.paymentMethod})
                  </span>
                </div>

                {/* Items */}
                <div className="space-y-2 border-b border-border pb-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
                    Order Items ({inspectorOrder.items.length})
                  </h4>
                  <div className="divide-y divide-border/60">
                    {inspectorOrder.items.map((it) => (
                      <div key={it.id} className="py-2 flex justify-between items-center text-xs">
                        <div>
                          <p className="font-medium text-primary">{it.productTitle}</p>
                          <p className="text-[11px] text-muted">{it.variantTitle} × {it.quantity}</p>
                        </div>
                        <span className="font-bold text-primary">{formatPaiseToRupees(it.totalInPaise)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Full Chronological Timeline */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-accent" />
                    <span>Audit & Fulfillment Journey</span>
                  </h4>

                  <div className="relative pl-5 space-y-3.5 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                    {(inspectorOrder.timeline || []).map((ev, i) => (
                      <div key={ev.id || i} className="relative">
                        <div className="absolute -left-5 top-1 w-2.5 h-2.5 rounded-full bg-accent ring-4 ring-canvas" />
                        <div className="bg-surface-dim p-3 rounded-xl border border-border/60 text-xs">
                          <div className="flex justify-between items-center gap-2">
                            <strong className="text-primary">{ev.title}</strong>
                            <span className="text-[10px] font-mono text-muted">
                              {new Date(ev.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-muted mt-1 text-[11px]">{ev.description}</p>
                          <div className="flex items-center justify-between text-[10px] text-muted mt-1.5 border-t border-border/40 pt-1">
                            <span>Actor: {ev.actor || 'System'}</span>
                            {ev.location && <span>{ev.location}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Add Custom Note Form */}
                <form onSubmit={handleAddTimelineNote} className="p-3.5 rounded-xl bg-surface-dim border border-border text-xs space-y-2.5">
                  <span className="font-bold text-primary block">Add Administrative Milestone / Checkpoint</span>
                  <input
                    type="text"
                    value={newTimelineTitle}
                    onChange={(e) => setNewTimelineTitle(e.target.value)}
                    placeholder="Milestone Title (e.g. Quality Inspection Passed)"
                    required
                    className="w-full text-xs px-3 py-2 bg-surface border border-border rounded-lg text-primary focus:outline-none"
                  />
                  <input
                    type="text"
                    value={newTimelineDesc}
                    onChange={(e) => setNewTimelineDesc(e.target.value)}
                    placeholder="Milestone Notes / Details"
                    required
                    className="w-full text-xs px-3 py-2 bg-surface border border-border rounded-lg text-primary focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-primary hover:bg-primary-hover text-white rounded-lg font-bold text-xs"
                  >
                    + Append Checkpoint
                  </button>
                </form>
              </div>

              <div className="pt-6 border-t border-border flex justify-end">
                <button
                  onClick={() => setInspectorOrder(null)}
                  className="px-4 py-2 bg-surface border border-border rounded-xl text-xs font-bold text-primary"
                >
                  Close Inspector
                </button>
              </div>
            </div>
          </div>
        )}

        {/* GST INVOICE MODAL (PRESERVED) */}
        {showInvoiceModal && selectedOrder && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-surface border border-border rounded-2xl max-w-2xl w-full p-6 sm:p-8 shadow-xl space-y-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <h3 className="font-display text-xl font-bold text-primary">
                    Tax Invoice / Consignment Memo
                  </h3>
                  <p className="text-xs text-muted">
                    Invoice No: INV-{selectedOrder.orderNumber}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.print()}
                    className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-bold flex items-center gap-1.5"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Invoice</span>
                  </button>
                  <button
                    onClick={() => setShowInvoiceModal(false)}
                    className="p-1 text-muted hover:text-primary"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Seller and Buyer Information */}
              <div className="grid grid-cols-2 gap-6 text-xs bg-surface-dim p-4 rounded-xl border border-border">
                <div className="space-y-1">
                  <span className="font-bold text-primary block uppercase tracking-wider text-[10px] text-muted">
                    Seller (Supplier)
                  </span>
                  <div className="font-bold text-primary">TechilyFly India (InfiniCharm)</div>
                  <p className="text-muted leading-relaxed text-[11px]">
                    Ward No. 07, Lahsaniya, Khoripakar, Dewapur, Pachpakari, Patahi, Dhaka, Motihari,
                    East Champaran, Bihar - 845427
                  </p>
                  <p className="text-muted text-[11px]">Dispatch Center: East Champaran</p>
                </div>

                <div className="space-y-1">
                  <span className="font-bold text-primary block uppercase tracking-wider text-[10px] text-muted">
                    Billed & Shipped To
                  </span>
                  <div className="font-bold text-primary">
                    {selectedOrder.shippingAddress.fullName}
                  </div>
                  <p className="text-muted leading-relaxed text-[11px]">
                    {selectedOrder.shippingAddress.addressLine1}
                    {selectedOrder.shippingAddress.addressLine2
                      ? `, ${selectedOrder.shippingAddress.addressLine2}`
                      : ''}
                    , {selectedOrder.shippingAddress.city},{' '}
                    {selectedOrder.shippingAddress.state} -{' '}
                    {selectedOrder.shippingAddress.postalCode}
                  </p>
                  <p className="text-muted text-[11px]">
                    Contact: {selectedOrder.customerPhone}
                  </p>
                </div>
              </div>

              {/* Itemized Table */}
              <div className="border border-border rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-surface-dim border-b border-border text-muted uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Item Description</th>
                      <th className="py-2.5 px-3">SKU</th>
                      <th className="py-2.5 px-3">Qty</th>
                      <th className="py-2.5 px-3 text-right">Unit Price</th>
                      <th className="py-2.5 px-3 text-right">Total (INR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {selectedOrder.items.map((it) => (
                      <tr key={it.id}>
                        <td className="py-2.5 px-3 font-medium text-primary">
                          {it.productTitle} — <span className="text-muted">{it.variantTitle}</span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[10px] text-muted">{it.sku}</td>
                        <td className="py-2.5 px-3 font-semibold text-primary">{it.quantity}</td>
                        <td className="py-2.5 px-3 text-right font-medium text-primary">
                          {formatPaiseToRupees(it.priceInPaise)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-primary">
                          {formatPaiseToRupees(it.totalInPaise)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Total Calculation */}
              <div className="flex justify-end text-xs">
                <div className="w-64 space-y-1.5 border-t border-border pt-3">
                  <div className="flex justify-between text-muted">
                    <span>Subtotal:</span>
                    <span>{formatPaiseToRupees(selectedOrder.subtotalInPaise)}</span>
                  </div>
                  {selectedOrder.discountInPaise > 0 && (
                    <div className="flex justify-between text-accent font-semibold">
                      <span>Discount ({selectedOrder.couponCode || 'PROMO'}):</span>
                      <span>-{formatPaiseToRupees(selectedOrder.discountInPaise)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-muted">
                    <span>Shipping:</span>
                    <span>
                      {selectedOrder.shippingInPaise === 0
                        ? 'FREE'
                        : formatPaiseToRupees(selectedOrder.shippingInPaise)}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-primary text-sm pt-2 border-t border-border">
                    <span>Grand Total:</span>
                    <span>{formatPaiseToRupees(selectedOrder.totalInPaise)}</span>
                  </div>
                </div>
              </div>

              {/* Footer Disclosures */}
              <div className="text-[10px] text-muted text-center pt-3 border-t border-border space-y-0.5">
                <p>This is a computer-generated tax invoice and requires no physical signature.</p>
                <p>Customer Support: support@infinicharm.com • East Champaran, Bihar - 845427</p>
              </div>
            </div>
          </div>
        )}

        {/* CREATE MANUAL ORDER MODAL */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-surface border border-border rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 my-8 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <h3 className="font-display text-lg font-bold text-primary flex items-center gap-2">
                    <PlusCircle className="w-5 h-5 text-accent" />
                    <span>Create Manual Order (Admin Hub)</span>
                  </h3>
                  <p className="text-xs text-muted mt-0.5">
                    Generate an official order with integer paise authority, automated taxes, and state tracking.
                  </p>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1.5 text-muted hover:text-primary rounded-lg hover:bg-surface-dim transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateOrderSubmit} className="space-y-4 text-xs">
                {/* Customer Information */}
                <div className="space-y-2">
                  <h4 className="font-bold uppercase tracking-wider text-[11px] text-accent">1. Customer Information</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="font-semibold text-primary block mb-1">Full Name *</label>
                      <input
                        type="text"
                        required
                        value={createForm.customerName}
                        onChange={(e) => setCreateForm({ ...createForm, customerName: e.target.value })}
                        placeholder="e.g. Rahul Sharma"
                        className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-primary block mb-1">Email Address</label>
                      <input
                        type="email"
                        value={createForm.customerEmail}
                        onChange={(e) => setCreateForm({ ...createForm, customerEmail: e.target.value })}
                        placeholder="rahul@example.com"
                        className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-primary block mb-1">Phone Number *</label>
                      <input
                        type="tel"
                        required
                        value={createForm.customerPhone}
                        onChange={(e) => setCreateForm({ ...createForm, customerPhone: e.target.value })}
                        placeholder="9876543210"
                        className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                      />
                    </div>
                  </div>
                </div>

                {/* Delivery Address */}
                <div className="space-y-2 pt-2 border-t border-border/60">
                  <h4 className="font-bold uppercase tracking-wider text-[11px] text-accent">2. Shipping Address</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-primary block mb-1">Address Line 1</label>
                      <input
                        type="text"
                        value={createForm.addressLine1}
                        onChange={(e) => setCreateForm({ ...createForm, addressLine1: e.target.value })}
                        placeholder="Street / Building / Landmark"
                        className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-primary block mb-1">Address Line 2 (Optional)</label>
                      <input
                        type="text"
                        value={createForm.addressLine2}
                        onChange={(e) => setCreateForm({ ...createForm, addressLine2: e.target.value })}
                        placeholder="Apartment / Suite / Area"
                        className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="font-semibold text-primary block mb-1">City</label>
                      <input
                        type="text"
                        value={createForm.city}
                        onChange={(e) => setCreateForm({ ...createForm, city: e.target.value })}
                        className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-primary block mb-1">State</label>
                      <input
                        type="text"
                        value={createForm.state}
                        onChange={(e) => setCreateForm({ ...createForm, state: e.target.value })}
                        className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-primary block mb-1">PIN Code</label>
                      <input
                        type="text"
                        value={createForm.postalCode}
                        onChange={(e) => setCreateForm({ ...createForm, postalCode: e.target.value })}
                        placeholder="845427"
                        className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                      />
                    </div>
                  </div>
                </div>

                {/* Items Selection */}
                <div className="space-y-2 pt-2 border-t border-border/60">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold uppercase tracking-wider text-[11px] text-accent">3. Consignment Items</h4>
                    <button
                      type="button"
                      onClick={() => {
                        setCreateForm({
                          ...createForm,
                          items: [
                            ...createForm.items,
                            {
                              id: `item-${Date.now()}-${Math.floor(Math.random() * 100)}`,
                              productId: 'S-01-P-01',
                              variantId: 'var-S-01-P-01-01',
                              productTitle: '100% Kashmiri Honey – Pure Taste & Natural Sweetness',
                              variantTitle: 'Standard Pack',
                              sku: 'S-01-P-01',
                              priceInPaise: 240000,
                              quantity: 1,
                              totalInPaise: 240000,
                            },
                          ],
                        });
                      }}
                      className="text-xs font-semibold text-accent hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Another Item</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {createForm.items.map((it, idx) => (
                      <div key={it.id || idx} className="p-3 rounded-xl bg-surface-dim border border-border/60 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                        <div className="sm:col-span-5">
                          <label className="text-[10px] text-muted block mb-0.5">Item Description</label>
                          <input
                            type="text"
                            required
                            value={it.productTitle}
                            onChange={(e) => {
                              const updated = [...createForm.items];
                              updated[idx].productTitle = e.target.value;
                              setCreateForm({ ...createForm, items: updated });
                            }}
                            className="w-full px-2.5 py-1.5 bg-surface border border-border rounded-lg text-primary focus:outline-none focus:border-accent"
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <label className="text-[10px] text-muted block mb-0.5">Variant / SKU</label>
                          <input
                            type="text"
                            value={it.variantTitle}
                            onChange={(e) => {
                              const updated = [...createForm.items];
                              updated[idx].variantTitle = e.target.value;
                              setCreateForm({ ...createForm, items: updated });
                            }}
                            className="w-full px-2.5 py-1.5 bg-surface border border-border rounded-lg text-primary focus:outline-none focus:border-accent"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-[10px] text-muted block mb-0.5">Price (₹)</label>
                          <input
                            type="number"
                            min="1"
                            value={it.priceInPaise / 100}
                            onChange={(e) => {
                              const updated = [...createForm.items];
                              const newPrice = Math.max(0, Math.round(Number(e.target.value) * 100));
                              updated[idx].priceInPaise = newPrice;
                              updated[idx].totalInPaise = newPrice * updated[idx].quantity;
                              setCreateForm({ ...createForm, items: updated });
                            }}
                            className="w-full px-2.5 py-1.5 bg-surface border border-border rounded-lg text-primary focus:outline-none focus:border-accent"
                          />
                        </div>
                        <div className="sm:col-span-1">
                          <label className="text-[10px] text-muted block mb-0.5">Qty</label>
                          <input
                            type="number"
                            min="1"
                            value={it.quantity}
                            onChange={(e) => {
                              const updated = [...createForm.items];
                              const q = Math.max(1, parseInt(e.target.value) || 1);
                              updated[idx].quantity = q;
                              updated[idx].totalInPaise = updated[idx].priceInPaise * q;
                              setCreateForm({ ...createForm, items: updated });
                            }}
                            className="w-full px-2.5 py-1.5 bg-surface border border-border rounded-lg text-primary focus:outline-none focus:border-accent"
                          />
                        </div>
                        <div className="sm:col-span-1 text-right">
                          {createForm.items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                setCreateForm({
                                  ...createForm,
                                  items: createForm.items.filter((_, i) => i !== idx),
                                });
                              }}
                              className="p-1.5 text-muted hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                              title="Remove Item"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Financial & Status Options */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border/60">
                  <div>
                    <label className="font-semibold text-primary block mb-1">Payment Method</label>
                    <select
                      value={createForm.paymentMethod}
                      onChange={(e) => setCreateForm({ ...createForm, paymentMethod: e.target.value as any })}
                      className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary font-medium focus:outline-none focus:border-accent"
                    >
                      <option value="CUSTOM_UPI">Custom UPI Direct</option>
                      <option value="COD">Cash on Delivery (COD)</option>
                      <option value="RAZORPAY">Razorpay Gateway</option>
                      <option value="CASH">Offline Cash / Retail</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-semibold text-primary block mb-1">Payment Status</label>
                    <select
                      value={createForm.paymentStatus}
                      onChange={(e) => setCreateForm({ ...createForm, paymentStatus: e.target.value as any })}
                      className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary font-medium focus:outline-none focus:border-accent"
                    >
                      <option value="PAID">PAID / Verified</option>
                      <option value="PENDING">PENDING</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-semibold text-primary block mb-1">Initial Order Status</label>
                    <select
                      value={createForm.status}
                      onChange={(e) => setCreateForm({ ...createForm, status: e.target.value as any })}
                      className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary font-medium focus:outline-none focus:border-accent"
                    >
                      <option value="CONFIRMED">CONFIRMED</option>
                      <option value="PROCESSING">PROCESSING</option>
                      <option value="PENDING">PENDING</option>
                    </select>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="font-semibold text-primary block mb-1">Internal Admin Notes (Optional)</label>
                  <input
                    type="text"
                    value={createForm.adminNotes}
                    onChange={(e) => setCreateForm({ ...createForm, adminNotes: e.target.value })}
                    placeholder="e.g. Concierge phone order verified via banking desk."
                    className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                  />
                </div>

                {/* Live Totals Bar */}
                <div className="p-3 bg-surface-dim rounded-xl border border-border/80 flex items-center justify-between text-xs">
                  <span className="text-muted">Total Payable Amount:</span>
                  <span className="text-base font-bold text-accent">
                    {formatPaiseToRupees(
                      createForm.items.reduce((s, it) => s + it.totalInPaise, 0) +
                        createForm.shippingInPaise -
                        createForm.discountInPaise
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 border border-border rounded-xl text-primary hover:bg-surface-dim font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-5 py-2 bg-accent hover:opacity-95 text-accent-fg font-bold rounded-xl shadow-md transition-opacity"
                  >
                    {isLoading ? 'Creating...' : 'Create Order'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* EDIT ORDER MODAL */}
        {editOrderTarget && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-surface border border-border rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 my-8 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <h3 className="font-display text-lg font-bold text-primary flex items-center gap-2">
                    <Pencil className="w-5 h-5 text-accent" />
                    <span>Edit Order {editOrderTarget.orderNumber}</span>
                  </h3>
                  <p className="text-xs text-muted mt-0.5">
                    Modify shipping address, customer contact, fulfillment status, and notes.
                  </p>
                </div>
                <button
                  onClick={() => setEditOrderTarget(null)}
                  className="p-1.5 text-muted hover:text-primary rounded-lg hover:bg-surface-dim transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleEditOrderSubmit} className="space-y-4 text-xs">
                {/* Customer Details */}
                <div className="space-y-2">
                  <label className="font-semibold text-primary block">Customer Full Name</label>
                  <input
                    type="text"
                    required
                    value={editForm.customerName}
                    onChange={(e) => setEditForm({ ...editForm, customerName: e.target.value })}
                    className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-primary block mb-1">Email Address</label>
                    <input
                      type="email"
                      value={editForm.customerEmail}
                      onChange={(e) => setEditForm({ ...editForm, customerEmail: e.target.value })}
                      className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-primary block mb-1">Phone Number</label>
                    <input
                      type="tel"
                      value={editForm.customerPhone}
                      onChange={(e) => setEditForm({ ...editForm, customerPhone: e.target.value })}
                      className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>

                {/* Delivery Address */}
                <div className="space-y-2">
                  <label className="font-semibold text-primary block">Address Line 1</label>
                  <input
                    type="text"
                    value={editForm.addressLine1}
                    onChange={(e) => setEditForm({ ...editForm, addressLine1: e.target.value })}
                    className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="font-semibold text-primary block mb-1">City</label>
                    <input
                      type="text"
                      value={editForm.city}
                      onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                      className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-primary block mb-1">State</label>
                    <input
                      type="text"
                      value={editForm.state}
                      onChange={(e) => setEditForm({ ...editForm, state: e.target.value })}
                      className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-primary block mb-1">PIN Code</label>
                    <input
                      type="text"
                      value={editForm.postalCode}
                      onChange={(e) => setEditForm({ ...editForm, postalCode: e.target.value })}
                      className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>

                {/* Statuses */}
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/60">
                  <div>
                    <label className="font-semibold text-primary block mb-1">Order Status</label>
                    <select
                      value={editForm.status}
                      onChange={(e) => setEditForm({ ...editForm, status: e.target.value as OrderStatus })}
                      className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary font-semibold uppercase focus:outline-none focus:border-accent"
                    >
                      <option value="PENDING">PENDING</option>
                      <option value="PAYMENT_RECEIVED">PAYMENT_RECEIVED</option>
                      <option value="PAYMENT_NOT_RECEIVED">PAYMENT_NOT_RECEIVED</option>
                      <option value="CONFIRMED">CONFIRMED</option>
                      <option value="PROCESSING">PROCESSING</option>
                      <option value="PACKED">PACKED</option>
                      <option value="READY_FOR_DISPATCH">READY_FOR_DISPATCH</option>
                      <option value="SHIPPED">SHIPPED</option>
                      <option value="OUT_FOR_DELIVERY">OUT_FOR_DELIVERY</option>
                      <option value="DELIVERED">DELIVERED</option>
                      <option value="CANCELLED">CANCELLED</option>
                      <option value="RETURNED">RETURNED</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-semibold text-primary block mb-1">Payment Status</label>
                    <select
                      value={editForm.paymentStatus}
                      onChange={(e) => setEditForm({ ...editForm, paymentStatus: e.target.value as any })}
                      className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary font-semibold uppercase focus:outline-none focus:border-accent"
                    >
                      <option value="PAID">PAID</option>
                      <option value="PENDING">PENDING</option>
                      <option value="FAILED">FAILED</option>
                      <option value="REFUNDED">REFUNDED</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-primary block mb-1">Admin Internal Notes</label>
                  <textarea
                    rows={2}
                    value={editForm.adminNotes}
                    onChange={(e) => setEditForm({ ...editForm, adminNotes: e.target.value })}
                    placeholder="Add operational notes or customer verification history..."
                    className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setEditOrderTarget(null)}
                    className="px-4 py-2 border border-border rounded-xl text-primary hover:bg-surface-dim font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-5 py-2 bg-accent hover:opacity-95 text-accent-fg font-bold rounded-xl shadow-md transition-opacity"
                  >
                    {isLoading ? 'Saving...' : 'Save Order Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* DELETE ORDER CONFIRMATION MODAL */}
        {deleteOrderTarget && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-surface border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex items-center gap-3 text-rose-600">
                <div className="p-2.5 rounded-full bg-rose-500/10">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-display text-base font-bold text-primary">
                    Delete Order {deleteOrderTarget.orderNumber}
                  </h3>
                  <p className="text-xs text-muted">
                    Total: {formatPaiseToRupees(deleteOrderTarget.totalInPaise)} • {deleteOrderTarget.shippingAddress?.fullName}
                  </p>
                </div>
              </div>

              <div className="space-y-3 py-2 border-y border-border/80 text-xs text-muted">
                <label className="flex items-start gap-2.5 cursor-pointer p-2.5 rounded-xl border border-border hover:bg-surface-dim">
                  <input
                    type="radio"
                    name="deleteType"
                    checked={!isPermanentDelete}
                    onChange={() => setIsPermanentDelete(false)}
                    className="mt-0.5 text-accent focus:ring-accent"
                  />
                  <div>
                    <span className="font-bold text-primary block">Cancel Order (Statutory Safeguard)</span>
                    <span className="text-[11px] text-muted block mt-0.5">
                      Recommended. Retains tax and audit history while marking status as CANCELLED and restocking items.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer p-2.5 rounded-xl border border-rose-300 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/20 hover:bg-rose-100/50">
                  <input
                    type="radio"
                    name="deleteType"
                    checked={isPermanentDelete}
                    onChange={() => setIsPermanentDelete(true)}
                    className="mt-0.5 text-rose-600 focus:ring-rose-500"
                  />
                  <div>
                    <span className="font-bold text-rose-700 dark:text-rose-400 block">Permanently Purge Record</span>
                    <span className="text-[11px] text-rose-600/80 dark:text-rose-400/80 block mt-0.5">
                      Completely removes this order record from the production store. Use only for test or erroneous data.
                    </span>
                  </div>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteOrderTarget(null)}
                  className="px-4 py-2 border border-border rounded-xl text-primary hover:bg-surface-dim font-semibold transition-colors text-xs"
                >
                  Keep Order
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleDeleteOrderExecute}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-md transition-colors text-xs"
                >
                  {isDeleting ? 'Deleting...' : isPermanentDelete ? 'Permanently Delete' : 'Cancel Order'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
