'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // In development the SW's cache-first strategy serves stale bundles after
    // every edit. Only run it in production (where it powers offline/PWA), and
    // actively unregister any dev-registered worker.
    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
      return;
    }

    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .catch((err) => console.error('SW registration failed:', err));
  }, []);

  return null;
}
