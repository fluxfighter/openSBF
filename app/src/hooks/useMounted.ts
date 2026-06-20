'use client';

import { useSyncExternalStore } from 'react';

const emptySubscribe = (): (() => void) => () => {};

/**
 * Returns false on the server and during hydration, then true on the client.
 * Gate any localStorage- or Math.random-derived UI behind this so the
 * server-rendered HTML matches the first client render (no hydration mismatch).
 *
 * Uses useSyncExternalStore so the server/hydration snapshot is false and the
 * client snapshot is true — without a setState-in-effect.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}
