'use client';

import React, { useState } from 'react';
import { BRAND } from '@/lib/constants/brand';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Mail, MapPin, Phone, ShieldAlert, Clock, CheckCircle2, Send, AlertCircle } from 'lucide-react';
import { CustomerInquiry } from '@/types';

export default function ContactPage() {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedInquiry, setSubmittedInquiry] = useState<CustomerInquiry | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!fullName.trim() || !phone.trim() || !email.trim() || !message.trim()) {
      setErrorMessage('Please fill in all mandatory fields.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    if (phone.replace(/\D/g, '').length < 10) {
      setErrorMessage('Please enter a valid 10-digit phone number.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          subject: subject.trim() || 'General Customer Inquiry',
          message: message.trim(),
          source: 'contact_page',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.inquiry) {
        setErrorMessage(data?.error || 'Unable to submit enquiry. Please try again.');
        return;
      }
      setSubmittedInquiry(data.inquiry);
      setFullName('');
      setPhone('');
      setEmail('');
      setSubject('');
      setMessage('');
    } catch {
      setErrorMessage('Network error submitting enquiry. Please retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="py-12 sm:py-16 space-y-12">
      <Container>
        <div className="max-w-2xl mx-auto text-center space-y-3 mb-12">
          <p className="text-xs uppercase tracking-widest font-semibold text-accent">
            Customer Care & Support
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-primary">
            We Are Here to Assist You
          </h1>
          <p className="text-xs sm:text-sm text-muted">
            Have a question about product origins, packaging, or an existing order? Get in touch with our team.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 max-w-5xl mx-auto">
          {/* Contact Details Column */}
          <div className="lg:col-span-5 space-y-6">
            <Card level={1} className="p-6 space-y-6">
              <h2 className="font-display text-lg font-bold text-primary border-b border-border pb-3">
                Official Contact Channels
              </h2>

              <div className="space-y-4 text-xs">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-md bg-surface-dim text-accent">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <strong className="block text-primary font-medium">Customer Support Email</strong>
                    <a href={`mailto:${BRAND.contact.supportEmail}`} className="text-muted hover:text-accent">
                      {BRAND.contact.supportEmail}
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-md bg-surface-dim text-accent">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <strong className="block text-primary font-medium">Registered Office & Fulfillment Center</strong>
                    <p className="text-muted leading-relaxed mt-0.5">
                      {BRAND.contact.address.fullAddress}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-md bg-surface-dim text-accent">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <strong className="block text-primary font-medium">Operating Hours</strong>
                    <p className="text-muted mt-0.5">
                      Monday to Saturday: 9:00 AM – 7:00 PM IST
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Grievance Officer Notice */}
            <Card level={1} className="p-6 bg-surface-dim/40 border-border space-y-2">
              <div className="flex items-center gap-2 text-primary font-semibold text-xs">
                <ShieldAlert className="w-4 h-4 text-accent" />
                <span>Designated Grievance Officer</span>
              </div>
              <p className="text-[11px] text-muted leading-relaxed">
                In compliance with Consumer Protection (E-Commerce) Rules 2020:
                <br />
                <strong>{BRAND.founder}</strong> (Founder & CEO)
                <br />
                Email: {BRAND.contact.supportEmail}
                <br />
                Complaints acknowledged within 48 hours.
              </p>
            </Card>
          </div>

          {/* Contact Inquiry Form Column */}
          <div className="lg:col-span-7">
            <Card level={1} className="p-8 sm:p-10 space-y-6">
              {submittedInquiry ? (
                <div className="text-center py-8 space-y-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="font-display text-2xl font-bold text-primary">Inquiry Submitted Successfully</h3>
                  <div className="bg-surface-dim p-4 rounded-2xl max-w-sm mx-auto text-xs space-y-1 font-mono">
                    <p className="text-muted">Ticket Reference Number:</p>
                    <p className="text-accent font-bold text-sm">{submittedInquiry.id}</p>
                  </div>
                  <p className="text-xs text-muted max-w-md mx-auto leading-relaxed">
                    Thank you, <strong className="text-primary">{submittedInquiry.name}</strong>. Our customer support desk at East Champaran, Bihar will review your message and reply to <strong className="text-primary">{submittedInquiry.email}</strong> within 24 business hours.
                  </p>
                  <button
                    onClick={() => setSubmittedInquiry(null)}
                    className="mt-4 px-6 py-2.5 bg-primary text-white text-xs font-bold rounded-xl"
                  >
                    Send Another Message
                  </button>
                </div>
              ) : (
                <>
                  <div>
                    <h2 className="font-display text-xl font-bold text-primary">
                      Send Us a Direct Message
                    </h2>
                    <p className="text-xs text-muted mt-1">
                      Fill in your details below and our customer support team will respond within 24 business hours.
                    </p>
                  </div>

                  {errorMessage && (
                    <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-semibold text-primary mb-1">Your Full Name *</label>
                        <input
                          type="text"
                          required
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="e.g. Ramesh Kumar"
                          className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-primary mb-1">Phone Number *</label>
                        <input
                          type="tel"
                          required
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="10-digit mobile number"
                          className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-primary mb-1">Email Address *</label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-primary mb-1">Subject / Order Reference</label>
                      <input
                        type="text"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="e.g. Inquiry regarding 100% Kashmiri Honey or Zamzam Water order"
                        className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-primary mb-1">Your Message *</label>
                      <textarea
                        rows={4}
                        required
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Tell us how we can assist you..."
                        className="w-full px-3.5 py-2.5 bg-surface-dim border border-border rounded-xl text-primary focus:outline-none focus:border-accent"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-6 py-3 bg-accent hover:bg-accent-hover text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isSubmitting ? 'Transmitting Message...' : 'Submit Inquiry'}</span>
                    </button>
                  </form>
                </>
              )}
            </Card>
          </div>
        </div>
      </Container>
    </div>
  );
}
