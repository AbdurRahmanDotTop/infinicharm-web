import React from 'react';
import { BRAND } from '@/lib/constants/brand';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';

export default function TermsPolicyPage() {
  return (
    <div className="py-12 sm:py-16">
      <Container>
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="border-b border-border pb-6 space-y-1">
            <h1 className="font-display text-2xl sm:text-4xl font-bold text-primary">
              Terms & Conditions
            </h1>
            <p className="text-xs text-muted">
              Last updated: November 2026 • Commercial Terms of Service
            </p>
          </div>

          <div className="text-xs sm:text-sm text-muted leading-relaxed space-y-6">
            <Card level={1} className="p-6 space-y-3">
              <h2 className="font-display text-base font-bold text-primary">1. Agreement & Jurisdiction</h2>
              <p>
                By accessing or placing an order through {BRAND.name} (operated by {BRAND.operatingEntity}), you agree to these terms. Any disputes arising out of or in connection with transactions shall be subject to the exclusive jurisdiction of the competent courts in Motihari, East Champaran, Bihar, India.
              </p>
            </Card>

            <Card level={1} className="p-6 space-y-3">
              <h2 className="font-display text-base font-bold text-primary">2. Pricing & Taxes</h2>
              <p>
                All prices displayed on {BRAND.name} are in Indian Rupees (INR) and are inclusive of all applicable Goods and Services Tax (GST).
              </p>
            </Card>

            <Card level={1} className="p-6 space-y-3">
              <h2 className="font-display text-base font-bold text-primary">3. Product Descriptions & Authenticity</h2>
              <p>
                We strive for absolute accuracy in descriptions, botanical names, and net quantities. Actual packaging may occasionally vary slightly due to artisan batch bottling.
              </p>
            </Card>
          </div>
        </div>
      </Container>
    </div>
  );
}

