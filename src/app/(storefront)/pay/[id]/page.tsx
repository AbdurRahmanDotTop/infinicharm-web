import React from 'react';
import PaymentPage from '../page';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateStaticParams() {
  return [
    { id: 'INF-202611-2527' },
    { id: 'INF-202611-4435' },
  ];
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  return {
    title: `Payment for Order #${id} | InfiniCharm Official Gateway`,
    description: `Complete secure UPI payment for InfiniCharm order #${id} via Google Pay, PhonePe, Paytm, BHIM, or Dynamic QR.`,
  };
}

export default async function DynamicPaymentPage({ params }: PageProps) {
  await params;
  return <PaymentPage />;
}
