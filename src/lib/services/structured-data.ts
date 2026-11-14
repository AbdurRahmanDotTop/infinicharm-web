import { BRAND } from '../constants/brand.ts';
import type { Product, ProductVariant, BlogPost } from '../../types/index.ts';
import { getAppOrigin, buildAbsoluteUrl } from '../utils/env-urls.ts';

export function generateOrganizationSchema() {
  const origin = getAppOrigin();
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${origin}/#organization`,
    name: BRAND.name,
    legalName: BRAND.operatingEntity,
    url: origin,
    logo: `${origin}/icon.svg`,
    founder: {
      '@type': 'Person',
      name: BRAND.founder,
      url: BRAND.founderWebsite,
    },
    address: {
      '@type': 'PostalAddress',
      streetAddress: BRAND.contact.address.line1 + ', ' + BRAND.contact.address.line2,
      addressLocality: BRAND.contact.address.city,
      addressRegion: BRAND.contact.address.state,
      postalCode: BRAND.contact.address.postalCode,
      addressCountry: BRAND.contact.address.country,
    },
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email: BRAND.contact.supportEmail,
        areaServed: 'IN',
        availableLanguage: ['English', 'Hindi'],
      },
    ],
  };
}

export function generateWebSiteSchema() {
  const origin = getAppOrigin();
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${origin}/#website`,
    url: origin,
    name: BRAND.name,
    description: BRAND.tagline,
    publisher: {
      '@id': `${origin}/#organization`,
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${origin}/shop?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function generateProductSchema(product: Product, variant?: ProductVariant) {
  const origin = getAppOrigin();
  const activeVariant = variant || product.variants[0];
  const primaryMedia = product.media.find((m) => m.role === 'PRIMARY') || product.media[0];
  const images = product.media.map((m) => m.externalUrl);

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${origin}/product/${product.slug}#product`,
    name: product.title,
    description: product.shortDescription,
    image: images.length > 0 ? images : [primaryMedia?.externalUrl].filter(Boolean),
    sku: activeVariant?.sku || `INF-${product.id}`,
    brand: {
      '@type': 'Brand',
      name: BRAND.name,
    },
    countryOfOrigin: {
      '@type': 'Country',
      name: product.originCountry || 'India',
    },
    offers: {
      '@type': 'Offer',
      url: `${origin}/product/${product.slug}`,
      priceCurrency: 'INR',
      price: activeVariant ? (activeVariant.priceInPaise / 100).toFixed(2) : '0.00',
      priceValidUntil: '2027-12-31',
      itemCondition: 'https://schema.org/NewCondition',
      availability:
        activeVariant && activeVariant.stockQuantity > 0
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
      seller: {
        '@type': 'Organization',
        name: BRAND.name,
      },
    },
  };
}

export function generateBreadcrumbSchema(items: { name: string; url: string }[]) {
  const origin = getAppOrigin();
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url.startsWith('http') ? item.url : `${origin}${item.url.startsWith('/') ? '' : '/'}${item.url}`,
    })),
  };
}

export function generateArticleSchema(post: BlogPost) {
  const origin = getAppOrigin();
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': `${origin}/blog/${post.slug}#article`,
    headline: post.title,
    description: post.summary,
    image: post.featuredImageUrl ? [post.featuredImageUrl] : [],
    author: {
      '@type': 'Person',
      name: post.authorName,
      url: BRAND.founderWebsite,
    },
    publisher: {
      '@type': 'Organization',
      name: BRAND.name,
      logo: {
        '@type': 'ImageObject',
        url: `${origin}/icon.svg`,
      },
    },
    datePublished: post.publishedAt || post.createdAt,
    dateModified: post.updatedAt || post.createdAt,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${origin}/blog/${post.slug}`,
    },
  };
}

export function generateFAQSchema(faqs: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}
