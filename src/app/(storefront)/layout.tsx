import React from 'react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export default function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <main id="main-content" tabIndex={-1} className="flex-1 w-full min-w-0 outline-none">{children}</main>
      <Footer />
    </>
  );
}

