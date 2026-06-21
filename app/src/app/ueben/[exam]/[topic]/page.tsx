'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import type { Question, ExamType, AnswerKey, SessionStats } from '@/lib/types';
import { Badge } from '@/components/ui/Badge';
import { getExamQuestions, getExamTopics } from '@/data/topics';
import { tutorialForTopic } from '@/data/tutorials';
import { isBinnenZusatzOnly } from '@/lib/settings';
import {
  loadProgress,
  saveProgress,
  recordAnswer,
  isQuestionPassed,
  getQuestionStreak,
  getQuestionBestStreak,
  getQuestionWrongCount,
  getHardestQuestions,
  getBookmarkedQuestions,
  isBookmarked,
  toggleBookmark,
  isTopicPassed,
} from '@/lib/progress';
import { buildDailyQueue } from '@/lib/srs';
import { playCorrect, playFinish, isSoundEnabled, setSoundEnabled } from '@/lib/sound';
import { useMounted } from '@/hooks/useMounted';
import { SpeakerWaveIcon, SpeakerXMarkIcon, BookmarkIcon } from '@heroicons/react/24/outline';
import { BookmarkIcon as BookmarkSolidIcon } from '@heroicons/react/24/solid';
import type { UserProgress } from '@/lib/types';

const CORRECT_THRESHOLD = 3;
const HARD_QUESTIONS_TOPIC_ID = 'schwierige-fragen';
const DAILY_QUEUE_TOPIC_ID = 'heute';
const BOOKMARKED_TOPIC_ID = 'gemerkte-fragen';

