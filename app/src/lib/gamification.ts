import type { UserProgress } from './types';

// Lean gamification derived entirely from existing answer data — no extra
// persisted state, so it survives the cross-device merge for free.

// XP awarded per correct answer recorded (correctCount accumulates over reviews).
const XP_PER_CORRECT = 10;

// Default daily goal: number of cards answered in a day.
export const DAILY_GOAL = 20;

function localDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function studyDayKeys(progress: UserProgress): Set<string> {
  const days = new Set<string>();
  for (const q of Object.values(progress.questions)) {
    if (q.lastAnswered) days.add(localDayKey(new Date(q.lastAnswered)));
  }
  return days;
}

/**
 * Consecutive-day study streak. Counts back from today; the streak stays alive
 * if you studied today or (not yet today but) yesterday.
 */
export function getStreak(progress: UserProgress, now: number = Date.now()): number {
  const days = studyDayKeys(progress);
  if (days.size === 0) return 0;

  const cursor = new Date(now);
  // If nothing today, only continue if yesterday was active (grace period).
  if (!days.has(localDayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(localDayKey(cursor))) return 0;
  }

  let streak = 0;
  while (days.has(localDayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** Number of cards answered today (across all topics of all exams). */
export function getTodayCount(progress: UserProgress, now: number = Date.now()): number {
  const today = localDayKey(new Date(now));
  let count = 0;
  for (const q of Object.values(progress.questions)) {
    if (q.lastAnswered && localDayKey(new Date(q.lastAnswered)) === today) count++;
  }
  return count;
}

/** Total experience points — one tidy number that always goes up. */
export function getXp(progress: UserProgress): number {
  let correct = 0;
  for (const q of Object.values(progress.questions)) correct += q.correctCount ?? 0;
  return correct * XP_PER_CORRECT;
}

/** Total distinct days studied. */
export function getStudyDays(progress: UserProgress): number {
  return studyDayKeys(progress).size;
}

/**
 * Overall hit rate: share of all recorded answers that were correct. A plain,
 * understandable "how well am I doing" number. Returns null until there is data.
 */
export function getAccuracy(progress: UserProgress): number | null {
  let correct = 0;
  let total = 0;
  for (const q of Object.values(progress.questions)) {
    correct += q.correctCount ?? 0;
    total += (q.correctCount ?? 0) + (q.wrongCount ?? 0);
  }
  if (total === 0) return null;
  return Math.round((correct / total) * 100);
}

export interface Motivation {
  emoji: string;
  text: string;
}

/**
 * Pick one short, encouraging line that reacts to the learner's current state —
 * milestones first, then gentle nudges. Keeps motivation concrete and honest.
 */
export function getMotivation(input: {
  streak: number;
  todayCount: number;
  dueTotal: number;
  readiness: number; // best of the two exams
  seen: number;
}): Motivation {
  const { streak, todayCount, dueTotal, readiness, seen } = input;

  if (seen === 0) {
    return { emoji: '⚓', text: 'Willkommen an Bord! Starte mit „Heute lernen" — schon 10 Fragen bringen dich voran.' };
  }
  if (readiness >= 85) {
    return { emoji: '🎉', text: `Prüfungsreife ${readiness}% — du bist bereit! Teste dich an den Prüfungsbögen.` };
  }
  if (todayCount > 0 && dueTotal === 0) {
    return { emoji: '✅', text: 'Heute alles Fällige gelernt — stark! Morgen halten dich ein paar Wiederholungen im Flow.' };
  }
  if (streak >= 7) {
    return { emoji: '🔥', text: `${streak} Tage in Folge — beeindruckende Disziplin. Weiter so!` };
  }
  if (streak >= 3) {
    return { emoji: '🔥', text: `${streak}-Tage-Streak! Dranbleiben zahlt sich aus — jeden Tag ein bisschen.` };
  }
  if (readiness >= 70) {
    return { emoji: '💪', text: `Fast geschafft — ${readiness}% Prüfungsreife. Noch ein paar Sessions bis zum Ziel.` };
  }
  if (readiness >= 40) {
    return { emoji: '📈', text: `Guter Fortschritt — ${readiness}% Prüfungsreife. Bleib am Ball!` };
  }
  return { emoji: '🧭', text: 'Kleine Häppchen, großer Effekt: ein paar Karten pro Tag führen dich sicher zur Prüfung.' };
}
