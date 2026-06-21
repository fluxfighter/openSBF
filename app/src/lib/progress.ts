import type { UserProgress, QuestionProgress, ExamType, Question, ExamResult, PruefungsbogenStats } from './types';
import { applyGrade, gradeFromCorrect } from './srs';

const STORAGE_KEY = 'opensbf_progress';
const CORRECT_THRESHOLD = 3;

function emptyProgress(): UserProgress {
  return { questions: {}, topics: {}, pruefungsboegen: {}, bookmarks: {}, lastUpdated: new Date().toISOString() };
}

export function loadProgress(): UserProgress {
  if (typeof window === 'undefined') return emptyProgress();
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return emptyProgress();
  const parsed = JSON.parse(raw) as UserProgress;
  // backfill for older stored data that predates these fields
  if (!parsed.pruefungsboegen) parsed.pruefungsboegen = {};
  if (!parsed.bookmarks) parsed.bookmarks = {};
  return parsed;
}

export function saveProgress(progress: UserProgress): void {
  if (typeof window === 'undefined') return;
  progress.lastUpdated = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  schedulePush(progress);
}

// ---------------------------------------------------------------------------
// Server sync (single-user self-hosted backend at /api/state)
// localStorage is the instant local cache; the server file is the cross-device
// source of truth. Writes are debounced and best-effort; failures are ignored
// so the app keeps working fully offline.
// ---------------------------------------------------------------------------

const SYNC_ENDPOINT = '/api/state';
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pendingPush: UserProgress | null = null;

function flushPendingPush(): void {
  if (!pendingPush) return;
  const payload = pendingPush;
  pendingPush = null;
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  // keepalive: true lets the request outlive the page (PWA background, tab close, navigation).
  void fetch(SYNC_ENDPOINT, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {});
}

function schedulePush(progress: UserProgress): void {
  if (typeof window === 'undefined') return;
  pendingPush = progress;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    const payload = pendingPush;
    pendingPush = null;
    if (!payload) return;
    void fetch(SYNC_ENDPOINT, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {
      // offline / server unavailable — local cache already holds the data
    });
  }, 800);
}

// Flush any pending push when the page is hidden or unloaded. This covers:
// – iOS PWA moving to background (visibilitychange → hidden)
// – Tab close / browser quit (pagehide)
// – Next.js SPA navigation is handled by the 800ms timer surviving in the module scope.
if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPendingPush();
  });
  window.addEventListener('pagehide', flushPendingPush);
}

/**
 * Pull the server state and merge it into the local cache. Returns the merged
 * progress, or null if nothing changed / the server is unreachable. Intended to
 * run once on app start so a second device picks up progress made elsewhere.
 */
export async function pullServerProgress(): Promise<UserProgress | null> {
  if (typeof window === 'undefined') return null;
  try {
    const res = await fetch(SYNC_ENDPOINT, { method: 'GET', cache: 'no-store' });
    if (!res.ok) return null;
    const server: unknown = await res.json();
    if (typeof server !== 'object' || server === null) return null;
    const serverProgress = server as UserProgress;
    if (!serverProgress.questions) return null;

    const local = loadProgress();
    const merged = mergeProgress(local, serverProgress);

    const before = JSON.stringify(local.questions) + JSON.stringify(local.pruefungsboegen ?? {});
    const after = JSON.stringify(merged.questions) + JSON.stringify(merged.pruefungsboegen ?? {});
    if (before === after) return null;

    saveProgress(merged);
    return merged;
  } catch {
    return null;
  }
}

export function getQuestionKey(questionId: number, exam: ExamType): string {
  return `${exam}_${questionId}`;
}

