import type { Question, QuestionProgress, UserProgress, ExamType, SrsGrade } from './types';

// SM-2-light spaced repetition. Pure scheduling logic with no DOM/storage deps
// so it stays trivially testable and reusable on both client and server.

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_EASE = 1.3;
const DEFAULT_EASE = 2.5;

// A card is considered "learned/stable" (counts towards exam readiness) once its
// review interval reaches roughly a week — i.e. it survived several reviews.
export const STABLE_INTERVAL_DAYS = 8;

// How many never-seen questions to introduce per daily queue build.
export const DEFAULT_NEW_PER_DAY = 15;

export interface SrsFields {
  ease: number;
  intervalDays: number;
  due: string;
  reps: number;
  lapses: number;
}

function qKey(questionId: number, exam: ExamType): string {
  return `${exam}_${questionId}`;
}

/** Compute the next SRS state from the previous one and the grade given. */
export function applyGrade(
  prev: Pick<QuestionProgress, 'ease' | 'intervalDays' | 'reps' | 'lapses'> | undefined,
  grade: SrsGrade,
  now: number = Date.now(),
): SrsFields {
  const ease0 = prev?.ease ?? DEFAULT_EASE;
  const reps0 = prev?.reps ?? 0;
  const lapses0 = prev?.lapses ?? 0;
  const interval0 = prev?.intervalDays ?? 0;

  let ease = ease0;
  let reps: number;
  let lapses = lapses0;
  let intervalDays: number;

  if (grade === 'again') {
    reps = 0;
    lapses = lapses0 + 1;
    ease = Math.max(MIN_EASE, ease0 - 0.2);
    intervalDays = 0; // due again immediately (same session / same day)
  } else {
    reps = reps0 + 1;
    if (grade === 'easy') ease = ease0 + 0.15;

    if (reps === 1) intervalDays = grade === 'easy' ? 3 : 1;
    else if (reps === 2) intervalDays = grade === 'easy' ? 7 : 4;
    else intervalDays = Math.round((interval0 || 1) * ease);

    if (grade === 'easy') intervalDays = Math.round(intervalDays * 1.3);
    intervalDays = Math.max(1, intervalDays);
  }

  const due = new Date(now + intervalDays * DAY_MS).toISOString();
  return { ease, intervalDays, due, reps, lapses };
}

/** Map a binary correct/incorrect result onto an SRS grade. */
export function gradeFromCorrect(isCorrect: boolean, easy = false): SrsGrade {
  if (!isCorrect) return 'again';
  return easy ? 'easy' : 'good';
}

function entry(progress: UserProgress, id: number, exam: ExamType): QuestionProgress | undefined {
  return progress.questions[qKey(id, exam)];
}

/** A seen card is due when its scheduled review time has passed. */
export function isDue(p: QuestionProgress | undefined, now: number = Date.now()): boolean {
  if (!p || !p.due) return false;
  return new Date(p.due).getTime() <= now;
}

function isNew(p: QuestionProgress | undefined): boolean {
  return !p;
}

export interface QueueCounts {
  due: number;
  fresh: number; // available never-seen cards (capped at newPerDay)
  total: number;
}

export function getQueueCounts(
  progress: UserProgress,
  exam: ExamType,
  allQuestions: Question[],
  newPerDay: number = DEFAULT_NEW_PER_DAY,
  now: number = Date.now(),
): QueueCounts {
  let due = 0;
  let unseen = 0;
  for (const q of allQuestions) {
    const p = entry(progress, q.id, exam);
    if (isNew(p)) unseen++;
    else if (isDue(p, now)) due++;
  }
  const fresh = Math.min(unseen, newPerDay);
  return { due, fresh, total: due + fresh };
}

/**
 * Build today's learning queue: all due (previously seen) cards plus a capped
 * number of fresh cards, interleaved. This is the heart of "show the right
 * questions to pass with minimal time".
 */
export function buildDailyQueue(
  progress: UserProgress,
  exam: ExamType,
  allQuestions: Question[],
  options: { newPerDay?: number; now?: number; includeNew?: boolean } = {},
): Question[] {
  const { newPerDay = DEFAULT_NEW_PER_DAY, now = Date.now(), includeNew = true } = options;

  const due: Question[] = [];
  const fresh: Question[] = [];
  for (const q of allQuestions) {
    const p = entry(progress, q.id, exam);
    if (isNew(p)) {
      if (includeNew) fresh.push(q);
    } else if (isDue(p, now)) {
      due.push(q);
    }
  }

  const cappedFresh = shuffle(fresh).slice(0, newPerDay);
  return shuffle([...due, ...cappedFresh]);
}

// Predicted exam score >= this counts as exam-ready.
export const READINESS_TARGET = 85;

// Bayesian prior for novel-question skill: pretend we've seen PRIOR_N questions
// with a PRIOR_P first-try success rate, so the estimate is sane with little data.
const PRIOR_N = 6;
const PRIOR_P = 0.5;

/** Current recall probability of a seen card (FSRS-style retrievability). */
function retrievability(p: QuestionProgress, now: number): number {
  const stability = Math.max(p.intervalDays ?? 1, 1);
  const elapsedDays = Math.max(0, (now - new Date(p.lastAnswered).getTime()) / DAY_MS);
  return Math.pow(0.9, elapsedDays / stability); // 1 right after review, 0.9 at due date
}

/**
 * Smart exam readiness: the predicted share of the *whole* catalog you'd answer
 * correctly right now. Seen cards use their current recall probability; unseen
 * cards use your demonstrated first-try accuracy (Bayes-smoothed). This rewards
 * both breadth (seeing more) and retention (reviewing on time), and gives an
 * honest estimate for questions you've never encountered.
 */
export function getReadiness(
  progress: UserProgress,
  exam: ExamType,
  allQuestions: Question[],
  now: number = Date.now(),
): { percentage: number; predictedCorrect: number; total: number; seen: number; ready: boolean } {
  const total = allQuestions.length;

  // Demonstrated skill on fresh questions: fraction of seen cards answered
  // right without ever failing, smoothed with a weak prior.
  let seen = 0;
  let cleanFirstTry = 0;
  for (const q of allQuestions) {
    const p = entry(progress, q.id, exam);
    if (!p) continue;
    seen++;
    if ((p.correctCount ?? 0) > 0 && (p.wrongCount ?? 0) === 0) cleanFirstTry++;
  }
  const baseAccuracy = (cleanFirstTry + PRIOR_N * PRIOR_P) / (seen + PRIOR_N);

  let expected = 0;
  for (const q of allQuestions) {
    const p = entry(progress, q.id, exam);
    if (!p) {
      expected += baseAccuracy; // never seen → fall back to demonstrated skill
    } else if ((p.reps ?? 0) >= 1) {
      expected += Math.min(0.99, Math.max(0.3, retrievability(p, now)));
    } else {
      expected += baseAccuracy * 0.5; // currently lapsed/relearning
    }
  }

  const predictedCorrect = Math.round(expected);
  const percentage = total > 0 ? Math.round((expected / total) * 100) : 0;
  return { percentage, predictedCorrect, total, seen, ready: percentage >= READINESS_TARGET };
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
