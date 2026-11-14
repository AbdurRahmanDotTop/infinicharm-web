import React from 'react';
import { BRAND } from '@/lib/constants/brand';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';

export default function PrivacyPolicyPage() {
  return (
    <div className="py-12 sm:py-16">
      <Container>
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="border-b border-border pb-6 space-y-1">
            <h1 className="font-display text-2xl sm:text-4xl font-bold text-primary">
              Privacy & Data Protection Notice
            </h1>
            <p className="text-xs text-muted">
              Last updated: November 2026 • In alignment with India Digital Personal Data Protection (DPDP) Act 2023
            </p>
          </div>

          <div className="text-xs sm:text-sm text-muted leading-relaxed space-y-6">
            <Card level={1} className="p-6 space-y-3">
              <h2 className="font-display text-base font-bold text-primary">1. Information We Collect</h2>
              <p>
                {BRAND.name} (operated by {BRAND.operatingEntity}) collects only the minimum information necessary to fulfill orders and provide customer support:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Contact details: Name, email address, and 10-digit mobile phone number.</li>
                <li>Delivery details: Postal address with 6-digit Indian PIN code.</li>
                <li>Transaction records: Payment reference identifiers (we never store card numbers).</li>
              </ul>
            </Card>

            <Card level={1} className="p-6 space-y-3">
              <h2 className="font-display text-base font-bold text-primary">2. Zero Sale of Personal Data</h2>
              <p>
                We never sell, rent, or trade your personal data to data brokers or third-party marketing companies. Data is shared strictly with authorized service providers (logistics carriers for delivery and payment gateways for transaction settlement).
              </p>
            </Card>

            <Card level={1} className="p-6 space-y-3">
              <h2 className="font-display text-base font-bold text-primary">3. Data Principal Rights & Contact</h2>
              <p>
                Under the DPDP Act 2023, you have the right to access, correct, or request the deletion of your personal account data by emailing{' '}
                <a href={`mailto:${BRAND.contact.supportEmail}`} className="text-accent underline">
                  {BRAND.contact.supportEmail}
                </a>.
              </p>
            </Card>
          </div>
        </div>
      </Container>
    </div>
  );
}

