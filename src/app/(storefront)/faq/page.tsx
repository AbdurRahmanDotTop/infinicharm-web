import React from 'react';
import { Container } from '@/components/ui/Container';
import { BRAND } from '@/lib/constants/brand';
import { generateFAQSchema } from '@/lib/services/structured-data';
import { HelpCircle, ChevronRight, ShieldCheck, Truck, RefreshCw, CreditCard } from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'Frequently Asked Questions (FAQ)',
  description: 'Common questions about InfiniCharm products, cold-pressed extraction, pure raw honey, delivery timelines, and return policies.',
};

export default function FAQPage() {
  const faqCategories = [
    {
      category: 'Product Purity & Authenticity',
      icon: ShieldCheck,
      questions: [
        {
          q: 'Is your 100% Kashmiri Honey natural and pure?',
          a: 'Yes, our 100% Kashmiri Honey is packed with natural goodness, pure taste, and authentic sweetness, without artificial syrups or synthetic flavouring.',
        },
        {
          q: 'Why has my jar of pure honey crystallized?',
          a: 'Crystallization is a natural characteristic of pure honey! Pure honey is a concentrated solution of natural glucose and fructose. Over time, glucose may form fine creamy crystals. To liquefy gently, place the sealed bottle in a bowl of warm water.',
        },
        {
          q: 'How is Zamzam Water – 5 Litres packaged for safe shipping?',
          a: 'Our 5L original sealed Zamzam Water can is tamper-evident sealed and double-cushioned inside protective corrugated cartons to prevent leaks or transit damage anywhere across India.',
        },
        {
          q: 'How do you prepare Takmeeli Talbeena and Premium Dates?',
          a: 'Takmeeli Talbeena is a wholesome, nourishing blend ready for quick traditional preparation in warm milk or water. Our Premium Dates – 1 KG are carefully graded for softness, natural sweetness, and clean resealable packing.',
        },
      ],
    },
    {
      category: 'Shipping & Delivery',
      icon: Truck,
      questions: [
        {
          q: 'Where do you dispatch orders from?',
          a: 'All orders are carefully packed and dispatched directly from our registered operations hub in East Champaran, Bihar (PIN: 845427) to guarantee direct source authenticity.',
        },
        {
          q: 'What is the delivery timeline?',
          a: 'Standard courier delivery takes 3 to 5 business days across major metros and state capitals, and 4 to 7 business days for regional and tier-2/3 postal circles across India.',
        },
        {
          q: 'What are the shipping charges?',
          a: 'We offer FREE Standard Delivery on all orders above ₹999 (99,900 paise). For orders below ₹999, a nominal flat delivery fee of ₹50 is applied at checkout.',
        },
      ],
    },
    {
      category: 'Payments & Order Tracking',
      icon: CreditCard,
      questions: [
        {
          q: 'What payment methods are supported?',
          a: 'We accept all major UPI apps (Google Pay, PhonePe, Paytm, BHIM), Credit & Debit Cards (Visa, MasterCard, RuPay), Net Banking across 50+ Indian banks, and Cash on Delivery (COD).',
        },
        {
          q: 'How can I track my shipment?',
          a: 'Once your package is dispatched, you will receive an SMS and email notification with your AWB tracking number. You can also visit our dedicated Track Order page anytime and enter your Order ID.',
        },
      ],
    },
    {
      category: 'Returns & Cancellations',
      icon: RefreshCw,
      questions: [
        {
          q: 'What is your return policy for food and pantry items?',
          a: 'Due to strict hygiene, food safety, and FSSAI standards, opened food and wellness items cannot be returned. However, if your shipment arrives damaged, leaked, or incorrect, notify us within 48 hours for an immediate free replacement or full refund.',
        },
        {
          q: 'How do I initiate a return or claim for damaged goods?',
          a: 'Simply email support@infinicharm.com with your Order ID and photos of the damaged package, or message our live care team directly on our website chat.',
        },
      ],
    },
  ];

  const allFaqs = faqCategories.flatMap((c) =>
    c.questions.map((q) => ({ question: q.q, answer: q.a }))
  );
  const faqJsonLd = generateFAQSchema(allFaqs);

  return (
    <div className="py-12 bg-surface-dim/40 min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <Container className="max-w-4xl">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-semibold text-accent uppercase tracking-widest bg-accent/10 px-3 py-1 rounded-full">
            Help & Transparency
          </span>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-primary mt-4 tracking-tight">
            Frequently Asked Questions
          </h1>
          <p className="text-sm text-muted mt-3">
            Honest answers regarding our extraction processes, purity assurances, dispatch origins, and customer protections.
          </p>
        </div>

        {/* Categories */}
        <div className="space-y-10">
          {faqCategories.map((group, idx) => {
            const Icon = group.icon;
            return (
              <div key={idx} className="bg-surface rounded-2xl border border-border p-6 sm:p-8 shadow-sm">
                <div className="flex items-center gap-3 pb-4 mb-6 border-b border-border">
                  <div className="p-2.5 rounded-xl bg-surface-dim text-accent">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h2 className="font-display text-lg sm:text-xl font-bold text-primary">
                    {group.category}
                  </h2>
                </div>

                <div className="space-y-6">
                  {group.questions.map((faq, qIdx) => (
                    <div key={qIdx} className="space-y-2">
                      <h3 className="text-sm font-semibold text-primary flex items-start gap-2">
                        <span className="text-accent font-bold">Q:</span>
                        <span>{faq.q}</span>
                      </h3>
                      <p className="text-xs sm:text-sm text-muted leading-relaxed pl-5">
                        {faq.a}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Live Support Help Box */}
        <div className="mt-12 text-center p-8 bg-surface rounded-2xl border border-border">
          <h3 className="font-display text-lg font-bold text-primary">Still have questions?</h3>
          <p className="text-xs text-muted mt-2 max-w-md mx-auto">
            Our founder and customer care team are always here to help. Reach out directly via live chat or email.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 mt-6">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-lg transition-colors"
            >
              Contact Support
            </Link>
            <Link
              href="/track-order"
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-surface-dim hover:bg-border text-primary text-xs font-semibold rounded-lg transition-colors border border-border"
            >
              Track an Existing Order
            </Link>
          </div>
        </div>
      </Container>
    </div>
  );
}

