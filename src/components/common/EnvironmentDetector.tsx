'use client';

// ==============================================================================
// InfiniCharm — Client Environment Detector & Synchronizer
// Standard: Revalidates on every visit and hard refresh; zero 24h expiration
// Ensures client origin matches window.location.origin dynamically.
// ==============================================================================

import { useEffect } from 'react';
import { syncClientEnvironmentOrigin } from '../../lib/utils/env-urls.ts';

export function EnvironmentDetector() {
  useEffect(() => {
    // Initial mount sync & first-visit recording
    syncClientEnvironmentOrigin();

    // Revalidate on window focus / visibility change (e.g. if tab restored or port shifted)
    const handleRevalidate = () => {
      syncClientEnvironmentOrigin();
    };

    window.addEventListener('focus', handleRevalidate);
    window.addEventListener('visibilitychange', handleRevalidate);

    return () => {
      window.removeEventListener('focus', handleRevalidate);
      window.removeEventListener('visibilitychange', handleRevalidate);
    };
  }, []);

  return null;
}

