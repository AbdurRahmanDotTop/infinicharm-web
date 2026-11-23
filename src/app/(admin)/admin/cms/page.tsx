'use client';

// ==============================================================================
// InfiniCharm — Admin CMS Management Authority
// Features: Full Homepage Section CMS CRUD, Enable/Disable, Reorder, Journal CMS
// Invariants: Single Source of Truth, Server File Persistence, Real Data
// ==============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { getAllBlogPosts } from '@/lib/data/blog';
import {
  BlogPost,
  HomepageSection,
  HomepageSectionType,
  Product,
  HeroItem,
  HeroItemType,
  HeroItemPosition,
  Category,
  SpotlightCardItem,
  SourcingCenterCardItem,
  ContactSettings,
  RegistrationFormSettings,
  RegistrationFormField,
  RegistrationFieldType,
  RegistrationFormFieldOption,
} from '@/types';
import { CATEGORIES } from '@/lib/constants/categories';
import { logAdminAction } from '@/lib/services/audit';
import {
  FileText,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Edit2,
  Trash2,
  Layers,
  Sparkles,
  ShieldCheck,
  Save,
  X,
  ExternalLink,
  Sliders,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  LayoutTemplate,
  ToggleLeft,
  ToggleRight,
  Copy,
  MapPin,
  Store,
  Tag,
  Compass,
  ArrowRight,
  Bell,
  Phone,
  Mail,
  UserPlus,
  AlertCircle,
  Loader2,
  CheckSquare,
  Square,
} from 'lucide-react';

interface HeroBannerConfig {
  badge: string;
  headline: string;
  subheadline: string;
  ctaText: string;
  ctaLink: string;
  imageUrl: string;
  isActive: boolean;
}