// ---------------------------------------------------------------------------
// Daily session persistence — saves the queue order for the current day so
// that pressing X and coming back resumes rather than reshuffles.
// ---------------------------------------------------------------------------

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadSessionQueue(exam: ExamType): number[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`opensbf_session_${exam}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { date: string; queueIds: number[] };
    if (parsed.date !== todayStr()) return null;
    return parsed.queueIds;
  } catch {
    return null;
  }
}

function saveSessionQueue(exam: ExamType, questions: Question[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(
    `opensbf_session_${exam}`,
    JSON.stringify({ date: todayStr(), queueIds: questions.map((q) => q.id) }),
  );
}

function clearSessionQueue(exam: ExamType): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(`opensbf_session_${exam}`);
}

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function getTopicQuestions(topicId: string, exam: ExamType, zusatz: boolean): Question[] {
  const topic = getExamTopics(exam, zusatz).find((t) => t.id === topicId);
  if (!topic) return [];
  const idSet = new Set(topic.questionIds);
  return getExamQuestions(exam, zusatz).filter((q) => idSet.has(q.id));
}

function getTopicName(topicId: string, exam: ExamType): string {
  if (topicId === HARD_QUESTIONS_TOPIC_ID) return 'Deine Problemfragen';
  if (topicId === DAILY_QUEUE_TOPIC_ID) return 'Heute lernen';
  if (topicId === BOOKMARKED_TOPIC_ID) return 'Gemerkte Fragen';
  return getExamTopics(exam, false).find((t) => t.id === topicId)?.name ?? topicId;
}

function isQueueMode(topicId: string): boolean {
  return (
    topicId === HARD_QUESTIONS_TOPIC_ID ||
    topicId === DAILY_QUEUE_TOPIC_ID ||
    topicId === BOOKMARKED_TOPIC_ID
  );
}

type ShuffledOption = { key: AnswerKey; text: string; originalKey: AnswerKey };

type QuestionView = {
  options: ShuffledOption[];
  selectedAnswer: AnswerKey | null;
  isRevealed: boolean;
};

type AnsweredRecord = { options: ShuffledOption[]; selectedAnswer: AnswerKey };

type QuizState = {
  progress: UserProgress;
  questions: Question[];
  currentIdx: number;
  view: QuestionView;
  // Revealed answers per deck index, so the user can step back and review them.
  answered: Record<number, AnsweredRecord>;
};

function makeView(question: Question): QuestionView {
  const options = shuffleArray(
    question.answers.map((a) => ({ key: a.key, text: a.text, originalKey: a.key })),
  );
  return { options, selectedAnswer: null, isRevealed: false };
}

// Rebuild the view for a deck index — restoring the revealed answer if it was
// already answered, otherwise a fresh (unrevealed) view.
function viewForIndex(state: QuizState, idx: number): QuestionView {
  const rec = state.answered[idx];
  if (rec) return { options: rec.options, selectedAnswer: rec.selectedAnswer, isRevealed: true };
  return makeView(state.questions[idx]);
}

function initQuizState(topicId: string, exam: ExamType, initialQ: number, zusatz: boolean): QuizState {
  const progress = loadProgress();
  const allQuestions = getExamQuestions(exam, zusatz);

  let questions: Question[];
  if (topicId === DAILY_QUEUE_TOPIC_ID) {
    const fresh = buildDailyQueue(progress, exam, allQuestions);
    const savedIds = loadSessionQueue(exam);
    if (savedIds && savedIds.length > 0) {
      // Restore the saved order; keep only questions still in today's queue.
      const stillDueIds = new Set(fresh.map((q) => q.id));
      const idToQ = new Map(allQuestions.map((q) => [q.id, q]));
      const restored = savedIds
        .filter((id) => stillDueIds.has(id))
        .map((id) => idToQ.get(id))
        .filter((q): q is Question => q !== undefined);
      questions = restored.length > 0 ? restored : fresh;
    } else {
      questions = fresh;
      saveSessionQueue(exam, fresh);
    }
  } else if (topicId === HARD_QUESTIONS_TOPIC_ID) {
    questions = shuffleArray(getHardestQuestions(progress, exam, allQuestions));
  } else if (topicId === BOOKMARKED_TOPIC_ID) {
    questions = shuffleArray(getBookmarkedQuestions(progress, exam, allQuestions));
  } else {
    const topicQuestions = getTopicQuestions(topicId, exam, zusatz);
    const unpassed = topicQuestions.filter((q) => !isQuestionPassed(progress, q.id, exam));
    questions = shuffleArray(unpassed.length > 0 ? unpassed : topicQuestions);
  }

  const currentIdx = initialQ > 0 && initialQ < questions.length ? initialQ : 0;
  const view = questions[currentIdx]
    ? makeView(questions[currentIdx])
    : { options: [], selectedAnswer: null, isRevealed: false };
  return { progress, questions, currentIdx, view, answered: {} };
}

// Delay before auto-advancing after a correct answer (ms). Longer when there's
// an explanation to glance at, shorter for plain correct answers.
const AUTO_ADVANCE_MS = 750;
const AUTO_ADVANCE_HINT_MS = 2600;

// In-session relearning steps: a missed question must be answered correctly
// again after each of these gaps (in cards) before it's done for the session.
// Growing gaps test recall at increasing spacing, not just short-term memory.
const RELEARN_STEPS = [3, 8];

export default function QuizPage(): React.ReactElement {
  const params = useParams();
  const exam = params.exam as ExamType;
  const topicId = params.topic as string;
  const binnenZusatz = isBinnenZusatzOnly();
  const allQuestions = getExamQuestions(exam, binnenZusatz);
  const mounted = useMounted();

  const [{ progress, questions, currentIdx, view }, setQuiz] = useState<QuizState>(() =>
    initQuizState(topicId, exam, 0, binnenZusatz),
  );
  const { options: shuffledOptions, selectedAnswer, isRevealed } = view;

  const [sessionStats, setSessionStats] = useState<SessionStats>({ correct: 0, wrong: 0, total: 0 });
  const [isComplete, setIsComplete] = useState(false);
  // Set when a correct answer should auto-advance after a short delay.
  const [pendingAdvance, setPendingAdvance] = useState(false);
  const [soundOn, setSoundOn] = useState<boolean>(() => isSoundEnabled());
  // Remaining relearning steps per question id (session-scoped, no re-render).
  const relearnRef = useRef<Map<number, number>>(new Map());

  const canGoBack = currentIdx > 0 && !pendingAdvance;

  const toggleSound = useCallback((): void => {
    setSoundOn((on) => {
      setSoundEnabled(!on);
      return !on;
    });
  }, []);

  const toggleCurrentBookmark = useCallback((): void => {
    setQuiz((prev) => {
      const q = prev.questions[prev.currentIdx];
      if (!q) return prev;
      const np = toggleBookmark(prev.progress, q.id, exam);
      saveProgress(np);
      return { ...prev, progress: np };
    });
  }, [exam]);

  const handleSelect = useCallback(
    (key: AnswerKey): void => {
      if (isRevealed) return;

      const currentQuestion = questions[currentIdx];
      const isCorrect = key === currentQuestion.correctAnswer;
      const updatedProgress = recordAnswer(progress, currentQuestion.id, exam, isCorrect);
      saveProgress(updatedProgress);

      // Decide whether to re-insert this card for relearning, and after how many
      // cards. Wrong → restart the step ladder (first gap). Correct while still
      // relearning → advance to the next, larger gap until the ladder is done.
      const qid = currentQuestion.id;
      const stepsLeft = relearnRef.current.get(qid) ?? 0;
      let reinsertGap: number | null = null;
      if (!isCorrect) {
        relearnRef.current.set(qid, RELEARN_STEPS.length);
        reinsertGap = RELEARN_STEPS[0];
      } else if (stepsLeft > 0) {
        const remaining = stepsLeft - 1;
        if (remaining > 0) {
          relearnRef.current.set(qid, remaining);
          reinsertGap = RELEARN_STEPS[RELEARN_STEPS.length - remaining];
        } else {
          relearnRef.current.delete(qid); // graduated for this session
        }
      }

      setQuiz((prev) => {
        const answered = {
          ...prev.answered,
          [prev.currentIdx]: { options: prev.view.options, selectedAnswer: key },
        };
        let nextQuestions = prev.questions;
        if (reinsertGap !== null) {
          nextQuestions = [...prev.questions];
          const insertIdx = Math.min(prev.currentIdx + reinsertGap, nextQuestions.length);
          nextQuestions.splice(insertIdx, 0, prev.questions[prev.currentIdx]);
        }
        return {
          ...prev,
          progress: updatedProgress,
          questions: nextQuestions,
          view: { ...prev.view, selectedAnswer: key, isRevealed: true },
          answered,
        };
      });
      setSessionStats((prev) => ({
        correct: prev.correct + (isCorrect ? 1 : 0),
        wrong: prev.wrong + (isCorrect ? 0 : 1),
        total: prev.total + 1,
      }));
      // Correct → satisfying chime + brief feedback, then auto-advance.
      // Wrong → wait for the user to read the explanation and tap "Weiter".
      if (isCorrect) {
        playCorrect();
        setPendingAdvance(true);
      }
    },
    [isRevealed, questions, currentIdx, progress, exam],
  );

  const handleNext = useCallback((): void => {
    setPendingAdvance(false);
    if (currentIdx + 1 >= questions.length) {
      if (topicId === DAILY_QUEUE_TOPIC_ID) {
        // Re-queue cards still due (e.g. just answered "again") without pulling
        // in new ones, so the session keeps going until today's queue is clear.
        const stillDue = buildDailyQueue(progress, exam, allQuestions, { includeNew: false });
        if (stillDue.length === 0) {
          clearSessionQueue(exam);
          setIsComplete(true);
          return;
        }
        setQuiz((prev) => ({ ...prev, questions: stillDue, currentIdx: 0, view: makeView(stillDue[0]), answered: {} }));
        return;
      }
      if (topicId === HARD_QUESTIONS_TOPIC_ID || topicId === BOOKMARKED_TOPIC_ID) {
        setIsComplete(true);
        return;
      }
      const topicQuestions = getTopicQuestions(topicId, exam, binnenZusatz);
      if (isTopicPassed(progress, topicQuestions.map((q) => q.id), exam)) {
        setIsComplete(true);
        return;
      }
      const unpassed = topicQuestions.filter((q) => !isQuestionPassed(progress, q.id, exam));
      if (unpassed.length === 0) {
        setIsComplete(true);
        return;
      }
      const newQuestions = shuffleArray(unpassed);
      setQuiz((prev) => ({ ...prev, questions: newQuestions, currentIdx: 0, view: makeView(newQuestions[0]), answered: {} }));
      return;
    }
    setQuiz((prev) => ({
      ...prev,
      currentIdx: prev.currentIdx + 1,
      view: viewForIndex(prev, prev.currentIdx + 1),
    }));
  }, [currentIdx, questions, topicId, exam, progress, allQuestions, binnenZusatz]);

  const handleBack = useCallback((): void => {
    setPendingAdvance(false);
    setQuiz((prev) => {
      if (prev.currentIdx === 0) return prev;
      const idx = prev.currentIdx - 1;
      return { ...prev, currentIdx: idx, view: viewForIndex(prev, idx) };
    });
  }, []);

  // Auto-advance after a correct answer. Linger longer when there's an
  // explanation to read, so the "why" actually registers before moving on.
  useEffect(() => {
    if (!pendingAdvance) return;
    const hasHint = Boolean(questions[currentIdx]?.hint);
    const t = setTimeout(() => handleNext(), hasHint ? AUTO_ADVANCE_HINT_MS : AUTO_ADVANCE_MS);
    return () => clearTimeout(t);
  }, [pendingAdvance, handleNext, questions, currentIdx]);

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'ArrowLeft' && currentIdx > 0) {
        handleBack();
        return;
      }
      if (e.key === 'Enter' && isRevealed) {
        handleNext();
        return;
      }
      if (!isRevealed) {
        const map: Record<string, AnswerKey> = { '1': 'a', '2': 'b', '3': 'c', '4': 'd' };
        const mapped = map[e.key];
        if (mapped) handleSelect(mapped);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isRevealed, handleNext, handleSelect, handleBack, currentIdx]);

  // Immersive focus mode: hide the global nav while a session is running so the
  // learner's attention stays on the card (the ✕ is the explicit exit).
  useEffect(() => {
    document.documentElement.setAttribute('data-focus-mode', 'true');
    return () => document.documentElement.removeAttribute('data-focus-mode');
  }, []);

  // The deck is built from localStorage + Math.random, so it only exists on the
  // client. Render a stable placeholder until mounted to avoid a hydration
  // mismatch (which previously cascaded into a broken page on back/forward nav).
  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--navy-deep)' }}>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Lade Fragen…</p>
      </div>
    );
  }

  if (questions.length === 0) {
    const queueEmpty = isQueueMode(topicId);
    const emptyTitle =
      topicId === DAILY_QUEUE_TOPIC_ID
        ? 'Für heute geschafft'
        : topicId === BOOKMARKED_TOPIC_ID
          ? 'Keine gemerkten Fragen'
          : 'Keine Problemfragen';
    const emptyText =
      topicId === DAILY_QUEUE_TOPIC_ID
        ? 'Es sind keine Karten fällig. Komm morgen wieder oder lerne ein Thema gezielt.'
        : topicId === BOOKMARKED_TOPIC_ID
          ? 'Tippe beim Üben auf das Lesezeichen, um dir knifflige Fragen zu merken.'
          : 'Du hast noch keine Frage falsch beantwortet — weiter so!';
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--navy-deep)' }}>
        <div className="text-center max-w-xs">
          {queueEmpty ? (
            <>
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-xl mb-4 mx-auto"
                style={{ background: 'rgba(18, 184, 112, 0.12)', color: 'var(--green-signal)' }}
              >
                ✓
              </div>
              <p className="text-base font-semibold mb-2" style={{ color: 'var(--white)' }}>
                {emptyTitle}
              </p>
              <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
                {emptyText}
              </p>
              <Link
                href={`/${exam}`}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80"
                style={{ background: 'var(--gold)', color: 'var(--navy-deepest)' }}
              >
                Zur Übersicht
              </Link>
            </>
          ) : (
            <>
              <div
                className="w-10 h-10 rounded-full mx-auto mb-4"
                style={{ background: 'var(--navy)', border: '1px solid var(--border)' }}
              />
              <p className="text-sm" style={{ color: 'var(--muted)' }}>Lade Fragen…</p>
            </>
          )}
        </div>
      </div>
    );
  }

  if (isComplete) {
    return (
      <CompletionScreen
        exam={exam}
        topicId={topicId}
        sessionStats={sessionStats}
        isHardMode={topicId === HARD_QUESTIONS_TOPIC_ID}
      />
    );
  }

  const currentQuestion = questions[currentIdx];
  const masteryStreak = getQuestionStreak(progress, currentQuestion.id, exam);
  const bestStreak = getQuestionBestStreak(progress, currentQuestion.id, exam);
  const wrongCount = getQuestionWrongCount(progress, currentQuestion.id, exam);
  const bookmarked = isBookmarked(progress, currentQuestion.id, exam);
  const isAnswerCorrect = isRevealed && selectedAnswer === currentQuestion.correctAnswer;
  const tutorialId = tutorialForTopic(currentQuestion.topic, exam);
  // Session progress through the deck — fills as you answer (Duolingo-style).
  const sessionPct = Math.round(((currentIdx + (isRevealed ? 1 : 0)) / questions.length) * 100);
  const barColor = exam === 'binnen' ? 'var(--gold)' : 'var(--seafoam)';

  return (
    <div className="min-h-screen py-6 px-4" style={{ background: 'var(--navy-deep)' }}>
      <div className="max-w-2xl mx-auto">
        {/* Focus session header: exit · progress · tally */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href={`/${exam}`}
            aria-label="Beenden"
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-base transition-colors hover:bg-white/5"
            style={{ color: 'var(--muted)' }}
          >
            ✕
          </Link>
          <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
            <div
              className="h-2 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${sessionPct}%`, background: barColor }}
            />
          </div>
          <button
            onClick={toggleCurrentBookmark}
            aria-label={bookmarked ? 'Merken aufheben' : 'Frage merken'}
            aria-pressed={bookmarked}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-white/5"
            style={{ color: bookmarked ? 'var(--gold)' : 'var(--muted)' }}
          >
            {bookmarked ? <BookmarkSolidIcon className="h-4 w-4" /> : <BookmarkIcon className="h-4 w-4" />}
          </button>
          <button
            onClick={toggleSound}
            aria-label={soundOn ? 'Ton aus' : 'Ton an'}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-white/5"
            style={{ color: 'var(--muted)' }}
          >
            {soundOn ? <SpeakerWaveIcon className="h-4 w-4" /> : <SpeakerXMarkIcon className="h-4 w-4" />}
          </button>
          {sessionStats.total > 0 && (
            <div className="flex items-center gap-2 text-xs shrink-0 tabular-nums">
              <span style={{ color: 'var(--green-signal)' }}>{sessionStats.correct}&nbsp;✓</span>
              <span style={{ color: 'var(--red-signal)' }}>{sessionStats.wrong}&nbsp;✗</span>
            </div>
          )}
        </div>

        <motion.div
          key={currentQuestion.id}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="rounded-2xl p-5 sm:p-6 mb-3"
          style={{ background: 'var(--navy)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              {canGoBack && (
                <button
                  onClick={handleBack}
                  aria-label="Vorherige Frage"
                  className="flex items-center justify-center w-7 h-7 rounded-lg transition-opacity hover:opacity-80"
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--muted)' }}
                >
                  ←
                </button>
              )}
              <Badge variant="muted" size="sm">#{currentQuestion.id}</Badge>
              {wrongCount > 0 && (
                <Badge variant="red" size="sm">{wrongCount}× falsch</Badge>
              )}
              {currentQuestion.hasImage && !currentQuestion.imagePath && (
                <Badge variant="blue" size="sm">{currentQuestion.imageDescription}</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: 'var(--muted)' }}>
                {currentIdx + 1}/{questions.length}
              </span>
              <div className="flex gap-1">
                {Array.from({ length: CORRECT_THRESHOLD }).map((_, i) => {
                  // Green = current streak; gray "ghost" = best ever reached
                  // beyond the current streak (shows regression after forgetting).
                  const isCurrent = i < masteryStreak;
                  const isGhost = !isCurrent && i < bestStreak;
                  return (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full border transition-all"
                    title={isCurrent ? 'Aktuelle Serie' : isGhost ? 'Schon mal erreicht' : undefined}
                    style={{
                      background: isCurrent
                        ? 'var(--green-signal)'
                        : isGhost
                          ? 'rgba(255,255,255,0.30)'
                          : 'transparent',
                      borderColor: isCurrent
                        ? 'var(--green-signal)'
                        : isGhost
                          ? 'rgba(255,255,255,0.30)'
                          : 'rgba(255,255,255,0.15)',
                    }}
                  />
                  );
                })}
              </div>
            </div>
          </div>

          {currentQuestion.imagePath && (
            <div className="mb-5 flex justify-center">
              <Image
                src={currentQuestion.imagePath}
                alt={currentQuestion.imageDescription ?? ''}
                width={400}
                height={300}
                className="rounded-lg max-h-48 w-auto object-contain"
                style={{
                  background: 'white',
                  padding: '8px',
                  border: '1px solid var(--border)',
                }}
              />
            </div>
          )}

          <h2 className="text-lg sm:text-xl font-medium leading-relaxed mb-6" style={{ color: 'var(--white)' }}>
            {currentQuestion.text}
          </h2>

          <div className="space-y-2.5">
            {shuffledOptions.map((option, i) => {
              const isSelected = selectedAnswer === option.key;
              const isCorrectOption = option.originalKey === currentQuestion.correctAnswer;
              let className = 'answer-option flex items-start gap-3 p-4 min-h-[3.5rem] rounded-xl border w-full text-left';
              let optionStyle: React.CSSProperties = {
                borderColor: 'var(--border)',
                background: 'transparent',
              };

              if (isRevealed) {
                className += ' disabled';
                if (isCorrectOption) {
                  className += ' correct';
                  optionStyle = {};
                } else if (isSelected) {
                  className += ' wrong';
                  optionStyle = {};
                }
              }

              return (
                <button
                  key={option.key}
                  onClick={() => handleSelect(option.key)}
                  className={className}
                  style={optionStyle}
                  disabled={isRevealed}
                >
                  <span
                    className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-sm font-semibold"
                    style={{
                      background:
                        isRevealed && isCorrectOption
                          ? 'var(--green-signal)'
                          : isRevealed && isSelected && !isCorrectOption
                            ? 'var(--red-signal)'
                            : 'rgba(255,255,255,0.06)',
                      color:
                        isRevealed && (isCorrectOption || (isSelected && !isCorrectOption))
                          ? 'white'
                          : 'var(--muted)',
                    }}
                  >
                    {['A', 'B', 'C', 'D'][i]}
                  </span>
                  <span className="text-[15px] sm:text-base leading-relaxed self-center" style={{ color: 'var(--white)' }}>
                    {option.text}
                  </span>
                </button>
              );
            })}
          </div>

          {isRevealed && (
            <div
              className="mt-4 px-4 py-3 rounded-lg"
              style={{
                background:
                  selectedAnswer === currentQuestion.correctAnswer
                    ? 'rgba(18, 184, 112, 0.08)'
                    : 'rgba(232, 68, 68, 0.08)',
                border: `1px solid ${
                  selectedAnswer === currentQuestion.correctAnswer
                    ? 'rgba(18, 184, 112, 0.25)'
                    : 'rgba(232, 68, 68, 0.25)'
                }`,
              }}
            >
              <span
                className="text-sm font-semibold"
                style={{
                  color:
                    selectedAnswer === currentQuestion.correctAnswer
                      ? 'var(--green-signal)'
                      : 'var(--red-signal)',
                }}
              >
                {selectedAnswer === currentQuestion.correctAnswer
                  ? 'Richtig'
                  : `Falsch — Richtig wäre Antwort ${['A', 'B', 'C', 'D'][shuffledOptions.findIndex((o) => o.originalKey === currentQuestion.correctAnswer)]}`}
              </span>
              {currentQuestion.hint && (
                <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
                  {currentQuestion.hint}
                </p>
              )}
              {tutorialId && (
                <Link
                  href={`/lernen/${tutorialId}`}
                  className="mt-2.5 inline-flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-80"
                  style={{ color: exam === 'binnen' ? 'var(--gold-light)' : 'var(--seafoam-light)' }}
                >
                  Mehr dazu in der Theorie →
                </Link>
              )}
              {/* Hide the button only for a plain correct answer (it auto-advances
                  fast); show it for wrong answers and correct-with-explanation. */}
              {(!pendingAdvance || (isAnswerCorrect && currentQuestion.hint)) && (
                <button
                  onClick={handleNext}
                  autoFocus
                  className="mt-3 w-full py-3.5 rounded-xl text-base font-semibold transition-opacity hover:opacity-90"
                  style={{ background: 'var(--gold)', color: 'var(--navy-deepest)' }}
                >
                  Weiter →
                </button>
              )}
            </div>
          )}
        </motion.div>

        <p className="hidden sm:block text-center text-xs" style={{ color: 'rgba(106, 136, 168, 0.4)' }}>
          1–4 auswählen · ← zurück · Enter = weiter
        </p>
      </div>
    </div>
  );
}

