import Link from 'next/link';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { ArrowLeft, Compass } from 'lucide-react';

export default function RootNotFound() {
  return (
    <div className="min-h-screen bg-canvas text-primary flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full space-y-6">
        <div className="flex justify-center">
          <BrandLogo variant="light" size="lg" href="/" showTagline />
        </div>

        <div className="space-y-2">
          <span className="font-mono text-xs font-bold text-accent uppercase tracking-widest bg-accent/10 px-3 py-1 rounded-full border border-accent/20">
            Error 404
          </span>
          <h1 className="font-display text-3xl font-bold tracking-tight text-primary">
            Page Not Found
          </h1>
          <p className="text-xs sm:text-sm text-muted leading-relaxed">
            The page you requested could not be located in our harvest archives. It may have been moved or updated.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-accent hover:bg-accent-hover text-white text-xs font-bold transition-colors shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Homepage</span>
          </Link>

          <Link
            href="/shop"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-surface hover:bg-surface-dim border border-border text-primary text-xs font-bold transition-colors shadow-xs"
          >
            <Compass className="w-4 h-4 text-muted" />
            <span>Explore All Products</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

