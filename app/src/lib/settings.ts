// Small persisted user settings (client-only, localStorage).

const BINNEN_ZUSATZ_KEY = 'opensbf_binnen_zusatz';

/**
 * When true, SBF Binnen is treated as an add-on catalog: the shared basis
 * questions are hidden so someone who already does SBF See only learns the
 * Binnen-specific questions.
 */
export function isBinnenZusatzOnly(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(BINNEN_ZUSATZ_KEY) === 'on';
}

export function setBinnenZusatzOnly(on: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(BINNEN_ZUSATZ_KEY, on ? 'on' : 'off');
}
