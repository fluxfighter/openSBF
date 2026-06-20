// Tiny WebAudio sound cues — synthesised on the fly, no audio assets to ship.
// Used for the satisfying "correct" chime and the end-of-session fanfare.

const SOUND_KEY = 'opensbf_sound';

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (typeof window.AudioContext === 'undefined') return null;
  if (!ctx) ctx = new window.AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  return window.localStorage.getItem(SOUND_KEY) !== 'off';
}

export function setSoundEnabled(on: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SOUND_KEY, on ? 'on' : 'off');
}

/** Play a short sine "blip" at the given frequency and time offset. */
function blip(c: AudioContext, freq: number, atOffset: number, duration: number, peak = 0.14): void {
  const osc = c.createOscillator();
  const gain = c.createGain();
  const start = c.currentTime + atOffset;
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, start);
  // Quick attack, smooth exponential release — soft and pleasant.
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(c.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

/** A bright two-note rise for a correct answer. */
export function playCorrect(): void {
  if (!isSoundEnabled()) return;
  const c = getCtx();
  if (!c) return;
  blip(c, 660, 0, 0.1);
  blip(c, 988, 0.08, 0.14);
}

/** An ascending arpeggio at the end of a session; longer the better the score. */
export function playFinish(stars: number): void {
  if (!isSoundEnabled()) return;
  const c = getCtx();
  if (!c) return;
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  const count = Math.max(2, Math.min(notes.length, stars + 1));
  for (let i = 0; i < count; i++) blip(c, notes[i], i * 0.13, 0.18);
}
