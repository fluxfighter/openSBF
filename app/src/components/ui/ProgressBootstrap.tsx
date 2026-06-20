'use client';

import { useEffect } from 'react';
import { pullServerProgress } from '@/lib/progress';

const SESSION_FLAG = 'opensbf_synced';

/**
 * On first load of a browser session, pull the server-side progress and merge
 * it into the local cache. If that brought in newer data from another device,
 * reload once so already-mounted pages reflect it. Runs at most once per session
 * to avoid reload loops. Renders nothing.
 */
export function ProgressBootstrap(): null {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (sessionStorage.getItem(SESSION_FLAG)) return;

    let cancelled = false;
    void pullServerProgress().then((merged) => {
      if (cancelled) return;
      sessionStorage.setItem(SESSION_FLAG, '1');
      if (merged) window.location.reload();
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
