'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function ConfirmationRedirect() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const orderNumber = searchParams.get('orderNumber') || searchParams.get('order_id') || '';
    if (orderNumber) {
      router.replace(`/checkout/success?order_id=${encodeURIComponent(orderNumber)}`);
    } else {
      router.replace('/shop');
    }
  }, [searchParams, router]);

  return (
    <div className="min-h-[50vh] flex items-center justify-center text-xs text-muted">
      Verifying payment and redirecting to order receipt...
    </div>
  );
}

export default function ConfirmationPage() {
  return (
    <Suspense fallback={<div className="min-h-[50vh] flex items-center justify-center">Loading...</div>}>
      <ConfirmationRedirect />
    </Suspense>
  );
}