export default function AdminCmsPage() {
  const [activeTab, setActiveTab] = useState<'HOMEPAGE' | 'BLOG' | 'HERO' | 'POLICIES' | 'CONTACT' | 'REGISTRATION'>('HOMEPAGE');
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddPostModal, setShowAddPostModal] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Registration Form Builder State
  const [regSettings, setRegSettings] = useState<RegistrationFormSettings | null>(null);
  const [isLoadingReg, setIsLoadingReg] = useState(false);
  const [isSavingReg, setIsSavingReg] = useState(false);
  const [regSuccessMsg, setRegSuccessMsg] = useState<string | null>(null);
  const [regErrorMsg, setRegErrorMsg] = useState<string | null>(null);

  // Field Edit / Add Modal State
  const [editingField, setEditingField] = useState<RegistrationFormField | null>(null);
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [fieldKey, setFieldKey] = useState('');
  const [fieldLabel, setFieldLabel] = useState('');
  const [fieldType, setFieldType] = useState<RegistrationFieldType>('text');
  const [fieldPlaceholder, setFieldPlaceholder] = useState('');
  const [fieldDescription, setFieldDescription] = useState('');
  const [fieldRequired, setFieldRequired] = useState(false);
  const [fieldEnabled, setFieldEnabled] = useState(true);
  const [fieldMinLength, setFieldMinLength] = useState<number | ''>('');
  const [fieldMaxLength, setFieldMaxLength] = useState<number | ''>('');
  const [fieldPattern, setFieldPattern] = useState('');
  const [fieldOptionsText, setFieldOptionsText] = useState('');

  // Contact Page Settings State
  const [contactSettings, setContactSettings] = useState<ContactSettings | null>(null);
  const [isSavingContact, setIsSavingContact] = useState(false);
  const [contactSaveMsg, setContactSaveMsg] = useState<string | null>(null);

  // Homepage Sections State
  const [homepageSections, setHomepageSections] = useState<HomepageSection[]>([]);
  const [isLoadingSections, setIsLoadingSections] = useState(false);
  const [editingSection, setEditingSection] = useState<HomepageSection | null>(null);
  const [showAddSectionModal, setShowAddSectionModal] = useState(false);
  const [deletingSectionId, setDeletingSectionId] = useState<string | null>(null);

  // Section Form States
  const [secType, setSecType] = useState<HomepageSectionType>('custom');
  const [secTitle, setSecTitle] = useState('');
  const [secSubtitle, setSecSubtitle] = useState('');
  const [secBadge, setSecBadge] = useState('');
  const [secCtaText, setSecCtaText] = useState('');
  const [secCtaLink, setSecCtaLink] = useState('');
  const [secSecondaryCtaText, setSecSecondaryCtaText] = useState('');
  const [secSecondaryCtaLink, setSecSecondaryCtaLink] = useState('');
  const [secImageUrl, setSecImageUrl] = useState('');
  const [secIsEnabled, setSecIsEnabled] = useState(true);

  // Dynamic Product Selection Controller States
  const [catalogueProducts, setCatalogueProducts] = useState<Product[]>([]);
  const [secSelectionMode, setSecSelectionMode] = useState<'manual' | 'category' | 'sales'>('sales');
  const [secSelectedProductIds, setSecSelectedProductIds] = useState<string[]>([]);
  const [secSelectedCategoryId, setSecSelectedCategoryId] = useState<string>('cat-honey');
  const [secProductLimit, setSecProductLimit] = useState<number>(4);
  const [secButtonText, setSecButtonText] = useState('Add to Bag');
  const [secCategories, setSecCategories] = useState<any[]>([]);
  const [productSearchTerm, setProductSearchTerm] = useState('');

  // Dynamic Spotlight & Origin Highlights Section States
  const [secSpotlightFloatingBadge, setSecSpotlightFloatingBadge] = useState('');
  const [secSpotlightFloatingText, setSecSpotlightFloatingText] = useState('');
  const [secSpotlightCards, setSecSpotlightCards] = useState<SpotlightCardItem[]>([]);
  const [secCenterCards, setSecCenterCards] = useState<SourcingCenterCardItem[]>([]);

  // Hero Section Dynamic Showcase Manager States
  const [secHeroItems, setSecHeroItems] = useState<HeroItem[]>([]);
  const [editingHeroItem, setEditingHeroItem] = useState<HeroItem | null>(null);
  const [showHeroItemModal, setShowHeroItemModal] = useState(false);
  const [heroItemFormType, setHeroItemFormType] = useState<HeroItemType>('product');
  const [heroItemFormTargetId, setHeroItemFormTargetId] = useState('');
  const [heroItemFormTitle, setHeroItemFormTitle] = useState('');
  const [heroItemFormSubtitle, setHeroItemFormSubtitle] = useState('');
  const [heroItemFormBadge, setHeroItemFormBadge] = useState('');
  const [heroItemFormTagline, setHeroItemFormTagline] = useState('');
  const [heroItemFormPrice, setHeroItemFormPrice] = useState('');
  const [heroItemFormCtaText, setHeroItemFormCtaText] = useState('');
  const [heroItemFormLinkUrl, setHeroItemFormLinkUrl] = useState('');
  const [heroItemFormImageUrl, setHeroItemFormImageUrl] = useState('');
  const [heroItemFormPosition, setHeroItemFormPosition] = useState<HeroItemPosition>('featured');
  const [heroItemFormIsEnabled, setHeroItemFormIsEnabled] = useState(true);
  const [allCategoriesList, setAllCategoriesList] = useState<Category[]>(
    (CATEGORIES as Category[]).filter((c) => c.isActive !== false)
  );

  // New Blog Post Form State
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Honey & Natural Wellness');
  const [newAuthor, setNewAuthor] = useState('AbdurRahman Ibn Ghufran');
  const [newSummary, setNewSummary] = useState('');
  const [newFeaturedImage, setNewFeaturedImage] = useState('');
  const [newContent, setNewContent] = useState('');

  // Hero Banner State
  const [heroConfig, setHeroConfig] = useState<HeroBannerConfig>({
    badge: 'Direct-to-Consumer Purity • East Champaran, Bihar',
    headline: 'Everyday Essentials, Selected With Heritage & Honesty',
    subheadline:
      '100% Kashmiri Honey, Zamzam Water, Takmeeli Talbeena, Barliva, and Premium Dates dispatched directly from East Champaran, Bihar - 845427.',
    ctaText: 'Explore Approved Catalogue',
    ctaLink: '/shop',
    imageUrl:
      'https://images.unsplash.com/photo-1685773253905-915ce8dd470b?q=80&w=1073&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D',
    isActive: true,
  });

  // Policy Disclosures State
  const [dispatchLocation, setDispatchLocation] = useState(
    'Ward No. 07, Lahsaniya, Khoripakar, Dewapur, Pachpakari, Patahi, Dhaka, Motihari, East Champaran, Bihar, India - 845427'
  );
  const [returnDaysClothing, setReturnDaysClothing] = useState('7');
  const [freeShippingThresholdRupees, setFreeShippingThresholdRupees] = useState('4999');

  // Fetch Homepage Sections from Server
  const fetchHomepageSections = useCallback(async () => {
    setIsLoadingSections(true);
    try {
      const res = await fetch('/api/homepage/sections');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.sections)) {
          setHomepageSections(data.sections);
        }
      }
    } catch (err) {
      console.error('Failed to fetch homepage sections:', err);
    } finally {
      setIsLoadingSections(false);
    }
  }, []);

  useEffect(() => {
    fetchHomepageSections();

    // Fetch live catalogue products for manual section assignment
    fetch('/api/products?admin=true')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.products)) {
          setCatalogueProducts(data.products);
        }
      })
      .catch((err) => console.error('Failed to load catalogue products for CMS:', err));

    // Fetch contact page configuration
    fetch('/api/contact/settings', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.success && data?.settings) {
          setContactSettings(data.settings);
        }
      })
      .catch((err) => console.error('Failed to load contact settings:', err));

    // Fetch registration form configuration
    fetch('/api/admin/settings/registration-form', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.success && data?.settings) {
          setRegSettings(data.settings);
        }
      })
      .catch((err) => console.error('Failed to load registration settings:', err));

    try {
      const storedPosts = localStorage.getItem('infinicharm_cms_posts');
      if (storedPosts) {
        setPosts(JSON.parse(storedPosts));
      } else {
        const initial = getAllBlogPosts();
        setPosts(initial);
      }

      const storedHero = localStorage.getItem('infinicharm_cms_hero');
      if (storedHero) {
        setHeroConfig(JSON.parse(storedHero));
      }
    } catch (err) {
      console.error('Failed to load CMS data:', err);
      setPosts(getAllBlogPosts());
    }
  }, [fetchHomepageSections]);

  const notifySuccess = (msg: string) => {
    setSaveSuccessMsg(msg);
    setTimeout(() => setSaveSuccessMsg(null), 3500);
  };

  const notifyError = (msg: string) => {
    alert(msg);
  };

  const handleSaveContactSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactSettings) return;
    setIsSavingContact(true);
    setContactSaveMsg(null);
    try {
      const res = await fetch('/api/admin/contact/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactSettings),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setContactSettings(data.settings);
        setContactSaveMsg('Public contact page settings updated and saved to server.');
        setTimeout(() => setContactSaveMsg(null), 4000);
        logAdminAction('UPDATE_CONTACT_PAGE_CMS', 'cms', 'contact_page', {
          primaryPhone: data.settings.primaryPhone,
          supportEmail: data.settings.supportEmail,
        });
      } else {
        alert(data.error || 'Failed to save contact settings.');
      }
    } catch {
      alert('Network error while saving contact settings.');
    } finally {
      setIsSavingContact(false);
    }
  };

  // --------------------------------------------------------------------------
  // REGISTRATION FORM BUILDER CONTROLLERS
  // --------------------------------------------------------------------------
  const fetchRegistrationSettings = useCallback(async () => {
    setIsLoadingReg(true);
    try {
      const res = await fetch('/api/admin/settings/registration-form');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.settings) {
          setRegSettings(data.settings);
        }
      }
    } catch (err) {
      console.error('Failed to fetch registration settings:', err);
    } finally {
      setIsLoadingReg(false);
    }
  }, []);

  const handleSaveRegGeneralSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regSettings) return;
    setIsSavingReg(true);
    setRegErrorMsg(null);
    try {
      const res = await fetch('/api/admin/settings/registration-form', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(regSettings),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to save settings.');
      setRegSuccessMsg('Registration form configuration saved successfully.');
      setTimeout(() => setRegSuccessMsg(null), 3500);
      if (data.settings) setRegSettings(data.settings);
    } catch (err: any) {
      setRegErrorMsg(err?.message || 'Error saving registration settings.');
    } finally {
      setIsSavingReg(false);
    }
  };

  const handleToggleFieldEnabled = async (field: RegistrationFormField) => {
    if (!regSettings) return;
    const updatedFields = regSettings.fields.map((f) =>
      f.key === field.key ? { ...f, isEnabled: !f.isEnabled } : f
    );
    setRegSettings({ ...regSettings, fields: updatedFields });
    try {
      await fetch(`/api/admin/settings/registration-form/fields/${encodeURIComponent(field.key)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled: !field.isEnabled }),
      });
    } catch {
      fetchRegistrationSettings();
    }
  };

  const handleToggleFieldRequired = async (field: RegistrationFormField) => {
    if (!regSettings || field.isSystemField) return;
    const updatedFields = regSettings.fields.map((f) =>
      f.key === field.key ? { ...f, required: !f.required } : f
    );
    setRegSettings({ ...regSettings, fields: updatedFields });
    try {
      await fetch(`/api/admin/settings/registration-form/fields/${encodeURIComponent(field.key)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ required: !field.required }),
      });
    } catch {
      fetchRegistrationSettings();
    }
  };

  const handleMoveField = async (index: number, direction: 'UP' | 'DOWN') => {
    if (!regSettings) return;
    const fields = [...regSettings.fields];
    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= fields.length) return;

    const temp = fields[index];
    fields[index] = fields[targetIndex];
    fields[targetIndex] = temp;

    fields.forEach((f, idx) => {
      f.order = idx + 1;
    });
    setRegSettings({ ...regSettings, fields });

    try {
      await fetch('/api/admin/settings/registration-form/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys: fields.map((f) => f.key) }),
      });
    } catch {
      fetchRegistrationSettings();
    }
  };

  const handleOpenAddField = () => {
    setEditingField(null);
    setFieldKey('');
    setFieldLabel('');
    setFieldType('text');
    setFieldPlaceholder('');
    setFieldDescription('');
    setFieldRequired(false);
    setFieldEnabled(true);
    setFieldMinLength('');
    setFieldMaxLength('');
    setFieldPattern('');
    setFieldOptionsText('');
    setShowFieldModal(true);
  };

  const handleOpenEditField = (field: RegistrationFormField) => {
    setEditingField(field);
    setFieldKey(field.key);
    setFieldLabel(field.label);
    setFieldType(field.type);
    setFieldPlaceholder(field.placeholder || '');
    setFieldDescription(field.description || '');
    setFieldRequired(field.required);
    setFieldEnabled(field.isEnabled);
    setFieldMinLength(field.validation?.minLength ?? '');
    setFieldMaxLength(field.validation?.maxLength ?? '');
    setFieldPattern(field.validation?.pattern || '');
    setFieldOptionsText(
      field.options ? field.options.map((o) => `${o.label}:${o.value}`).join('\n') : ''
    );
    setShowFieldModal(true);
  };

  const handleSaveField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fieldLabel.trim()) return;

    let parsedOptions: RegistrationFormFieldOption[] | undefined = undefined;
    if (['select', 'radio', 'checkbox'].includes(fieldType) && fieldOptionsText.trim()) {
      parsedOptions = fieldOptionsText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          if (line.includes(':')) {
            const [lbl, val] = line.split(':');
            return { label: lbl.trim(), value: val.trim() };
          }
          return { label: line, value: line.toLowerCase().replace(/[^a-z0-9]/g, '_') };
        });
    }

    const payload: Partial<RegistrationFormField> = {
      label: fieldLabel.trim(),
      type: fieldType,
      placeholder: fieldPlaceholder.trim() || undefined,
      description: fieldDescription.trim() || undefined,
      required: fieldRequired,
      isEnabled: fieldEnabled,
      options: parsedOptions,
      validation: {
        minLength: fieldMinLength !== '' ? Number(fieldMinLength) : undefined,
        maxLength: fieldMaxLength !== '' ? Number(fieldMaxLength) : undefined,
        pattern: fieldPattern.trim() || undefined,
      },
    };

    try {
      if (editingField) {
        const res = await fetch(`/api/admin/settings/registration-form/fields/${encodeURIComponent(editingField.key)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to update field.');
      } else {
        const generatedKey = fieldKey.trim() || fieldLabel.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const res = await fetch('/api/admin/settings/registration-form/fields', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, key: generatedKey }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to create field.');
      }

      setShowFieldModal(false);
      fetchRegistrationSettings();
      setRegSuccessMsg('Registration field updated successfully.');
      setTimeout(() => setRegSuccessMsg(null), 3500);
    } catch (err: any) {
      setRegErrorMsg(err?.message || 'Error saving registration field.');
    }
  };

  const handleDeleteField = async (key: string) => {
    if (!confirm(`Are you sure you want to permanently delete registration field "${key}"?`)) return;
    try {
      const res = await fetch(`/api/admin/settings/registration-form/fields/${encodeURIComponent(key)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to delete field.');
      fetchRegistrationSettings();
      setRegSuccessMsg(`Field "${key}" deleted successfully.`);
      setTimeout(() => setRegSuccessMsg(null), 3500);
    } catch (err: any) {
      setRegErrorMsg(err?.message || 'Error deleting field.');
    }
  };

  // Toggle Section Enabled Status
  const handleToggleSection = async (section: HomepageSection) => {
    const nextState = !section.isEnabled;
    // Optimistic UI update
    setHomepageSections((prev) =>
      prev.map((s) => (s.id === section.id ? { ...s, isEnabled: nextState } : s))
    );

    try {
      const res = await fetch(`/api/homepage/sections/${encodeURIComponent(section.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'TOGGLE_ENABLE',
          isEnabled: nextState,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.section) {
          setHomepageSections((prev) =>
            prev.map((s) => (s.id === section.id ? data.section : s))
          );
          logAdminAction('TOGGLE_HOMEPAGE_SECTION', 'cms', section.id, {
            type: section.type,
            title: section.title,
            isEnabled: nextState,
          });
          notifySuccess(`Section "${section.title}" ${nextState ? 'enabled' : 'disabled'}.`);
        }
      }
    } catch (err) {
      console.error('Failed to toggle section status:', err);
      fetchHomepageSections();
    }
  };

  // Move Section Up or Down (Reorder)
  const handleMoveSection = async (sectionId: string, direction: 'UP' | 'DOWN') => {
    const currentIndex = homepageSections.findIndex((s) => s.id === sectionId);
    if (currentIndex < 0) return;
    if (direction === 'UP' && currentIndex === 0) return;
    if (direction === 'DOWN' && currentIndex === homepageSections.length - 1) return;

    const targetIndex = direction === 'UP' ? currentIndex - 1 : currentIndex + 1;
    const reordered = [...homepageSections];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, moved);

    // Update display orders
    const updated = reordered.map((s, idx) => ({ ...s, displayOrder: idx + 1 }));
    setHomepageSections(updated);

    try {
      const res = await fetch('/api/homepage/sections/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderedIds: updated.map((s) => s.id),
        }),
      });

      if (res.ok) {
        logAdminAction('REORDER_HOMEPAGE_SECTIONS', 'cms', sectionId, {
          direction,
          newIndex: targetIndex,
        });
        notifySuccess('Homepage sections reordered successfully.');
      }
    } catch (err) {
      console.error('Failed to reorder sections on server:', err);
      fetchHomepageSections();
    }
  };

  // Open Edit Section Modal
  const handleOpenEditSection = (section: HomepageSection) => {
    setEditingSection(section);
    setSecType(section.type);
    setSecTitle(section.title || '');
    setSecSubtitle(section.subtitle || '');
    setSecBadge(section.badge || '');
    setSecCtaText(section.ctaText || '');
    setSecCtaLink(section.ctaLink || '');
    setSecSecondaryCtaText(section.secondaryCtaText || '');
    setSecSecondaryCtaLink(section.secondaryCtaLink || '');
    setSecImageUrl(section.imageUrl || '');
    setSecIsEnabled(section.isEnabled);

    // Initialize Product Assignment Config
    const cfg = section.config || {};
    setSecSelectionMode(
      cfg.selectionMode ||
        (section.type === 'best_sellers'
          ? 'sales'
          : section.type === 'kirana_packs'
          ? 'manual'
          : 'category')
    );
    setSecSelectedProductIds(Array.isArray(cfg.selectedProductIds) ? cfg.selectedProductIds : []);
    setSecSelectedCategoryId(cfg.selectedCategoryId || 'cat-honey');
    setSecProductLimit(
      cfg.productLimit ||
        (section.type === 'best_sellers'
          ? 99
          : section.type === 'flash_deals'
          ? 5
          : 4)
    );
    setSecButtonText(cfg.buttonText || (section.type === 'best_sellers' ? 'Add to Bag' : 'Add'));
    setSecCategories(
      Array.isArray(cfg.categories) && cfg.categories.length > 0
        ? cfg.categories
        : allCategoriesList.map((cat) => ({
            id: cat.id,
            name: cat.name,
            slug: cat.slug,
            tagline: cat.tagline || cat.hindiName || cat.description,
            badge: cat.badge || 'Verified',
            imageUrl: cat.imageUrl || '',
            linkUrl: `/shop?category=${cat.slug}`,
          }))
    );
    setProductSearchTerm('');

    // Initialize Spotlight & Center Highlight Configs
    setSecSpotlightFloatingBadge(cfg.spotlightFloatingBadge || 'East Champaran, Bihar Dispatch');
    setSecSpotlightFloatingText(
      cfg.spotlightFloatingText ||
        'Every Honey jar, Talbeena pack, Dates box, and Zamzam Water can is batch-verified before dispatch.'
    );
    setSecSpotlightCards(
      Array.isArray(cfg.spotlightCards) && cfg.spotlightCards.length > 0
        ? cfg.spotlightCards
        : [
            { id: 'sp-1', title: '100% Kashmiri Honey', description: 'Pure taste & natural sweetness sourced cleanly.' },
            { id: 'sp-2', title: 'Takmeeli Talbeena', description: 'Healthy & nourishing barley dry-fruit blend.' },
            { id: 'sp-3', title: 'Zamzam & Dates', description: 'Original 5L sealed can and soft sweet dates.' },
          ]
    );
    setSecCenterCards(
      Array.isArray(cfg.centerCards) && cfg.centerCards.length > 0
        ? cfg.centerCards
        : [
            {
              id: 'cc-1',
              title: '100% Kashmiri Honey',
              location: 'East Champaran, Bihar - 845427',
              description: 'Natural honey with pure taste & natural sweetness.',
              imageUrl:
                'https://images.unsplash.com/photo-1685773253905-915ce8dd470b?q=80&w=1073&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D',
              specLeft: 'Natural Honey',
              specRight: 'Unadulterated',
              linkUrl: '/product/100-kashmiri-honey',
              ctaText: 'View Honey',
            },
          ]
    );

    // Initialize Hero Showcase Items if hero section
    const heroItemsList: HeroItem[] = Array.isArray(cfg.heroItems)
      ? cfg.heroItems
      : Array.isArray(section.heroItems)
      ? section.heroItems
      : section.type === 'hero'
      ? [
          {
            id: 'hero-item-1',
            type: 'product',
            targetId: 'S-01-P-01',
            title: '100% Kashmiri Honey',
            subtitle: 'Pure Taste & Natural Sweetness',
            badge: 'East Champaran, Bihar Dispatch',
            tagline: 'Natural Honey & Pure Goodness',
            priceDisplay: '₹2,400',
            ctaText: 'Signature Harvest',
            linkUrl: '/product/100-kashmiri-honey',
            imageUrl:
              section.imageUrl ||
              'https://images.unsplash.com/photo-1685773253905-915ce8dd470b?q=80&w=1073&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D',
            position: 'featured',
            displayOrder: 1,
            isEnabled: true,
          },
          {
            id: 'hero-item-2',
            type: 'product',
            targetId: 'S-01-P-02',
            title: 'Zamzam Water 5 Litres',
            badge: 'Original Sealed Pack',
            tagline: '100% Pure & Authentic',
            priceDisplay: '₹6,000',
            ctaText: 'Shop 5L Pack',
            linkUrl: '/product/zamzam-water-5-litres',
            imageUrl:
              'https://zamzamstoreeg.com/cdn/shop/files/bottle.jpg?v=1758206902',
            position: 'secondary_top',
            displayOrder: 2,
            isEnabled: true,
          },
          {
            id: 'hero-item-3',
            type: 'product',
            targetId: 'S-01-P-03',
            title: 'Takmeeli Talbeena',
            badge: 'Healthy Breakfast',
            tagline: 'Wholesome Daily Nutrition',
            priceDisplay: '₹300',
            ctaText: 'Shop Talbeena',
            linkUrl: '/product/takmeeli-talbeena',
            imageUrl:
              'https://rukminim2.flixcart.com/image/1536/1536/xif0q/ready-mix/q/5/l/1-talbeena-with-dry-fruits-combo-premium-pack-pack-4-250g-x-4-4-original-imahgt7br6ydh8rn.jpeg',
            position: 'secondary_bottom',
            displayOrder: 3,
            isEnabled: true,
          },
        ]
      : [];
    setSecHeroItems(heroItemsList);
  };

  // Open Add Hero Item Modal
  const handleOpenAddHeroItem = () => {
    setEditingHeroItem(null);
    setHeroItemFormType('product');
    setHeroItemFormTargetId(catalogueProducts[0]?.id || '');
    if (catalogueProducts[0]) {
      const p = catalogueProducts[0];
      setHeroItemFormTitle(p.title);
      setHeroItemFormBadge(p.originRegion || 'Direct Harvest');
      setHeroItemFormTagline('Pure Single-Origin');
      const price = p.variants[0]?.priceInPaise ? `₹${(p.variants[0].priceInPaise / 100).toFixed(0)}` : '';
      setHeroItemFormPrice(price);
      setHeroItemFormCtaText('Explore');
      setHeroItemFormLinkUrl(`/product/${p.slug}`);
      setHeroItemFormImageUrl(p.media?.[0]?.externalUrl || p.variants?.[0]?.mediaUrl || '');
    } else {
      setHeroItemFormTitle('');
      setHeroItemFormBadge('');
      setHeroItemFormTagline('');
      setHeroItemFormPrice('');
      setHeroItemFormCtaText('');
      setHeroItemFormLinkUrl('');
      setHeroItemFormImageUrl('');
    }
    setHeroItemFormSubtitle('');
    setHeroItemFormPosition(
      secHeroItems.length === 0
        ? 'featured'
        : secHeroItems.length === 1
        ? 'secondary_top'
        : 'secondary_bottom'
    );
    setHeroItemFormIsEnabled(true);
    setShowHeroItemModal(true);
  };

  // Open Edit Hero Item Modal
  const handleOpenEditHeroItem = (item: HeroItem) => {
    setEditingHeroItem(item);
    setHeroItemFormType(item.type);
    setHeroItemFormTargetId(item.targetId || '');
    setHeroItemFormTitle(item.title || '');
    setHeroItemFormSubtitle(item.subtitle || '');
    setHeroItemFormBadge(item.badge || '');
    setHeroItemFormTagline(item.tagline || '');
    setHeroItemFormPrice(item.priceDisplay || '');
    setHeroItemFormCtaText(item.ctaText || '');
    setHeroItemFormLinkUrl(item.linkUrl || '');
    setHeroItemFormImageUrl(item.imageUrl || '');
    setHeroItemFormPosition(item.position || 'featured');
    setHeroItemFormIsEnabled(item.isEnabled !== false);
    setShowHeroItemModal(true);
  };

  // When changing item type or product/category selection
  const handleSelectProductForHeroItem = (prodId: string) => {
    setHeroItemFormTargetId(prodId);
    const prod = catalogueProducts.find((p) => p.id === prodId);
    if (prod) {
      setHeroItemFormTitle(prod.title);
      setHeroItemFormBadge(prod.originRegion || 'Direct Harvest');
      const price = prod.variants[0]?.priceInPaise ? `₹${(prod.variants[0].priceInPaise / 100).toFixed(0)}` : '';
      setHeroItemFormPrice(price);
      setHeroItemFormLinkUrl(`/product/${prod.slug}`);
      setHeroItemFormImageUrl(prod.media?.[0]?.externalUrl || prod.variants?.[0]?.mediaUrl || '');
    }
  };

  const handleSelectCategoryForHeroItem = (catSlugOrId: string) => {
    setHeroItemFormTargetId(catSlugOrId);
    const cat = allCategoriesList.find((c) => c.slug === catSlugOrId || c.id === catSlugOrId);
    if (cat) {
      setHeroItemFormTitle(cat.name);
      setHeroItemFormBadge(cat.hindiName ? `${cat.hindiName} Reserve` : 'Curated Category');
      setHeroItemFormLinkUrl(`/shop?category=${cat.slug || cat.id}`);
      if (cat.imageUrl) {
        setHeroItemFormImageUrl(cat.imageUrl);
      }
    }
  };

  // Save Hero Item to secHeroItems list
  const handleSaveHeroItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!heroItemFormTitle.trim()) {
      notifyError('Please enter a title for the hero item.');
      return;
    }

    let resolvedLink = heroItemFormLinkUrl.trim();
    if (!resolvedLink) {
      if (heroItemFormType === 'category') {
        resolvedLink = `/shop?category=${heroItemFormTargetId || 'all'}`;
      } else if (heroItemFormType === 'product') {
        const prod = catalogueProducts.find((p) => p.id === heroItemFormTargetId);
        resolvedLink = prod ? `/product/${prod.slug}` : `/product/${heroItemFormTargetId || 'shop'}`;
      } else {
        resolvedLink = '/shop';
      }
    }

    const newItem: HeroItem = {
      id: editingHeroItem ? editingHeroItem.id : `hero-item-${Date.now()}`,
      type: heroItemFormType,
      targetId: heroItemFormTargetId,
      title: heroItemFormTitle.trim(),
      subtitle: heroItemFormSubtitle.trim(),
      badge: heroItemFormBadge.trim(),
      tagline: heroItemFormTagline.trim(),
      priceDisplay: heroItemFormPrice.trim(),
      ctaText: heroItemFormCtaText.trim(),
      linkUrl: resolvedLink,
      imageUrl:
        heroItemFormImageUrl.trim() ||
        'https://images.unsplash.com/photo-1615397349754-cfa2066a298e?auto=format&fit=crop&w=800&q=80',
      position: heroItemFormPosition,
      isEnabled: heroItemFormIsEnabled,
      displayOrder: editingHeroItem ? editingHeroItem.displayOrder : secHeroItems.length + 1,
    };

    if (editingHeroItem) {
      setSecHeroItems((prev) =>
        prev.map((item) => (item.id === editingHeroItem.id ? newItem : item))
      );
      notifySuccess('Hero showcase card updated.');
    } else {
      setSecHeroItems((prev) => [...prev, newItem]);
      notifySuccess('New hero showcase card added.');
    }

    setShowHeroItemModal(false);
  };

  // Duplicate Hero Item
  const handleDuplicateHeroItem = (itemId: string) => {
    const item = secHeroItems.find((i) => i.id === itemId);
    if (!item) return;

    const copy: HeroItem = {
      ...item,
      id: `hero-item-${Date.now()}`,
      title: `${item.title} (Copy)`,
      displayOrder: secHeroItems.length + 1,
    };

    setSecHeroItems((prev) => [...prev, copy]);
    notifySuccess('Hero card duplicated.');
  };

  // Delete Hero Item
  const handleDeleteHeroItem = (itemId: string) => {
    setSecHeroItems((prev) => {
      const filtered = prev.filter((i) => i.id !== itemId);
      return filtered.map((i, idx) => ({ ...i, displayOrder: idx + 1 }));
    });
    notifySuccess('Hero card removed.');
  };

  // Reorder Hero Item Up / Down
  const handleMoveHeroItem = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === secHeroItems.length - 1) return;

    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const reordered = [...secHeroItems];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIdx, 0, moved);

    setSecHeroItems(reordered.map((item, idx) => ({ ...item, displayOrder: idx + 1 })));
  };

  // Toggle Hero Item Visibility
  const handleToggleHeroItem = (itemId: string) => {
    setSecHeroItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, isEnabled: !item.isEnabled } : item))
    );
  };

  // Save Section Edit
  const handleSaveSectionEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSection) return;

    try {
      const updatedConfig = {
        ...(editingSection.config || {}),
        selectionMode: secSelectionMode,
        selectedProductIds: secSelectedProductIds,
        selectedCategoryId: secSelectedCategoryId,
        productLimit: Number(secProductLimit) || (editingSection.type === 'best_sellers' ? 99 : 4),
        buttonText: secButtonText.trim() || 'Add to Bag',
        categories: secCategories,
        heroItems: secHeroItems,
        spotlightFloatingBadge: secSpotlightFloatingBadge.trim(),
        spotlightFloatingText: secSpotlightFloatingText.trim(),
        spotlightCards: secSpotlightCards,
        centerCards: secCenterCards,
      };

      const res = await fetch(`/api/homepage/sections/${encodeURIComponent(editingSection.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: secTitle.trim(),
          subtitle: secSubtitle.trim(),
          badge: secBadge.trim(),
          ctaText: secCtaText.trim(),
          ctaLink: secCtaLink.trim(),
          secondaryCtaText: secSecondaryCtaText.trim(),
          secondaryCtaLink: secSecondaryCtaLink.trim(),
          imageUrl: secImageUrl.trim(),
          isEnabled: secIsEnabled,
          config: updatedConfig,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.section) {
          setHomepageSections((prev) =>
            prev.map((s) => (s.id === editingSection.id ? data.section : s))
          );
          logAdminAction('UPDATE_HOMEPAGE_SECTION', 'cms', editingSection.id, {
            title: secTitle.trim(),
            config: updatedConfig,
          });
          setEditingSection(null);
          notifySuccess('Section updated and live on storefront.');

          // Dispatch update events for instant storefront synchronization
          window.dispatchEvent(new CustomEvent('infinicharm_sections_updated'));
          try {
            localStorage.setItem('infinicharm_sections_updated', Date.now().toString());
          } catch {
            // ignore
          }
        }
      }
    } catch (err) {
      console.error('Failed to save section edits:', err);
      alert('Failed to save section. Please try again.');
    }
  };

  // Create New Homepage Section
  const handleCreateSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secTitle.trim()) return;

    try {
      const res = await fetch('/api/homepage/sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: secType,
          title: secTitle.trim(),
          subtitle: secSubtitle.trim(),
          badge: secBadge.trim(),
          ctaText: secCtaText.trim(),
          ctaLink: secCtaLink.trim(),
          secondaryCtaText: secSecondaryCtaText.trim(),
          secondaryCtaLink: secSecondaryCtaLink.trim(),
          imageUrl: secImageUrl.trim(),
          isEnabled: secIsEnabled,
          config:
            secType === 'best_sellers'
              ? { productLimit: 99, buttonText: 'Add to Bag', selectionMode: 'sales' }
              : {},
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.section) {
          setHomepageSections((prev) => [...prev, data.section]);
          logAdminAction('CREATE_HOMEPAGE_SECTION', 'cms', data.section.id, {
            title: data.section.title,
            type: data.section.type,
          });
          setShowAddSectionModal(false);
          setSecTitle('');
          setSecSubtitle('');
          setSecBadge('');
          setSecCtaText('');
          setSecCtaLink('');
          notifySuccess('New homepage section added.');
        }
      }
    } catch (err) {
      console.error('Failed to create section:', err);
      alert('Failed to create section.');
    }
  };

  // Delete Section
  const handleDeleteSection = async (sectionId: string) => {
    try {
      const res = await fetch(`/api/homepage/sections/${encodeURIComponent(sectionId)}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setHomepageSections((prev) => prev.filter((s) => s.id !== sectionId));
        logAdminAction('DELETE_HOMEPAGE_SECTION', 'cms', sectionId, {});
        setDeletingSectionId(null);
        notifySuccess('Homepage section deleted.');
      }
    } catch (err) {
      console.error('Failed to delete section:', err);
      alert('Failed to delete section.');
    }
  };

  // Blog Post Toggle
  const handleTogglePublish = (postId: string) => {
    setPosts((prev) => {
      const updated = prev.map((p) => {
        if (p.id !== postId) return p;
        const newStatus: 'PUBLISHED' | 'DRAFT' =
          p.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
        logAdminAction('TOGGLE_BLOG_STATUS', 'blog_posts', p.id, {
          previousStatus: p.status,
          newStatus,
        });
        return { ...p, status: newStatus };
      });
      localStorage.setItem('infinicharm_cms_posts', JSON.stringify(updated));
      return updated;
    });
    notifySuccess('Article visibility updated.');
  };

  // Create Blog Post
  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    const slug = newTitle
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const newPost: BlogPost = {
      id: `post-${Date.now()}`,
      slug: `${slug}-${Date.now().toString().slice(-4)}`,
      title: newTitle.trim(),
      summary: newSummary.trim() || 'Insightful craft notes from the source.',
      contentMarkdown: newContent.trim(),
      featuredImageUrl:
        newFeaturedImage.trim() ||
        'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=800&q=80',
      category: newCategory,
      tags: ['Purity', 'Sourcing'],
      authorName: newAuthor.trim() || 'AbdurRahman Ibn Ghufran',
      status: 'PUBLISHED',
      publishedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updated = [newPost, ...posts];
    setPosts(updated);
    localStorage.setItem('infinicharm_cms_posts', JSON.stringify(updated));

    logAdminAction('CREATE_BLOG_POST', 'blog_posts', newPost.id, {
      title: newPost.title,
      slug: newPost.slug,
      category: newPost.category,
    });

    setShowAddPostModal(false);
    setNewTitle('');
    setNewSummary('');
    setNewContent('');
    setNewFeaturedImage('');
    notifySuccess('New article published.');
  };

  // Save Policy Disclosures
  const handleSavePolicies = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      localStorage.setItem('infinicharm_dispatch_location', dispatchLocation);
      localStorage.setItem('infinicharm_return_days_clothing', returnDaysClothing);
      localStorage.setItem('infinicharm_free_shipping_threshold', freeShippingThresholdRupees);

      logAdminAction('UPDATE_POLICY_PARAMETERS', 'settings', 'global-policies', {
        dispatchLocation,
        returnDaysClothing,
        freeShippingThresholdRupees,
      });

      notifySuccess('Legal policy parameters saved successfully.');
    } catch {
      alert('Failed to save policy parameters.');
    }
  };

  // Filter blog posts
  const filteredPosts = posts.filter(
    (p) =>
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.authorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <AdminHeader />

      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl font-bold text-primary tracking-tight">
                Content & Editorial CMS Engine (Storefront & Homepage)
              </h1>
              <span className="text-xs font-bold bg-accent/10 text-accent border border-accent/20 px-2.5 py-0.5 rounded-full">
                Dynamic Layout Engine
              </span>
            </div>
            <p className="text-xs text-muted mt-1">
              Manage every visible homepage section, live banner copy, editorial articles, and legal parameters.
            </p>
          </div>

          {activeTab === 'HOMEPAGE' && (
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => fetchHomepageSections()}
                disabled={isLoadingSections}
                className="p-2.5 text-muted hover:text-primary rounded-xl hover:bg-surface border border-border transition-colors"
                title="Refresh Sections"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingSections ? 'animate-spin' : ''}`} />
              </button>

              <button
                onClick={() => {
                  setSecType('custom');
                  setSecTitle('');
                  setSecSubtitle('');
                  setSecBadge('');
                  setSecCtaText('Learn More');
                  setSecCtaLink('/shop');
                  setSecImageUrl('');
                  setSecIsEnabled(true);
                  setShowAddSectionModal(true);
                }}
                className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-colors uppercase tracking-wider shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Add Section</span>
              </button>
            </div>
          )}

          {activeTab === 'BLOG' && (
            <button
              onClick={() => setShowAddPostModal(true)}
              className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-colors uppercase tracking-wider shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Write Article</span>
            </button>
          )}
        </div>

        {/* Global Success Notification */}
        {saveSuccessMsg && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs rounded-xl flex items-center gap-2 shadow-sm animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{saveSuccessMsg}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-border pb-2 text-xs font-bold overflow-x-auto">
          <button
            onClick={() => setActiveTab('HOMEPAGE')}
            className={`px-4 py-2 rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'HOMEPAGE'
                ? 'bg-primary text-white shadow-sm'
                : 'text-muted hover:text-primary hover:bg-surface-dim'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Homepage Sections ({homepageSections.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('BLOG')}
            className={`px-4 py-2 rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'BLOG'
                ? 'bg-primary text-white shadow-sm'
                : 'text-muted hover:text-primary hover:bg-surface-dim'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Journal & Articles ({posts.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('HERO')}
            className={`px-4 py-2 rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'HERO'
                ? 'bg-primary text-white shadow-sm'
                : 'text-muted hover:text-primary hover:bg-surface-dim'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Hero Banner Details</span>
          </button>

          <button
            onClick={() => setActiveTab('POLICIES')}
            className={`px-4 py-2 rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'POLICIES'
                ? 'bg-primary text-white shadow-sm'
                : 'text-muted hover:text-primary hover:bg-surface-dim'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Legal Policy Parameters</span>
          </button>

          <button
            onClick={() => setActiveTab('CONTACT')}
            className={`px-4 py-2 rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'CONTACT'
                ? 'bg-primary text-white shadow-sm'
                : 'text-muted hover:text-primary hover:bg-surface-dim'
            }`}
          >
            <Phone className="w-4 h-4" />
            <span>Public Contact Page</span>
          </button>

          <button
            onClick={() => setActiveTab('REGISTRATION')}
            className={`px-4 py-2 rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'REGISTRATION'
                ? 'bg-primary text-white shadow-sm'
                : 'text-muted hover:text-primary hover:bg-surface-dim'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>Registration Form Builder ({regSettings?.fields?.length || 6})</span>
          </button>

          <Link
            href="/admin/announcements"
            className="px-4 py-2 rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap text-accent hover:text-accent-hover hover:bg-accent/10 border border-accent/25 ml-auto"
            title="Configure Top Announcement Bar"
          >
            <Bell className="w-4 h-4" />
            <span>Top Announcement Bar &gt;</span>
          </Link>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: HOMEPAGE SECTIONS CMS */}
        {/* ========================================================================= */}
        {activeTab === 'HOMEPAGE' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between text-xs text-muted">
              <p>
                Every section of the homepage is rendered in the order below. Toggle switches instantly show or hide sections on the live storefront. Use ↑ / ↓ to adjust vertical page layout.
              </p>
              <Link
                href="/"
                target="_blank"
                className="inline-flex items-center gap-1.5 text-accent hover:underline font-bold shrink-0 ml-4"
              >
                <span>Preview Live Homepage</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="bg-surface rounded-2xl border border-border overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-border bg-surface-dim/40 text-muted uppercase text-[10px] tracking-wider">
                      <th className="py-3.5 px-4 w-16 text-center">Order</th>
                      <th className="py-3.5 px-4">Section Name & Details</th>
                      <th className="py-3.5 px-4">Section Type</th>
                      <th className="py-3.5 px-4">CTA / Link</th>
                      <th className="py-3.5 px-4">Status & Visibility</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {isLoadingSections && homepageSections.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-muted">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-accent" />
                          Loading homepage layout sections...
                        </td>
                      </tr>
                    ) : (
                      homepageSections.map((sec, idx) => {
                        const isFirst = idx === 0;
                        const isLast = idx === homepageSections.length - 1;

                        return (
                          <tr
                            key={sec.id}
                            className={`hover:bg-surface-dim/30 transition-colors ${
                              !sec.isEnabled ? 'opacity-50 bg-surface-dim/20' : ''
                            }`}
                          >
                            {/* Order & Move Buttons */}
                            <td className="py-3.5 px-4 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <span className="font-mono font-bold text-muted text-xs mr-1">
                                  #{sec.displayOrder}
                                </span>
                                <div className="flex flex-col gap-0.5">
                                  <button
                                    onClick={() => handleMoveSection(sec.id, 'UP')}
                                    disabled={isFirst}
                                    className="p-1 rounded text-muted hover:text-primary hover:bg-surface border border-border disabled:opacity-20 transition-all"
                                    title="Move section up"
                                  >
                                    <ArrowUp className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => handleMoveSection(sec.id, 'DOWN')}
                                    disabled={isLast}
                                    className="p-1 rounded text-muted hover:text-primary hover:bg-surface border border-border disabled:opacity-20 transition-all"
                                    title="Move section down"
                                  >
                                    <ArrowDown className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            </td>

                            {/* Section Details */}
                            <td className="py-3.5 px-4 max-w-sm">
                              {sec.badge && (
                                <span className="text-[9px] font-bold tracking-wider uppercase text-accent bg-accent/10 px-2 py-0.5 rounded-full inline-block mb-1">
                                  {sec.badge}
                                </span>
                              )}
                              <h4 className="font-bold text-primary text-xs line-clamp-1">
                                {sec.title}
                              </h4>
                              <p className="text-[11px] text-muted line-clamp-2 mt-0.5">
                                {sec.subtitle}
                              </p>
                            </td>

                            {/* Type */}
                            <td className="py-3.5 px-4">
                              <span className="font-mono text-[10px] font-bold px-2 py-1 rounded bg-surface-dim border border-border text-primary uppercase">
                                {sec.type}
                              </span>
                            </td>

                            {/* CTA */}
                            <td className="py-3.5 px-4 text-[11px]">
                              {sec.ctaText ? (
                                <span className="font-semibold text-primary block">
                                  {sec.ctaText}
                                  <span className="text-muted block font-mono text-[10px]">
                                    {sec.ctaLink}
                                  </span>
                                </span>
                              ) : (
                                <span className="text-muted">—</span>
                              )}
                            </td>

                            {/* Visibility Toggle Switch */}
                            <td className="py-3.5 px-4">
                              <button
                                onClick={() => handleToggleSection(sec)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all shadow-sm ${
                                  sec.isEnabled
                                    ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                                    : 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-400'
                                }`}
                              >
                                {sec.isEnabled ? (
                                  <>
                                    <Eye className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>VISIBLE ON /</span>
                                  </>
                                ) : (
                                  <>
                                    <EyeOff className="w-3.5 h-3.5 text-zinc-500" />
                                    <span>HIDDEN (OFF)</span>
                                  </>
                                )}
                              </button>
                            </td>

                            {/* Actions */}
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleOpenEditSection(sec)}
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-accent px-2 py-1 rounded hover:bg-surface-dim transition-colors"
                                  title="Edit section content"
                                >
                                  <Edit2 className="w-3 h-3 text-neutral-500" />
                                  <span>Edit</span>
                                </button>

                                <button
                                  onClick={() => setDeletingSectionId(sec.id)}
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700 px-2 py-1 rounded hover:bg-rose-50 transition-colors"
                                  title="Delete section"
                                >
                                  <Trash2 className="w-3 h-3 text-rose-500" />
                                  <span>Delete</span>
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
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: BLOG MANAGER */}
        {/* ========================================================================= */}
        {activeTab === 'BLOG' && (
          <div className="space-y-6">
            <div className="relative max-w-md">
              <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search articles by title, author, or category..."
                className="w-full pl-10 pr-4 py-2 bg-surface border border-border rounded-xl text-xs text-primary focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            <div className="bg-surface rounded-2xl border border-border overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-dim border-b border-border text-muted font-bold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Article Title & Author</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Published Date</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredPosts.map((post) => (
                      <tr key={post.id} className="hover:bg-surface-dim/40 transition-colors">
                        <td className="py-3.5 px-4 max-w-md">
                          <div className="font-bold text-primary text-sm line-clamp-1">
                            {post.title}
                          </div>
                          <div className="text-[11px] text-muted mt-0.5">
                            By {post.authorName} • /{post.slug}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="px-2.5 py-1 rounded-full bg-surface-dim border border-border font-semibold text-primary">
                            {post.category}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <button
                            onClick={() => handleTogglePublish(post.id)}
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase flex items-center gap-1.5 ${
                              post.status === 'PUBLISHED'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                post.status === 'PUBLISHED' ? 'bg-emerald-600' : 'bg-amber-600'
                              }`}
                            />
                            {post.status}
                          </button>
                        </td>

                        <td className="py-3.5 px-4 text-muted">
                          {post.publishedAt
                            ? new Date(post.publishedAt).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })
                            : 'Draft'}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/blog/${post.slug}`}
                              target="_blank"
                              className="p-1.5 text-muted hover:text-primary rounded-lg hover:bg-surface border border-border"
                              title="View Article"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Link>
                          </div>
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
        {/* TAB 3: HERO BANNER DETAILS */}
        {/* ========================================================================= */}
        {activeTab === 'HERO' && (
          <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm space-y-6 max-w-3xl">
            <div>
              <h2 className="font-display text-lg font-bold text-primary">
                Homepage Hero Banner Setup
              </h2>
              <p className="text-xs text-muted mt-1">
                Configure top visual banner imagery, high-impact headlines, and source badge.
              </p>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-primary mb-1">Source Badge</label>
                <input
                  type="text"
                  value={heroConfig.badge}
                  onChange={(e) => setHeroConfig({ ...heroConfig, badge: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-dim border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              <div>
                <label className="block font-semibold text-primary mb-1">Primary Headline</label>
                <input
                  type="text"
                  value={heroConfig.headline}
                  onChange={(e) => setHeroConfig({ ...heroConfig, headline: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-dim border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              <div>
                <label className="block font-semibold text-primary mb-1">Subheadline Copy</label>
                <textarea
                  rows={3}
                  value={heroConfig.subheadline}
                  onChange={(e) => setHeroConfig({ ...heroConfig, subheadline: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-dim border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-primary mb-1">CTA Button Text</label>
                  <input
                    type="text"
                    value={heroConfig.ctaText}
                    onChange={(e) => setHeroConfig({ ...heroConfig, ctaText: e.target.value })}
                    className="w-full px-3 py-2 bg-surface-dim border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-primary mb-1">CTA Target Link</label>
                  <input
                    type="text"
                    value={heroConfig.ctaLink}
                    onChange={(e) => setHeroConfig({ ...heroConfig, ctaLink: e.target.value })}
                    className="w-full px-3 py-2 bg-surface-dim border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-primary mb-1">
                  Background Visual (External HTTPS URL)
                </label>
                <input
                  type="url"
                  value={heroConfig.imageUrl}
                  onChange={(e) => setHeroConfig({ ...heroConfig, imageUrl: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-dim border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              <div className="flex justify-end pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem('infinicharm_cms_hero', JSON.stringify(heroConfig));
                    notifySuccess('Hero banner updated.');
                  }}
                  className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white font-bold rounded-xl flex items-center gap-1.5 shadow-sm"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Hero Configuration</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: LEGAL POLICY PARAMETERS */}
        {/* ========================================================================= */}
        {activeTab === 'POLICIES' && (
          <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm space-y-6 max-w-3xl">
            <div>
              <h2 className="font-display text-lg font-bold text-primary">
                Legal & Operations Policies
              </h2>
              <p className="text-xs text-muted mt-1">
                Configure mandatory consumer protection parameters and dispatch center disclosures.
              </p>
            </div>

            <form onSubmit={handleSavePolicies} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-primary mb-1">
                  Authoritative Dispatch Location (East Champaran Center)
                </label>
                <textarea
                  rows={2}
                  value={dispatchLocation}
                  onChange={(e) => setDispatchLocation(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-dim border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-accent font-mono text-[11px]"
                />
                <p className="text-[11px] text-muted mt-1">
                  Printed on shipping manifests, GST invoices, and delivery labels.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-primary mb-1">
                    Clothing Return Window (Days)
                  </label>
                  <input
                    type="number"
                    value={returnDaysClothing}
                    onChange={(e) => setReturnDaysClothing(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-dim border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                  <p className="text-[11px] text-muted mt-1">
                    Applicable to unworn, tagged apparel only.
                  </p>
                </div>

                <div>
                  <label className="block font-semibold text-primary mb-1">
                    Free Shipping Threshold (INR)
                  </label>
                  <input
                    type="number"
                    value={freeShippingThresholdRupees}
                    onChange={(e) => setFreeShippingThresholdRupees(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-dim border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                  <p className="text-[11px] text-muted mt-1">
                    Server evaluates qualification at ₹4,999.00 (499900 paise).
                  </p>
                </div>
              </div>

              <div className="p-3.5 bg-surface-dim rounded-xl border border-border space-y-1.5 text-muted text-[11px]">
                <strong className="text-primary font-bold block">
                  Mandatory Consumer Protection Disclosures:
                </strong>
                <p>• Food & edible items are non-returnable once opened for public health & hygiene.</p>
                <p>• Grievance Officer: AbdurRahman Ibn Ghufran (support@infinicharm.com).</p>
                <p>• Jurisdiction: Competent courts in Motihari, East Champaran, Bihar.</p>
              </div>

              <div className="flex justify-end pt-4 border-t border-border">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white font-bold rounded-xl flex items-center gap-1.5 shadow-sm"
                >
                  <Save className="w-4 h-4" />
                  <span>Update Policy Parameters</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: PUBLIC CONTACT PAGE CMS                                           */}
        {/* ========================================================================= */}
        {activeTab === 'CONTACT' && (
          <div className="bg-surface rounded-2xl border border-border p-6 sm:p-8 shadow-sm space-y-6 max-w-4xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
              <div>
                <h2 className="font-display text-lg sm:text-xl font-bold text-primary flex items-center gap-2">
                  <Phone className="w-5 h-5 text-accent" />
                  <span>Public Contact Page & Helpline CMS</span>
                </h2>
                <p className="text-xs text-muted mt-1">
                  Manage the authoritative contact number (+91 8825164657), support emails, official addresses, and grievance disclosures displayed on /contact.
                </p>
              </div>
              <Link
                href="/contact"
                target="_blank"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-dim border border-border text-xs font-bold text-primary hover:text-accent hover:border-accent transition-colors shrink-0"
              >
                <span>Preview /contact</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>

            {contactSaveMsg && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{contactSaveMsg}</span>
              </div>
            )}

            {contactSettings ? (
              <form onSubmit={handleSaveContactSettings} className="space-y-6 text-xs">
                {/* 1. Header & Intro */}
                <div className="space-y-3 p-4 rounded-xl bg-surface-dim/40 border border-border">
                  <h3 className="font-bold text-primary uppercase tracking-wider text-[11px]">
                    1. Hero Headline & Page Intro
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-primary mb-1">Badge Tagline</label>
                      <input
                        type="text"
                        value={contactSettings.badge || ''}
                        onChange={(e) =>
                          setContactSettings({ ...contactSettings, badge: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-primary focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-primary mb-1">Page Title</label>
                      <input
                        type="text"
                        value={contactSettings.pageTitle || ''}
                        onChange={(e) =>
                          setContactSettings({ ...contactSettings, pageTitle: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-primary focus:outline-none focus:border-accent font-semibold"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block font-semibold text-primary mb-1">Subtitle / Description</label>
                      <textarea
                        rows={2}
                        value={contactSettings.pageDescription || ''}
                        onChange={(e) =>
                          setContactSettings({ ...contactSettings, pageDescription: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-primary focus:outline-none focus:border-accent"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Official Phone Helpline */}
                <div className="space-y-3 p-4 rounded-xl bg-surface-dim/40 border border-border">
                  <h3 className="font-bold text-primary uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-accent" />
                    <span>2. Official Contact Phone Helpline</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold text-primary mb-1">
                        Primary Phone (E.164 tel: link)
                      </label>
                      <input
                        type="text"
                        value={contactSettings.primaryPhone || ''}
                        onChange={(e) =>
                          setContactSettings({ ...contactSettings, primaryPhone: e.target.value })
                        }
                        placeholder="+91 8825164657"
                        className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-primary font-mono font-bold focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-primary mb-1">Display Label</label>
                      <input
                        type="text"
                        value={contactSettings.displayPhone || ''}
                        onChange={(e) =>
                          setContactSettings({ ...contactSettings, displayPhone: e.target.value })
                        }
                        placeholder="+91 8825164657"
                        className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-primary font-mono focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-primary mb-1">Phone Hours</label>
                      <input
                        type="text"
                        value={contactSettings.phoneHours || ''}
                        onChange={(e) =>
                          setContactSettings({ ...contactSettings, phoneHours: e.target.value })
                        }
                        placeholder="Mon – Sat: 9:00 AM – 7:00 PM IST"
                        className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-primary focus:outline-none focus:border-accent"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Support Email Channels */}
                <div className="space-y-3 p-4 rounded-xl bg-surface-dim/40 border border-border">
                  <h3 className="font-bold text-primary uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-accent" />
                    <span>3. Support Email Channels</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-primary mb-1">Primary Support Email</label>
                      <input
                        type="email"
                        value={contactSettings.supportEmail || ''}
                        onChange={(e) =>
                          setContactSettings({ ...contactSettings, supportEmail: e.target.value })
                        }
                        placeholder="support@infinicharm.com"
                        className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-primary focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-primary mb-1">Inquiry / Escalation Email</label>
                      <input
                        type="email"
                        value={contactSettings.inquiryEmail || ''}
                        onChange={(e) =>
                          setContactSettings({ ...contactSettings, inquiryEmail: e.target.value })
                        }
                        placeholder="support@infinicharm.com"
                        className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-primary focus:outline-none focus:border-accent"
                      />
                    </div>
                  </div>
                </div>

                {/* 4. Physical Addresses */}
                <div className="space-y-3 p-4 rounded-xl bg-surface-dim/40 border border-border">
                  <h3 className="font-bold text-primary uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-accent" />
                    <span>4. Registered Office & Operating Hours</span>
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block font-semibold text-primary mb-1">
                        Registered Office & Fulfillment Address
                      </label>
                      <textarea
                        rows={2}
                        value={contactSettings.registeredOffice || ''}
                        onChange={(e) =>
                          setContactSettings({ ...contactSettings, registeredOffice: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-primary focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-primary mb-1">General Operating Hours</label>
                      <input
                        type="text"
                        value={contactSettings.operatingHours || ''}
                        onChange={(e) =>
                          setContactSettings({ ...contactSettings, operatingHours: e.target.value })
                        }
                        placeholder="Monday to Saturday: 9:00 AM – 7:00 PM IST"
                        className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-primary focus:outline-none focus:border-accent"
                      />
                    </div>
                  </div>
                </div>

                {/* 5. Grievance Officer */}
                <div className="space-y-3 p-4 rounded-xl bg-surface-dim/40 border border-border">
                  <h3 className="font-bold text-primary uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-accent" />
                    <span>5. Consumer Protection Grievance Officer</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-primary mb-1">Officer Name</label>
                      <input
                        type="text"
                        value={contactSettings.grievanceOfficer?.name || ''}
                        onChange={(e) =>
                          setContactSettings({
                            ...contactSettings,
                            grievanceOfficer: {
                              ...contactSettings.grievanceOfficer,
                              name: e.target.value,
                            },
                          })
                        }
                        className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-primary focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-primary mb-1">Designation</label>
                      <input
                        type="text"
                        value={contactSettings.grievanceOfficer?.designation || ''}
                        onChange={(e) =>
                          setContactSettings({
                            ...contactSettings,
                            grievanceOfficer: {
                              ...contactSettings.grievanceOfficer,
                              designation: e.target.value,
                            },
                          })
                        }
                        className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-primary focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-primary mb-1">Officer Email</label>
                      <input
                        type="email"
                        value={contactSettings.grievanceOfficer?.email || ''}
                        onChange={(e) =>
                          setContactSettings({
                            ...contactSettings,
                            grievanceOfficer: {
                              ...contactSettings.grievanceOfficer,
                              email: e.target.value,
                            },
                          })
                        }
                        className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-primary focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-primary mb-1">Officer Helpline</label>
                      <input
                        type="text"
                        value={contactSettings.grievanceOfficer?.phone || ''}
                        onChange={(e) =>
                          setContactSettings({
                            ...contactSettings,
                            grievanceOfficer: {
                              ...contactSettings.grievanceOfficer,
                              phone: e.target.value,
                            },
                          })
                        }
                        className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-primary font-mono focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block font-semibold text-primary mb-1">Acknowledgment SLA</label>
                      <input
                        type="text"
                        value={contactSettings.grievanceOfficer?.responseTime || ''}
                        onChange={(e) =>
                          setContactSettings({
                            ...contactSettings,
                            grievanceOfficer: {
                              ...contactSettings.grievanceOfficer,
                              responseTime: e.target.value,
                            },
                          })
                        }
                        className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-primary focus:outline-none focus:border-accent"
                      />
                    </div>
                  </div>
                </div>

                {/* 6. Section Visibility Toggles */}
                <div className="space-y-3 p-4 rounded-xl bg-surface-dim/40 border border-border">
                  <h3 className="font-bold text-primary uppercase tracking-wider text-[11px]">
                    6. Section Display Toggles
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                      { key: 'showPhone', label: 'Helpline Phone' },
                      { key: 'showEmail', label: 'Support Email' },
                      { key: 'showOffice', label: 'Office Address' },
                      { key: 'showOperatingHours', label: 'Operating Hours' },
                      { key: 'showGrievanceOfficer', label: 'Grievance Officer' },
                      { key: 'showInquiryForm', label: 'Inquiry Form' },
                    ].map(({ key, label }) => {
                      const isVisible =
                        contactSettings.sectionsVisibility?.[key as keyof typeof contactSettings.sectionsVisibility] !==
                        false;
                      return (
                        <label
                          key={key}
                          className="flex items-center gap-2 p-2.5 bg-surface border border-border rounded-lg cursor-pointer hover:border-accent transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={isVisible}
                            onChange={(e) =>
                              setContactSettings({
                                ...contactSettings,
                                sectionsVisibility: {
                                  ...contactSettings.sectionsVisibility,
                                  [key]: e.target.checked,
                                },
                              })
                            }
                            className="rounded border-border text-accent focus:ring-accent"
                          />
                          <span className="font-medium text-primary text-xs">{label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Submit Action */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                  <button
                    type="submit"
                    disabled={isSavingContact}
                    className="px-6 py-2.5 bg-accent hover:bg-accent-hover text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
                  >
                    {isSavingContact ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    <span>{isSavingContact ? 'Saving Changes...' : 'Save Contact Settings'}</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="py-12 text-center text-xs text-muted">Loading contact settings...</div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 6: REGISTRATION FORM BUILDER CMS                                     */}
        {/* ========================================================================= */}
        {activeTab === 'REGISTRATION' && (
          <div className="space-y-6 max-w-5xl">
            {/* Header & Subtitle */}
            <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-lg sm:text-xl font-bold text-primary flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-accent" />
                  <span>Customer Registration Form Architecture</span>
                </h2>
                <p className="text-xs text-muted mt-1 leading-relaxed">
                  Dynamic form builder for customer account registration (<code className="text-primary font-mono bg-surface-dim px-1.5 py-0.5 rounded">/register</code>). Add custom fields, toggle visibility, customize validation, and drag/reorder layout.
                </p>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={handleOpenAddField}
                  className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-xs transition-colors uppercase tracking-wider"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Custom Field</span>
                </button>
                <Link
                  href="/register"
                  target="_blank"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-dim border border-border text-xs font-bold text-primary hover:text-accent hover:border-accent transition-colors"
                >
                  <span>Preview /register</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Notifications */}
            {regSuccessMsg && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{regSuccessMsg}</span>
              </div>
            )}
            {regErrorMsg && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{regErrorMsg}</span>
              </div>
            )}

            {regSettings ? (
              <>
                {/* General Settings */}
                <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm space-y-4">
                  <h3 className="font-display text-sm font-bold text-primary uppercase tracking-wider border-b border-border pb-2.5">
                    Form Copy & Legal Agreement Configuration
                  </h3>
                  <form onSubmit={handleSaveRegGeneralSettings} className="space-y-4 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block font-semibold text-primary mb-1">Page Headline</label>
                        <input
                          type="text"
                          value={regSettings.title}
                          onChange={(e) => setRegSettings({ ...regSettings, title: e.target.value })}
                          className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block font-semibold text-primary mb-1">Page Tagline / Subtitle</label>
                        <input
                          type="text"
                          value={regSettings.subtitle}
                          onChange={(e) => setRegSettings({ ...regSettings, subtitle: e.target.value })}
                          className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block font-semibold text-primary mb-1">Submit Button Label</label>
                        <input
                          type="text"
                          value={regSettings.submitButtonText}
                          onChange={(e) => setRegSettings({ ...regSettings, submitButtonText: e.target.value })}
                          className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-primary mb-1">Terms Link</label>
                        <input
                          type="text"
                          value={regSettings.termsLink}
                          onChange={(e) => setRegSettings({ ...regSettings, termsLink: e.target.value })}
                          className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent font-mono text-[11px]"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-primary mb-1">Privacy Policy Link</label>
                        <input
                          type="text"
                          value={regSettings.privacyLink}
                          onChange={(e) => setRegSettings({ ...regSettings, privacyLink: e.target.value })}
                          className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent font-mono text-[11px]"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-border/60">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={regSettings.termsAgreementRequired}
                          onChange={(e) => setRegSettings({ ...regSettings, termsAgreementRequired: e.target.checked })}
                          className="rounded border-border text-accent focus:ring-accent"
                        />
                        <span className="font-semibold text-primary">Require Customer Agreement to Terms & Privacy Policy</span>
                      </label>

                      <button
                        type="submit"
                        disabled={isSavingReg}
                        className="px-5 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors shadow-xs"
                      >
                        {isSavingReg ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        <span>Save Copy Settings</span>
                      </button>
                    </div>
                  </form>
                </div>

                {/* Form Fields Table */}
                <div className="bg-surface rounded-2xl border border-border overflow-hidden shadow-sm">
                  <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between">
                    <div>
                      <h3 className="font-display text-sm font-bold text-primary uppercase tracking-wider">
                        Form Fields & Sequence Architecture ({regSettings.fields.length} Fields)
                      </h3>
                      <p className="text-[11px] text-muted">
                        Active fields render dynamically on the storefront in the sequence specified below.
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-surface-dim border-b border-border text-muted font-bold uppercase tracking-wider text-[11px]">
                        <tr>
                          <th className="py-3 px-4 w-16 text-center">Order</th>
                          <th className="py-3 px-4">Field Name & Key</th>
                          <th className="py-3 px-4">Field Type</th>
                          <th className="py-3 px-4">Validation</th>
                          <th className="py-3 px-4 text-center">Mandatory</th>
                          <th className="py-3 px-4 text-center">Storefront Status</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {regSettings.fields.map((field, idx) => (
                          <tr key={field.key} className="hover:bg-surface-dim/40 transition-colors">
                            <td className="py-3.5 px-4 text-center font-bold text-muted">
                              <div className="flex items-center justify-center gap-1">
                                <span className="font-mono text-xs">{field.order}</span>
                                <div className="flex flex-col gap-0.5">
                                  <button
                                    type="button"
                                    disabled={idx === 0}
                                    onClick={() => handleMoveField(idx, 'UP')}
                                    className="p-0.5 hover:text-accent disabled:opacity-20 text-muted"
                                    title="Move Up"
                                  >
                                    <ArrowUp className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={idx === regSettings.fields.length - 1}
                                    onClick={() => handleMoveField(idx, 'DOWN')}
                                    className="p-0.5 hover:text-accent disabled:opacity-20 text-muted"
                                    title="Move Down"
                                  >
                                    <ArrowDown className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            </td>

                            <td className="py-3.5 px-4">
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-primary">{field.label}</span>
                                  {field.isSystemField && (
                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-zinc-100 text-zinc-700 border border-zinc-200">
                                      System Critical
                                    </span>
                                  )}
                                </div>
                                <span className="font-mono text-[10px] text-muted block">key: {field.key}</span>
                                {field.description && (
                                  <p className="text-[10px] text-secondary italic max-w-xs truncate">{field.description}</p>
                                )}
                              </div>
                            </td>

                            <td className="py-3.5 px-4">
                              <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-surface-dim border border-border text-primary">
                                {field.type}
                              </span>
                              {field.options && field.options.length > 0 && (
                                <span className="text-[10px] text-muted block mt-1 font-mono">
                                  {field.options.length} options configured
                                </span>
                              )}
                            </td>

                            <td className="py-3.5 px-4">
                              <div className="text-[11px] text-muted space-y-0.5">
                                {field.validation?.minLength && (
                                  <span>min: {field.validation.minLength} chars </span>
                                )}
                                {field.validation?.maxLength && (
                                  <span>max: {field.validation.maxLength} chars </span>
                                )}
                                {field.validation?.pattern && (
                                  <span className="block font-mono text-[9px] text-accent truncate max-w-[120px]" title={field.validation.pattern}>
                                    regex: {field.validation.pattern}
                                  </span>
                                )}
                                {!field.validation?.minLength && !field.validation?.maxLength && !field.validation?.pattern && (
                                  <span className="italic text-muted">Standard</span>
                                )}
                              </div>
                            </td>

                            <td className="py-3.5 px-4 text-center">
                              {field.isSystemField && ['fullName', 'email', 'password', 'confirmPassword'].includes(field.key) ? (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800">
                                  Required (Locked)
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleToggleFieldRequired(field)}
                                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors ${
                                    field.required
                                      ? 'bg-rose-100 text-rose-800'
                                      : 'bg-surface-dim text-muted hover:text-primary'
                                  }`}
                                >
                                  {field.required ? 'Required' : 'Optional'}
                                </button>
                              )}
                            </td>

                            <td className="py-3.5 px-4 text-center">
                              <button
                                type="button"
                                onClick={() => handleToggleFieldEnabled(field)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors ${
                                  field.isEnabled
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-zinc-100 text-zinc-500 hover:text-primary'
                                }`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${field.isEnabled ? 'bg-emerald-600' : 'bg-zinc-400'}`} />
                                <span>{field.isEnabled ? 'Active' : 'Disabled'}</span>
                              </button>
                            </td>

                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditField(field)}
                                  className="p-1.5 hover:bg-surface-dim text-primary rounded-lg transition-colors"
                                  title="Edit field settings"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                {!field.isSystemField ? (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteField(field.key)}
                                    className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg transition-colors"
                                    title="Delete custom field"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                ) : (
                                  <span className="p-1.5 text-muted opacity-30 cursor-not-allowed" title="System field cannot be deleted">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-12 text-center text-xs text-muted">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-accent" />
                <span>Loading registration form configuration...</span>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL: EDIT HOMEPAGE SECTION */}
        {/* ========================================================================= */}
        {editingSection && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-surface border border-border rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted">
                    Homepage CMS Editor
                  </span>
                  <h3 className="font-display text-lg font-bold text-primary">
                    Edit: {editingSection.title}
                  </h3>
                </div>
                <button
                  onClick={() => setEditingSection(null)}
                  className="p-1 text-muted hover:text-primary rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveSectionEdit} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-primary mb-1">Section Title *</label>
                  <input
                    type="text"
                    required
                    value={secTitle}
                    onChange={(e) => setSecTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-primary mb-1">Subtitle / Description</label>
                  <textarea
                    rows={3}
                    value={secSubtitle}
                    onChange={(e) => setSecSubtitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-primary mb-1">Badge Text (Optional)</label>
                    <input
                      type="text"
                      value={secBadge}
                      onChange={(e) => setSecBadge(e.target.value)}
                      placeholder="e.g. HIGH DEMAND"
                      className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-primary mb-1">Visibility Status</label>
                    <select
                      value={secIsEnabled ? 'true' : 'false'}
                      onChange={(e) => setSecIsEnabled(e.target.value === 'true')}
                      className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    >
                      <option value="true">Enabled (Visible on Homepage)</option>
                      <option value="false">Disabled (Hidden)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-primary mb-1">Primary CTA Button Text</label>
                    <input
                      type="text"
                      value={secCtaText}
                      onChange={(e) => setSecCtaText(e.target.value)}
                      placeholder="e.g. Explore Collections"
                      className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-primary mb-1">Primary CTA Target Link</label>
                    <input
                      type="text"
                      value={secCtaLink}
                      onChange={(e) => setSecCtaLink(e.target.value)}
                      placeholder="e.g. /shop"
                      className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-primary mb-1">Secondary CTA Text</label>
                    <input
                      type="text"
                      value={secSecondaryCtaText}
                      onChange={(e) => setSecSecondaryCtaText(e.target.value)}
                      placeholder="e.g. Our Sourcing Story"
                      className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-primary mb-1">Secondary CTA Target Link</label>
                    <input
                      type="text"
                      value={secSecondaryCtaLink}
                      onChange={(e) => setSecSecondaryCtaLink(e.target.value)}
                      placeholder="e.g. /about"
                      className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-primary mb-1">Media Visual (External HTTPS URL)</label>
                  <input
                    type="url"
                    value={secImageUrl}
                    onChange={(e) => setSecImageUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                  />
                </div>

                {/* Hero Section Dynamic Showcase Manager */}
                {Boolean((editingSection && editingSection.type === 'hero') || secType === 'hero') && (
                  <div className="p-4 bg-surface-dim/60 rounded-2xl border border-border space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-accent" />
                        <div>
                          <span className="font-bold text-primary text-xs block">
                            Hero Visual Showcase &amp; Mosaic Cards
                          </span>
                          <span className="text-[10px] text-muted block">
                            Configure the 3 interactive showcase cards (Main Large Left, Top Right, Bottom Right) or add custom promotions.
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleOpenAddHeroItem}
                        className="px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-xl text-[11px] font-bold inline-flex items-center gap-1.5 shadow-xs transition-colors shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Hero Card</span>
                      </button>
                    </div>

                    {/* Cards List */}
                    <div className="space-y-2.5">
                      {secHeroItems.length === 0 ? (
                        <div className="p-4 rounded-xl border border-dashed border-border bg-surface text-center">
                          <p className="text-muted text-xs">No hero showcase cards configured.</p>
                          <button
                            type="button"
                            onClick={handleOpenAddHeroItem}
                            className="mt-2 text-accent font-bold text-xs hover:underline"
                          >
                            + Add Your First Hero Card
                          </button>
                        </div>
                      ) : (
                        secHeroItems.map((item, idx) => (
                          <div
                            key={item.id}
                            className={`p-3 rounded-xl border bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                              item.isEnabled !== false ? 'border-border' : 'border-border/60 opacity-60'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-12 h-12 rounded-lg bg-surface-dim overflow-hidden shrink-0 border border-border relative">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={item.imageUrl}
                                  alt={item.title}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                                      item.position === 'featured'
                                        ? 'bg-accent/15 text-accent'
                                        : item.position === 'secondary_top'
                                        ? 'bg-blue-500/15 text-blue-600'
                                        : 'bg-emerald-500/15 text-emerald-600'
                                    }`}
                                  >
                                    {item.position === 'featured'
                                      ? 'Main Featured (Left)'
                                      : item.position === 'secondary_top'
                                      ? 'Top Right Card'
                                      : item.position === 'secondary_bottom'
                                      ? 'Bottom Right Card'
                                      : 'Showcase Grid'}
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded bg-surface-dim text-primary text-[9px] font-semibold border border-border uppercase">
                                    {item.type}
                                  </span>
                                  {item.badge && (
                                    <span className="text-[10px] text-muted font-medium truncate">
                                      • {item.badge}
                                    </span>
                                  )}
                                </div>
                                <h5 className="font-bold text-primary text-xs truncate">{item.title}</h5>
                                <div className="flex items-center gap-2 text-[10px] text-muted">
                                  {item.priceDisplay && <span className="font-mono font-bold text-primary">{item.priceDisplay}</span>}
                                  <span className="truncate">→ {item.linkUrl}</span>
                                </div>
                              </div>
                            </div>

                            {/* Item Actions */}
                            <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                              {/* Move Up */}
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => handleMoveHeroItem(idx, 'up')}
                                className="p-1.5 text-muted hover:text-primary disabled:opacity-30 rounded-lg hover:bg-surface-dim border border-border"
                                title="Move Up"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              {/* Move Down */}
                              <button
                                type="button"
                                disabled={idx === secHeroItems.length - 1}
                                onClick={() => handleMoveHeroItem(idx, 'down')}
                                className="p-1.5 text-muted hover:text-primary disabled:opacity-30 rounded-lg hover:bg-surface-dim border border-border"
                                title="Move Down"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                              {/* Duplicate */}
                              <button
                                type="button"
                                onClick={() => handleDuplicateHeroItem(item.id)}
                                className="p-1.5 text-muted hover:text-primary rounded-lg hover:bg-surface-dim border border-border"
                                title="Duplicate Card"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              {/* Active/Inactive Toggle */}
                              <button
                                type="button"
                                onClick={() => handleToggleHeroItem(item.id)}
                                className={`p-1.5 rounded-lg border transition-colors ${
                                  item.isEnabled !== false
                                    ? 'text-state-success border-state-success/30 bg-state-success/10'
                                    : 'text-muted border-border hover:bg-surface-dim'
                                }`}
                                title={item.isEnabled !== false ? 'Active (Click to Hide)' : 'Hidden (Click to Activate)'}
                              >
                                {item.isEnabled !== false ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                              </button>
                              {/* Edit */}
                              <button
                                type="button"
                                onClick={() => handleOpenEditHeroItem(item)}
                                className="p-1.5 text-muted hover:text-primary rounded-lg hover:bg-surface-dim border border-border"
                                title="Edit Card"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              {/* Delete */}
                              <button
                                type="button"
                                onClick={() => handleDeleteHeroItem(item.id)}
                                className="p-1.5 text-state-error/70 hover:text-state-error rounded-lg hover:bg-state-error/10 border border-state-error/20"
                                title="Delete Card"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Product Section Dynamic Inventory Controller */}
                {Boolean((editingSection && ['best_sellers', 'kirana_packs', 'flash_deals', 'tabbed_spotlight', 'custom'].includes(editingSection.type)) || ['best_sellers', 'kirana_packs', 'flash_deals', 'tabbed_spotlight', 'custom'].includes(secType)) && (
                  <div className="p-4 bg-surface-dim/60 rounded-2xl border border-border space-y-3.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-accent" />
                        <span className="font-bold text-primary text-xs">
                          Product Assignment &amp; Selection Mode
                        </span>
                      </div>
                      <span className="text-[10px] font-mono bg-accent/10 text-accent font-semibold px-2 py-0.5 rounded-full">
                        {secSelectionMode === 'sales'
                          ? 'Sales Performance'
                          : secSelectionMode === 'manual'
                          ? 'Manual Selection'
                          : 'Category-Based'}
                      </span>
                    </div>

                    {/* Mode Radio Buttons */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setSecSelectionMode('sales')}
                        className={`p-2.5 rounded-xl border text-left flex items-start gap-2 transition-all ${
                          secSelectionMode === 'sales'
                            ? 'border-accent bg-accent/5 shadow-xs'
                            : 'border-border bg-surface hover:bg-surface-dim'
                        }`}
                      >
                        <div
                          className={`w-3.5 h-3.5 rounded-full mt-0.5 border flex items-center justify-center shrink-0 ${
                            secSelectionMode === 'sales' ? 'border-accent bg-accent' : 'border-muted'
                          }`}
                        >
                          {secSelectionMode === 'sales' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <div>
                          <p className="font-bold text-primary text-[11px]">Dynamic Sales Ranking</p>
                          <p className="text-[10px] text-muted">Auto-sorts by total units sold</p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSecSelectionMode('manual')}
                        className={`p-2.5 rounded-xl border text-left flex items-start gap-2 transition-all ${
                          secSelectionMode === 'manual'
                            ? 'border-accent bg-accent/5 shadow-xs'
                            : 'border-border bg-surface hover:bg-surface-dim'
                        }`}
                      >
                        <div
                          className={`w-3.5 h-3.5 rounded-full mt-0.5 border flex items-center justify-center shrink-0 ${
                            secSelectionMode === 'manual' ? 'border-accent bg-accent' : 'border-muted'
                          }`}
                        >
                          {secSelectionMode === 'manual' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <div>
                          <p className="font-bold text-primary text-[11px]">Manual Product Selection</p>
                          <p className="text-[10px] text-muted">Pick and reorder exact products</p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSecSelectionMode('category')}
                        className={`p-2.5 rounded-xl border text-left flex items-start gap-2 transition-all ${
                          secSelectionMode === 'category'
                            ? 'border-accent bg-accent/5 shadow-xs'
                            : 'border-border bg-surface hover:bg-surface-dim'
                        }`}
                      >
                        <div
                          className={`w-3.5 h-3.5 rounded-full mt-0.5 border flex items-center justify-center shrink-0 ${
                            secSelectionMode === 'category' ? 'border-accent bg-accent' : 'border-muted'
                          }`}
                        >
                          {secSelectionMode === 'category' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <div>
                          <p className="font-bold text-primary text-[11px]">Category-Based Auto Feed</p>
                          <p className="text-[10px] text-muted">Feed from a category up to limit</p>
                        </div>
                      </button>
                    </div>

                    {/* Product Limit & CTA Button Text Inputs */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold text-primary mb-1">
                          Display Product Limit (Max Cards to Show, up to 99)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={99}
                          value={secProductLimit}
                          onChange={(e) => setSecProductLimit(parseInt(e.target.value || '99', 10))}
                          className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-primary text-xs"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-primary mb-1">
                          Product Card CTA Button Text
                        </label>
                        <input
                          type="text"
                          value={secButtonText}
                          onChange={(e) => setSecButtonText(e.target.value)}
                          placeholder="e.g. Add to Bag, Add to Cart, Buy Now"
                          className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-primary text-xs"
                        />
                      </div>
                    </div>

                    {secSelectionMode === 'category' ? (
                      <div>
                        <label className="block font-semibold text-primary mb-1">Source Category</label>
                        <select
                          value={secSelectedCategoryId}
                          onChange={(e) => setSecSelectedCategoryId(e.target.value)}
                          className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-primary text-xs"
                        >
                          <option value="ALL">All Categories (Global Catalog)</option>
                          {allCategoriesList.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name} ({cat.slug})
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        <label className="block font-semibold text-primary">
                          Assigned Products ({secSelectedProductIds.length} selected, max {secProductLimit} shown)
                        </label>

                        {/* Selected items list with reorder Up / Down & Remove */}
                        {secSelectedProductIds.length > 0 && (
                          <div className="space-y-1.5 max-h-40 overflow-y-auto border border-border rounded-xl p-2 bg-surface">
                            {secSelectedProductIds.map((pid, idx) => {
                              const prod = catalogueProducts.find((p) => p.id === pid);
                              if (!prod) return null;
                              return (
                                <div
                                  key={pid}
                                  className="flex items-center justify-between p-1.5 rounded-lg bg-surface-dim border border-border/60 text-[11px]"
                                >
                                  <div className="flex items-center gap-2 truncate">
                                    <span className="font-mono text-[10px] text-muted w-4">#{idx + 1}</span>
                                    <span className="font-semibold text-primary truncate max-w-[200px]">
                                      {prod.title}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      disabled={idx === 0}
                                      onClick={() => {
                                        const copy = [...secSelectedProductIds];
                                        const temp = copy[idx - 1];
                                        copy[idx - 1] = copy[idx];
                                        copy[idx] = temp;
                                        setSecSelectedProductIds(copy);
                                      }}
                                      className="p-1 hover:text-accent disabled:opacity-30"
                                      title="Move Up"
                                    >
                                      <ArrowUp className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={idx === secSelectedProductIds.length - 1}
                                      onClick={() => {
                                        const copy = [...secSelectedProductIds];
                                        const temp = copy[idx + 1];
                                        copy[idx + 1] = copy[idx];
                                        copy[idx] = temp;
                                        setSecSelectedProductIds(copy);
                                      }}
                                      className="p-1 hover:text-accent disabled:opacity-30"
                                      title="Move Down"
                                    >
                                      <ArrowDown className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setSecSelectedProductIds((prev) => prev.filter((id) => id !== pid))
                                      }
                                      className="p-1 text-red-500 hover:text-red-700"
                                      title="Remove"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Search & Add Products */}
                        <div className="space-y-1.5">
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 text-muted absolute left-3 top-2.5" />
                            <input
                              type="text"
                              value={productSearchTerm}
                              onChange={(e) => setProductSearchTerm(e.target.value)}
                              placeholder="Search products to add..."
                              className="w-full pl-8 pr-3 py-1.5 bg-surface border border-border rounded-xl text-[11px] text-primary"
                            />
                          </div>

                          <div className="max-h-36 overflow-y-auto space-y-1 border border-border/80 rounded-xl p-1.5 bg-surface">
                            {catalogueProducts
                              .filter((p) => p.status === 'PUBLISHED')
                              .filter(
                                (p) =>
                                  !productSearchTerm.trim() ||
                                  p.title.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
                                  p.brand.toLowerCase().includes(productSearchTerm.toLowerCase())
                              )
                              .map((p) => {
                                const isSelected = secSelectedProductIds.includes(p.id);
                                return (
                                  <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => {
                                      if (isSelected) {
                                        setSecSelectedProductIds((prev) => prev.filter((id) => id !== p.id));
                                      } else {
                                        setSecSelectedProductIds((prev) => [...prev, p.id]);
                                      }
                                    }}
                                    className={`w-full flex items-center justify-between p-1.5 rounded-lg text-left text-[11px] transition-colors ${
                                      isSelected
                                        ? 'bg-accent/10 text-accent font-bold'
                                        : 'hover:bg-surface-dim text-primary'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 truncate">
                                      <div
                                        className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                                          isSelected ? 'bg-accent border-accent text-white' : 'border-muted'
                                        }`}
                                      >
                                        {isSelected && <CheckCircle2 className="w-3 h-3" />}
                                      </div>
                                      <span className="truncate">{p.title}</span>
                                    </div>
                                    <span className="text-[10px] font-mono text-muted shrink-0">
                                      {p.variants[0] ? `₹${p.variants[0].priceInPaise / 100}` : '—'}
                                    </span>
                                  </button>
                                );
                              })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Dynamic Category Management Controller */}
                {Boolean((editingSection && ['categories', 'departments'].includes(editingSection.type)) || ['categories', 'departments'].includes(secType)) && (
                  <div className="p-4 bg-surface-dim/60 rounded-2xl border border-border space-y-3.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-accent" />
                        <span className="font-bold text-primary text-xs">
                          Approved Homepage Categories Configuration
                        </span>
                      </div>
                      <Link
                        href="/admin/categories"
                        className="text-[10px] font-bold text-accent hover:underline flex items-center gap-1"
                      >
                        <span>Manage Global Taxonomy</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                    <p className="text-[11px] text-muted">
                      Configure the category banners, titles, descriptions, badges, and linked paths displayed dynamically on the homepage grid.
                    </p>

                    <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                      {secCategories.map((cat, idx) => (
                        <div key={cat.id || idx} className="p-3 bg-surface rounded-xl border border-border space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-primary text-xs">{cat.name} ({cat.slug})</span>
                            <span className="text-[10px] font-mono text-muted">Order #{idx + 1}</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-muted mb-0.5">Display Title</label>
                              <input
                                type="text"
                                value={cat.name}
                                onChange={(e) => {
                                  const updated = [...secCategories];
                                  updated[idx] = { ...updated[idx], name: e.target.value };
                                  setSecCategories(updated);
                                }}
                                className="w-full px-2.5 py-1.5 bg-surface-dim border border-border rounded-lg text-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-muted mb-0.5">Badge (e.g. Verified Pure)</label>
                              <input
                                type="text"
                                value={cat.badge || ''}
                                onChange={(e) => {
                                  const updated = [...secCategories];
                                  updated[idx] = { ...updated[idx], badge: e.target.value };
                                  setSecCategories(updated);
                                }}
                                className="w-full px-2.5 py-1.5 bg-surface-dim border border-border rounded-lg text-xs"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-muted mb-0.5">Tagline / Short Description</label>
                            <input
                              type="text"
                              value={cat.tagline || ''}
                              onChange={(e) => {
                                const updated = [...secCategories];
                                updated[idx] = { ...updated[idx], tagline: e.target.value };
                                setSecCategories(updated);
                              }}
                              className="w-full px-2.5 py-1.5 bg-surface-dim border border-border rounded-lg text-xs"
                            />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-muted mb-0.5">Banner Image URL</label>
                              <input
                                type="url"
                                value={cat.imageUrl || ''}
                                onChange={(e) => {
                                  const updated = [...secCategories];
                                  updated[idx] = { ...updated[idx], imageUrl: e.target.value };
                                  setSecCategories(updated);
                                }}
                                className="w-full px-2.5 py-1.5 bg-surface-dim border border-border rounded-lg text-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-muted mb-0.5">Linked Target Path</label>
                              <input
                                type="text"
                                value={cat.linkUrl || `/shop?category=${cat.slug}`}
                                onChange={(e) => {
                                  const updated = [...secCategories];
                                  updated[idx] = { ...updated[idx], linkUrl: e.target.value };
                                  setSecCategories(updated);
                                }}
                                className="w-full px-2.5 py-1.5 bg-surface-dim border border-border rounded-lg text-xs"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* DYNAMIC EDITOR: SPOTLIGHT STORY SECTION */}
                {editingSection.type === 'deg_bhapka' && (
                  <div className="p-4 bg-surface-dim/60 rounded-2xl border border-border space-y-3">
                    <span className="font-bold text-primary text-xs block">
                      Spotlight Floating Card &amp; Feature Highlights
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block font-semibold text-primary mb-1">Floating Card Badge</label>
                        <input
                          type="text"
                          value={secSpotlightFloatingBadge}
                          onChange={(e) => setSecSpotlightFloatingBadge(e.target.value)}
                          placeholder="e.g. East Champaran, Bihar Dispatch"
                          className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-primary text-xs"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-primary mb-1">Floating Card Description</label>
                        <input
                          type="text"
                          value={secSpotlightFloatingText}
                          onChange={(e) => setSecSpotlightFloatingText(e.target.value)}
                          placeholder="Short quality assurance statement"
                          className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-primary text-xs"
                        />
                      </div>
                    </div>

                    <div className="space-y-2 pt-1">
                      <span className="text-[11px] font-bold text-muted uppercase tracking-wider block">
                        Spotlight Highlight Cards ({secSpotlightCards.length})
                      </span>
                      {secSpotlightCards.map((card, cIdx) => (
                        <div key={cIdx} className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2.5 bg-surface rounded-xl border border-border">
                          <input
                            type="text"
                            value={card.title}
                            onChange={(e) => {
                              const copy = [...secSpotlightCards];
                              copy[cIdx] = { ...copy[cIdx], title: e.target.value };
                              setSecSpotlightCards(copy);
                            }}
                            placeholder="Card Title"
                            className="px-2.5 py-1.5 bg-surface-dim border border-border rounded-lg text-xs text-primary font-semibold"
                          />
                          <input
                            type="text"
                            value={card.description}
                            onChange={(e) => {
                              const copy = [...secSpotlightCards];
                              copy[cIdx] = { ...copy[cIdx], description: e.target.value };
                              setSecSpotlightCards(copy);
                            }}
                            placeholder="Card Description"
                            className="px-2.5 py-1.5 bg-surface-dim border border-border rounded-lg text-xs text-primary"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* DYNAMIC EDITOR: SOURCING & PRODUCT ORIGIN HIGHLIGHTS */}
                {editingSection.type === 'sourcing_centers' && (
                  <div className="p-4 bg-surface-dim/60 rounded-2xl border border-border space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-primary text-xs">
                        Origin &amp; Catalogue Highlight Cards ({secCenterCards.length})
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setSecCenterCards((prev) => [
                            ...prev,
                            {
                              id: `cc-${Date.now()}`,
                              title: 'New Catalogue Highlight',
                              location: 'East Champaran, Bihar - 845427',
                              description: 'Approved InfiniCharm catalogue item.',
                              imageUrl: '',
                              specLeft: '100% Pure',
                              specRight: 'Verified',
                              linkUrl: '/shop',
                              ctaText: 'View Product',
                            },
                          ])
                        }
                        className="px-2.5 py-1 rounded-lg bg-accent/10 text-accent text-[11px] font-bold hover:bg-accent/20"
                      >
                        + Add Highlight Card
                      </button>
                    </div>
                    <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                      {secCenterCards.map((card, cIdx) => (
                        <div key={cIdx} className="p-3 bg-surface rounded-xl border border-border space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono font-bold text-muted">
                              Highlight #{cIdx + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setSecCenterCards((prev) => prev.filter((_, i) => i !== cIdx))
                              }
                              className="text-[10px] text-red-600 hover:underline font-semibold"
                            >
                              Remove
                            </button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={card.title}
                              onChange={(e) => {
                                const copy = [...secCenterCards];
                                copy[cIdx] = { ...copy[cIdx], title: e.target.value };
                                setSecCenterCards(copy);
                              }}
                              placeholder="Title"
                              className="px-2.5 py-1.5 bg-surface-dim border border-border rounded-lg text-xs text-primary font-semibold"
                            />
                            <input
                              type="text"
                              value={card.location}
                              onChange={(e) => {
                                const copy = [...secCenterCards];
                                copy[cIdx] = { ...copy[cIdx], location: e.target.value };
                                setSecCenterCards(copy);
                              }}
                              placeholder="Location / Subtitle"
                              className="px-2.5 py-1.5 bg-surface-dim border border-border rounded-lg text-xs text-primary"
                            />
                          </div>
                          <input
                            type="text"
                            value={card.imageUrl}
                            onChange={(e) => {
                              const copy = [...secCenterCards];
                              copy[cIdx] = { ...copy[cIdx], imageUrl: e.target.value };
                              setSecCenterCards(copy);
                            }}
                            placeholder="External Image URL"
                            className="w-full px-2.5 py-1.5 bg-surface-dim border border-border rounded-lg text-xs text-primary font-mono"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={card.linkUrl}
                              onChange={(e) => {
                                const copy = [...secCenterCards];
                                copy[cIdx] = { ...copy[cIdx], linkUrl: e.target.value };
                                setSecCenterCards(copy);
                              }}
                              placeholder="Link URL (e.g. /product/...)"
                              className="px-2.5 py-1.5 bg-surface-dim border border-border rounded-lg text-xs text-primary font-mono"
                            />
                            <input
                              type="text"
                              value={card.ctaText}
                              onChange={(e) => {
                                const copy = [...secCenterCards];
                                copy[cIdx] = { ...copy[cIdx], ctaText: e.target.value };
                                setSecCenterCards(copy);
                              }}
                              placeholder="Button Text"
                              className="px-2.5 py-1.5 bg-surface-dim border border-border rounded-lg text-xs text-primary"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2.5 pt-4 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setEditingSection(null)}
                    className="px-5 py-2.5 bg-surface-dim hover:bg-border text-primary rounded-xl font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-accent hover:bg-accent-hover text-white font-bold rounded-xl shadow-sm"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL: ADD HOMEPAGE SECTION */}
        {/* ========================================================================= */}
        {showAddSectionModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-surface border border-border rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted">
                    Homepage CMS
                  </span>
                  <h3 className="font-display text-lg font-bold text-primary">
                    Create New Homepage Section
                  </h3>
                </div>
                <button
                  onClick={() => setShowAddSectionModal(false)}
                  className="p-1 text-muted hover:text-primary rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateSection} className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-primary mb-1">Section Type *</label>
                    <select
                      value={secType}
                      onChange={(e) => setSecType(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    >
                      <option value="custom">Custom Content Section</option>
                      <option value="hero">Hero Banner</option>
                      <option value="best_sellers">Best-Selling Products Section</option>
                      <option value="categories">Categories Grid</option>
                      <option value="flash_deals">Flash Deals Spotlight</option>
                      <option value="tabbed_spotlight">Tabbed Spotlight</option>
                      <option value="deg_bhapka">Craft &amp; Nutrition Spotlight</option>
                      <option value="kirana_packs">Kirana Bundles</option>
                      <option value="sourcing_centers">Sourcing Centers Map</option>
                      <option value="values_strip">Values & Guarantees</option>
                      <option value="journal_preview">Journal Preview</option>
                      <option value="newsletter">Newsletter Circle</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-primary mb-1">Badge Text</label>
                    <input
                      type="text"
                      value={secBadge}
                      onChange={(e) => setSecBadge(e.target.value)}
                      placeholder="e.g. SPECIAL CURATION"
                      className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-primary mb-1">Section Title *</label>
                  <input
                    type="text"
                    required
                    value={secTitle}
                    onChange={(e) => setSecTitle(e.target.value)}
                    placeholder="e.g. Direct Mustard Harvest Showcase"
                    className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-primary mb-1">Subtitle / Description</label>
                  <textarea
                    rows={2}
                    value={secSubtitle}
                    onChange={(e) => setSecSubtitle(e.target.value)}
                    placeholder="Descriptive copy for this section..."
                    className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-primary mb-1">CTA Button Text</label>
                    <input
                      type="text"
                      value={secCtaText}
                      onChange={(e) => setSecCtaText(e.target.value)}
                      placeholder="e.g. Explore"
                      className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-primary mb-1">CTA Target Link</label>
                    <input
                      type="text"
                      value={secCtaLink}
                      onChange={(e) => setSecCtaLink(e.target.value)}
                      placeholder="e.g. /shop"
                      className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-primary mb-1">Media Visual (External HTTPS URL)</label>
                  <input
                    type="url"
                    value={secImageUrl}
                    onChange={(e) => setSecImageUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                  />
                </div>

                {/* Hero Section Dynamic Showcase Manager */}
                {Boolean((editingSection && editingSection.type === 'hero') || secType === 'hero') && (
                  <div className="p-4 bg-surface-dim/60 rounded-2xl border border-border space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-accent" />
                        <div>
                          <span className="font-bold text-primary text-xs block">
                            Hero Visual Showcase &amp; Mosaic Cards
                          </span>
                          <span className="text-[10px] text-muted block">
                            Configure the 3 interactive showcase cards (Main Large Left, Top Right, Bottom Right) or add custom promotions.
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleOpenAddHeroItem}
                        className="px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-xl text-[11px] font-bold inline-flex items-center gap-1.5 shadow-xs transition-colors shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Hero Card</span>
                      </button>
                    </div>

                    {/* Cards List */}
                    <div className="space-y-2.5">
                      {secHeroItems.length === 0 ? (
                        <div className="p-4 rounded-xl border border-dashed border-border bg-surface text-center">
                          <p className="text-muted text-xs">No hero showcase cards configured.</p>
                          <button
                            type="button"
                            onClick={handleOpenAddHeroItem}
                            className="mt-2 text-accent font-bold text-xs hover:underline"
                          >
                            + Add Your First Hero Card
                          </button>
                        </div>
                      ) : (
                        secHeroItems.map((item, idx) => (
                          <div
                            key={item.id}
                            className={`p-3 rounded-xl border bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                              item.isEnabled !== false ? 'border-border' : 'border-border/60 opacity-60'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-12 h-12 rounded-lg bg-surface-dim overflow-hidden shrink-0 border border-border relative">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={item.imageUrl}
                                  alt={item.title}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                                      item.position === 'featured'
                                        ? 'bg-accent/15 text-accent'
                                        : item.position === 'secondary_top'
                                        ? 'bg-blue-500/15 text-blue-600'
                                        : 'bg-emerald-500/15 text-emerald-600'
                                    }`}
                                  >
                                    {item.position === 'featured'
                                      ? 'Main Featured (Left)'
                                      : item.position === 'secondary_top'
                                      ? 'Top Right Card'
                                      : item.position === 'secondary_bottom'
                                      ? 'Bottom Right Card'
                                      : 'Showcase Grid'}
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded bg-surface-dim text-primary text-[9px] font-semibold border border-border uppercase">
                                    {item.type}
                                  </span>
                                  {item.badge && (
                                    <span className="text-[10px] text-muted font-medium truncate">
                                      • {item.badge}
                                    </span>
                                  )}
                                </div>
                                <h5 className="font-bold text-primary text-xs truncate">{item.title}</h5>
                                <div className="flex items-center gap-2 text-[10px] text-muted">
                                  {item.priceDisplay && <span className="font-mono font-bold text-primary">{item.priceDisplay}</span>}
                                  <span className="truncate">→ {item.linkUrl}</span>
                                </div>
                              </div>
                            </div>

                            {/* Item Actions */}
                            <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                              {/* Move Up */}
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => handleMoveHeroItem(idx, 'up')}
                                className="p-1.5 text-muted hover:text-primary disabled:opacity-30 rounded-lg hover:bg-surface-dim border border-border"
                                title="Move Up"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              {/* Move Down */}
                              <button
                                type="button"
                                disabled={idx === secHeroItems.length - 1}
                                onClick={() => handleMoveHeroItem(idx, 'down')}
                                className="p-1.5 text-muted hover:text-primary disabled:opacity-30 rounded-lg hover:bg-surface-dim border border-border"
                                title="Move Down"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                              {/* Duplicate */}
                              <button
                                type="button"
                                onClick={() => handleDuplicateHeroItem(item.id)}
                                className="p-1.5 text-muted hover:text-primary rounded-lg hover:bg-surface-dim border border-border"
                                title="Duplicate Card"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              {/* Active/Inactive Toggle */}
                              <button
                                type="button"
                                onClick={() => handleToggleHeroItem(item.id)}
                                className={`p-1.5 rounded-lg border transition-colors ${
                                  item.isEnabled !== false
                                    ? 'text-state-success border-state-success/30 bg-state-success/10'
                                    : 'text-muted border-border hover:bg-surface-dim'
                                }`}
                                title={item.isEnabled !== false ? 'Active (Click to Hide)' : 'Hidden (Click to Activate)'}
                              >
                                {item.isEnabled !== false ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                              </button>
                              {/* Edit */}
                              <button
                                type="button"
                                onClick={() => handleOpenEditHeroItem(item)}
                                className="p-1.5 text-muted hover:text-primary rounded-lg hover:bg-surface-dim border border-border"
                                title="Edit Card"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              {/* Delete */}
                              <button
                                type="button"
                                onClick={() => handleDeleteHeroItem(item.id)}
                                className="p-1.5 text-state-error/70 hover:text-state-error rounded-lg hover:bg-state-error/10 border border-state-error/20"
                                title="Delete Card"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Product Section Dynamic Inventory Controller */}
                {Boolean((editingSection && ['best_sellers', 'kirana_packs', 'flash_deals', 'tabbed_spotlight', 'custom'].includes(editingSection.type)) || ['best_sellers', 'kirana_packs', 'flash_deals', 'tabbed_spotlight', 'custom'].includes(secType)) && (
                  <div className="p-4 bg-surface-dim/60 rounded-2xl border border-border space-y-3.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-accent" />
                        <span className="font-bold text-primary text-xs">
                          Product Assignment &amp; Selection Mode
                        </span>
                      </div>
                      <span className="text-[10px] font-mono bg-accent/10 text-accent font-semibold px-2 py-0.5 rounded-full">
                        {secSelectionMode === 'sales'
                          ? 'Sales Performance'
                          : secSelectionMode === 'manual'
                          ? 'Manual Selection'
                          : 'Category-Based'}
                      </span>
                    </div>

                    {/* Mode Radio Buttons */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setSecSelectionMode('sales')}
                        className={`p-2.5 rounded-xl border text-left flex items-start gap-2 transition-all ${
                          secSelectionMode === 'sales'
                            ? 'border-accent bg-accent/5 shadow-xs'
                            : 'border-border bg-surface hover:bg-surface-dim'
                        }`}
                      >
                        <div
                          className={`w-3.5 h-3.5 rounded-full mt-0.5 border flex items-center justify-center shrink-0 ${
                            secSelectionMode === 'sales' ? 'border-accent bg-accent' : 'border-muted'
                          }`}
                        >
                          {secSelectionMode === 'sales' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <div>
                          <p className="font-bold text-primary text-[11px]">Dynamic Sales Ranking</p>
                          <p className="text-[10px] text-muted">Auto-sorts by total units sold</p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSecSelectionMode('manual')}
                        className={`p-2.5 rounded-xl border text-left flex items-start gap-2 transition-all ${
                          secSelectionMode === 'manual'
                            ? 'border-accent bg-accent/5 shadow-xs'
                            : 'border-border bg-surface hover:bg-surface-dim'
                        }`}
                      >
                        <div
                          className={`w-3.5 h-3.5 rounded-full mt-0.5 border flex items-center justify-center shrink-0 ${
                            secSelectionMode === 'manual' ? 'border-accent bg-accent' : 'border-muted'
                          }`}
                        >
                          {secSelectionMode === 'manual' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <div>
                          <p className="font-bold text-primary text-[11px]">Manual Product Selection</p>
                          <p className="text-[10px] text-muted">Pick and reorder exact products</p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSecSelectionMode('category')}
                        className={`p-2.5 rounded-xl border text-left flex items-start gap-2 transition-all ${
                          secSelectionMode === 'category'
                            ? 'border-accent bg-accent/5 shadow-xs'
                            : 'border-border bg-surface hover:bg-surface-dim'
                        }`}
                      >
                        <div
                          className={`w-3.5 h-3.5 rounded-full mt-0.5 border flex items-center justify-center shrink-0 ${
                            secSelectionMode === 'category' ? 'border-accent bg-accent' : 'border-muted'
                          }`}
                        >
                          {secSelectionMode === 'category' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <div>
                          <p className="font-bold text-primary text-[11px]">Category-Based Auto Feed</p>
                          <p className="text-[10px] text-muted">Feed from a category up to limit</p>
                        </div>
                      </button>
                    </div>

                    {/* Product Limit & CTA Button Text Inputs */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold text-primary mb-1">
                          Display Product Limit (Max Cards to Show, up to 99)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={99}
                          value={secProductLimit}
                          onChange={(e) => setSecProductLimit(parseInt(e.target.value || '99', 10))}
                          className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-primary text-xs"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-primary mb-1">
                          Product Card CTA Button Text
                        </label>
                        <input
                          type="text"
                          value={secButtonText}
                          onChange={(e) => setSecButtonText(e.target.value)}
                          placeholder="e.g. Add to Bag, Add to Cart, Buy Now"
                          className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-primary text-xs"
                        />
                      </div>
                    </div>

                    {secSelectionMode === 'category' ? (
                      <div>
                        <label className="block font-semibold text-primary mb-1">Source Category</label>
                        <select
                          value={secSelectedCategoryId}
                          onChange={(e) => setSecSelectedCategoryId(e.target.value)}
                          className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-primary text-xs"
                        >
                          <option value="ALL">All Categories (Global Catalog)</option>
                          {allCategoriesList.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name} ({cat.slug})
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        <label className="block font-semibold text-primary">
                          Assigned Products ({secSelectedProductIds.length} selected, max {secProductLimit} shown)
                        </label>

                        {/* Selected items list with reorder Up / Down & Remove */}
                        {secSelectedProductIds.length > 0 && (
                          <div className="space-y-1.5 max-h-40 overflow-y-auto border border-border rounded-xl p-2 bg-surface">
                            {secSelectedProductIds.map((pid, idx) => {
                              const prod = catalogueProducts.find((p) => p.id === pid);
                              if (!prod) return null;
                              return (
                                <div
                                  key={pid}
                                  className="flex items-center justify-between p-1.5 rounded-lg bg-surface-dim border border-border/60 text-[11px]"
                                >
                                  <div className="flex items-center gap-2 truncate">
                                    <span className="font-mono text-[10px] text-muted w-4">#{idx + 1}</span>
                                    <span className="font-semibold text-primary truncate max-w-[200px]">
                                      {prod.title}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      disabled={idx === 0}
                                      onClick={() => {
                                        const copy = [...secSelectedProductIds];
                                        const temp = copy[idx - 1];
                                        copy[idx - 1] = copy[idx];
                                        copy[idx] = temp;
                                        setSecSelectedProductIds(copy);
                                      }}
                                      className="p-1 hover:text-accent disabled:opacity-30"
                                      title="Move Up"
                                    >
                                      <ArrowUp className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={idx === secSelectedProductIds.length - 1}
                                      onClick={() => {
                                        const copy = [...secSelectedProductIds];
                                        const temp = copy[idx + 1];
                                        copy[idx + 1] = copy[idx];
                                        copy[idx] = temp;
                                        setSecSelectedProductIds(copy);
                                      }}
                                      className="p-1 hover:text-accent disabled:opacity-30"
                                      title="Move Down"
                                    >
                                      <ArrowDown className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setSecSelectedProductIds((prev) => prev.filter((id) => id !== pid))
                                      }
                                      className="p-1 text-red-500 hover:text-red-700"
                                      title="Remove"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Search & Add Products */}
                        <div className="space-y-1.5">
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 text-muted absolute left-3 top-2.5" />
                            <input
                              type="text"
                              value={productSearchTerm}
                              onChange={(e) => setProductSearchTerm(e.target.value)}
                              placeholder="Search products to add..."
                              className="w-full pl-8 pr-3 py-1.5 bg-surface border border-border rounded-xl text-[11px] text-primary"
                            />
                          </div>

                          <div className="max-h-36 overflow-y-auto space-y-1 border border-border/80 rounded-xl p-1.5 bg-surface">
                            {catalogueProducts
                              .filter((p) => p.status === 'PUBLISHED')
                              .filter(
                                (p) =>
                                  !productSearchTerm.trim() ||
                                  p.title.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
                                  p.brand.toLowerCase().includes(productSearchTerm.toLowerCase())
                              )
                              .map((p) => {
                                const isSelected = secSelectedProductIds.includes(p.id);
                                return (
                                  <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => {
                                      if (isSelected) {
                                        setSecSelectedProductIds((prev) => prev.filter((id) => id !== p.id));
                                      } else {
                                        setSecSelectedProductIds((prev) => [...prev, p.id]);
                                      }
                                    }}
                                    className={`w-full flex items-center justify-between p-1.5 rounded-lg text-left text-[11px] transition-colors ${
                                      isSelected
                                        ? 'bg-accent/10 text-accent font-bold'
                                        : 'hover:bg-surface-dim text-primary'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 truncate">
                                      <div
                                        className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                                          isSelected ? 'bg-accent border-accent text-white' : 'border-muted'
                                        }`}
                                      >
                                        {isSelected && <CheckCircle2 className="w-3 h-3" />}
                                      </div>
                                      <span className="truncate">{p.title}</span>
                                    </div>
                                    <span className="text-[10px] font-mono text-muted shrink-0">
                                      {p.variants[0] ? `₹${p.variants[0].priceInPaise / 100}` : '—'}
                                    </span>
                                  </button>
                                );
                              })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-end gap-2.5 pt-4 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setShowAddSectionModal(false)}
                    className="px-5 py-2.5 bg-surface-dim hover:bg-border text-primary rounded-xl font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-accent hover:bg-accent-hover text-white font-bold rounded-xl shadow-sm"
                  >
                    Create Section
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL: DELETE CONFIRMATION */}
        {/* ========================================================================= */}
        {deletingSectionId && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-surface border border-border rounded-3xl max-w-sm w-full p-6 shadow-2xl">
              <h3 className="font-display text-base font-bold text-primary mb-2">
                Delete Homepage Section?
              </h3>
              <p className="text-xs text-muted mb-5 leading-relaxed">
                This will remove this section from the homepage layout configuration.
              </p>
              <div className="flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setDeletingSectionId(null)}
                  className="px-4 py-2 bg-surface-dim hover:bg-border text-primary rounded-xl font-medium text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteSection(deletingSectionId)}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs"
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL: WRITE NEW ARTICLE */}
        {/* ========================================================================= */}
        {showAddPostModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-surface border border-border rounded-2xl max-w-2xl w-full p-6 shadow-xl space-y-5 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="font-display text-lg font-bold text-primary">
                  Compose & Publish Journal Article
                </h3>
                <button
                  onClick={() => setShowAddPostModal(false)}
                  className="p-1 text-muted hover:text-primary"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreatePost} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-primary mb-1">
                    Article Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 100% Kashmiri Honey: Pure Taste &amp; Everyday Benefits"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-dim border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-primary mb-1">
                      Category *
                    </label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-dim border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                    >
                      <option value="Honey & Natural Wellness">Honey &amp; Natural Wellness</option>
                      <option value="Zamzam Water & Authenticity">Zamzam Water &amp; Authenticity</option>
                      <option value="Talbeena & Barliva">Talbeena &amp; Barliva</option>
                      <option value="Dates & Wholesome Pantry">Dates &amp; Wholesome Pantry</option>
                      <option value="Sourcing & Quality">Sourcing &amp; Quality</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-primary mb-1">
                      Author Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={newAuthor}
                      onChange={(e) => setNewAuthor(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-dim border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-primary mb-1">
                    Executive Summary / Abstract *
                  </label>
                  <textarea
                    rows={2}
                    required
                    placeholder="Brief 2-line preview displayed on article cards and search results..."
                    value={newSummary}
                    onChange={(e) => setNewSummary(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-dim border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-primary mb-1">
                    Featured Image URL (External CDN / HTTPS)
                  </label>
                  <input
                    type="url"
                    placeholder="https://images.unsplash.com/..."
                    value={newFeaturedImage}
                    onChange={(e) => setNewFeaturedImage(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-dim border border-border rounded-lg text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-primary mb-1">
                    Markdown Article Content *
                  </label>
                  <textarea
                    rows={8}
                    required
                    placeholder="Write article body in standard Markdown (headings, lists, bold, quotes)..."
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-dim border border-border rounded-lg text-primary font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setShowAddPostModal(false)}
                    className="px-4 py-2 border border-border rounded-lg text-muted hover:text-primary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-accent hover:bg-accent-hover text-white font-bold rounded-lg flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Publish Article</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {/* ========================================================================= */}
        {/* MODAL: ADD / EDIT HERO SHOWCASE ITEM */}
        {/* ========================================================================= */}
        {showHeroItemModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-surface border border-border rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted">
                    Hero Section Manager
                  </span>
                  <h3 className="font-display text-base font-bold text-primary">
                    {editingHeroItem ? 'Edit Hero Showcase Card' : 'Add New Hero Showcase Card'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHeroItemModal(false)}
                  className="p-1 text-muted hover:text-primary rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveHeroItem} className="space-y-3.5 text-xs">
                {/* 1. Item Type Selector */}
                <div>
                  <label className="block font-semibold text-primary mb-1">Content Type *</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setHeroItemFormType('product');
                        if (catalogueProducts[0]) handleSelectProductForHeroItem(catalogueProducts[0].id);
                      }}
                      className={`p-2 rounded-xl border text-center font-bold text-xs transition-colors ${
                        heroItemFormType === 'product'
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-border text-muted hover:text-primary hover:bg-surface-dim'
                      }`}
                    >
                      Product
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setHeroItemFormType('category');
                        if (allCategoriesList[0]) handleSelectCategoryForHeroItem(allCategoriesList[0].slug);
                      }}
                      className={`p-2 rounded-xl border text-center font-bold text-xs transition-colors ${
                        heroItemFormType === 'category'
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-border text-muted hover:text-primary hover:bg-surface-dim'
                      }`}
                    >
                      Category
                    </button>
                    <button
                      type="button"
                      onClick={() => setHeroItemFormType('custom')}
                      className={`p-2 rounded-xl border text-center font-bold text-xs transition-colors ${
                        heroItemFormType === 'custom'
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-border text-muted hover:text-primary hover:bg-surface-dim'
                      }`}
                    >
                      Custom Content
                    </button>
                  </div>
                </div>

                {/* 2. Product Picker if type === product */}
                {heroItemFormType === 'product' && (
                  <div>
                    <label className="block font-semibold text-primary mb-1">Select Product *</label>
                    <select
                      value={heroItemFormTargetId}
                      onChange={(e) => handleSelectProductForHeroItem(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary font-medium focus:outline-none focus:border-accent"
                    >
                      {catalogueProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title} {p.variants[0] ? `(₹${(p.variants[0].priceInPaise / 100).toFixed(0)})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* 3. Category Picker if type === category */}
                {heroItemFormType === 'category' && (
                  <div>
                    <label className="block font-semibold text-primary mb-1">Select Category *</label>
                    <select
                      value={heroItemFormTargetId}
                      onChange={(e) => handleSelectCategoryForHeroItem(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary font-medium focus:outline-none focus:border-accent"
                    >
                      {allCategoriesList.map((c) => (
                        <option key={c.id} value={c.slug}>
                          {c.name} {c.hindiName ? `(${c.hindiName})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* 4. Common Card Details */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-primary mb-1">Card Title *</label>
                    <input
                      type="text"
                      required
                      value={heroItemFormTitle}
                      onChange={(e) => setHeroItemFormTitle(e.target.value)}
                      placeholder="e.g. 100% Kashmiri Honey"
                      className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-primary mb-1">Origin / Badge</label>
                    <input
                      type="text"
                      value={heroItemFormBadge}
                      onChange={(e) => setHeroItemFormBadge(e.target.value)}
                      placeholder="e.g. East Champaran, Bihar Dispatch"
                      className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-primary mb-1">Tagline / Subheading</label>
                    <input
                      type="text"
                      value={heroItemFormTagline}
                      onChange={(e) => setHeroItemFormTagline(e.target.value)}
                      placeholder="e.g. Pure Taste &amp; Natural Sweetness"
                      className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-primary mb-1">Price / Tag Display</label>
                    <input
                      type="text"
                      value={heroItemFormPrice}
                      onChange={(e) => setHeroItemFormPrice(e.target.value)}
                      placeholder="e.g. ₹2,400"
                      className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-primary mb-1">Destination URL (Redirection)</label>
                  <input
                    type="text"
                    value={heroItemFormLinkUrl}
                    onChange={(e) => setHeroItemFormLinkUrl(e.target.value)}
                    placeholder="Auto-calculated or e.g. /product/100-kashmiri-honey"
                    className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary font-mono text-[11px] focus:outline-none focus:border-accent"
                  />
                  <p className="text-[10px] text-muted mt-1">
                    Clicking this card redirects users to this destination.
                  </p>
                </div>

                <div>
                  <label className="block font-semibold text-primary mb-1">Image URL (External HTTPS)</label>
                  <input
                    type="url"
                    required
                    value={heroItemFormImageUrl}
                    onChange={(e) => setHeroItemFormImageUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                  />
                  {heroItemFormImageUrl && (
                    <div className="mt-2 w-20 h-20 rounded-xl overflow-hidden border border-border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={heroItemFormImageUrl}
                        alt="Preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block font-semibold text-primary mb-1">Card Position *</label>
                    <select
                      value={heroItemFormPosition}
                      onChange={(e) => setHeroItemFormPosition(e.target.value as any)}
                      className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary font-medium focus:outline-none focus:border-accent"
                    >
                      <option value="featured">Main Featured (Large Left)</option>
                      <option value="secondary_top">Top Right Card</option>
                      <option value="secondary_bottom">Bottom Right Card</option>
                      <option value="grid">Showcase Grid</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-primary mb-1">Card Visibility</label>
                    <select
                      value={heroItemFormIsEnabled ? 'active' : 'inactive'}
                      onChange={(e) => setHeroItemFormIsEnabled(e.target.value === 'active')}
                      className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary font-medium focus:outline-none focus:border-accent"
                    >
                      <option value="active">Active (Visible)</option>
                      <option value="inactive">Inactive (Hidden)</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setShowHeroItemModal(false)}
                    className="px-4 py-2 bg-surface-dim hover:bg-border text-primary rounded-xl font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-accent hover:bg-accent-hover text-white font-bold rounded-xl shadow-xs"
                  >
                    {editingHeroItem ? 'Update Card' : 'Add Card'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL: ADD / EDIT REGISTRATION FIELD                                      */}
        {/* ========================================================================= */}
        {showFieldModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-surface border border-border rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted">
                    Registration Form Builder
                  </span>
                  <h3 className="font-display text-lg font-bold text-primary">
                    {editingField ? `Edit Field: ${editingField.label}` : 'Create New Registration Field'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFieldModal(false)}
                  className="p-2 text-muted hover:text-primary rounded-xl hover:bg-surface-dim transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveField} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-primary mb-1">Field Label *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. How Did You Discover InfiniCharm?"
                      value={fieldLabel}
                      onChange={(e) => {
                        setFieldLabel(e.target.value);
                        if (!editingField && !fieldKey) {
                          setFieldKey(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '_'));
                        }
                      }}
                      className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-primary mb-1">
                      Field Key {editingField?.isSystemField && '(Locked)'}
                    </label>
                    <input
                      type="text"
                      required
                      disabled={Boolean(editingField?.isSystemField)}
                      placeholder="e.g. hearAboutUs"
                      value={fieldKey}
                      onChange={(e) => setFieldKey(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                      className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary font-mono text-xs focus:outline-none focus:border-accent disabled:opacity-50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-primary mb-1">Field Type</label>
                    <select
                      value={fieldType}
                      disabled={Boolean(editingField?.isSystemField)}
                      onChange={(e) => setFieldType(e.target.value as RegistrationFieldType)}
                      className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary text-xs focus:outline-none focus:border-accent disabled:opacity-50"
                    >
                      <option value="text">Text (Single Line)</option>
                      <option value="textarea">Textarea (Multi-Line)</option>
                      <option value="email">Email</option>
                      <option value="phone">Mobile Phone</option>
                      <option value="number">Number</option>
                      <option value="select">Dropdown Select</option>
                      <option value="radio">Radio Choice</option>
                      <option value="checkbox">Checkbox (Boolean)</option>
                      <option value="date">Date Picker</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-primary mb-1">Placeholder Text</label>
                    <input
                      type="text"
                      placeholder="e.g. Select an option or enter details..."
                      value={fieldPlaceholder}
                      onChange={(e) => setFieldPlaceholder(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-primary mb-1">Description / Helper Text</label>
                  <input
                    type="text"
                    placeholder="Helper text displayed underneath the field input"
                    value={fieldDescription}
                    onChange={(e) => setFieldDescription(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                  />
                </div>

                {['select', 'radio', 'checkbox'].includes(fieldType) && (
                  <div className="p-3 bg-surface-dim rounded-xl border border-border space-y-2">
                    <label className="block font-semibold text-primary">
                      Options List (one per line, format: <code className="text-accent">Label:value</code> or just <code className="text-accent">Label</code>)
                    </label>
                    <textarea
                      rows={4}
                      value={fieldOptionsText}
                      onChange={(e) => setFieldOptionsText(e.target.value)}
                      placeholder="Google Search:google&#10;Instagram:instagram&#10;Friend Recommendation:referral&#10;YouTube:youtube"
                      className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-primary font-mono text-xs focus:outline-none focus:border-accent"
                    />
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-primary mb-1">Min Length</label>
                    <input
                      type="number"
                      placeholder="e.g. 2"
                      value={fieldMinLength}
                      onChange={(e) => setFieldMinLength(e.target.value ? Number(e.target.value) : '')}
                      className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-primary mb-1">Max Length</label>
                    <input
                      type="number"
                      placeholder="e.g. 100"
                      value={fieldMaxLength}
                      onChange={(e) => setFieldMaxLength(e.target.value ? Number(e.target.value) : '')}
                      className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-primary mb-1">Regex Pattern</label>
                    <input
                      type="text"
                      placeholder="^[a-zA-Z0-9]+$"
                      value={fieldPattern}
                      onChange={(e) => setFieldPattern(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-dim border border-border rounded-xl text-primary font-mono text-[11px] focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-6 pt-2 border-t border-border">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={fieldRequired}
                      disabled={Boolean(editingField?.isSystemField && ['fullName', 'email', 'password', 'confirmPassword'].includes(editingField.key))}
                      onChange={(e) => setFieldRequired(e.target.checked)}
                      className="rounded border-border text-accent focus:ring-accent"
                    />
                    <span className="font-semibold text-primary">Mandatory Field</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={fieldEnabled}
                      onChange={(e) => setFieldEnabled(e.target.checked)}
                      className="rounded border-border text-accent focus:ring-accent"
                    />
                    <span className="font-semibold text-primary">Enabled on Storefront</span>
                  </label>
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setShowFieldModal(false)}
                    className="px-4 py-2 bg-surface-dim hover:bg-border text-primary rounded-xl font-medium text-xs transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-accent hover:bg-accent-hover text-white font-bold rounded-xl text-xs shadow-xs transition-colors"
                  >
                    {editingField ? 'Save Changes' : 'Create Field'}
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