interface CompletionScreenProps {
  exam: ExamType;
  topicId: string;
  sessionStats: SessionStats;
  isHardMode: boolean;
}

function CompletionScreen({
  exam,
  topicId,
  sessionStats,
  isHardMode,
}: CompletionScreenProps): React.ReactElement {
  const topicName = getTopicName(topicId, exam);
  const isDaily = topicId === DAILY_QUEUE_TOPIC_ID;
  const accuracy = sessionStats.total > 0 ? Math.round((sessionStats.correct / sessionStats.total) * 100) : 0;

  const title = isDaily ? 'Tagesziel erreicht' : isHardMode ? 'Gut gemacht!' : 'Thema bestanden';
  const subtitle = isDaily
    ? 'Alle fälligen Karten für heute gelernt 🎉'
    : isHardMode
      ? 'Du hast alle Problemfragen geübt'
      : topicName;

  // Reward scaled by accuracy: 0–3 stars + a fanfare on arrival.
  const stars = accuracy >= 90 ? 3 : accuracy >= 70 ? 2 : accuracy >= 50 ? 1 : 0;
  const praise =
    stars === 3 ? 'Hervorragend!' : stars === 2 ? 'Stark!' : stars === 1 ? 'Solide!' : 'Dranbleiben!';

  useEffect(() => {
    playFinish(stars);
  }, [stars]);

  const stats: Array<{ label: string; value: number | string; color: string }> = [
    { label: 'Richtig',     value: sessionStats.correct, color: 'var(--green-signal)' },
    { label: 'Falsch',      value: sessionStats.wrong,   color: 'var(--red-signal)' },
    { label: 'Genauigkeit', value: `${accuracy}%`,       color: 'var(--gold)' },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--navy-deep)' }}>
      <div
        className="max-w-sm w-full p-8 rounded-xl"
        style={{
          background: 'var(--navy)',
          border: `1px solid ${isHardMode ? 'rgba(188, 147, 50, 0.25)' : 'rgba(18, 184, 112, 0.25)'}`,
        }}
      >
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-xl mb-5 mx-auto"
          style={{
            background: isHardMode ? 'rgba(188, 147, 50, 0.12)' : 'rgba(18, 184, 112, 0.12)',
            color: isHardMode ? 'var(--gold)' : 'var(--green-signal)',
          }}
        >
          {isHardMode ? '★' : '✓'}
        </div>

        <h2
          className="text-xl font-bold mb-1 text-center"
          style={{ color: 'var(--white)' }}
        >
          {title}
        </h2>
        <p className="text-sm mb-4 text-center" style={{ color: 'var(--muted)' }}>
          {subtitle}
        </p>

        {sessionStats.total > 0 && (
          <div className="mb-6 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="text-2xl leading-none transition-transform"
                  style={{
                    color: i < stars ? 'var(--gold-light)' : 'rgba(255,255,255,0.14)',
                    transform: i < stars ? 'scale(1)' : 'scale(0.85)',
                  }}
                >
                  ★
                </span>
              ))}
            </div>
            <p className="text-sm font-semibold" style={{ color: 'var(--gold-light)' }}>
              {praise}
            </p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 mb-7">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="p-3 rounded-lg text-center"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}
            >
              <div className="text-xl font-bold tabular-nums" style={{ color: stat.color }}>
                {stat.value}
              </div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <Link
            href={`/${exam}`}
            className="w-full py-2.5 rounded-lg text-sm font-semibold text-center transition-opacity hover:opacity-90"
            style={{ background: 'var(--gold)', color: 'var(--navy-deepest)' }}
          >
            Zur Übersicht
          </Link>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-2.5 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--muted)',
            }}
          >
            Nochmals üben
          </button>
        </div>
      </div>
    </div>
  );
}
