import React from 'react';
import OrderDetailClient from './OrderDetailClient';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateStaticParams() {
  return [
    { id: 'INF-202611-2527' },
  ];
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  return {
    title: `Order #${id} Details | InfiniCharm Patron Account`,
    description: `Track itemized consignment breakdown, delivery address, live courier logistics, and payment verification for InfiniCharm order #${id}.`,
  };
}

export default async function OrderDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <OrderDetailClient orderId={id} />;
}
