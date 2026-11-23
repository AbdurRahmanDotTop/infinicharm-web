'use client';

// ==============================================================================
// InfiniCharm — Admin Product Catalogue & Unified Data Authority
// Single Source of Truth: Server Store (`src/data/products.json`)
// Standards: WooCommerce-Grade Product Management, Integer Paise Authority,
// URL-Based Multi-Media (Zero Server Binaries), Playwright 10 Viewports Tested
// ==============================================================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { CATEGORIES } from '@/lib/constants/categories';
import { formatPaiseToRupees } from '@/lib/utils/currency';
import { logAdminAction } from '@/lib/services/audit';
import {
  Package,
  Plus,
  Search,
  Check,
  AlertTriangle,
  ExternalLink,
  Edit,
  Trash2,
  RefreshCw,
  Eye,
  EyeOff,
  Layers,
  Copy,
  Tag,
  DollarSign,
  UploadCloud,
  Globe,
  Sliders,
  CheckSquare,
  Square,
  ArrowUp,
  ArrowDown,
  X,
  FileCheck,
  Video,
  Music,
  FileText,
  Sparkles,
  ChevronRight,
  Info,
} from 'lucide-react';
import {
  Product,
  ProductVariant,
  ExternalMedia,
  MediaType,
  ProductType,
  TaxStatus,
  StockStatus,
  BackorderPolicy,
} from '@/types';

// Tab keys for the WooCommerce-grade product editor
type EditorTab = 'general' | 'pricing' | 'variations' | 'media' | 'advanced';

interface ProductFormState {
  id?: string;
  title: string;
  slug: string;
  productType: ProductType;
  status: 'PUBLISHED' | 'DRAFT' | 'ARCHIVED';
  isFeatured: boolean;
  isNewArrival: boolean;
  brand: string;
  baseSku: string;
  barcode: string;
  categoryId: string;
  tags: string;
  shortDescription: string;
  fullDescription: string;
  originCountry: string;
  originRegion: string;
  ingredients: string;
  storageInstructions: string;
  fssaiLicenseNumber: string;

  // Pricing & Inventory Authority
  sellingPriceRupees: string;
  mrpPriceRupees: string;
  regularPriceRupees?: string;
  salePriceRupees?: string;
  saleStartDate: string;
  saleEndDate: string;
  costPriceRupees: string;
  taxStatus: TaxStatus;
  taxClass: string;
  manageStock: boolean;
  stockQuantity: string;
  stockStatus: StockStatus;
  lowStockThreshold: string;
  backordersAllowed: BackorderPolicy;
  soldIndividually: boolean;
  weightInGrams: string;
  dimensionsLength: string;
  dimensionsWidth: string;
  dimensionsHeight: string;
  shippingClass: string;

  // Variations & Attributes
  attributes: Array<{ name: string; values: string }>;
  variants: Array<{
    id: string;
    sku: string;
    title: string;
    priceRupees: string;
    comparePriceRupees: string;
    stockQuantity: string;
    stockStatus: 'IN_STOCK' | 'OUT_OF_STOCK';
    weightInGrams: string;
    mediaUrl: string;
    isActive: boolean;
  }>;

  // Media URLs (Zero Server Binaries)
  media: Array<{
    id: string;
    externalUrl: string;
    mediaType: MediaType;
    role: ExternalMedia['role'];
    altText: string;
    caption: string;
  }>;

  // Advanced & External / SEO / PDP Controls
  seoTitle: string;
  seoDescription: string;
  purchaseNote: string;
  externalProductUrl: string;
  buttonText: string;
  tagline: string;
  customBadge: string;
  customShippingText: string;
  customGuaranteeText: string;
  returnPolicyText: string;
  highlights: string;
  specifications: Array<{ label: string; value: string }>;
  relatedProductIds: string[];
}

