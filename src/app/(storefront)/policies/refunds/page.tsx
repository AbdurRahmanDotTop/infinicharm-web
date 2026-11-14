import React from 'react';
import Link from 'next/link';
import { BRAND } from '@/lib/constants/brand';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { ShieldCheck, RefreshCw, Clock, ArrowRight } from 'lucide-react';

export const metadata = {
  title: 'Refund & Cancellation Policy | InfiniCharm',
  description: 'Statutory refund terms, turnaround timelines, and dispute resolution for prepaid and Cash on Delivery orders at InfiniCharm.',
};

export default function RefundsPolicyPage() {
  return (
    <div className="py-12 sm:py-16 bg-surface-dim/30 min-h-screen">
      <Container>
        <div className="max-w-3xl mx-auto space-y-8">
          {/* Header */}
          <div className="border-b border-border pb-6 space-y-2">
            <span className="text-xs font-bold text-accent uppercase tracking-widest bg-accent/10 px-3 py-1 rounded-full">
              Commercial & Statutory Integrity
            </span>
            <h1 className="font-display text-2xl sm:text-4xl font-bold text-primary mt-2">
              Refund & Cancellation Policy
            </h1>
            <p className="text-xs text-muted">
              Last updated: November 2026 • Formulated in compliance with Indian Consumer Protection (E-Commerce) Rules
            </p>
          </div>

          <div className="text-xs sm:text-sm text-muted leading-relaxed space-y-6">
            {/* Cancellation Window */}
            <Card level={1} className="p-6 space-y-3 bg-surface">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-accent" />
                <h2 className="font-display text-base font-bold text-primary">
                  1. Order Cancellation Window
                </h2>
              </div>
              <p>
                Customers may cancel an order free of charge at any time before the consignment is marked as <strong>SHIPPED</strong> by our East Champaran fulfillment center. Once an Air Waybill (AWB) has been generated and handed over to logistics partners (Delhivery, Blue Dart, DTDC, India Post), cancellation is no longer possible and the standard return procedure applies.
              </p>
            </Card>

            {/* Turnaround Time */}
            <Card level={1} className="p-6 space-y-3 bg-surface">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-accent" />
                <h2 className="font-display text-base font-bold text-primary">
                  2. Refund Turnaround & Payment Channels
                </h2>
              </div>
              <p>
                Upon verified order cancellation or physical receipt and inspection of returned merchandise at our East Champaran warehouse:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>Prepaid Transactions (UPI, Credit/Debit Cards, Net Banking):</strong> Refunds are initiated immediately via our payment gateway partner. The refunded amount will reflect in your original bank account within <strong>5 to 7 business days</strong>, subject to your issuing bank&apos;s settlement cycle.
                </li>
                <li>
                  <strong>Cash on Delivery (COD) Orders:</strong> In cases of verified transit damage or approved clothing returns on COD orders, our care team will contact you via email ({BRAND.contact.supportEmail}) to disburse funds directly to your verified bank account via <strong>UPI or NEFT transfer</strong> within 3 business days of verification.
                </li>
              </ul>
            </Card>

            {/* Non-Refundable Categories */}
            <Card level={1} className="p-6 space-y-3 bg-surface">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-accent" />
                <h2 className="font-display text-base font-bold text-primary">
                  3. Non-Refundable Exceptions & Food Safety
                </h2>
              </div>
              <p>
                In strict accordance with statutory FSSAI and food safety mandates, perishable or sealed edible products (100% Kashmiri Honey, Zamzam Water – 5 Litres, Takmeeli Talbeena, Barliva, and Premium Dates) cannot be refunded once the tamper-evident seal is broken, unless physically damaged or leaking upon arrival.
              </p>
              <p>
                For transit damages, customers must report the issue within <strong>48 hours of delivery</strong> with photographic evidence to {BRAND.contact.supportEmail}.
              </p>
            </Card>

            {/* Grievance Redressal */}
            <Card level={1} className="p-6 space-y-3 bg-surface">
              <h2 className="font-display text-base font-bold text-primary">
                4. Grievance Redressal & Jurisdiction
              </h2>
              <p>
                If a refund is delayed beyond 7 business days, you may escalate directly to our designated Grievance Officer:
              </p>
              <div className="bg-surface-dim p-3.5 rounded-xl border border-border text-xs text-primary space-y-1">
                <p><strong>Grievance Officer:</strong> {BRAND.founder}</p>
                <p><strong>Official Email:</strong> {BRAND.contact.supportEmail}</p>
                <p><strong>Registered Office:</strong> {BRAND.contact.address.fullAddress}</p>
                <p><strong>Jurisdiction:</strong> Competent courts of Motihari, East Champaran, Bihar, India.</p>
              </div>
            </Card>

            <div className="pt-4 flex items-center justify-between text-xs">
              <Link
                href="/policies/returns"
                className="text-accent font-bold hover:underline flex items-center gap-1"
              >
                <span>View Full Returns Policy</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/policies/shipping"
                className="text-accent font-bold hover:underline flex items-center gap-1"
              >
                <span>View Shipping Policy</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}
