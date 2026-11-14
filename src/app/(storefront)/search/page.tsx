import React, { Suspense } from 'react';
import { ShopAllProductsView } from '@/components/shop/ShopAllProductsView';
import { Container } from '@/components/ui/Container';
import { Skeleton } from '@/components/ui/Skeleton';

// ==============================================================================
// InfiniCharm — Product Search Results Route (/search)
// Design Reference: All_Docs/Designs/InfiniCharm Product Search Results - organic honey
// Standards: 100% Real Data, Server Financial Authority, Shared DRY Component
// ==============================================================================

export const metadata = {
  title: 'Product Search Results | InfiniCharm',
  description:
    'Search 100% Kashmiri Honey, Zamzam Water – 5 Litres, Takmeeli Talbeena, Barliva, and Premium Dates – 1 KG directly from InfiniCharm.',
};

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 bg-canvas">
          <Container>
            <Skeleton className="h-32 w-full rounded-2xl mb-6" />
            <Skeleton className="h-12 w-full rounded-full mb-8" />
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-8">
              <Skeleton className="hidden lg:block lg:col-span-3 h-[600px] rounded-2xl" />
              <div className="col-span-1 lg:col-span-9 min-w-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <Skeleton key={i} className="h-80 rounded-2xl" />
                ))}
              </div>
            </div>
          </Container>
        </div>
      }
    >
      <ShopAllProductsView />
    </Suspense>
  );
}

