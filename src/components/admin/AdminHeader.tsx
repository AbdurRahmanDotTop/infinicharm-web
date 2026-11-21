'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BrandLogo } from '@/components/brand/BrandLogo';
import {
  LayoutDashboard,
  Package,
  Layers,
  ShoppingBag,
  Users,
  Tag,
  Image as ImageIcon,
  MessageSquare,
  FileText,
  Settings,
  ShieldCheck,
  LogOut,
  ArrowUpRight,
  CreditCard,
  UserCheck,
  UserCog,
  Inbox,
  Mail,
  Bell,
  BellRing,
  FileCode2,
  Server,
  Database,
  Menu,
  X,
} from 'lucide-react';

export function AdminHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [adminEmail, setAdminEmail] = useState('admin@infinicharm.com');

  useEffect(() => {
    try {
      const raw = localStorage.getItem('infinicharm_admin_user');
      if (raw) {
        const u = JSON.parse(raw);
        if (u?.email) setAdminEmail(u.email);
      }
    } catch {}
  }, []);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const handleAdminSignOut = async () => {
    setDrawerOpen(false);
    try {
      await fetch('/api/admin/auth/logout', { method: 'POST' });
    } catch {}
    if (typeof document !== 'undefined') {
      document.cookie =
        'infinicharm_admin_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT;';
    }
    router.push('/admin/login');
    router.refresh();
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const navItems = [
    { label: 'Overview', href: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'Products', href: '/admin/products', icon: Package },
    { label: 'Categories', href: '/admin/categories', icon: Layers },
    { label: 'Orders', href: '/admin/orders', icon: ShoppingBag },
    { label: 'Payments', href: '/admin/payments', icon: CreditCard },
    { label: 'All Users', href: '/admin/users', icon: UserCheck },
    { label: 'Customers', href: '/admin/customers', icon: Users },
    { label: 'Coupons', href: '/admin/coupons', icon: Tag },
    { label: 'Inquiries', href: '/admin/inquiries', icon: Inbox },
    { label: 'Notifications', href: '/admin/email-notifications', icon: BellRing },
    { label: 'Email Templates', href: '/admin/email-templates', icon: FileCode2 },
    { label: 'Newsletter', href: '/admin/newsletter', icon: Mail },
    { label: 'Media Library', href: '/admin/media', icon: ImageIcon },
    { label: 'Reviews', href: '/admin/reviews', icon: MessageSquare },
    { label: 'Content & CMS', href: '/admin/cms', icon: FileText },
    { label: 'Announcements', href: '/admin/announcements', icon: Bell },
    { label: 'Backup & Restore', href: '/admin/backup', icon: Database },
    { label: 'Email & SMTP', href: '/admin/settings/email-smtp', icon: Server },
    { label: 'Settings', href: '/admin/settings', icon: Settings },
    { label: 'Audit Logs', href: '/admin/audit-logs', icon: ShieldCheck },
  ];

  const activeNav = navItems.find((item) => item.href === pathname) || navItems[0];

  return (
    <header data-testid="admin-header" className="border-b border-border bg-surface relative z-30 shadow-level-1">
      {/* Top Bar */}
      <div className="px-3 sm:px-6 py-2.5 sm:py-3 flex flex-wrap items-center justify-between gap-2 border-b border-border/60">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* Admin Hamburger Menu Trigger (< lg) */}
          <button
            type="button"
            data-testid="admin-mobile-menu-toggle"
            onClick={() => setDrawerOpen((prev) => !prev)}
            className="lg:hidden p-1.5 sm:p-2 text-primary hover:bg-surface-dim rounded-lg border border-border/80 transition-colors shrink-0"
            aria-label="Toggle Admin Navigation Menu"
            aria-expanded={drawerOpen}
          >
            {drawerOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <BrandLogo variant="light" size="sm" href="/admin/dashboard" showTagline={false} />

          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent/10 text-accent font-bold whitespace-nowrap">
            Operations Hub
          </span>
        </div>

        <div className="flex items-center flex-wrap gap-2 sm:gap-4 text-xs">
          <Link
            href="/"
            target="_blank"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 sm:px-0 sm:py-0 rounded-lg bg-surface-dim sm:bg-transparent border border-border sm:border-0 text-muted hover:text-primary transition-colors font-medium"
          >
            <span>Live Storefront</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>

          <Link
            href="/admin/profile"
            className="text-muted text-[11px] sm:text-xs hidden sm:inline-flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-surface-dim hover:text-primary transition-colors"
            title="Manage Administrator Profile & Credentials"
          >
            <UserCog className="w-3.5 h-3.5 text-accent" />
            <span><strong className="text-primary font-semibold">{adminEmail}</strong> (Super Admin)</span>
          </Link>

          <button
            type="button"
            data-testid="admin-signout-btn"
            onClick={handleAdminSignOut}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-surface-dim hover:bg-border text-primary rounded-lg transition-colors font-medium border border-border whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Admin Active Module Status & Compact Pill Switcher on Mobile/Tablet (< lg), Full Wrapped Bar on Desktop (lg+) */}
      <div className="lg:hidden px-3 sm:px-6 py-2 bg-surface-dim/40 flex items-center justify-between gap-2 text-xs border-b border-border/40">
        <div className="flex items-center gap-2 min-w-0">
          <activeNav.icon className="w-3.5 h-3.5 text-accent shrink-0" />
          <span className="font-bold text-primary truncate">{activeNav.label}</span>
          <span className="text-[10px] text-muted truncate hidden xs:inline">• {adminEmail}</span>
        </div>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="text-[11px] font-bold text-accent hover:underline shrink-0"
        >
          All Modules ({navItems.length}) →
        </button>
      </div>

      {/* Desktop Wrapped Multi-Module Bar — Zero Horizontal Scrollbar */}
      <nav
        aria-label="Admin Operations Modules"
        className="hidden lg:flex flex-wrap items-center gap-1 px-6 py-2 bg-surface-dim/30"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-muted hover:text-primary hover:bg-surface-dim'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Admin Mobile & Tablet Slide-in Drawer (Portalled to document.body) */}
      {mounted &&
        drawerOpen &&
        createPortal(
          <div
            data-testid="admin-mobile-nav-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Admin Operations Navigation"
            className="lg:hidden fixed inset-0 z-[100] flex w-screen h-[100dvh]"
          >
            <div
              className="fixed inset-0 bg-neutral-900/60 backdrop-blur-xs transition-opacity"
              onClick={() => setDrawerOpen(false)}
              aria-hidden="true"
            />
            <div className="relative w-[86vw] max-w-xs sm:max-w-sm bg-surface h-[100dvh] flex flex-col shadow-2xl z-10 overflow-hidden animate-in slide-in-from-left duration-200">
              <div className="p-4 border-b border-border flex items-center justify-between bg-surface-dim/50 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <BrandLogo variant="light" size="sm" href="/admin/dashboard" showTagline={false} />
                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent/10 text-accent font-bold">
                    Admin
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close Admin Navigation Menu"
                  className="p-2 text-primary hover:bg-surface-dim rounded-full border border-border/60 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-4">
                {/* Admin Identity Box */}
                <div className="p-3.5 rounded-2xl bg-surface-dim border border-border space-y-2 text-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
                    Signed In Operator
                  </span>
                  <p className="font-bold text-primary break-all">{adminEmail}</p>
                  <p className="text-[11px] text-accent font-semibold">Super Administrator Role</p>
                </div>

                {/* All 14 Admin Navigation Modules */}
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted px-1 mb-1.5">
                    Management Modules
                  </p>
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setDrawerOpen(false)}
                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                          isActive
                            ? 'bg-primary text-white shadow-xs'
                            : 'text-primary hover:bg-surface-dim border border-transparent hover:border-border'
                        }`}
                      >
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-accent' : 'text-muted'}`} />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>

                {/* Footer Actions */}
                <div className="pt-3 border-t border-border space-y-2 text-xs">
                  <Link
                    href="/"
                    target="_blank"
                    onClick={() => setDrawerOpen(false)}
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-surface-dim border border-border font-semibold text-primary hover:border-accent transition-colors"
                  >
                    <span>Open Live Storefront</span>
                    <ArrowUpRight className="w-4 h-4 text-accent" />
                  </Link>
                  <button
                    type="button"
                    data-testid="admin-mobile-signout-btn"
                    onClick={handleAdminSignOut}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out Admin</span>
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </header>
  );
}
