import React from 'react';
import Link from 'next/link';
import { BRAND } from '@/lib/constants/brand';
import { CATEGORIES } from '@/lib/constants/categories';
import { Container } from '@/components/ui/Container';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { Shield, Sparkles, Truck, Lock } from 'lucide-react';
import { FooterSocialLinks } from './FooterSocialLinks';

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface text-primary pt-16 pb-28 sm:pb-24 mt-auto">
      <Container>
        {/* Trust Badges Rail */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pb-14 border-b border-border">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-md bg-surface-dim text-primary">
              <Shield className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h4 className="text-sm font-semibold">100% Genuine</h4>
              <p className="text-xs text-muted mt-0.5">Strict quality and source verification</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-md bg-surface-dim text-primary">
              <Truck className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h4 className="text-sm font-semibold">Careful Dispatch</h4>
              <p className="text-xs text-muted mt-0.5">Shipped securely across India</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-md bg-surface-dim text-primary">
              <Lock className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h4 className="text-sm font-semibold">Secure Payments</h4>
              <p className="text-xs text-muted mt-0.5">UPI, Cards, Net Banking & COD</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-md bg-surface-dim text-primary">
              <Sparkles className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h4 className="text-sm font-semibold">Artisan Purity</h4>
              <p className="text-xs text-muted mt-0.5">No artificial additives or syrups</p>
            </div>
          </div>
        </div>

        {/* Main Footer Links */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 py-14 border-b border-border text-sm">
          {/* Brand Info & Registered Office */}
          <div className="lg:col-span-2 space-y-4">
            <div className="space-y-2">
              <BrandLogo variant="light" size="md" href="/" showTagline={true} />
              <p className="text-xs text-muted font-medium">
                Operated by {BRAND.operatingEntity}
              </p>
            </div>
            <p className="text-xs text-muted leading-relaxed max-w-sm">
              {BRAND.tagline} We believe in transparent disclosures, authentic products, and customer confidence. Sourced directly and packaged with integrity.
            </p>
            <div className="pt-2 text-xs text-muted space-y-1">
              <p>
                <strong className="text-primary font-medium">Founder & CEO:</strong>{' '}
                <a
                  href={BRAND.founderWebsite}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-accent underline underline-offset-2"
                >
                  {BRAND.founder}
                </a>
              </p>
              <p>
                <strong className="text-primary font-medium">Registered Office:</strong>{' '}
                {BRAND.contact.address.fullAddress}
              </p>
              <p>
                <strong className="text-primary font-medium">Support:</strong>{' '}
                <a
                  href={`mailto:${BRAND.contact.supportEmail}`}
                  className="hover:text-accent"
                >
                  {BRAND.contact.supportEmail}
                </a>
              </p>
            </div>
            <FooterSocialLinks />
          </div>

          {/* Categories */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-primary">
              Categories
            </h4>
            <ul className="space-y-2 text-xs">
              {CATEGORIES.map((cat) => (
                <li key={cat.id}>
                  <Link
                    href={`/shop?category=${cat.slug}`}
                    className="text-muted hover:text-primary transition-colors"
                  >
                    {cat.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Navigation & Information */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-primary">
              Information
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/about" className="text-muted hover:text-primary transition-colors">
                  Our Story & Values
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-muted hover:text-primary transition-colors">
                  Contact & Care
                </Link>
              </li>
              <li>
                <Link href="/blog" className="text-muted hover:text-primary transition-colors">
                  Journal & Sourcing Guides
                </Link>
              </li>
              <li>
                <Link href="/faq" className="text-muted hover:text-primary transition-colors">
                  Frequently Asked Questions
                </Link>
              </li>
              <li>
                <Link href="/track-order" className="text-muted hover:text-primary transition-colors">
                  Track Your Order
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal Policies */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-primary">
              Compliance & Policies
            </h4>
            <ul className="space-y-2 text-xs">
              {BRAND.policies.map((p) => (
                <li key={p.href}>
                  <Link href={p.href} className="text-muted hover:text-primary transition-colors">
                    {p.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Sub-Footer */}
        <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted">
          <div>
            <p>© {new Date().getFullYear()} {BRAND.name}. Operating Brand: {BRAND.operatingEntity}. All rights reserved.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium text-muted mr-1">Accepted Payment Methods:</span>
            {['UPI', 'Visa', 'Mastercard', 'RuPay', 'NetBanking'].map((method) => (
              <span
                key={method}
                className="px-2 py-0.5 rounded bg-surface-dim border border-border text-[11px] font-mono text-primary font-semibold"
              >
                {method}
              </span>
            ))}
          </div>
        </div>
      </Container>
    </footer>
  );
}

