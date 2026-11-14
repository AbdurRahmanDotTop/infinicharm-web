import React from 'react';
import Link from 'next/link';
import { BRAND } from '@/lib/constants/brand';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ShieldCheck, HeartHandshake, Eye, Sparkles } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="py-12 sm:py-16 space-y-16">
      <Container>
        {/* Story Hero */}
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">
            Our Story & Heritage
          </p>
          <h1 className="font-display text-3xl sm:text-5xl font-bold text-primary">
            Built on Authenticity, <br />
            Rooted in Trust.
          </h1>
          <p className="text-sm sm:text-base text-muted leading-relaxed">
            {BRAND.name} was founded with a singular conviction: online shoppers in India deserve access to genuine, unadulterated everyday pantry staples and lifestyle essentials without dubious claims or confusing marketing.
          </p>
        </div>

        {/* Leadership & Brand Identity Box */}
        <div className="max-w-3xl mx-auto mt-12">
          <Card level={1} className="p-8 sm:p-10 border-border bg-gradient-to-br from-surface to-surface-dim">
            <h2 className="font-display text-xl font-bold text-primary mb-3">
              Leadership & Corporate Governance
            </h2>
            <div className="space-y-4 text-xs sm:text-sm text-muted leading-relaxed">
              <p>
                <strong className="text-primary font-medium">Founder & CEO:</strong>{' '}
                <a
                  href={BRAND.founderWebsite}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline underline-offset-2 font-medium"
                >
                  {BRAND.founder}
                </a>
              </p>
              <p>
                <strong className="text-primary font-medium">Operating Entity:</strong>{' '}
                {BRAND.operatingEntity}
              </p>
              <p>
                <strong className="text-primary font-medium">Operations & Regional Hub:</strong>{' '}
                {BRAND.contact.address.fullAddress}
              </p>
              <p>
                Under the leadership of AbdurRahman Ibn Ghufran, InfiniCharm prioritizes transparent packaging, certified FSSAI compliance, and direct regional dispatch rather than opaque third-party drop-shipping.
              </p>
            </div>
          </Card>
        </div>

        {/* Core Values Grid */}
        <div className="max-w-4xl mx-auto pt-8">
          <h2 className="font-display text-2xl font-bold text-primary text-center mb-10">
            Our Operating Principles
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card level={1} className="p-6 space-y-3">
              <div className="w-10 h-10 rounded-lg bg-surface-dim flex items-center justify-center text-accent">
                <Eye className="w-5 h-5" />
              </div>
              <h3 className="font-display text-base font-bold text-primary">
                1. Total Clarity
              </h3>
              <p className="text-xs text-muted leading-relaxed">
                We disclose exact net quantities, botanical sources, ingredients, and origin points. No hidden additives, no fine-print deceptions.
              </p>
            </Card>

            <Card level={1} className="p-6 space-y-3">
              <div className="w-10 h-10 rounded-lg bg-surface-dim flex items-center justify-center text-accent">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="font-display text-base font-bold text-primary">
                2. Careful Selection
              </h3>
              <p className="text-xs text-muted leading-relaxed">
                Every product listed on our store undergoes rigorous sample evaluation and producer vetting before receiving the InfiniCharm seal.
              </p>
            </Card>

            <Card level={1} className="p-6 space-y-3">
              <div className="w-10 h-10 rounded-lg bg-surface-dim flex items-center justify-center text-accent">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="font-display text-base font-bold text-primary">
                3. Uncompromising Honesty
              </h3>
              <p className="text-xs text-muted leading-relaxed">
                We do not claim medical miracles or synthetic super-food statuses. We simply provide 100% Kashmiri Honey, Zamzam Water, Takmeeli Talbeena, Barliva, and Premium Dates with transparent quality standards.
              </p>
            </Card>

            <Card level={1} className="p-6 space-y-3">
              <div className="w-10 h-10 rounded-lg bg-surface-dim flex items-center justify-center text-accent">
                <HeartHandshake className="w-5 h-5" />
              </div>
              <h3 className="font-display text-base font-bold text-primary">
                4. Direct Accountability
              </h3>
              <p className="text-xs text-muted leading-relaxed">
                If an order arrives damaged or fails to meet expectations, our customer care team and designated Grievance Officer resolve it without bureaucratic delays.
              </p>
            </Card>
          </div>
        </div>

        {/* CTA Banner */}
        <div className="max-w-2xl mx-auto text-center pt-8">
          <Link href="/shop">
            <Button variant="accent" size="lg" pill>
              Discover Our Authentic Collection
            </Button>
          </Link>
        </div>
      </Container>
    </div>
  );
}

