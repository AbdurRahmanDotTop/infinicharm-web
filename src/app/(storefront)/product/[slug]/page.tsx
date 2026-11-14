import React from 'react';
import { notFound } from 'next/navigation';
import { getAllProducts, getProductBySlug } from '@/lib/data/products';
import ProductDetailClient from './ProductDetailClient';

interface ProductPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateStaticParams() {
  const products = getAllProducts(false);
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) return { title: 'Product Not Found | InfiniCharm' };

  const firstImageUrl = product.media?.[0]?.externalUrl;
  const description = product.seoDescription || product.shortDescription || product.tagline || '';

  return {
    title: product.seoTitle || `${product.title} | InfiniCharm`,
    description,
    openGraph: {
      title: product.seoTitle || product.title,
      description,
      images: firstImageUrl ? [firstImageUrl] : [],
    },
  };
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) {
    notFound();
  }

  return <ProductDetailClient initialSlug={slug} />;
}
