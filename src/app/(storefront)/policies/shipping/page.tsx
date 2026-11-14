import React from 'react';
import { BRAND } from '@/lib/constants/brand';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';

export default function ShippingPolicyPage() {
  return (
    <div className="py-12 sm:py-16">
      <Container>
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="border-b border-border pb-6 space-y-1">
            <h1 className="font-display text-2xl sm:text-4xl font-bold text-primary">
              Shipping & Delivery Policy
            </h1>
            <p className="text-xs text-muted">
              Last updated: November 2026 • Governing dispatch from East Champaran, Bihar
            </p>
          </div>

          <div className="prose prose-sm text-xs sm:text-sm text-muted leading-relaxed space-y-6">
            <Card level={1} className="p-6 space-y-3">
              <h2 className="font-display text-base font-bold text-primary">1. Dispatch Origin & Processing</h2>
              <p>
                All orders placed on {BRAND.name} are processed, packed with protective materials, and dispatched directly from our regional fulfillment facility located at:
              </p>
              <p className="font-medium text-primary bg-surface-dim p-3 rounded-md">
                {BRAND.contact.address.fullAddress}
              </p>
              <p>
                Orders are dispatched within 24 to 48 business hours following payment confirmation (or COD acceptance).
              </p>
            </Card>

            <Card level={1} className="p-6 space-y-3">
              <h2 className="font-display text-base font-bold text-primary">2. Delivery Timelines & Courier Partners</h2>
              <p>
                We partner with premier Indian logistics carriers including Delhivery, Blue Dart, DTDC, and India Post Speed Post. Delivery typically takes:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Bihar & Eastern Region:</strong> 2 to 3 business days.</li>
                <li><strong>Metro Cities (Delhi, Mumbai, Bengaluru, Kolkata, Chennai):</strong> 3 to 5 business days.</li>
                <li><strong>Rest of India:</strong> 4 to 7 business days.</li>
              </ul>
            </Card>

            <Card level={1} className="p-6 space-y-3">
              <h2 className="font-display text-base font-bold text-primary">3. Shipping Fees & Free Shipping</h2>
              <p>
                Standard courier shipping is charged at a flat ₹60 fee for smaller orders. Orders with a qualifying subtotal of ₹999 or higher automatically receive <strong>Free Standard Shipping</strong> across India.
              </p>
            </Card>
          </div>
        </div>
      </Container>
    </div>
  );
}