const DEFAULT_FORM_STATE: ProductFormState = {
  title: '',
  slug: '',
  productType: 'simple',
  status: 'PUBLISHED',
  isFeatured: false,
  isNewArrival: false,
  brand: 'InfiniCharm',
  tagline: '',
  customBadge: '',
  customShippingText: '',
  customGuaranteeText: '',
  returnPolicyText: 'Transit damage covered with instant free replacement. 7-day hassle-free return for sealed products.',
  highlights: 'Origin: East Champaran, Bihar - 845427\n100% Authentic • Pure & Natural Quality\nBatch Quality Tested & Verified',
  specifications: [],
  relatedProductIds: [],
  baseSku: '',
  barcode: '',
  categoryId: CATEGORIES[0]?.id || 'cat-honey',
  tags: 'natural, pure, kashmiri-honey',
  shortDescription: '',
  fullDescription: '',
  originCountry: 'India',
  originRegion: 'East Champaran, Bihar - 845427',
  ingredients: '100% Pure & Authentic Single-Origin Sourced',
  storageInstructions: 'Store in a cool, dry place away from direct sunlight.',
  fssaiLicenseNumber: 'FSSAI Lic. No. 10423000001234',

  sellingPriceRupees: '299',
  mrpPriceRupees: '',
  regularPriceRupees: '299',
  salePriceRupees: '',
  saleStartDate: '',
  saleEndDate: '',
  costPriceRupees: '180',
  taxStatus: 'TAXABLE',
  taxClass: 'GST 5%',
  manageStock: true,
  stockQuantity: '50',
  stockStatus: 'IN_STOCK',
  lowStockThreshold: '10',
  backordersAllowed: 'NO',
  soldIndividually: false,
  weightInGrams: '500',
  dimensionsLength: '10',
  dimensionsWidth: '10',
  dimensionsHeight: '15',
  shippingClass: 'Standard Express',

  attributes: [{ name: 'Packaging Size', values: '250g, 500g, 1kg' }],
  variants: [],
  media: [
    {
      id: 'med-initial-1',
      externalUrl: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=800&q=80',
      mediaType: 'IMAGE',
      role: 'PRIMARY',
      altText: 'Primary product showcase thumbnail',
      caption: 'Direct from regional processing hub',
    },
  ],

  seoTitle: '',
  seoDescription: '',
  purchaseNote: 'Thank you for supporting pure single-origin Indian agriculture & craft.',
  externalProductUrl: '',
  buttonText: 'Buy Now',
};

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PUBLISHED' | 'DRAFT' | 'ARCHIVED' | 'LOW_STOCK'>('ALL');

  // Multi-Row Selection & Bulk Operations
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<'NONE' | 'PUBLISH' | 'DRAFT' | 'DELETE'>('NONE');

  // Unified Product Editor Modal State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<EditorTab>('general');
  const [formState, setFormState] = useState<ProductFormState>(DEFAULT_FORM_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Media Adder State inside Media Tab
  const [newMediaUrl, setNewMediaUrl] = useState('');
  const [newMediaType, setNewMediaType] = useState<'IMAGE' | 'VIDEO' | 'AUDIO' | 'PDF'>('IMAGE');
  const [newMediaRole, setNewMediaRole] = useState<ExternalMedia['role']>('GALLERY');
  const [newMediaAlt, setNewMediaAlt] = useState('');

  // Delete Confirmation Modal
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [isSyncingCsv, setIsSyncingCsv] = useState(false);

  const notify = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  // Synchronize products directly from CSV directory All_Docs/Products/
  const handleSyncFromCsv = async () => {
    setIsSyncingCsv(true);
    try {
      const res = await fetch('/api/admin/products/sync-csv', {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        notify(`Synchronized ${data.count} product(s) directly from CSV files in All_Docs/Products/`);
        await fetchProducts();
        broadcastProductUpdate();
      } else {
        alert(data.error || 'Failed to sync CSV products');
      }
    } catch (err: any) {
      console.error('Error syncing CSV products:', err);
      alert('Failed to connect to CSV sync endpoint.');
    } finally {
      setIsSyncingCsv(false);
    }
  };

  // Synchronize products from server store
  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/products?admin=true');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.products)) {
        setProducts(data.products);
      } else {
        throw new Error(data.error || 'Invalid API payload');
      }
    } catch (err: any) {
      console.error('Failed to sync products from server:', err);
      setErrorMsg('Failed to sync catalogue from server. Retrying...');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Dispatch sync event across tabs & windows
  const broadcastProductUpdate = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('infinicharm_products_updated'));
      try {
        localStorage.setItem('infinicharm_products_updated', Date.now().toString());
      } catch {
        // ignore
      }
    }
  };

  // Filtered Products Calculation
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCategory = categoryFilter === 'ALL' || p.categoryId === categoryFilter;
      const primaryVar = p.variants[0];
      const isLowStock = primaryVar && primaryVar.stockQuantity <= (primaryVar.lowStockThreshold || 10);

      let matchesStatus = true;
      if (statusFilter === 'LOW_STOCK') {
        matchesStatus = Boolean(isLowStock);
      } else if (statusFilter !== 'ALL') {
        matchesStatus = p.status === statusFilter;
      }

      const cleanQ = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !cleanQ ||
        p.title.toLowerCase().includes(cleanQ) ||
        p.brand.toLowerCase().includes(cleanQ) ||
        (p.originRegion && p.originRegion.toLowerCase().includes(cleanQ)) ||
        p.variants.some((v) => v.sku.toLowerCase().includes(cleanQ));

      return matchesCategory && matchesStatus && matchesSearch;
    });
  }, [products, categoryFilter, statusFilter, searchQuery]);

  // Handle Multi-row Checkbox Selection
  const handleToggleSelectProduct = (id: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const isAllSelected =
    filteredProducts.length > 0 &&
    filteredProducts.every((p) => selectedProductIds.has(p.id));

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedProductIds(new Set());
    } else {
      setSelectedProductIds(new Set(filteredProducts.map((p) => p.id)));
    }
  };

  // Execute Bulk Action
  const handleApplyBulkAction = async () => {
    if (bulkAction === 'NONE' || selectedProductIds.size === 0) return;

    const count = selectedProductIds.size;
    const actionLabel =
      bulkAction === 'PUBLISH'
        ? 'publish'
        : bulkAction === 'DRAFT'
        ? 'set to draft'
        : 'permanently delete';

    if (!confirm(`Are you sure you want to ${actionLabel} ${count} selected product(s)?`)) {
      return;
    }

    try {
      const res = await fetch('/api/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'BULK_ACTION',
          bulkAction,
          ids: Array.from(selectedProductIds),
        }),
      });

      if (!res.ok) throw new Error('Bulk action failed');
      const data = await res.json();

      if (data.success) {
        logAdminAction('BULK_PRODUCT_ACTION', 'products', 'multiple', {
          action: bulkAction,
          count: data.count,
        });
        notify(`Successfully executed bulk ${bulkAction} on ${data.count} product(s).`);
        setSelectedProductIds(new Set());
        setBulkAction('NONE');
        fetchProducts();
        broadcastProductUpdate();
      }
    } catch (err) {
      console.error('Error applying bulk action:', err);
      alert('Failed to execute bulk action.');
    }
  };

  // Duplicate Product Action
  const handleDuplicateProduct = async (product: Product) => {
    try {
      const res = await fetch(`/api/products/${encodeURIComponent(product.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'DUPLICATE' }),
      });

      if (!res.ok) throw new Error('Duplicate failed');
      const data = await res.json();

      if (data.success && data.product) {
        setProducts((prev) => [data.product, ...prev]);
        logAdminAction('DUPLICATE_PRODUCT', 'products', product.id, {
          newProductId: data.product.id,
          title: data.product.title,
        });
        notify(`Duplicated "${product.title}" into draft copy.`);
        broadcastProductUpdate();
      }
    } catch (err) {
      console.error('Failed to duplicate product:', err);
      alert('Failed to duplicate product. Please try again.');
    }
  };

  // Toggle Publish / Draft status directly from table badge
  const handleToggleStatus = async (product: Product) => {
    const nextStatus = product.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, status: nextStatus } : p))
    );

    try {
      const res = await fetch(`/api/products/${encodeURIComponent(product.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'TOGGLE_STATUS' }),
      });

      if (!res.ok) throw new Error('Status toggle failed');
      const data = await res.json();
      if (data.success && data.product) {
        setProducts((prev) =>
          prev.map((p) => (p.id === product.id ? data.product : p))
        );
        logAdminAction('TOGGLE_PRODUCT_STATUS', 'products', product.id, {
          newStatus: data.product.status,
        });
        broadcastProductUpdate();
      }
    } catch (err) {
      console.error('Failed to toggle status:', err);
      fetchProducts();
    }
  };

  // Quick Stock Increment / Decrement (+5 / -5)
  const handleUpdateStock = async (productId: string, variantId: string, delta: number) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id !== productId) return p;
        return {
          ...p,
          variants: p.variants.map((v) => {
            if (v.id !== variantId) return v;
            return { ...v, stockQuantity: Math.max(0, (v.stockQuantity || 0) + delta) };
          }),
        };
      })
    );

    try {
      const res = await fetch(`/api/products/${encodeURIComponent(productId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'UPDATE_STOCK', variantId, delta }),
      });

      if (!res.ok) throw new Error('Stock update failed');
      const data = await res.json();
      if (data.success && data.product) {
        setProducts((prev) =>
          prev.map((p) => (p.id === productId ? data.product : p))
        );
        broadcastProductUpdate();
      }
    } catch (err) {
      console.error('Failed to update stock:', err);
      fetchProducts();
    }
  };

  // Open Editor for Creating New Product
  const handleOpenCreateModal = () => {
    setFormState({
      ...DEFAULT_FORM_STATE,
      slug: `product-${Date.now().toString().slice(-6)}`,
      baseSku: `INF-PRD-${Math.floor(1000 + Math.random() * 9000)}`,
    });
    setActiveTab('general');
    setIsEditorOpen(true);
  };

  // Open Editor for Editing Existing Product
  const handleOpenEditModal = (p: Product) => {
    const defaultVar = p.variants[0];
    setFormState({
      id: p.id,
      title: p.title,
      slug: p.slug,
      productType: p.productType || 'simple',
      status: p.status,
      isFeatured: p.isFeatured || false,
      isNewArrival: p.isNewArrival || false,
      brand: p.brand || 'InfiniCharm',
      baseSku: p.baseSku || defaultVar?.sku || '',
      barcode: p.barcode || defaultVar?.barcode || '',
      categoryId: p.categoryId,
      tags: p.tags ? p.tags.join(', ') : 'organic, artisanal',
      shortDescription: p.shortDescription || '',
      fullDescription: p.fullDescription || '',
      originCountry: p.originCountry || 'India',
      originRegion: p.originRegion || 'East Champaran, Bihar',
      ingredients: p.ingredients || '100% Pure & Authentic Single-Origin Sourced',
      storageInstructions: p.storageInstructions || 'Store in a cool dry place.',
      fssaiLicenseNumber: p.fssaiLicenseNumber || 'FSSAI Lic. No. 10423000001234',

      sellingPriceRupees: defaultVar ? (defaultVar.priceInPaise / 100).toString() : '299',
      mrpPriceRupees: defaultVar?.compareAtPriceInPaise
        ? (defaultVar.compareAtPriceInPaise / 100).toString()
        : '',
      regularPriceRupees: defaultVar ? (defaultVar.priceInPaise / 100).toString() : '299',
      salePriceRupees: defaultVar?.compareAtPriceInPaise
        ? (defaultVar.compareAtPriceInPaise / 100).toString()
        : '',
      saleStartDate: p.saleStartDate || '',
      saleEndDate: p.saleEndDate || '',
      costPriceRupees: defaultVar?.costPriceInPaise
        ? (defaultVar.costPriceInPaise / 100).toString()
        : '',
      taxStatus: p.taxStatus || 'TAXABLE',
      taxClass: p.taxClass || 'GST 5%',
      manageStock: p.manageStock !== false,
      stockQuantity: defaultVar ? defaultVar.stockQuantity.toString() : '50',
      stockStatus: p.stockStatus || 'IN_STOCK',
      lowStockThreshold: defaultVar ? defaultVar.lowStockThreshold.toString() : '10',
      backordersAllowed: p.backordersAllowed || 'NO',
      soldIndividually: p.soldIndividually || false,
      weightInGrams: defaultVar?.weightInGrams?.toString() || '500',
      dimensionsLength: p.dimensions?.length?.toString() || '10',
      dimensionsWidth: p.dimensions?.width?.toString() || '10',
      dimensionsHeight: p.dimensions?.height?.toString() || '15',
      shippingClass: p.shippingClass || 'Standard Express',

      attributes: p.attributesConfig
        ? p.attributesConfig.map((a) => ({ name: a.name, values: a.values.join(', ') }))
        : [{ name: 'Packaging Size', values: '250g, 500g, 1kg' }],

      variants: p.variants.map((v) => ({
        id: v.id,
        sku: v.sku,
        title: v.title,
        priceRupees: (v.priceInPaise / 100).toString(),
        comparePriceRupees: v.compareAtPriceInPaise
          ? (v.compareAtPriceInPaise / 100).toString()
          : '',
        stockQuantity: v.stockQuantity.toString(),
        stockStatus: v.stockQuantity > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK',
        weightInGrams: (v.weightInGrams || 500).toString(),
        mediaUrl: v.mediaUrl || v.media?.[0]?.externalUrl || '',
        isActive: v.isActive !== false,
      })),

      media: p.media.map((m) => ({
        id: m.id,
        externalUrl: m.externalUrl,
        mediaType: m.mediaType || 'IMAGE',
        role: m.role || 'GALLERY',
        altText: m.altText || p.title,
        caption: m.caption || '',
      })),

      seoTitle: p.seoTitle || '',
      seoDescription: p.seoDescription || '',
      purchaseNote: p.purchaseNote || 'Thank you for your purchase.',
      externalProductUrl: p.externalProductUrl || '',
      buttonText: p.buttonText || 'Buy Now',
      tagline: p.tagline || '',
      customBadge: p.customBadge || '',
      customShippingText: p.customShippingText || '',
      customGuaranteeText: p.customGuaranteeText || '',
      returnPolicyText: p.returnPolicyText || '',
      highlights: p.highlights ? p.highlights.join('\n') : '',
      specifications: p.specifications ? p.specifications.map((s) => ({ ...s })) : [],
      relatedProductIds: p.relatedProductIds ? [...p.relatedProductIds] : [],
    });
    setActiveTab('general');
    setIsEditorOpen(true);
  };

  // Generate Slug from Title
  const handleGenerateSlug = () => {
    if (!formState.title.trim()) return;
    const clean = formState.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
    setFormState((prev) => ({ ...prev, slug: clean }));
  };

  // Add Variation Row inside Variations Tab
  const handleAddVariationRow = () => {
    const count = formState.variants.length + 1;
    const newVariant = {
      id: `var-new-${Date.now()}-${count}`,
      sku: `${formState.baseSku || 'INF-PRD'}-VAR${count}`,
      title: `Option ${count}`,
      priceRupees: formState.sellingPriceRupees || formState.regularPriceRupees || '299',
      comparePriceRupees: formState.mrpPriceRupees || formState.salePriceRupees || '',
      stockQuantity: '25',
      stockStatus: 'IN_STOCK' as const,
      weightInGrams: '500',
      mediaUrl: formState.media[0]?.externalUrl || '',
      isActive: true,
    };
    setFormState((prev) => ({ ...prev, variants: [...prev.variants, newVariant] }));
  };

  // Add External Media Item inside Media Tab
  const handleAddMediaItem = () => {
    if (!newMediaUrl.trim()) return;
    const newMedia = {
      id: `med-${Date.now()}`,
      externalUrl: newMediaUrl.trim(),
      mediaType: newMediaType,
      role: newMediaRole,
      altText: newMediaAlt.trim() || formState.title || 'Product media',
      caption: '',
    };
    setFormState((prev) => ({ ...prev, media: [...prev.media, newMedia] }));
    setNewMediaUrl('');
    setNewMediaAlt('');
    notify('External media reference added.');
  };

  // Set Media Item as Primary
  const handleSetPrimaryMedia = (idx: number) => {
    setFormState((prev) => {
      const copy = [...prev.media];
      const target = copy.splice(idx, 1)[0];
      target.role = 'PRIMARY';
      copy.forEach((m) => {
        if (m.role === 'PRIMARY') m.role = 'GALLERY';
      });
      return { ...prev, media: [target, ...copy] };
    });
  };

  // Save Product (Both Create and Edit)
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.title.trim()) {
      alert('Product title is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const priceInPaise = Math.round(
        parseFloat(formState.sellingPriceRupees || formState.regularPriceRupees || '0') * 100
      );
      const rawMrp = formState.mrpPriceRupees || formState.salePriceRupees;
      const compareAtPriceInPaise = rawMrp
        ? Math.round(parseFloat(rawMrp) * 100)
        : undefined;
      const costPriceInPaise = formState.costPriceRupees
        ? Math.round(parseFloat(formState.costPriceRupees) * 100)
        : undefined;
      const stockQuantity = Math.max(0, parseInt(formState.stockQuantity || '0', 10));

      const tagsArray = formState.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const productId = formState.id || `prod-custom-${Date.now()}`;

      // Assemble variants
      let assembledVariants: ProductVariant[] = [];
      if (formState.productType === 'variable' && formState.variants.length > 0) {
        assembledVariants = formState.variants.map((v, idx) => ({
          id: v.id || `var-${productId}-${idx + 1}`,
          productId,
          sku: v.sku.trim() || `INF-${productId.slice(-6).toUpperCase()}-${idx + 1}`,
          title: v.title.trim() || `Option ${idx + 1}`,
          priceInPaise: Math.round(parseFloat(v.priceRupees || '0') * 100),
          compareAtPriceInPaise: v.comparePriceRupees
            ? Math.round(parseFloat(v.comparePriceRupees) * 100)
            : undefined,
          stockQuantity: Math.max(0, parseInt(v.stockQuantity || '0', 10)),
          lowStockThreshold: 10,
          weightInGrams: parseInt(v.weightInGrams || '500', 10),
          attributes: { Option: v.title },
          isActive: v.isActive,
          mediaUrl: v.mediaUrl,
        }));
      } else {
        assembledVariants = [
          {
            id: formState.id ? `var-${productId}-primary` : `var-${Date.now()}-primary`,
            productId,
            sku: formState.baseSku.trim() || `INF-${productId.slice(-8).toUpperCase()}`,
            barcode: formState.barcode.trim() || undefined,
            title: 'Standard Pack',
            priceInPaise,
            compareAtPriceInPaise,
            costPriceInPaise,
            stockQuantity,
            lowStockThreshold: parseInt(formState.lowStockThreshold || '10', 10),
            weightInGrams: parseInt(formState.weightInGrams || '500', 10),
            attributes: { Packaging: 'Food Grade Glass Jar / Container' },
            isActive: true,
          },
        ];
      }

      // Assemble external media items
      const assembledMedia: ExternalMedia[] =
        formState.media.length > 0
          ? formState.media.map((m, idx) => ({
              id: m.id || `med-${Date.now()}-${idx + 1}`,
              provider: 'EXTERNAL_HTTPS',
              externalUrl: m.externalUrl.trim(),
              mimeType:
                m.mediaType === 'VIDEO'
                  ? 'video/mp4'
                  : m.mediaType === 'PDF'
                  ? 'application/pdf'
                  : 'image/jpeg',
              altText: m.altText || formState.title,
              caption: m.caption || undefined,
              mediaType: m.mediaType,
              role: m.role,
              displayOrder: idx + 1,
              productId,
              isActive: true,
            }))
          : [
              {
                id: `med-${Date.now()}-1`,
                provider: 'EXTERNAL_HTTPS',
                externalUrl:
                  'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=800&q=80',
                mimeType: 'image/jpeg',
                altText: formState.title,
                role: 'PRIMARY',
                displayOrder: 1,
                productId,
                isActive: true,
              },
            ];

      const productPayload: Product = {
        id: productId,
        title: formState.title.trim(),
        slug: formState.slug.trim() || `product-${Date.now().toString().slice(-6)}`,
        productType: formState.productType,
        status: formState.status,
        isFeatured: formState.isFeatured,
        isNewArrival: formState.isNewArrival,
        brand: formState.brand.trim() || 'InfiniCharm',
        baseSku: formState.baseSku.trim(),
        barcode: formState.barcode.trim() || undefined,
        categoryId: formState.categoryId,
        tags: tagsArray,
        shortDescription: formState.shortDescription.trim() || formState.title.trim(),
        fullDescription: formState.fullDescription.trim() || formState.shortDescription.trim(),
        originCountry: formState.originCountry.trim() || 'India',
        originRegion: formState.originRegion.trim() || 'East Champaran, Bihar',
        ingredients: formState.ingredients.trim(),
        storageInstructions: formState.storageInstructions.trim(),
        fssaiLicenseNumber: formState.fssaiLicenseNumber.trim(),

        costPriceInPaise,
        taxStatus: formState.taxStatus,
        taxClass: formState.taxClass,
        saleStartDate: formState.saleStartDate || undefined,
        saleEndDate: formState.saleEndDate || undefined,
        manageStock: formState.manageStock,
        stockStatus: formState.stockStatus,
        backordersAllowed: formState.backordersAllowed,
        soldIndividually: formState.soldIndividually,
        weightInGrams: parseInt(formState.weightInGrams || '500', 10),
        dimensions: {
          length: parseFloat(formState.dimensionsLength || '10'),
          width: parseFloat(formState.dimensionsWidth || '10'),
          height: parseFloat(formState.dimensionsHeight || '15'),
          unit: 'cm',
        },
        shippingClass: formState.shippingClass,
        purchaseNote: formState.purchaseNote.trim() || undefined,
        externalProductUrl: formState.externalProductUrl.trim() || undefined,
        buttonText: formState.buttonText.trim() || undefined,
        tagline: formState.tagline.trim() || undefined,
        customBadge: formState.customBadge.trim() || undefined,
        customShippingText: formState.customShippingText.trim() || undefined,
        customGuaranteeText: formState.customGuaranteeText.trim() || undefined,
        returnPolicyText: formState.returnPolicyText.trim() || undefined,
        highlights: formState.highlights
          ? formState.highlights
              .split('\n')
              .map((h) => h.trim())
              .filter(Boolean)
          : undefined,
        specifications: formState.specifications
          .filter((s) => s.label.trim() && s.value.trim())
          .map((s) => ({ label: s.label.trim(), value: s.value.trim() })),
        relatedProductIds:
          formState.relatedProductIds.length > 0 ? formState.relatedProductIds : undefined,
        seoTitle: formState.seoTitle.trim() || undefined,
        seoDescription: formState.seoDescription.trim() || undefined,

        variants: assembledVariants,
        media: assembledMedia,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const isEdit = Boolean(formState.id);
      const url = isEdit
        ? `/api/products/${encodeURIComponent(formState.id!)}`
        : '/api/products';
      const method = isEdit ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productPayload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed with status ${res.status}`);
      }

      const data = await res.json();
      if (data.success && data.product) {
        if (isEdit) {
          setProducts((prev) =>
            prev.map((p) => (p.id === formState.id ? data.product : p))
          );
          logAdminAction('UPDATE_PRODUCT', 'products', formState.id!, {
            title: productPayload.title,
            status: productPayload.status,
          });
          notify(`Updated product "${productPayload.title}".`);
        } else {
          setProducts((prev) => [data.product, ...prev]);
          logAdminAction('CREATE_PRODUCT', 'products', data.product.id, {
            title: productPayload.title,
            status: productPayload.status,
          });
          notify(`Successfully created and published "${productPayload.title}".`);
        }

        setIsEditorOpen(false);
        broadcastProductUpdate();
      }
    } catch (err: any) {
      console.error('Error saving product:', err);
      alert(err.message || 'Failed to save product. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Product
  const handleDeleteProduct = async (productId: string) => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/products/${encodeURIComponent(productId)}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Delete failed');
      setProducts((prev) => prev.filter((p) => p.id !== productId));
      logAdminAction('DELETE_PRODUCT', 'products', productId, {
        deletedAt: new Date().toISOString(),
      });
      notify('Product deleted permanently from server store.');
      setDeletingProductId(null);
      broadcastProductUpdate();
    } catch (err) {
      console.error('Failed to delete product:', err);
      alert('Failed to delete product. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex flex-col font-sans">
      <AdminHeader />

      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Header & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl font-bold text-primary tracking-tight">
                Product Catalogue &amp; Inventory Hub
              </h1>
              <span className="text-xs font-bold bg-accent/10 text-accent border border-accent/20 px-2.5 py-0.5 rounded-full">
                WooCommerce Grade
              </span>
            </div>
            <p className="text-xs text-muted mt-1">
              Synchronized real catalogue with integer paise pricing and verified external media. Showing{' '}
              {filteredProducts.length} of {products.length} products.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => fetchProducts()}
              disabled={isLoading}
              className="p-2.5 text-muted hover:text-primary rounded-xl hover:bg-surface border border-border transition-colors"
              title="Refresh Catalogue"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              onClick={handleSyncFromCsv}
              disabled={isSyncingCsv}
              className="px-4 py-2.5 bg-surface hover:bg-surface-dim text-primary border border-border hover:border-accent text-xs font-bold rounded-xl flex items-center gap-2 transition-colors shadow-xs"
              title="Synchronize products directly from CSV files in All_Docs/Products/"
            >
              <UploadCloud className={`w-4 h-4 text-accent ${isSyncingCsv ? 'animate-bounce' : ''}`} />
              <span>{isSyncingCsv ? 'Syncing CSV...' : 'Sync from CSV'}</span>
            </button>

            <button
              onClick={handleOpenCreateModal}
              className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-colors uppercase tracking-wider shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Product</span>
            </button>
          </div>
        </div>

        {/* Global Toast Notification */}
        {notification && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{notification}</span>
          </div>
        )}

        {/* 4 Catalogue KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 bg-surface rounded-2xl border border-border shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted">Total Catalogue</span>
              <Package className="w-4 h-4 text-accent" />
            </div>
            <div className="text-2xl font-extrabold text-primary mt-1">{products.length}</div>
            <span className="text-[10px] text-muted">Master SKU listings</span>
          </div>
          <div className="p-4 bg-surface rounded-2xl border border-border shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted">Published Live</span>
              <Eye className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-extrabold text-emerald-600 mt-1">
              {products.filter((p) => p.status === 'PUBLISHED').length}
            </div>
            <span className="text-[10px] text-muted">Visible on storefront</span>
          </div>
          <div className="p-4 bg-surface rounded-2xl border border-border shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted">Draft / Staging</span>
              <EyeOff className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-extrabold text-amber-600 mt-1">
              {products.filter((p) => p.status === 'DRAFT').length}
            </div>
            <span className="text-[10px] text-muted">Hidden from public</span>
          </div>
          <div className="p-4 bg-surface rounded-2xl border border-border shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted">Low Stock Alert</span>
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            </div>
            <div className="text-2xl font-extrabold text-rose-600 mt-1">
              {products.filter((p) => (p.variants || []).some((v) => v.stockQuantity <= (v.lowStockThreshold || 10))).length}
            </div>
            <span className="text-[10px] text-muted">Units at or below threshold</span>
          </div>
        </div>

        {/* Filter Controls & Search */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products by title, brand, origin, or SKU..."
              className="w-full text-xs pl-10 pr-4 py-2.5 bg-surface border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
            />
          </div>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-xs px-3.5 py-2.5 bg-surface border border-border rounded-xl text-primary focus:outline-none focus:border-accent font-medium"
          >
            <option value="ALL">All Categories ({CATEGORIES.length})</option>
            {CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="text-xs px-3.5 py-2.5 bg-surface border border-border rounded-xl text-primary focus:outline-none focus:border-accent font-medium"
          >
            <option value="ALL">All Statuses</option>
            <option value="PUBLISHED">PUBLISHED (Live)</option>
            <option value="DRAFT">DRAFT (Hidden)</option>
            <option value="LOW_STOCK">⚠️ Low Stock Alert</option>
            <option value="ARCHIVED">ARCHIVED</option>
          </select>
        </div>

        {/* Bulk Actions Floating Bar */}
        {selectedProductIds.size > 0 && (
          <div className="p-3 bg-primary text-white rounded-2xl flex items-center justify-between gap-4 shadow-lg animate-in fade-in">
            <div className="flex items-center gap-2 text-xs font-bold">
              <span className="w-6 h-6 rounded-full bg-accent flex items-center justify-center text-white text-[11px]">
                {selectedProductIds.size}
              </span>
              <span>Product(s) Selected</span>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <select
                value={bulkAction}
                onChange={(e) => setBulkAction(e.target.value as any)}
                className="bg-surface text-primary px-3 py-1.5 rounded-lg border border-border font-medium text-xs focus:outline-none"
              >
                <option value="NONE">Select Bulk Action...</option>
                <option value="PUBLISH">Publish Selected (Make Live)</option>
                <option value="DRAFT">Set to Draft (Hide from Store)</option>
                <option value="DELETE">Delete Selected Permanently</option>
              </select>

              <button
                type="button"
                onClick={handleApplyBulkAction}
                disabled={bulkAction === 'NONE'}
                className="px-4 py-1.5 bg-accent hover:bg-accent-hover text-white font-bold rounded-lg disabled:opacity-40 transition-colors"
              >
                Apply
              </button>

              <button
                type="button"
                onClick={() => setSelectedProductIds(new Set())}
                className="px-3 py-1.5 text-white/70 hover:text-white text-xs underline"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Error notice */}
        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-700 text-xs flex items-center justify-between">
            <span>{errorMsg}</span>
            <button onClick={() => fetchProducts()} className="font-bold underline">
              Retry
            </button>
          </div>
        )}

        {/* Mobile & Tablet Product Cards (< lg) */}
        <div className="lg:hidden space-y-3">
          {isLoading && products.length === 0 ? (
            <div className="bg-surface rounded-2xl border border-border p-10 text-center text-xs text-muted">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-accent" />
              Loading authoritative products catalogue...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="bg-surface rounded-2xl border border-border p-10 text-center text-xs text-muted">
              <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
              No products match your search or filter criteria.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredProducts.map((p) => {
                const defaultVar = p.variants[0];
                const category = CATEGORIES.find((c) => c.id === p.categoryId);
                const isPublished = p.status === 'PUBLISHED';
                const isSelected = selectedProductIds.has(p.id);

                return (
                  <div
                    key={p.id}
                    className={`bg-surface rounded-2xl border p-4 shadow-sm space-y-3 text-xs ${
                      isSelected ? 'border-accent ring-1 ring-accent/30 bg-accent/5' : 'border-border'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => handleToggleSelectProduct(p.id)}
                        className="p-1 text-muted hover:text-primary shrink-0"
                        aria-label={`Select ${p.title}`}
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-accent" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>

                      <div className="w-12 h-12 rounded-xl bg-surface-dim border border-border overflow-hidden shrink-0">
                        {p.media?.[0]?.externalUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={p.media[0].externalUrl} alt={p.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted">
                            <Package className="w-4 h-4" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-bold text-primary text-sm leading-snug line-clamp-2">{p.title}</h3>
                          <button
                            onClick={() => handleToggleStatus(p)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase shrink-0 ${
                              isPublished
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {isPublished ? 'PUBLISHED' : 'DRAFT'}
                          </button>
                        </div>
                        <p className="text-[11px] text-muted truncate mt-0.5">
                          {category?.name || 'General'} • {p.baseSku || defaultVar?.sku || '—'}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/60">
                      <div>
                        <div className="flex items-baseline gap-1.5 flex-wrap">
                          <span className="font-bold text-primary text-sm">
                            {defaultVar ? formatPaiseToRupees(defaultVar.priceInPaise) : '—'}
                          </span>
                          {defaultVar?.compareAtPriceInPaise && defaultVar.compareAtPriceInPaise > defaultVar.priceInPaise && (
                            <span className="text-[10px] text-muted line-through font-mono">
                              {formatPaiseToRupees(defaultVar.compareAtPriceInPaise)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-muted font-mono">
                            {defaultVar?.priceInPaise} paise
                          </span>
                          {defaultVar?.compareAtPriceInPaise && defaultVar.compareAtPriceInPaise > defaultVar.priceInPaise && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                              {Math.round(((defaultVar.compareAtPriceInPaise - defaultVar.priceInPaise) / defaultVar.compareAtPriceInPaise) * 100)}% OFF
                            </span>
                          )}
                        </div>
                      </div>

                      {defaultVar && (
                        <div className="inline-flex items-center border border-border rounded-lg bg-surface-dim">
                          <button
                            onClick={() => handleUpdateStock(p.id, defaultVar.id, -5)}
                            className="px-2 py-1 text-muted hover:text-primary font-bold"
                          >
                            -5
                          </button>
                          <span
                            className={`px-2 py-1 font-bold text-center min-w-[2.25rem] ${
                              defaultVar.stockQuantity <= (defaultVar.lowStockThreshold || 10)
                                ? 'text-rose-600 bg-rose-50'
                                : 'text-primary'
                            }`}
                          >
                            {defaultVar.stockQuantity}
                          </span>
                          <button
                            onClick={() => handleUpdateStock(p.id, defaultVar.id, 5)}
                            className="px-2 py-1 text-muted hover:text-primary font-bold"
                          >
                            +5
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-border/60 flex flex-wrap items-center justify-end gap-1.5">
                      <Link
                        href={`/product/${p.slug}`}
                        target="_blank"
                        className="p-1.5 rounded-lg bg-surface-dim hover:bg-border text-neutral-600 hover:text-primary"
                        title="View on storefront"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                      <button
                        onClick={() => handleDuplicateProduct(p)}
                        className="p-1.5 rounded-lg bg-surface-dim hover:bg-border text-neutral-600 hover:text-accent"
                        title="Duplicate as draft"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleOpenEditModal(p)}
                        className="px-2.5 py-1.5 rounded-lg bg-surface-dim hover:bg-border text-primary font-semibold text-[11px] flex items-center gap-1 border border-border"
                      >
                        <Edit className="w-3.5 h-3.5 text-accent" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => setDeletingProductId(p.id)}
                        className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600"
                        title="Delete product"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Desktop Products Table (lg+) */}
        <div className="hidden lg:block bg-surface rounded-2xl border border-border overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-border bg-surface-dim/40 text-muted uppercase text-[10px] tracking-wider">
                  <th className="py-3.5 px-3 w-10 text-center">
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      className="p-1 hover:text-primary transition-colors"
                      title={isAllSelected ? 'Deselect All' : 'Select All'}
                    >
                      {isAllSelected ? (
                        <CheckSquare className="w-4 h-4 text-accent" />
                      ) : (
                        <Square className="w-4 h-4 text-muted" />
                      )}
                    </button>
                  </th>
                  <th className="py-3.5 px-4">Product Details</th>
                  <th className="py-3.5 px-3">Type</th>
                  <th className="py-3.5 px-3">Category</th>
                  <th className="py-3.5 px-3">SKU &amp; Variant</th>
                  <th className="py-3.5 px-3">Price (Paise)</th>
                  <th className="py-3.5 px-3">Stock Controls</th>
                  <th className="py-3.5 px-3">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {isLoading && products.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-muted">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-accent" />
                      Loading authoritative products catalogue...
                    </td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-muted">
                      <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      No products match your search or filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p) => {
                    const defaultVar = p.variants[0];
                    const category = CATEGORIES.find((c) => c.id === p.categoryId);
                    const isPublished = p.status === 'PUBLISHED';
                    const isSelected = selectedProductIds.has(p.id);

                    return (
                      <tr
                        key={p.id}
                        className={`transition-colors ${
                          isSelected ? 'bg-accent/5' : 'hover:bg-surface-dim/30'
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="py-3.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleSelectProduct(p.id)}
                            className="p-1 hover:text-primary transition-colors"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-accent" />
                            ) : (
                              <Square className="w-4 h-4 text-muted" />
                            )}
                          </button>
                        </td>

                        {/* Product Thumbnail & Title */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-surface-dim border border-border overflow-hidden shrink-0">
                              {p.media?.[0]?.externalUrl ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img
                                  src={p.media[0].externalUrl}
                                  alt={p.title}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-muted">
                                  <Package className="w-4 h-4" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <span className="font-bold text-primary block truncate max-w-[220px]">
                                {p.title}
                              </span>
                              <span className="text-[10px] text-muted block truncate max-w-[220px]">
                                {p.originRegion || 'East Champaran, Bihar'} • {p.brand}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Product Type */}
                        <td className="py-3.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-surface-dim border border-border text-neutral-700 capitalize">
                            {p.productType || 'simple'}
                          </span>
                        </td>

                        {/* Category */}
                        <td className="py-3.5 px-3">
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-accent/10 text-accent whitespace-nowrap">
                            {category?.name || 'General'}
                          </span>
                        </td>

                        {/* SKU & Variant */}
                        <td className="py-3.5 px-3 font-mono text-[11px] text-primary whitespace-nowrap">
                          {defaultVar?.title || 'Single'}
                          <span className="block text-[10px] text-muted">
                            {p.baseSku || defaultVar?.sku || '—'}
                          </span>
                        </td>

                        {/* Price in Paise */}
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <div className="flex items-baseline gap-1.5">
                            <span className="font-bold text-primary">
                              {defaultVar ? formatPaiseToRupees(defaultVar.priceInPaise) : '—'}
                            </span>
                            {defaultVar?.compareAtPriceInPaise && defaultVar.compareAtPriceInPaise > defaultVar.priceInPaise && (
                              <span className="text-[11px] text-muted line-through font-mono">
                                {formatPaiseToRupees(defaultVar.compareAtPriceInPaise)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-muted font-mono">
                              {defaultVar?.priceInPaise} paise
                            </span>
                            {defaultVar?.compareAtPriceInPaise && defaultVar.compareAtPriceInPaise > defaultVar.priceInPaise && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                                {Math.round(((defaultVar.compareAtPriceInPaise - defaultVar.priceInPaise) / defaultVar.compareAtPriceInPaise) * 100)}% OFF
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Stock Controls */}
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          {defaultVar ? (
                            <div className="inline-flex items-center border border-border rounded-lg bg-surface-dim">
                              <button
                                onClick={() => handleUpdateStock(p.id, defaultVar.id, -5)}
                                className="px-2 py-1 text-muted hover:text-primary font-bold hover:bg-border/60 transition-colors"
                                title="Decrease stock by 5"
                              >
                                -5
                              </button>
                              <span
                                className={`px-2.5 py-1 font-bold text-center min-w-[2.5rem] ${
                                  defaultVar.stockQuantity <= (defaultVar.lowStockThreshold || 10)
                                    ? 'text-rose-600 bg-rose-50 dark:bg-rose-950/40'
                                    : 'text-primary'
                                }`}
                              >
                                {defaultVar.stockQuantity}
                              </span>
                              <button
                                onClick={() => handleUpdateStock(p.id, defaultVar.id, 5)}
                                className="px-2 py-1 text-muted hover:text-primary font-bold hover:bg-border/60 transition-colors"
                                title="Increase stock by 5"
                              >
                                +5
                              </button>
                            </div>
                          ) : null}
                        </td>

                        {/* Status Toggle */}
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <button
                            onClick={() => handleToggleStatus(p)}
                            title={`Click to ${isPublished ? 'unpublish' : 'publish'}`}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all shadow-sm ${
                              isPublished
                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                                : 'bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-950/40 dark:text-amber-300'
                            }`}
                          >
                            {isPublished ? (
                              <>
                                <Eye className="w-3 h-3 text-emerald-600" />
                                <span>PUBLISHED</span>
                              </>
                            ) : (
                              <>
                                <EyeOff className="w-3 h-3 text-amber-600" />
                                <span>DRAFT</span>
                              </>
                            )}
                          </button>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <Link
                              href={`/product/${p.slug}`}
                              target="_blank"
                              className="p-1.5 rounded-lg hover:bg-surface-dim text-neutral-600 hover:text-primary transition-colors"
                              title="View on storefront"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Link>

                            <button
                              onClick={() => handleDuplicateProduct(p)}
                              className="p-1.5 rounded-lg hover:bg-surface-dim text-neutral-600 hover:text-accent transition-colors"
                              title="Duplicate as draft"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleOpenEditModal(p)}
                              className="px-2 py-1 rounded-lg hover:bg-surface-dim text-neutral-600 hover:text-accent transition-colors flex items-center gap-1 font-semibold text-[11px]"
                              title="Edit product"
                            >
                              <Edit className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>

                            <button
                              onClick={() => setDeletingProductId(p.id)}
                              className="p-1.5 rounded-lg hover:bg-rose-500/10 text-neutral-600 hover:text-rose-600 transition-colors"
                              title="Delete product"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* UNIFIED 5-TAB WOOCOMMERCE PRODUCT EDITOR MODAL */}
        {/* ========================================================================= */}
        {isEditorOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-neutral-900/70 backdrop-blur-md">
            <div className="bg-surface rounded-3xl border border-border max-w-4xl w-full shadow-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-dim/40">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-accent/15 text-accent flex items-center justify-center">
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="font-display text-base font-bold text-primary">
                      {formState.id ? `Edit Product: ${formState.title}` : 'Create New Product'}
                    </h2>
                    <p className="text-[11px] text-muted">
                      WooCommerce-grade attributes, pricing in paise, and zero server binary media.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-surface-dim transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Tab Navigation */}
              <div className="flex items-center gap-1 px-6 border-b border-border bg-surface overflow-x-auto scrollbar-none">
                <button
                  type="button"
                  onClick={() => setActiveTab('general')}
                  className={`py-3 px-3.5 text-xs font-bold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                    activeTab === 'general'
                      ? 'border-accent text-accent'
                      : 'border-transparent text-neutral-600 hover:text-primary'
                  }`}
                >
                  <Tag className="w-3.5 h-3.5" />
                  <span>General Info</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('pricing')}
                  className={`py-3 px-3.5 text-xs font-bold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                    activeTab === 'pricing'
                      ? 'border-accent text-accent'
                      : 'border-transparent text-neutral-600 hover:text-primary'
                  }`}
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>Pricing &amp; Inventory</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('variations')}
                  className={`py-3 px-3.5 text-xs font-bold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                    activeTab === 'variations'
                      ? 'border-accent text-accent'
                      : 'border-transparent text-neutral-600 hover:text-primary'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Variations &amp; Attributes</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('media')}
                  className={`py-3 px-3.5 text-xs font-bold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                    activeTab === 'media'
                      ? 'border-accent text-accent'
                      : 'border-transparent text-neutral-600 hover:text-primary'
                  }`}
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Media URLs ({formState.media.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('advanced')}
                  className={`py-3 px-3.5 text-xs font-bold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                    activeTab === 'advanced'
                      ? 'border-accent text-accent'
                      : 'border-transparent text-neutral-600 hover:text-primary'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Advanced &amp; SEO</span>
                </button>
              </div>

              {/* Tab Form Content */}
              <form onSubmit={handleSaveProduct} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
                {/* 1. GENERAL TAB */}
                {activeTab === 'general' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block font-semibold text-primary mb-1">Product Title *</label>
                      <input
                        type="text"
                        required
                        value={formState.title}
                        onChange={(e) => setFormState({ ...formState, title: e.target.value })}
                        placeholder="e.g. 100% Kashmiri Honey"
                        className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary font-medium focus:outline-none focus:border-accent"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold text-primary mb-1">Tagline / Subtitle (PDP)</label>
                        <input
                          type="text"
                          value={formState.tagline}
                          onChange={(e) => setFormState({ ...formState, tagline: e.target.value })}
                          placeholder="e.g. Pure Taste & Natural Sweetness"
                          className="w-full px-3.5 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-primary mb-1">Custom Promo Badge (Card Overlay)</label>
                        <input
                          type="text"
                          value={formState.customBadge}
                          onChange={(e) => setFormState({ ...formState, customBadge: e.target.value })}
                          placeholder="e.g. Bestseller, Artisan Reserve, Cold Pressed"
                          className="w-full px-3.5 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <div className="flex items-center justify-between mb-1">
                          <label className="block font-semibold text-primary">URL Slug *</label>
                          <button
                            type="button"
                            onClick={handleGenerateSlug}
                            className="text-[10px] text-accent hover:underline font-bold flex items-center gap-1"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>Auto-Generate</span>
                          </button>
                        </div>
                        <input
                          type="text"
                          required
                          value={formState.slug}
                          onChange={(e) => setFormState({ ...formState, slug: e.target.value })}
                          placeholder="e.g. kachi-ghani-mustard-oil"
                          className="w-full px-3.5 py-2 bg-surface-dim border border-border rounded-xl text-primary font-mono focus:outline-none focus:border-accent"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-primary mb-1">Product Type</label>
                        <select
                          value={formState.productType}
                          onChange={(e) =>
                            setFormState({ ...formState, productType: e.target.value as ProductType })
                          }
                          className="w-full px-3.5 py-2 bg-surface-dim border border-border rounded-xl text-primary font-medium focus:outline-none focus:border-accent"
                        >
                          <option value="simple">Simple Product</option>
                          <option value="variable">Variable Product</option>
                          <option value="grouped">Grouped Product</option>
                          <option value="external">External / Affiliate</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="block font-semibold text-primary mb-1">Status</label>
                        <select
                          value={formState.status}
                          onChange={(e) =>
                            setFormState({ ...formState, status: e.target.value as any })
                          }
                          className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                        >
                          <option value="PUBLISHED">Published (Live)</option>
                          <option value="DRAFT">Draft (Hidden)</option>
                          <option value="ARCHIVED">Archived</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-semibold text-primary mb-1">Brand Name</label>
                        <input
                          type="text"
                          value={formState.brand}
                          onChange={(e) => setFormState({ ...formState, brand: e.target.value })}
                          className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-primary mb-1">Base SKU</label>
                        <input
                          type="text"
                          value={formState.baseSku}
                          onChange={(e) => setFormState({ ...formState, baseSku: e.target.value })}
                          placeholder="e.g. INF-OIL-01"
                          className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary font-mono focus:outline-none focus:border-accent"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-primary mb-1">Barcode / GTIN</label>
                        <input
                          type="text"
                          value={formState.barcode}
                          onChange={(e) => setFormState({ ...formState, barcode: e.target.value })}
                          placeholder="e.g. 8901234567890"
                          className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary font-mono focus:outline-none focus:border-accent"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold text-primary mb-1">Primary Category *</label>
                        <select
                          value={formState.categoryId}
                          onChange={(e) => setFormState({ ...formState, categoryId: e.target.value })}
                          className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                        >
                          {CATEGORIES.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} ({c.slug})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block font-semibold text-primary mb-1">Product Tags (Comma-Separated)</label>
                        <input
                          type="text"
                          value={formState.tags}
                          onChange={(e) => setFormState({ ...formState, tags: e.target.value })}
                          placeholder="e.g. honey, zamzam, talbeena, dates"
                          className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 p-3 bg-surface-dim/40 rounded-xl border border-border">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formState.isFeatured}
                          onChange={(e) => setFormState({ ...formState, isFeatured: e.target.checked })}
                          className="rounded text-accent focus:ring-accent"
                        />
                        <span className="font-semibold text-primary">Feature on Homepage Spotlight</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formState.isNewArrival}
                          onChange={(e) => setFormState({ ...formState, isNewArrival: e.target.checked })}
                          className="rounded text-accent focus:ring-accent"
                        />
                        <span className="font-semibold text-primary">Mark as Fresh Harvest / New Arrival</span>
                      </label>
                    </div>

                    <div>
                      <label className="block font-semibold text-primary mb-1">Short Description (Excerpt)</label>
                      <textarea
                        rows={2}
                        value={formState.shortDescription}
                        onChange={(e) => setFormState({ ...formState, shortDescription: e.target.value })}
                        placeholder="Brief 1-2 sentence overview shown on catalog cards..."
                        className="w-full px-3.5 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-primary mb-1">Detailed Description (Markdown Supported)</label>
                      <textarea
                        rows={5}
                        value={formState.fullDescription}
                        onChange={(e) => setFormState({ ...formState, fullDescription: e.target.value })}
                        placeholder="Complete artisan sourcing story, health benefits, lab test purity verification..."
                        className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary font-mono text-[11px] focus:outline-none focus:border-accent"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block font-semibold text-primary mb-1">Origin Sourcing Region</label>
                        <input
                          type="text"
                          value={formState.originRegion}
                          onChange={(e) => setFormState({ ...formState, originRegion: e.target.value })}
                          className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-primary mb-1">Ingredients</label>
                        <input
                          type="text"
                          value={formState.ingredients}
                          onChange={(e) => setFormState({ ...formState, ingredients: e.target.value })}
                          className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-primary mb-1">FSSAI License Number</label>
                        <input
                          type="text"
                          value={formState.fssaiLicenseNumber}
                          onChange={(e) => setFormState({ ...formState, fssaiLicenseNumber: e.target.value })}
                          className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary font-mono focus:outline-none focus:border-accent"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. PRICING & INVENTORY TAB */}
                {activeTab === 'pricing' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block font-semibold text-primary mb-1">
                          Selling / Offer Price (₹) <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={formState.sellingPriceRupees}
                          onChange={(e) =>
                            setFormState({
                              ...formState,
                              sellingPriceRupees: e.target.value,
                              regularPriceRupees: e.target.value,
                            })
                          }
                          placeholder="e.g. 2400"
                          className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary font-bold text-sm focus:outline-none focus:border-accent"
                        />
                        <span className="text-[10px] text-muted font-mono mt-0.5 block">
                          = {Math.round(parseFloat(formState.sellingPriceRupees || '0') * 100)} integer paise (charged at checkout)
                        </span>
                      </div>

                      <div>
                        <label className="block font-semibold text-primary mb-1">
                          Original M.R.P. / Compare-At Price (₹)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={formState.mrpPriceRupees}
                          onChange={(e) =>
                            setFormState({
                              ...formState,
                              mrpPriceRupees: e.target.value,
                              salePriceRupees: e.target.value,
                            })
                          }
                          placeholder="e.g. 2800"
                          className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary font-bold text-sm focus:outline-none focus:border-accent"
                        />
                        <span className="text-[10px] text-muted font-mono mt-0.5 block">
                          = {formState.mrpPriceRupees ? `${Math.round(parseFloat(formState.mrpPriceRupees) * 100)} integer paise (strikethrough)` : 'Optional M.R.P. baseline'}
                        </span>
                      </div>

                      <div>
                        <label className="block font-semibold text-primary mb-1">
                          Cost Price (₹, Gross Margin)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={formState.costPriceRupees}
                          onChange={(e) => setFormState({ ...formState, costPriceRupees: e.target.value })}
                          placeholder="e.g. 1680"
                          className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary font-medium focus:outline-none focus:border-accent"
                        />
                        <span className="text-[10px] text-muted font-mono mt-0.5 block">
                          = {formState.costPriceRupees ? `${Math.round(parseFloat(formState.costPriceRupees) * 100)} integer paise (procurement)` : 'Internal unit cost'}
                        </span>
                      </div>
                    </div>

                    {/* Dynamic Pricing & Margin Intelligence Card */}
                    {(() => {
                      const sell = parseFloat(formState.sellingPriceRupees || '0');
                      const mrp = parseFloat(formState.mrpPriceRupees || '0');
                      const cost = parseFloat(formState.costPriceRupees || '0');
                      const hasDiscount = mrp > sell && sell > 0;
                      const isInvalidMrp = mrp > 0 && mrp < sell;
                      const discountAmount = hasDiscount ? mrp - sell : 0;
                      const discountPercent = hasDiscount ? Math.round(((mrp - sell) / mrp) * 100) : 0;
                      const grossProfit = sell > 0 && cost > 0 ? sell - cost : 0;
                      const grossMarginPercent = sell > 0 && cost > 0 ? ((grossProfit / sell) * 100).toFixed(1) : '0.0';

                      return (
                        <div
                          className={`p-3.5 rounded-xl border text-xs transition-colors ${
                            isInvalidMrp
                              ? 'bg-rose-50/60 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800'
                              : 'bg-accent/5 border-accent/20'
                          }`}
                        >
                          {isInvalidMrp ? (
                            <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-semibold">
                              <AlertTriangle className="w-4 h-4 shrink-0" />
                              <span>
                                Notice: Original M.R.P. (₹{mrp.toFixed(2)}) is lower than Selling Price (₹{sell.toFixed(2)}). Strikethrough M.R.P. must be higher than or equal to the selling price.
                              </span>
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="flex items-center gap-3 flex-wrap">
                                <span className="text-muted font-medium">Customer Checkout:</span>
                                <span className="font-extrabold text-primary text-sm">
                                  ₹{sell.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </span>
                                {hasDiscount && (
                                  <>
                                    <span className="line-through text-muted font-mono">
                                      ₹{mrp.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </span>
                                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
                                      Save ₹{discountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} ({discountPercent}% OFF)
                                    </span>
                                  </>
                                )}
                              </div>
                              {cost > 0 && sell > 0 && (
                                <div className="flex items-center gap-2 font-mono text-[11px] text-muted">
                                  <span>Gross Margin:</span>
                                  <span className={`font-bold ${grossProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    ₹{grossProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })} ({grossMarginPercent}%)
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold text-primary mb-1">Tax Status</label>
                        <select
                          value={formState.taxStatus}
                          onChange={(e) =>
                            setFormState({ ...formState, taxStatus: e.target.value as TaxStatus })
                          }
                          className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                        >
                          <option value="TAXABLE">Taxable (GST Standard)</option>
                          <option value="EXEMPT">Exempt (Raw Farm Harvest)</option>
                          <option value="ZERO_RATED">Zero Rated</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-semibold text-primary mb-1">Tax Class (Indian GST)</label>
                        <select
                          value={formState.taxClass}
                          onChange={(e) => setFormState({ ...formState, taxClass: e.target.value })}
                          className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                        >
                          <option value="GST 0%">GST 0% (Drinking Water, Unprocessed Grains)</option>
                          <option value="GST 5%">GST 5% (Natural Honey, Talbeena, Dates &amp; Food)</option>
                          <option value="GST 12%">GST 12% (Specialty Packaged Foods)</option>
                          <option value="GST 18%">GST 18% (Standard Taxable Goods)</option>
                          <option value="GST 28%">GST 28%</option>
                        </select>
                      </div>
                    </div>

                    {/* Stock Management Card */}
                    <div className="p-4 bg-surface-dim/50 rounded-2xl border border-border space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-primary">Inventory &amp; Stock Protocol</span>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formState.manageStock}
                            onChange={(e) => setFormState({ ...formState, manageStock: e.target.checked })}
                            className="rounded text-accent focus:ring-accent"
                          />
                          <span className="font-semibold text-neutral-700">Track Stock Quantity</span>
                        </label>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block font-semibold text-primary mb-1">Stock Units</label>
                          <input
                            type="number"
                            min="0"
                            value={formState.stockQuantity}
                            onChange={(e) => setFormState({ ...formState, stockQuantity: e.target.value })}
                            className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-primary font-bold"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-primary mb-1">Stock Status</label>
                          <select
                            value={formState.stockStatus}
                            onChange={(e) =>
                              setFormState({ ...formState, stockStatus: e.target.value as StockStatus })
                            }
                            className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-primary"
                          >
                            <option value="IN_STOCK">In Stock</option>
                            <option value="OUT_OF_STOCK">Out of Stock</option>
                            <option value="ON_BACKORDER">On Backorder</option>
                          </select>
                        </div>

                        <div>
                          <label className="block font-semibold text-primary mb-1">Low Stock Warning Threshold</label>
                          <input
                            type="number"
                            value={formState.lowStockThreshold}
                            onChange={(e) => setFormState({ ...formState, lowStockThreshold: e.target.value })}
                            className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-primary"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Shipping & Dimensions */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="block font-semibold text-primary mb-1">Weight (Grams)</label>
                        <input
                          type="number"
                          value={formState.weightInGrams}
                          onChange={(e) => setFormState({ ...formState, weightInGrams: e.target.value })}
                          className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-primary mb-1">Length (cm)</label>
                        <input
                          type="number"
                          value={formState.dimensionsLength}
                          onChange={(e) => setFormState({ ...formState, dimensionsLength: e.target.value })}
                          className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-primary mb-1">Width (cm)</label>
                        <input
                          type="number"
                          value={formState.dimensionsWidth}
                          onChange={(e) => setFormState({ ...formState, dimensionsWidth: e.target.value })}
                          className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-primary mb-1">Height (cm)</label>
                        <input
                          type="number"
                          value={formState.dimensionsHeight}
                          onChange={(e) => setFormState({ ...formState, dimensionsHeight: e.target.value })}
                          className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. VARIATIONS & ATTRIBUTES TAB */}
                {activeTab === 'variations' && (
                  <div className="space-y-4">
                    {formState.productType !== 'variable' ? (
                      <div className="p-6 bg-surface-dim/40 rounded-2xl border border-dashed border-border text-center space-y-2">
                        <Layers className="w-8 h-8 mx-auto text-accent opacity-60" />
                        <h4 className="font-bold text-primary text-sm">Simple Product Configured</h4>
                        <p className="text-muted max-w-md mx-auto text-[11px]">
                          This product is currently configured as a Simple Product with single inventory pricing. To generate
                          variant matrices (e.g. 250g, 500g, 1L flacons), change the Product Type to &ldquo;Variable Product&rdquo; in the General Info tab.
                        </p>
                        <button
                          type="button"
                          onClick={() => setFormState({ ...formState, productType: 'variable' })}
                          className="px-4 py-2 bg-accent text-white rounded-xl font-bold mt-2 hover:bg-accent-hover transition-colors shadow-xs"
                        >
                          Switch to Variable Product
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between pb-2 border-b border-border">
                          <div>
                            <span className="font-bold text-primary">Variant Matrix</span>
                            <p className="text-[10px] text-muted">
                              SKUs, prices, and stock units for each specific volume or size variant.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={handleAddVariationRow}
                            className="px-3 py-1.5 bg-accent text-white rounded-lg font-bold flex items-center gap-1 hover:bg-accent-hover transition-colors shadow-xs"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Variation</span>
                          </button>
                        </div>

                        {formState.variants.length === 0 ? (
                          <div className="p-4 text-center text-muted border border-border rounded-xl">
                            No variations generated yet. Click &ldquo;Add Variation&rdquo; above.
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-72 overflow-y-auto">
                            {formState.variants.map((v, idx) => (
                              <div
                                key={v.id}
                                className="p-3 bg-surface-dim/50 rounded-xl border border-border grid grid-cols-1 sm:grid-cols-7 gap-2 items-center"
                              >
                                <div>
                                  <label className="text-[10px] font-bold text-muted uppercase">Option Name</label>
                                  <input
                                    type="text"
                                    value={v.title}
                                    onChange={(e) => {
                                      const copy = [...formState.variants];
                                      copy[idx].title = e.target.value;
                                      setFormState({ ...formState, variants: copy });
                                    }}
                                    className="w-full px-2 py-1 bg-surface border border-border rounded text-[11px]"
                                  />
                                </div>

                                <div>
                                  <label className="text-[10px] font-bold text-muted uppercase">SKU</label>
                                  <input
                                    type="text"
                                    value={v.sku}
                                    onChange={(e) => {
                                      const copy = [...formState.variants];
                                      copy[idx].sku = e.target.value;
                                      setFormState({ ...formState, variants: copy });
                                    }}
                                    className="w-full px-2 py-1 bg-surface border border-border rounded text-[11px] font-mono"
                                  />
                                </div>

                                <div>
                                  <label className="text-[10px] font-bold text-muted uppercase">Selling (₹)</label>
                                  <input
                                    type="number"
                                    value={v.priceRupees}
                                    onChange={(e) => {
                                      const copy = [...formState.variants];
                                      copy[idx].priceRupees = e.target.value;
                                      setFormState({ ...formState, variants: copy });
                                    }}
                                    placeholder="2400"
                                    className="w-full px-2 py-1 bg-surface border border-border rounded text-[11px] font-bold"
                                  />
                                </div>

                                <div>
                                  <label className="text-[10px] font-bold text-muted uppercase">M.R.P. (₹)</label>
                                  <input
                                    type="number"
                                    value={v.comparePriceRupees}
                                    onChange={(e) => {
                                      const copy = [...formState.variants];
                                      copy[idx].comparePriceRupees = e.target.value;
                                      setFormState({ ...formState, variants: copy });
                                    }}
                                    placeholder="2800"
                                    className="w-full px-2 py-1 bg-surface border border-border rounded text-[11px]"
                                  />
                                </div>

                                <div>
                                  <label className="text-[10px] font-bold text-muted uppercase">Stock Units</label>
                                  <input
                                    type="number"
                                    value={v.stockQuantity}
                                    onChange={(e) => {
                                      const copy = [...formState.variants];
                                      copy[idx].stockQuantity = e.target.value;
                                      setFormState({ ...formState, variants: copy });
                                    }}
                                    className="w-full px-2 py-1 bg-surface border border-border rounded text-[11px]"
                                  />
                                </div>

                                <div>
                                  <label className="text-[10px] font-bold text-muted uppercase">Media URL</label>
                                  <input
                                    type="url"
                                    value={v.mediaUrl}
                                    onChange={(e) => {
                                      const copy = [...formState.variants];
                                      copy[idx].mediaUrl = e.target.value;
                                      setFormState({ ...formState, variants: copy });
                                    }}
                                    placeholder="https://..."
                                    className="w-full px-2 py-1 bg-surface border border-border rounded text-[11px]"
                                  />
                                </div>

                                <div className="flex items-center justify-end gap-2 pt-3 sm:pt-0">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const copy = formState.variants.filter((_, i) => i !== idx);
                                      setFormState({ ...formState, variants: copy });
                                    }}
                                    className="p-1 text-rose-500 hover:text-rose-700"
                                    title="Delete variation"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* 4. MEDIA URLS TAB (ZERO BINARY UPLOADS) */}
                {activeTab === 'media' && (
                  <div className="space-y-4">
                    {/* Media Adder Form */}
                    <div className="p-4 bg-surface-dim/60 rounded-2xl border border-border space-y-3">
                      <div className="flex items-center gap-2">
                        <UploadCloud className="w-4 h-4 text-accent" />
                        <span className="font-bold text-primary">Add External Media Reference</span>
                        <span className="text-[10px] text-muted font-mono bg-accent/10 text-accent px-2 py-0.5 rounded-full">
                          Zero Server Disk Storage
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                        <div className="sm:col-span-2">
                          <label className="block font-semibold text-primary mb-1">External HTTPS URL *</label>
                          <input
                            type="url"
                            value={newMediaUrl}
                            onChange={(e) => setNewMediaUrl(e.target.value)}
                            placeholder="https://images.unsplash.com/... or https://.../report.pdf"
                            className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-primary font-mono text-[11px]"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-primary mb-1">Media Type</label>
                          <select
                            value={newMediaType}
                            onChange={(e) => setNewMediaType(e.target.value as any)}
                            className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-primary font-medium"
                          >
                            <option value="IMAGE">Image (JPEG/PNG/WEBP)</option>
                            <option value="VIDEO">Video (MP4/YouTube/Vimeo)</option>
                            <option value="AUDIO">Audio (MP3 Guide)</option>
                            <option value="PDF">Document / NMR Lab Report</option>
                          </select>
                        </div>

                        <div>
                          <label className="block font-semibold text-primary mb-1">Media Role</label>
                          <select
                            value={newMediaRole}
                            onChange={(e) => setNewMediaRole(e.target.value as any)}
                            className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-primary font-medium"
                          >
                            <option value="PRIMARY">Primary Cover Thumbnail</option>
                            <option value="GALLERY">Product Gallery</option>
                            <option value="VIDEO">Video Demonstration</option>
                            <option value="AUDIO">Artisan Audio Guide</option>
                            <option value="CERTIFICATE">NMR / FSSAI Lab Report</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <input
                          type="text"
                          value={newMediaAlt}
                          onChange={(e) => setNewMediaAlt(e.target.value)}
                          placeholder="Alt descriptive caption (e.g. Pure cold-pressed oil flacon in sunlight)..."
                          className="flex-1 px-3 py-1.5 bg-surface border border-border rounded-xl text-primary text-[11px]"
                        />

                        <button
                          type="button"
                          onClick={handleAddMediaItem}
                          disabled={!newMediaUrl.trim()}
                          className="px-4 py-1.5 bg-accent text-white font-bold rounded-xl disabled:opacity-40 hover:bg-accent-hover transition-colors shadow-xs"
                        >
                          Add to Media List
                        </button>
                      </div>
                    </div>

                    {/* Media Reorderable List */}
                    <div className="space-y-2">
                      <span className="font-bold text-primary block">
                        Assigned Media Assets ({formState.media.length})
                      </span>

                      {formState.media.map((m, idx) => (
                        <div
                          key={m.id || idx}
                          className="p-2.5 bg-surface rounded-xl border border-border flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Visual Thumbnail */}
                            <div className="w-12 h-12 rounded-lg bg-surface-dim border border-border overflow-hidden shrink-0 flex items-center justify-center">
                              {m.mediaType === 'VIDEO' ? (
                                <Video className="w-5 h-5 text-accent" />
                              ) : m.mediaType === 'AUDIO' ? (
                                <Music className="w-5 h-5 text-accent" />
                              ) : m.mediaType === 'PDF' ? (
                                <FileCheck className="w-5 h-5 text-accent" />
                              ) : (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img
                                  src={m.externalUrl}
                                  alt={m.altText}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                              )}
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-primary text-xs truncate max-w-[280px]">
                                  {m.altText || 'Product Media Asset'}
                                </span>
                                <span
                                  className={`text-[9px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                                    m.role === 'PRIMARY'
                                      ? 'bg-accent text-white'
                                      : 'bg-surface-dim text-neutral-600 border border-border'
                                  }`}
                                >
                                  {m.role}
                                </span>
                              </div>
                              <a
                                href={m.externalUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] text-muted hover:text-accent font-mono truncate block max-w-sm mt-0.5 underline"
                              >
                                {m.externalUrl}
                              </a>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {m.role !== 'PRIMARY' && (
                              <button
                                type="button"
                                onClick={() => handleSetPrimaryMedia(idx)}
                                className="px-2 py-1 rounded bg-surface-dim hover:bg-accent hover:text-white text-[10px] font-bold transition-colors"
                              >
                                Make Primary
                              </button>
                            )}

                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => {
                                const copy = [...formState.media];
                                const temp = copy[idx - 1];
                                copy[idx - 1] = copy[idx];
                                copy[idx] = temp;
                                setFormState({ ...formState, media: copy });
                              }}
                              className="p-1 hover:text-accent disabled:opacity-30"
                              title="Move Up"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              disabled={idx === formState.media.length - 1}
                              onClick={() => {
                                const copy = [...formState.media];
                                const temp = copy[idx + 1];
                                copy[idx + 1] = copy[idx];
                                copy[idx] = temp;
                                setFormState({ ...formState, media: copy });
                              }}
                              className="p-1 hover:text-accent disabled:opacity-30"
                              title="Move Down"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                const copy = formState.media.filter((_, i) => i !== idx);
                                setFormState({ ...formState, media: copy });
                              }}
                              className="p-1 text-rose-500 hover:text-rose-700"
                              title="Remove"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 5. ADVANCED & SEO TAB */}
                {activeTab === 'advanced' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block font-semibold text-primary mb-1">SEO Meta Title</label>
                      <input
                        type="text"
                        value={formState.seoTitle}
                        onChange={(e) => setFormState({ ...formState, seoTitle: e.target.value })}
                        placeholder={`${formState.title || 'Product'} | Buy Authentic Online | InfiniCharm`}
                        className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-primary mb-1">SEO Meta Description</label>
                      <textarea
                        rows={2}
                        value={formState.seoDescription}
                        onChange={(e) => setFormState({ ...formState, seoDescription: e.target.value })}
                        placeholder="Search engine summary snippet for Google and Answer Engines..."
                        className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-primary mb-1">Customer Purchase Note</label>
                      <textarea
                        rows={2}
                        value={formState.purchaseNote}
                        onChange={(e) => setFormState({ ...formState, purchaseNote: e.target.value })}
                        placeholder="Note sent to customer in email and PDF GST invoice..."
                        className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-primary mb-1">
                        Sourcing &amp; Authenticity Highlights (PDP Bullet Points, One per Line)
                      </label>
                      <textarea
                        rows={3}
                        value={formState.highlights}
                        onChange={(e) => setFormState({ ...formState, highlights: e.target.value })}
                        placeholder="Origin: Direct from Regional Distilleries&#10;100% Authentic • Zero Synthetic Adulteration&#10;Batch Quality Tested &amp; Certified"
                        className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary font-mono text-[11px] focus:outline-none focus:border-accent"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-surface-dim/60 rounded-xl border border-border">
                      <div>
                        <label className="block font-semibold text-primary mb-1">
                          Custom Shipping Message (PDP Override)
                        </label>
                        <input
                          type="text"
                          value={formState.customShippingText}
                          onChange={(e) => setFormState({ ...formState, customShippingText: e.target.value })}
                          placeholder="e.g. Free Express Delivery over ₹499 (Leave blank for settings default)"
                          className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-primary text-[11px] focus:outline-none focus:border-accent"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-primary mb-1">
                          Custom Guarantee Message (PDP Override)
                        </label>
                        <input
                          type="text"
                          value={formState.customGuaranteeText}
                          onChange={(e) => setFormState({ ...formState, customGuaranteeText: e.target.value })}
                          placeholder="e.g. Transit Damage Replacement Guarantee (Leave blank for settings default)"
                          className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-primary text-[11px] focus:outline-none focus:border-accent"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-primary mb-1">
                        Return &amp; Replacement Policy
                      </label>
                      <input
                        type="text"
                        value={formState.returnPolicyText}
                        onChange={(e) => setFormState({ ...formState, returnPolicyText: e.target.value })}
                        placeholder="e.g. Transit damage covered with instant free replacement. 7-day hassle-free return."
                        className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                      />
                    </div>

                    {/* Custom Specifications Table Rows */}
                    <div className="p-4 bg-surface-dim/40 rounded-xl border border-border space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-primary block">
                            Custom Technical Specifications (PDP Specs Tab)
                          </span>
                          <span className="text-[10px] text-muted">
                            Add custom rows (e.g. Harvest Season, Pollen Source, Packaging Material)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setFormState({
                              ...formState,
                              specifications: [...formState.specifications, { label: '', value: '' }],
                            })
                          }
                          className="px-3 py-1.5 bg-surface border border-border hover:border-accent text-primary font-bold rounded-lg text-[11px] flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add Spec Row</span>
                        </button>
                      </div>

                      {formState.specifications.length > 0 && (
                        <div className="space-y-2">
                          {formState.specifications.map((spec, sIdx) => (
                            <div key={sIdx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                              <input
                                type="text"
                                value={spec.label}
                                onChange={(e) => {
                                  const next = [...formState.specifications];
                                  next[sIdx] = { ...next[sIdx], label: e.target.value };
                                  setFormState({ ...formState, specifications: next });
                                }}
                                placeholder="Label (e.g. Pollen Source)"
                                className="sm:col-span-5 px-3 py-2 bg-surface border border-border rounded-lg text-primary text-[11px]"
                              />
                              <input
                                type="text"
                                value={spec.value}
                                onChange={(e) => {
                                  const next = [...formState.specifications];
                                  next[sIdx] = { ...next[sIdx], value: e.target.value };
                                  setFormState({ ...formState, specifications: next });
                                }}
                                placeholder="Value (e.g. Multi-flora Himalayan Acacia)"
                                className="sm:col-span-6 px-3 py-2 bg-surface border border-border rounded-lg text-primary text-[11px]"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const next = formState.specifications.filter((_, i) => i !== sIdx);
                                  setFormState({ ...formState, specifications: next });
                                }}
                                className="sm:col-span-1 p-1.5 text-rose-500 hover:text-rose-700 flex justify-center"
                                title="Remove specification row"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Related Products Picker */}
                    <div className="p-4 bg-surface-dim/40 rounded-xl border border-border space-y-2">
                      <div>
                        <span className="font-bold text-primary block">
                          Related &amp; Cross-Sell Products (PDP Recommendations)
                        </span>
                        <span className="text-[10px] text-muted">
                          Select products to suggest under &ldquo;You May Also Appreciate&rdquo; (leaves empty for automatic category suggestions)
                        </span>
                      </div>
                      <div className="max-h-36 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {products
                          .filter((other) => other.id !== formState.id && other.status === 'PUBLISHED')
                          .map((other) => {
                            const isChecked = formState.relatedProductIds.includes(other.id);
                            return (
                              <label
                                key={other.id}
                                className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-[11px] transition-colors ${
                                  isChecked
                                    ? 'bg-accent/10 border-accent text-primary font-semibold'
                                    : 'bg-surface border-border text-muted hover:text-primary'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    const next = e.target.checked
                                      ? [...formState.relatedProductIds, other.id]
                                      : formState.relatedProductIds.filter((rid) => rid !== other.id);
                                    setFormState({ ...formState, relatedProductIds: next });
                                  }}
                                  className="rounded text-accent focus:ring-accent"
                                />
                                <span className="truncate">{other.title}</span>
                              </label>
                            );
                          })}
                        {products.filter((other) => other.id !== formState.id && other.status === 'PUBLISHED').length === 0 && (
                          <span className="text-[11px] text-muted italic col-span-2">
                            No other published products available to link yet.
                          </span>
                        )}
                      </div>
                    </div>

                    {formState.productType === 'external' && (
                      <div className="grid grid-cols-2 gap-3 p-4 bg-surface-dim/60 rounded-xl border border-border">
                        <div>
                          <label className="block font-semibold text-primary mb-1">Affiliate Destination URL</label>
                          <input
                            type="url"
                            value={formState.externalProductUrl}
                            onChange={(e) => setFormState({ ...formState, externalProductUrl: e.target.value })}
                            placeholder="https://amazon.in/dp/..."
                            className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-primary font-mono text-[11px]"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-primary mb-1">Button Call-to-Action Text</label>
                          <input
                            type="text"
                            value={formState.buttonText}
                            onChange={(e) => setFormState({ ...formState, buttonText: e.target.value })}
                            placeholder="Buy on Amazon"
                            className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-primary"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Modal Footer Controls */}
                <div className="flex items-center justify-between pt-4 border-t border-border mt-6">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted font-mono">
                      {formState.id ? `ID: ${formState.id}` : 'Drafting new listing'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setIsEditorOpen(false)}
                      className="px-5 py-2.5 bg-surface-dim hover:bg-border text-primary rounded-xl font-medium transition-colors"
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-6 py-2.5 bg-accent hover:bg-accent-hover text-white font-bold rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Saving to Store...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Save &amp; Synchronize</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        {deletingProductId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-sm">
            <div className="bg-surface rounded-2xl border border-border p-6 max-w-sm w-full shadow-2xl space-y-4">
              <div className="flex items-center gap-3 text-rose-600">
                <AlertTriangle className="w-6 h-6 shrink-0" />
                <h3 className="font-bold text-base text-primary">Confirm Deletion</h3>
              </div>
              <p className="text-xs text-muted">
                Are you sure you want to permanently delete this product? It will be removed from all search indexes,
                recommendations, and the public storefront.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingProductId(null)}
                  className="px-4 py-2 bg-surface-dim hover:bg-border text-primary rounded-xl font-medium text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleDeleteProduct(deletingProductId)}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Deleting...' : 'Delete Permanently'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