export function recordAnswer(
  progress: UserProgress,
  questionId: number,
  exam: ExamType,
  isCorrect: boolean,
  easy = false,
): UserProgress {
  const key = getQuestionKey(questionId, exam);
  const existing = progress.questions[key];

  const srs = applyGrade(existing, gradeFromCorrect(isCorrect, easy));

  const updated: QuestionProgress = {
    questionId,
    exam,
    correctCount: isCorrect ? (existing?.correctCount ?? 0) + 1 : existing?.correctCount ?? 0,
    wrongCount: isCorrect ? (existing?.wrongCount ?? 0) : (existing?.wrongCount ?? 0) + 1,
    lastAnswered: new Date().toISOString(),
    ease: srs.ease,
    intervalDays: srs.intervalDays,
    due: srs.due,
    reps: srs.reps,
    bestReps: Math.max(existing?.bestReps ?? 0, srs.reps),
    lapses: srs.lapses,
  };

  return {
    ...progress,
    questions: {
      ...progress.questions,
      [key]: updated,
    },
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Current consecutive-correct streak toward mastery. Uses the SRS `reps`
 * (resets to 0 on a wrong answer), so mastery honestly reflects retention —
 * a forgotten question drops below the threshold again. Falls back to the
 * cumulative correctCount for legacy entries written before SRS existed.
 */
export function getQuestionStreak(progress: UserProgress, questionId: number, exam: ExamType): number {
  const e = progress.questions[getQuestionKey(questionId, exam)];
  if (!e) return 0;
  return e.reps ?? e.correctCount ?? 0;
}

/** Highest consecutive-correct streak ever reached — the "ghost" max shown behind the current streak. */
export function getQuestionBestStreak(progress: UserProgress, questionId: number, exam: ExamType): number {
  const e = progress.questions[getQuestionKey(questionId, exam)];
  if (!e) return 0;
  // Legacy fallback: entries without reps/bestReps but past the threshold count as fully mastered.
  const legacy = (e.correctCount ?? 0) >= CORRECT_THRESHOLD ? CORRECT_THRESHOLD : 0;
  return Math.max(e.bestReps ?? 0, e.reps ?? 0, legacy);
}

export function isQuestionPassed(progress: UserProgress, questionId: number, exam: ExamType): boolean {
  return getQuestionStreak(progress, questionId, exam) >= CORRECT_THRESHOLD;
}

export function getQuestionCorrectCount(progress: UserProgress, questionId: number, exam: ExamType): number {
  const key = getQuestionKey(questionId, exam);
  return progress.questions[key]?.correctCount ?? 0;
}

export function getQuestionWrongCount(progress: UserProgress, questionId: number, exam: ExamType): number {
  const key = getQuestionKey(questionId, exam);
  return progress.questions[key]?.wrongCount ?? 0;
}

// ---------------------------------------------------------------------------
// Bookmarks ("gemerkte Fragen")
// ---------------------------------------------------------------------------

export function isBookmarked(progress: UserProgress, questionId: number, exam: ExamType): boolean {
  return progress.bookmarks?.[getQuestionKey(questionId, exam)] === true;
}

/** Pure toggle — returns new progress with the bookmark flipped. */
export function toggleBookmark(progress: UserProgress, questionId: number, exam: ExamType): UserProgress {
  const key = getQuestionKey(questionId, exam);
  const bookmarks = { ...(progress.bookmarks ?? {}) };
  if (bookmarks[key]) delete bookmarks[key];
  else bookmarks[key] = true;
  return { ...progress, bookmarks, lastUpdated: new Date().toISOString() };
}

export function getBookmarkCount(progress: UserProgress, exam: ExamType, ids?: number[]): number {
  const set = progress.bookmarks ?? {};
  if (ids) return ids.filter((id) => set[getQuestionKey(id, exam)] === true).length;
  const prefix = `${exam}_`;
  return Object.entries(set).filter(([k, v]) => v === true && k.startsWith(prefix)).length;
}

export function getBookmarkedQuestions(
  progress: UserProgress,
  exam: ExamType,
  allQuestions: Question[],
): Question[] {
  return allQuestions.filter((q) => isBookmarked(progress, q.id, exam));
}

export const HARD_QUESTIONS_LIMIT = 20;

export function getHardestQuestions(
  progress: UserProgress,
  exam: ExamType,
  allQuestions: Question[],
  limit = HARD_QUESTIONS_LIMIT,
): Question[] {
  return allQuestions
    .map((q) => ({ question: q, wrongCount: progress.questions[getQuestionKey(q.id, exam)]?.wrongCount ?? 0 }))
    .filter(({ wrongCount }) => wrongCount > 0)
    .sort((a, b) => b.wrongCount - a.wrongCount)
    .slice(0, limit)
    .map(({ question }) => question);
}

export function getTopicProgress(
  progress: UserProgress,
  questionIds: number[],
  exam: ExamType,
): { passed: number; total: number; percentage: number } {
  const total = questionIds.length;
  const passed = questionIds.filter((id) => isQuestionPassed(progress, id, exam)).length;
  return { passed, total, percentage: total > 0 ? Math.round((passed / total) * 100) : 0 };
}

export function isTopicPassed(
  progress: UserProgress,
  questionIds: number[],
  exam: ExamType,
): boolean {
  return questionIds.every((id) => isQuestionPassed(progress, id, exam));
}

export function resetProgress(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

export function exportProgress(): string {
  const progress = loadProgress();
  return JSON.stringify(progress, null, 2);
}

export function mergeProgress(current: UserProgress, imported: UserProgress): UserProgress {
  const merged: UserProgress['questions'] = { ...current.questions };

  for (const [key, importedQ] of Object.entries(imported.questions)) {
    const existing = merged[key];
    // Counts accumulate (max wins); for the SRS schedule keep the entry that was
    // answered most recently, so the freshest device's review state survives.
    const importedNewer =
      !existing || new Date(importedQ.lastAnswered).getTime() >= new Date(existing.lastAnswered).getTime();
    const fresher = importedNewer ? importedQ : existing;
    merged[key] = {
      ...fresher,
      correctCount: Math.max(importedQ.correctCount, existing?.correctCount ?? 0),
      wrongCount: Math.max(importedQ.wrongCount ?? 0, existing?.wrongCount ?? 0),
      bestReps: Math.max(importedQ.bestReps ?? 0, existing?.bestReps ?? 0, fresher.reps ?? 0),
    };
  }

  // Merge exam results: combine arrays, deduplicate by takenAt
  const mergedPb: UserProgress['pruefungsboegen'] = { ...(current.pruefungsboegen ?? {}) };
  for (const [key, results] of Object.entries(imported.pruefungsboegen ?? {})) {
    const existingResults = mergedPb[key] ?? [];
    const existingTimes = new Set(existingResults.map((r) => r.takenAt));
    const newResults = results.filter((r) => !existingTimes.has(r.takenAt));
    mergedPb[key] = [...existingResults, ...newResults].sort((a, b) =>
      a.takenAt.localeCompare(b.takenAt),
    );
  }

  // Bookmarks: union — a question stays bookmarked if either side has it.
  const mergedBookmarks: UserProgress['bookmarks'] = { ...(current.bookmarks ?? {}) };
  for (const [key, on] of Object.entries(imported.bookmarks ?? {})) {
    if (on) mergedBookmarks[key] = true;
  }

  return {
    questions: merged,
    topics: {},
    pruefungsboegen: mergedPb,
    bookmarks: mergedBookmarks,
    lastUpdated: new Date().toISOString(),
  };
}

export function validateImport(raw: string): UserProgress | null {
  try {
    const parsed = JSON.parse(raw) as UserProgress;
    if (typeof parsed !== 'object' || !parsed.questions) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function resetTopicProgress(
  progress: UserProgress,
  questionIds: number[],
  exam: ExamType,
): UserProgress {
  const updatedQuestions = { ...progress.questions };
  questionIds.forEach((id) => {
    const key = getQuestionKey(id, exam);
    delete updatedQuestions[key];
  });
  return { ...progress, questions: updatedQuestions };
}

export function getExamOverallProgress(
  progress: UserProgress,
  allQuestionIds: number[],
  exam: ExamType,
): { passed: number; total: number; percentage: number } {
  return getTopicProgress(progress, allQuestionIds, exam);
}

// ---------------------------------------------------------------------------
// Prüfungsbögen exam result persistence
// ---------------------------------------------------------------------------

export function pruefungsbogenKey(nummer: number): string {
  return `see_pb_${String(nummer).padStart(2, '0')}`;
}

export function saveExamResult(result: ExamResult, nummer: number): void {
  const progress = loadProgress();
  const key = pruefungsbogenKey(nummer);
  const existing = progress.pruefungsboegen[key] ?? [];
  const updated: UserProgress = {
    ...progress,
    pruefungsboegen: {
      ...progress.pruefungsboegen,
      [key]: [...existing, result],
    },
  };
  saveProgress(updated);
}

export function getExamResults(progress: UserProgress, nummer: number): ExamResult[] {
  return progress.pruefungsboegen[pruefungsbogenKey(nummer)] ?? [];
}

export function getBestExamResult(progress: UserProgress, nummer: number): ExamResult | null {
  const results = getExamResults(progress, nummer);
  if (results.length === 0) return null;
  return results.reduce((best, r) => (r.correct > best.correct ? r : best), results[0]);
}

export function getLastExamResult(progress: UserProgress, nummer: number): ExamResult | null {
  const results = getExamResults(progress, nummer);
  return results.length > 0 ? results[results.length - 1] : null;
}

/** Aggregate attempt statistics for one Prüfungsbogen (attempts, average, passes). */
export function getPruefungsbogenStats(progress: UserProgress, nummer: number): PruefungsbogenStats {
  const results = getExamResults(progress, nummer);
  const attempts = results.length;
  if (attempts === 0) {
    return { attempts: 0, avgCorrect: 0, passedCount: 0, bestCorrect: 0, lastCorrect: null, lastPassed: null };
  }
  const sum = results.reduce((s, r) => s + r.correct, 0);
  const passedCount = results.filter((r) => r.passed).length;
  const bestCorrect = results.reduce((m, r) => Math.max(m, r.correct), 0);
  const last = results[results.length - 1];
  return {
    attempts,
    avgCorrect: Math.round((sum / attempts) * 10) / 10,
    passedCount,
    bestCorrect,
    lastCorrect: last.correct,
    lastPassed: last.passed,
  };
}
