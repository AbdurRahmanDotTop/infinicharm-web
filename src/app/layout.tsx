import type { Metadata, Viewport } from 'next';
import { Manrope, Inter } from 'next/font/google';
import './globals.css';
import { BRAND } from '@/lib/constants/brand';
import { FloatingControlsDock } from '@/components/common/FloatingControlsDock';
import { CartProvider } from '@/lib/context/CartContext';
import { WishlistProvider } from '@/lib/context/WishlistContext';
import { CartDrawer } from '@/components/layout/CartDrawer';
import {
  generateOrganizationSchema,
  generateWebSiteSchema,
} from '@/lib/services/structured-data';
import { getAppOrigin } from '@/lib/utils/env-urls';
import { EnvironmentDetector } from '@/components/common/EnvironmentDetector';

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: {
    default: `${BRAND.name} — ${BRAND.tagline}`,
    template: `%s | ${BRAND.name}`,
  },
  description:
    'Discover 100% Kashmiri Honey, Zamzam Water – 5 Litres, Takmeeli Talbeena, Barliva, and Premium Dates – 1 KG. Dispatched directly from East Champaran, Bihar.',
  keywords: [
    'InfiniCharm',
    '100% Kashmiri Honey',
    'Zamzam Water 5 Litres',
    'Takmeeli Talbeena',
    'Barliva',
    'Premium Dates 1 KG',
    'Techily Fly',
  ],
  authors: [{ name: BRAND.founder, url: BRAND.founderWebsite }],
  creator: BRAND.operatingEntity,
  publisher: BRAND.name,
  metadataBase: new URL(getAppOrigin()),
  openGraph: {
    title: `${BRAND.name} — Everyday essentials. Selected with care.`,
    description:
      '100% Kashmiri Honey, Zamzam Water, Takmeeli Talbeena, Barliva, and Premium Dates. Honest sourcing and clear disclosures.',
    url: getAppOrigin(),
    siteName: BRAND.name,
    locale: 'en_IN',
    type: 'website',
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/apple-icon.svg', type: 'image/svg+xml' },
    ],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const organizationJsonLd = generateOrganizationSchema();
  const websiteJsonLd = generateWebSiteSchema();

  return (
    <html lang="en" className={`${manrope.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        <script
          id="infinicharm-env-sync"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var o=window.location.origin;if(!localStorage.getItem('infinicharm_app_origin')){localStorage.setItem('infinicharm_first_visit_at',new Date().toISOString());}localStorage.setItem('infinicharm_app_origin',o);localStorage.setItem('infinicharm_origin_last_synced_at',new Date().toISOString());document.cookie='infinicharm_origin='+encodeURIComponent(o)+'; Path=/; SameSite=Lax; Max-Age=31536000';}catch(e){}})();`,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
      </head>
      <body
        suppressHydrationWarning
        className="bg-canvas text-primary antialiased min-h-screen flex flex-col"
      >
        <EnvironmentDetector />
        <CartProvider>
          <WishlistProvider>
            {children}
            <CartDrawer />
            <FloatingControlsDock />
          </WishlistProvider>
        </CartProvider>
      </body>
    </html>
  );
}
