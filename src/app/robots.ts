import type { MetadataRoute } from 'next';
import { BRAND } from '../lib/constants/brand.ts';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = BRAND.social.website;

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/account/',
          '/checkout/',
          '/api/',
          '/_next/',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
