import React from 'react';
import { BRAND } from '@/lib/constants/brand';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';

export default function CompliancePolicyPage() {
  return (
    <div className="py-12 sm:py-16">
      <Container>
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="border-b border-border pb-6 space-y-1">
            <h1 className="font-display text-2xl sm:text-4xl font-bold text-primary">
              Legal Metrology & Regulatory Disclosures
            </h1>
            <p className="text-xs text-muted">
              Consumer Protection (E-Commerce) Rules 2020 & Legal Metrology Act Declarations
            </p>
          </div>

          <div className="text-xs sm:text-sm text-muted leading-relaxed space-y-6">
            <Card level={1} className="p-6 space-y-3">
              <h2 className="font-display text-base font-bold text-primary">1. Entity & Manufacturer / Packer Details</h2>
              <div className="space-y-1 bg-surface-dim p-4 rounded-md text-xs text-primary">
                <p><strong>Brand Name:</strong> {BRAND.name}</p>
                <p><strong>Operating Business:</strong> {BRAND.operatingEntity}</p>
                <p><strong>Founder & CEO:</strong> {BRAND.founder}</p>
                <p><strong>Principal Place of Business:</strong> {BRAND.contact.address.fullAddress}</p>
                <p><strong>Country of Origin:</strong> India</p>
              </div>
            </Card>

            <Card level={1} className="p-6 space-y-3">
              <h2 className="font-display text-base font-bold text-primary">2. Food Safety & Standards Authority of India (FSSAI)</h2>
              <p>
                All food and beverage products—including Honey, Drinking Water (Zamzam Water), Talbeena, and Dates—are sourced, packed, and distributed in full accordance with FSSAI regulations. 14-digit FSSAI license numbers and batch numbers are disclosed on relevant packaging labels and product pages.
              </p>
            </Card>

            <Card level={1} className="p-6 space-y-3">
              <h2 className="font-display text-base font-bold text-primary">3. Grievance Redressal Mechanism</h2>
              <p>
                In accordance with Rule 5(9) of the Consumer Protection (E-Commerce) Rules 2020:
              </p>
              <div className="space-y-1 bg-surface-dim p-4 rounded-md text-xs text-primary">
                <p><strong>Grievance Officer:</strong> {BRAND.founder}</p>
                <p><strong>Email:</strong> {BRAND.contact.supportEmail}</p>
                <p><strong>Address:</strong> {BRAND.contact.address.fullAddress}</p>
                <p><strong>Turnaround SLA:</strong> Acknowledgment within 48 hours; resolution within 30 days.</p>
              </div>
            </Card>
          </div>
        </div>
      </Container>
    </div>
  );
}

