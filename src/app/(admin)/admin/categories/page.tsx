'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { CATEGORIES } from '@/lib/constants/categories';
import { getAllProducts } from '@/lib/data/products';
import { logAdminAction } from '@/lib/services/audit';
import { Category, Product } from '@/types';
import {
  Layers,
  Search,
  Plus,
  Edit2,
  CheckCircle2,
  Package,
  ShieldCheck,
  ExternalLink,
  Save,
  X,
  Trash2,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Tag,
  RefreshCw,
} from 'lucide-react';

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>(() => CATEGORIES as Category[]);
  const [products, setProducts] = useState<Product[]>(() => getAllProducts());
  const [searchQuery, setSearchQuery] = useState('');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncingCsv, setIsSyncingCsv] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // New Category State
  const [newName, setNewName] = useState('');
  const [newHindiName, setNewHindiName] = useState('');
  const [newPrimaryCategory, setNewPrimaryCategory] = useState('');
  const [newSubCategory1, setNewSubCategory1] = useState('');
  const [newSubCategory2, setNewSubCategory2] = useState('');
  const [newTagline, setNewTagline] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newBadge, setNewBadge] = useState('Approved Catalogue');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newCompliance, setNewCompliance] = useState('FSSAI License & Quality Verification');
  const [newIsActive, setNewIsActive] = useState(true);

  // Load from server API on mount
  useEffect(() => {
    loadCategories();
    // Also load live products to have accurate SKU count
    fetch('/api/products')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.products)) {
          setProducts(data.products);
        }
      })
      .catch(() => {});
  }, []);

  const loadCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.categories)) {
          setCategories(data.categories);
          try {
            localStorage.setItem('infinicharm_custom_categories', JSON.stringify(data.categories));
          } catch {}
          return;
        }
      }
    } catch (err) {
      console.error('Failed to fetch categories from server:', err);
    }
  };

  const notifyChange = (msg: string) => {
    setFeedbackMessage(msg);
    setTimeout(() => setFeedbackMessage(null), 3000);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('infinicharm_categories_updated'));
      try {
        localStorage.setItem('infinicharm_custom_categories', JSON.stringify(categories));
      } catch {}
    }
  };

  const filteredCategories = categories.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.hindiName && c.hindiName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      c.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.tagline && c.tagline.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const activeCategoriesCount = categories.filter((c) => c.isActive !== false).length;

  // Toggle Category Active Status
  const handleToggleActive = async (category: Category) => {
    const nextActive = !category.isActive;
    const updated = categories.map((c) =>
      c.id === category.id ? { ...c, isActive: nextActive } : c
    );
    setCategories(updated);

    try {
      const res = await fetch(`/api/categories/${category.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'TOGGLE_ACTIVE', isActive: nextActive }),
      });
      if (res.ok) {
        notifyChange(`${category.name} is now ${nextActive ? 'ACTIVE' : 'INACTIVE'}.`);
        logAdminAction('TOGGLE_CATEGORY_STATUS', 'category', category.id, {
          name: category.name,
          isActive: nextActive,
        });
      } else {
        await loadCategories(); // rollback
      }
    } catch {
      await loadCategories();
    }
  };

  // Reorder Category (Move UP / DOWN)
  const handleMoveCategory = async (id: string, direction: 'UP' | 'DOWN') => {
    const sorted = [...categories].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    const idx = sorted.findIndex((c) => c.id === id);
    if (idx < 0) return;

    const targetIdx = direction === 'UP' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= sorted.length) return;

    // Swap positions
    const temp = sorted[idx];
    sorted[idx] = sorted[targetIdx];
    sorted[targetIdx] = temp;

    const orderedIds = sorted.map((c) => c.id);
    const updated = sorted.map((c, i) => ({ ...c, displayOrder: i + 1 }));
    setCategories(updated);

    try {
      await fetch('/api/categories/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds }),
      });
      notifyChange(`Category "${temp.name}" display order updated.`);
      logAdminAction('REORDER_CATEGORIES', 'category', id, { orderedIds });
    } catch (err) {
      console.error('Failed to reorder categories:', err);
    }
  };

  // Save Category Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/categories/${editingCategory.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingCategory),
      });

      if (res.ok) {
        const data = await res.json();
        setCategories((prev) =>
          prev.map((c) => (c.id === editingCategory.id ? data.category || editingCategory : c))
        );
        notifyChange(`Category "${editingCategory.name}" updated successfully.`);
        logAdminAction('UPDATE_CATEGORY', 'category', editingCategory.id, {
          name: editingCategory.name,
          tagline: editingCategory.tagline,
          badge: editingCategory.badge,
        });
        setEditingCategory(null);
      } else {
        alert('Failed to save category updates.');
      }
    } catch (err) {
      alert('Error updating category.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Category
  const handleDeleteCategory = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete category "${name}"? This action removes it from the catalog and homepage.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setCategories((prev) => prev.filter((c) => c.id !== id));
        notifyChange(`Category "${name}" deleted.`);
        logAdminAction('DELETE_CATEGORY', 'category', id, { name });
      } else {
        alert('Failed to delete category.');
      }
    } catch (err) {
      alert('Error deleting category.');
    }
  };

  // Create Category
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setIsSubmitting(true);

    const slug = newName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const newCategory: Partial<Category> = {
      id: `cat-${slug}`,
      slug,
      name: newName.trim(),
      hindiName: newHindiName.trim() || undefined,
      primaryCategory: newPrimaryCategory.trim() || undefined,
      subCategory1: newSubCategory1.trim() || undefined,
      subCategory2: newSubCategory2.trim() || undefined,
      tagline: newTagline.trim() || 'Approved InfiniCharm essentials',
      description: newDescription.trim() || 'Verified quality item from the approved InfiniCharm catalogue.',
      badge: newBadge.trim() || 'Approved Catalogue',
      imageUrl:
        newImageUrl.trim() ||
        'https://images.unsplash.com/photo-1685773253905-915ce8dd470b?q=80&w=1073&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D',
      alt: `${newName.trim()} category`,
      complianceRequirement: newCompliance.trim() || 'FSSAI License & Quality Verification',
      displayOrder: categories.length + 1,
      isActive: newIsActive,
    };

    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCategory),
      });

      if (res.ok) {
        const data = await res.json();
        setCategories((prev) => [...prev, data.category]);
        notifyChange(`New category "${newName.trim()}" created successfully.`);
        logAdminAction('CREATE_CATEGORY', 'category', data.category.id, {
          name: data.category.name,
          slug: data.category.slug,
        });

        setShowAddModal(false);
        setNewName('');
        setNewHindiName('');
        setNewPrimaryCategory('');
        setNewSubCategory1('');
        setNewSubCategory2('');
        setNewTagline('');
        setNewDescription('');
        setNewBadge('Direct Harvest');
        setNewImageUrl('');
        setNewCompliance('FSSAI License & Lab Records');
        setNewIsActive(true);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to create category.');
      }
    } catch (err) {
      alert('Error creating category.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <AdminHeader />

      <main className="flex-1 p-6 sm:p-8 max-w-7xl mx-auto w-full space-y-8">
        {/* Feedback Alert */}
        {feedbackMessage && (
          <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs font-semibold flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{feedbackMessage}</span>
            </div>
            <button onClick={() => setFeedbackMessage(null)} className="text-muted hover:text-primary">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-primary tracking-tight">
              Category Taxonomy &amp; Governance
            </h1>
            <p className="text-xs text-muted mt-1">
              Configure centralized store categories, statutory compliance disclosures, and catalogue hierarchy.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
            <button
              type="button"
              disabled={isSyncingCsv}
              onClick={async () => {
                setIsSyncingCsv(true);
                try {
                  const res = await fetch('/api/admin/categories/sync-csv', { method: 'POST' });
                  const data = await res.json();
                  if (res.ok && data.success) {
                    const catRes = await fetch('/api/categories');
                    const catJson = await catRes.json();
                    if (Array.isArray(catJson.categories)) {
                      setCategories(catJson.categories);
                    }
                    notifyChange(`Synced ${data.categoriesCount} approved categories from All_Docs/Products CSV.`);
                    logAdminAction('SYNC_CATEGORIES_CSV', 'category', 'all', { count: data.categoriesCount });
                  } else {
                    alert(data.error || 'Failed to sync categories from CSV.');
                  }
                } catch {
                  alert('Error syncing categories from CSV.');
                } finally {
                  setIsSyncingCsv(false);
                }
              }}
              className="px-4 py-2.5 bg-surface hover:bg-surface-dim border border-border text-primary text-xs font-bold rounded-xl flex items-center gap-2 transition-colors shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingCsv ? 'animate-spin' : ''}`} />
              <span>{isSyncingCsv ? 'Syncing...' : 'Sync from CSV'}</span>
            </button>

            <button
              onClick={() => setShowAddModal(true)}
              className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-colors uppercase tracking-wider shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Category</span>
            </button>
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="bg-surface rounded-2xl border border-border p-5 shadow-sm space-y-1">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">
              Total Categories
            </span>
            <div className="font-display text-2xl font-bold text-primary">
              {activeCategoriesCount} Active / {categories.length} Total
            </div>
            <p className="text-[11px] text-muted">Curated single-owner catalogue</p>
          </div>

          <div className="bg-surface rounded-2xl border border-border p-5 shadow-sm space-y-1">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">
              Categorized Products
            </span>
            <div className="font-display text-2xl font-bold text-primary">
              {products.length} Products
            </div>
            <p className="text-[11px] text-muted">All assigned to active categories</p>
          </div>

          <div className="bg-surface rounded-2xl border border-border p-5 shadow-sm space-y-1">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">
              Compliance Standard
            </span>
            <div className="font-display text-2xl font-bold text-emerald-700 flex items-center gap-1.5">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              100% Certified
            </div>
            <p className="text-[11px] text-muted">FSSAI / Agmark / Metrology mapped</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search categories by name, Hindi term, or description..."
            className="w-full pl-10 pr-4 py-2 bg-surface border border-border rounded-xl text-xs text-primary focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCategories.map((category, idx) => {
            const productCount = products.filter((p) => p.categoryId === category.id).length;
            const isFirst = idx === 0;
            const isLast = idx === filteredCategories.length - 1;

            return (
              <div
                key={category.id}
                className={`bg-surface rounded-2xl border border-border p-5 shadow-sm hover:border-accent/30 transition-all flex flex-col justify-between space-y-4 ${
                  category.isActive === false ? 'opacity-65 bg-surface-dim/40' : ''
                }`}
              >
                <div className="space-y-3">
                  {/* Top Bar: Order, Image Thumbnail, Title, Actions */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      {/* Image Thumbnail */}
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-surface-dim border border-border shrink-0 relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={category.imageUrl || 'https://images.unsplash.com/photo-1685773253905-915ce8dd470b?q=80&w=1073&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D'}
                          alt={category.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = 'https://images.unsplash.com/photo-1685773253905-915ce8dd470b?q=80&w=1073&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D';
                          }}
                        />
                      </div>

                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-mono font-bold text-muted bg-surface-dim px-1.5 py-0.5 rounded border border-border">
                            #{category.displayOrder || idx + 1}
                          </span>
                          {category.badge && (
                            <span className="text-[9px] font-bold tracking-wider uppercase text-accent bg-accent/10 px-2 py-0.5 rounded-full">
                              {category.badge}
                            </span>
                          )}
                        </div>
                        <h2 className="font-display text-base font-bold text-primary flex items-center gap-1.5 mt-0.5">
                          {category.name}
                          {category.hindiName && (
                            <span className="text-xs font-normal text-muted font-sans">
                              ({category.hindiName})
                            </span>
                          )}
                        </h2>
                        <p className="text-xs text-accent font-semibold">
                          {category.tagline}
                        </p>
                      </div>
                    </div>

                    {/* Actions: Reorder & Edit/Delete */}
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleMoveCategory(category.id, 'UP')}
                          disabled={isFirst}
                          className="p-1 rounded text-muted hover:text-primary hover:bg-surface-dim border border-border disabled:opacity-20"
                          title="Move Up"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleMoveCategory(category.id, 'DOWN')}
                          disabled={isLast}
                          className="p-1 rounded text-muted hover:text-primary hover:bg-surface-dim border border-border disabled:opacity-20"
                          title="Move Down"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEditingCategory(category)}
                          className="p-1.5 hover:bg-surface-dim rounded-lg text-muted hover:text-primary transition-colors border border-border"
                          title="Edit Category Details"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(category.id, category.name)}
                          className="p-1.5 hover:bg-rose-50 rounded-lg text-muted hover:text-rose-600 transition-colors border border-border"
                          title="Delete Category"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-muted leading-relaxed line-clamp-2">
                    {category.description}
                  </p>

                  <div className="pt-2 border-t border-border/60 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5 text-muted" />
                        Active SKUs:
                      </span>
                      <span className="font-semibold text-primary">
                        {productCount} {productCount === 1 ? 'item' : 'items'}
                      </span>
                    </div>

                    {category.complianceRequirement && (
                      <div className="flex items-start gap-1.5 text-[11px] text-muted bg-surface-dim p-2 rounded-lg">
                        <ShieldCheck className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
                        <span>{category.complianceRequirement}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Bar: Status Toggle & Shop Link */}
                <div className="flex items-center justify-between pt-3 border-t border-border text-xs gap-2">
                  {/* Status Toggle */}
                  <button
                    onClick={() => handleToggleActive(category)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all shadow-xs ${
                      category.isActive !== false
                        ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-400'
                    }`}
                  >
                    {category.isActive !== false ? (
                      <>
                        <Eye className="w-3 h-3 text-emerald-600" />
                        <span>ACTIVE ON HOMEPAGE</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-3 h-3 text-zinc-500" />
                        <span>INACTIVE (HIDDEN)</span>
                      </>
                    )}
                  </button>

                  <Link
                    href={`/shop?category=${category.slug}`}
                    target="_blank"
                    className="text-accent hover:text-accent-hover font-bold flex items-center gap-1 text-[11px]"
                  >
                    <span>View in Shop</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {/* Edit Modal */}
        {editingCategory && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-surface border border-border rounded-2xl max-w-xl w-full p-6 shadow-xl space-y-5 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="font-display text-lg font-bold text-primary">
                  Edit Category: {editingCategory.name}
                </h3>
                <button
                  onClick={() => setEditingCategory(null)}
                  className="p-1 text-muted hover:text-primary"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-primary mb-1">
                      Category Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={editingCategory.name}
                      onChange={(e) =>
                        setEditingCategory({ ...editingCategory, name: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-surface-dim border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-primary mb-1">
                      Hindi / Vernacular Term
                    </label>
                    <input
                      type="text"
                      value={editingCategory.hindiName || ''}
                      onChange={(e) =>
                        setEditingCategory({ ...editingCategory, hindiName: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-surface-dim border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-primary mb-1">
                      Tagline / Subtitle
                    </label>
                    <input
                      type="text"
                      value={editingCategory.tagline || ''}
                      onChange={(e) =>
                        setEditingCategory({ ...editingCategory, tagline: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-surface-dim border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-primary mb-1">
                      Badge Pill (e.g. Pure &amp; Natural, Sealed 5L Can)
                    </label>
                    <input
                      type="text"
                      value={editingCategory.badge || ''}
                      onChange={(e) =>
                        setEditingCategory({ ...editingCategory, badge: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-surface-dim border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="block font-semibold text-primary mb-1">
                      Primary Category
                    </label>
                    <input
                      type="text"
                      value={editingCategory.primaryCategory || ''}
                      onChange={(e) =>
                        setEditingCategory({ ...editingCategory, primaryCategory: e.target.value })
                      }
                      placeholder="e.g. Honey"
                      className="w-full px-3 py-2 bg-surface-dim border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-primary mb-1">
                      Sub-Category 1
                    </label>
                    <input
                      type="text"
                      value={editingCategory.subCategory1 || ''}
                      onChange={(e) =>
                        setEditingCategory({ ...editingCategory, subCategory1: e.target.value })
                      }
                      placeholder="e.g. Pure Kashmiri Honey"
                      className="w-full px-3 py-2 bg-surface-dim border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-primary mb-1">
                      Sub-Category 2
                    </label>
                    <input
                      type="text"
                      value={editingCategory.subCategory2 || ''}
                      onChange={(e) =>
                        setEditingCategory({ ...editingCategory, subCategory2: e.target.value })
                      }
                      placeholder="e.g. Unprocessed Honey"
                      className="w-full px-3 py-2 bg-surface-dim border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-primary mb-1">
                    Media Visual (External HTTPS URL)
                  </label>
                  <input
                    type="url"
                    value={editingCategory.imageUrl || ''}
                    onChange={(e) =>
                      setEditingCategory({ ...editingCategory, imageUrl: e.target.value })
                    }
                    placeholder="https://images.unsplash.com/..."
                    className="w-full px-3 py-2 bg-surface-dim border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                  {editingCategory.imageUrl && (
                    <div className="mt-2 w-20 h-20 rounded-xl overflow-hidden bg-surface-dim border border-border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={editingCategory.imageUrl}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-primary mb-1">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    value={editingCategory.description || ''}
                    onChange={(e) =>
                      setEditingCategory({ ...editingCategory, description: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-surface-dim border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-primary mb-1">
                    Regulatory Compliance Declaration
                  </label>
                  <input
                    type="text"
                    value={editingCategory.complianceRequirement || ''}
                    onChange={(e) =>
                      setEditingCategory({
                        ...editingCategory,
                        complianceRequirement: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 bg-surface-dim border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-surface-dim rounded-xl border border-border">
                  <div>
                    <span className="font-semibold text-primary block">Active on Storefront</span>
                    <span className="text-[11px] text-muted">Toggle whether this category appears on the homepage and in navigation</span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setEditingCategory({
                        ...editingCategory,
                        isActive: editingCategory.isActive === false ? true : false,
                      })
                    }
                    className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all ${
                      editingCategory.isActive !== false
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
                    }`}
                  >
                    {editingCategory.isActive !== false ? 'ACTIVE' : 'INACTIVE'}
                  </button>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setEditingCategory(null)}
                    className="px-4 py-2 border border-border rounded-lg text-muted hover:text-primary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 bg-accent hover:bg-accent-hover text-white font-bold rounded-lg flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isSubmitting ? 'Saving...' : 'Save Changes'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Add Category Modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-surface border border-border rounded-2xl max-w-xl w-full p-6 shadow-xl space-y-5 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="font-display text-lg font-bold text-primary">
                  Add New Category
                </h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-1 text-muted hover:text-primary"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateCategory} className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-primary mb-1">
                      Category Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 100% Kashmiri Honey"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-dim border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-primary mb-1">
                      Hindi / Vernacular Term
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Kashmiri Shahad"
                      value={newHindiName}
                      onChange={(e) => setNewHindiName(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-dim border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="block font-semibold text-primary mb-1">Primary Category</label>
                    <input
                      type="text"
                      placeholder="e.g. Honey"
                      value={newPrimaryCategory}
                      onChange={(e) => setNewPrimaryCategory(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-dim border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-primary mb-1">Sub-Category 1</label>
                    <input
                      type="text"
                      placeholder="e.g. Natural Honey"
                      value={newSubCategory1}
                      onChange={(e) => setNewSubCategory1(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-dim border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-primary mb-1">Sub-Category 2</label>
                    <input
                      type="text"
                      placeholder="e.g. Wildflora"
                      value={newSubCategory2}
                      onChange={(e) => setNewSubCategory2(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-dim border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-primary mb-1">
                      Tagline / Subtitle
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Pure taste & natural sweetness"
                      value={newTagline}
                      onChange={(e) => setNewTagline(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-dim border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-primary mb-1">
                      Badge Pill (e.g. Pure &amp; Natural, Sealed 5L Can)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Approved Catalogue"
                      value={newBadge}
                      onChange={(e) => setNewBadge(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-dim border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-primary mb-1">
                    Media Visual (External HTTPS URL)
                  </label>
                  <input
                    type="url"
                    placeholder="https://images.unsplash.com/photo-..."
                    value={newImageUrl}
                    onChange={(e) => setNewImageUrl(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-dim border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                  {newImageUrl && (
                    <div className="mt-2 w-20 h-20 rounded-xl overflow-hidden bg-surface-dim border border-border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={newImageUrl}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-primary mb-1">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Detailed explanation of sourcing, origin discipline, and purity..."
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-dim border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-primary mb-1">
                    Statutory Compliance Requirement
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. FSSAI Pure Honey Compliance & Moisture Records"
                    value={newCompliance}
                    onChange={(e) => setNewCompliance(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-dim border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-surface-dim rounded-xl border border-border">
                  <div>
                    <span className="font-semibold text-primary block">Active on Storefront</span>
                    <span className="text-[11px] text-muted">Immediately display this category on the homepage</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNewIsActive(!newIsActive)}
                    className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all ${
                      newIsActive
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
                    }`}
                  >
                    {newIsActive ? 'ACTIVE' : 'INACTIVE'}
                  </button>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 border border-border rounded-lg text-muted hover:text-primary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 bg-accent hover:bg-accent-hover text-white font-bold rounded-lg flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{isSubmitting ? 'Creating...' : 'Create Category'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
