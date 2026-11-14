import React from 'react';
import { BRAND } from '@/lib/constants/brand';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';

export default function ReturnsPolicyPage() {
  return (
    <div className="py-12 sm:py-16">
      <Container>
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="border-b border-border pb-6 space-y-1">
            <h1 className="font-display text-2xl sm:text-4xl font-bold text-primary">
              Returns, Refunds & Cancellation Policy
            </h1>
            <p className="text-xs text-muted">
              Last updated: November 2026 • In compliance with Consumer Protection (E-Commerce) Rules
            </p>
          </div>

          <div className="text-xs sm:text-sm text-muted leading-relaxed space-y-6">
            <Card level={1} className="p-6 space-y-3">
              <h2 className="font-display text-base font-bold text-primary">1. Category-Specific Return Rules</h2>
              <p>
                To maintain the highest food safety and hygienic standards:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>
                  <strong>Pure Honey, Talbeena, Barliva &amp; Premium Dates:</strong> Non-returnable once the tamper-evident packaging seal has been broken, in compliance with FSSAI regulations.
                </li>
                <li>
                  <strong>Zamzam Water (5L Sealed Can):</strong> Non-returnable once the factory seal is opened. Transit damage or broken seals on arrival are eligible for immediate replacement.
                </li>
              </ul>
            </Card>

            <Card level={1} className="p-6 space-y-3">
              <h2 className="font-display text-base font-bold text-primary">2. Damaged in Transit or Incorrect Items</h2>
              <p>
                If your parcel arrives physically damaged, leaking, or with missing items, notify us within 48 hours of delivery at{' '}
                <a href={`mailto:${BRAND.contact.supportEmail}`} className="text-accent underline">
                  {BRAND.contact.supportEmail}
                </a>{' '}
                with clear photographic evidence. We provide an immediate free replacement or 100% refund.
              </p>
            </Card>

            <Card level={1} className="p-6 space-y-3">
              <h2 className="font-display text-base font-bold text-primary">3. Refund Processing Turnaround</h2>
              <p>
                Approved refunds are processed within 5 to 7 business days to the original payment source (UPI, Credit/Debit Card, or Net Banking). For Cash on Delivery orders, refunds are disbursed via verified UPI or bank NEFT transfer.
              </p>
            </Card>
          </div>
        </div>
      </Container>
    </div>
  );
}

