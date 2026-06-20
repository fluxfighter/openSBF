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
