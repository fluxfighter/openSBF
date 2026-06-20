'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import type { Question, ExamType, AnswerKey, SessionStats } from '@/lib/types';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Badge } from '@/components/ui/Badge';
import { FeedbackModal } from '@/components/ui/FeedbackModal';
import { binnenTopics, seeTopics, getAllBinnenQuestions, getAllSeeQuestions } from '@/data/topics';
import {
  loadProgress,
  saveProgress,
  recordAnswer,
  isQuestionPassed,
  getQuestionCorrectCount,
  getQuestionWrongCount,
  getHardestQuestions,
  getTopicProgress,
  isTopicPassed,
} from '@/lib/progress';
import { buildDailyQueue } from '@/lib/srs';
import { useMounted } from '@/hooks/useMounted';
import type { UserProgress } from '@/lib/types';

const CORRECT_THRESHOLD = 3;
const HARD_QUESTIONS_TOPIC_ID = 'schwierige-fragen';
const DAILY_QUEUE_TOPIC_ID = 'heute';

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function getTopicQuestions(topicId: string, exam: ExamType): Question[] {
  const topics = exam === 'binnen' ? binnenTopics : seeTopics;
  const allQuestions = exam === 'binnen' ? getAllBinnenQuestions() : getAllSeeQuestions();
  const topic = topics.find((t) => t.id === topicId);
  if (!topic) return [];
  return allQuestions.filter((q) => topic.questionIds.includes(q.id));
}

function getTopicName(topicId: string, exam: ExamType): string {
  if (topicId === HARD_QUESTIONS_TOPIC_ID) return 'Deine Problemfragen';
  if (topicId === DAILY_QUEUE_TOPIC_ID) return 'Heute lernen';
  const topics = exam === 'binnen' ? binnenTopics : seeTopics;
  return topics.find((t) => t.id === topicId)?.name ?? topicId;
}

function isQueueMode(topicId: string): boolean {
  return topicId === HARD_QUESTIONS_TOPIC_ID || topicId === DAILY_QUEUE_TOPIC_ID;
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

function initQuizState(topicId: string, exam: ExamType, initialQ: number): QuizState {
  const progress = loadProgress();
  const allQuestions = exam === 'binnen' ? getAllBinnenQuestions() : getAllSeeQuestions();

  let questions: Question[];
  if (topicId === DAILY_QUEUE_TOPIC_ID) {
    questions = buildDailyQueue(progress, exam, allQuestions);
  } else if (topicId === HARD_QUESTIONS_TOPIC_ID) {
    questions = shuffleArray(getHardestQuestions(progress, exam, allQuestions));
  } else {
    const topicQuestions = getTopicQuestions(topicId, exam);
    const unpassed = topicQuestions.filter((q) => !isQuestionPassed(progress, q.id, exam));
    questions = shuffleArray(unpassed.length > 0 ? unpassed : topicQuestions);
  }

  const currentIdx = initialQ > 0 && initialQ < questions.length ? initialQ : 0;
  const view = questions[currentIdx]
    ? makeView(questions[currentIdx])
    : { options: [], selectedAnswer: null, isRevealed: false };
  return { progress, questions, currentIdx, view, answered: {} };
}

// Delay before auto-advancing after a correct answer (ms).
const AUTO_ADVANCE_MS = 750;

export default function QuizPage(): React.ReactElement {
  const params = useParams();
  const exam = params.exam as ExamType;
  const topicId = params.topic as string;
  const allQuestions = exam === 'binnen' ? getAllBinnenQuestions() : getAllSeeQuestions();
  const mounted = useMounted();

  const [{ progress, questions, currentIdx, view }, setQuiz] = useState<QuizState>(() =>
    initQuizState(topicId, exam, 0),
  );
  const { options: shuffledOptions, selectedAnswer, isRevealed } = view;

  const [sessionStats, setSessionStats] = useState<SessionStats>({ correct: 0, wrong: 0, total: 0 });
  const [isComplete, setIsComplete] = useState(false);
  // Set when a correct answer should auto-advance after a short delay.
  const [pendingAdvance, setPendingAdvance] = useState(false);

  const canGoBack = currentIdx > 0 && !pendingAdvance;

  const handleSelect = useCallback(
    (key: AnswerKey): void => {
      if (isRevealed) return;

      const currentQuestion = questions[currentIdx];
      const isCorrect = key === currentQuestion.correctAnswer;
      const updatedProgress = recordAnswer(progress, currentQuestion.id, exam, isCorrect);
      saveProgress(updatedProgress);

      setQuiz((prev) => ({
        ...prev,
        progress: updatedProgress,
        view: { ...prev.view, selectedAnswer: key, isRevealed: true },
        answered: { ...prev.answered, [prev.currentIdx]: { options: prev.view.options, selectedAnswer: key } },
      }));
      setSessionStats((prev) => ({
        correct: prev.correct + (isCorrect ? 1 : 0),
        wrong: prev.wrong + (isCorrect ? 0 : 1),
        total: prev.total + 1,
      }));
      // Correct → brief feedback, then auto-advance. Wrong → wait for the user
      // to read the explanation and tap "Weiter".
      if (isCorrect) setPendingAdvance(true);
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
          setIsComplete(true);
          return;
        }
        setQuiz((prev) => ({ ...prev, questions: stillDue, currentIdx: 0, view: makeView(stillDue[0]), answered: {} }));
        return;
      }
      if (topicId === HARD_QUESTIONS_TOPIC_ID) {
        setIsComplete(true);
        return;
      }
      const topicQuestions = getTopicQuestions(topicId, exam);
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
  }, [currentIdx, questions, topicId, exam, progress, allQuestions]);

  const handleBack = useCallback((): void => {
    setPendingAdvance(false);
    setQuiz((prev) => {
      if (prev.currentIdx === 0) return prev;
      const idx = prev.currentIdx - 1;
      return { ...prev, currentIdx: idx, view: viewForIndex(prev, idx) };
    });
  }, []);

  // Auto-advance shortly after a correct answer.
  useEffect(() => {
    if (!pendingAdvance) return;
    const t = setTimeout(() => handleNext(), AUTO_ADVANCE_MS);
    return () => clearTimeout(t);
  }, [pendingAdvance, handleNext]);

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
      topicId === DAILY_QUEUE_TOPIC_ID ? 'Für heute geschafft' : 'Keine Problemfragen';
    const emptyText =
      topicId === DAILY_QUEUE_TOPIC_ID
        ? 'Es sind keine Karten fällig. Komm morgen wieder oder lerne ein Thema gezielt.'
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
  const correctCount = getQuestionCorrectCount(progress, currentQuestion.id, exam);
  const wrongCount = getQuestionWrongCount(progress, currentQuestion.id, exam);
  const queueMode = isQueueMode(topicId);
  const topicQuestions = queueMode ? questions : getTopicQuestions(topicId, exam);
  const totalQuestions = topicQuestions.length;
  // In queue modes the bar tracks this session's progress through the deck;
  // for a topic it tracks how many of its questions are mastered.
  const topicProgress = queueMode
    ? {
        passed: Math.min(sessionStats.total, totalQuestions),
        total: totalQuestions,
        percentage: totalQuestions > 0 ? Math.round((Math.min(sessionStats.total, totalQuestions) / totalQuestions) * 100) : 0,
      }
    : getTopicProgress(progress, topicQuestions.map((q) => q.id), exam);
  const progressLabel = queueMode
    ? `${topicProgress.passed}/${totalQuestions} bearbeitet`
    : `${topicProgress.passed}/${totalQuestions} bestanden`;

  return (
    <div className="min-h-screen py-8 px-4" style={{ background: 'var(--navy-deep)' }}>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link
            href={`/${exam}`}
            className="text-xs font-medium transition-opacity hover:opacity-70"
            style={{ color: 'var(--muted)' }}
          >
            ← {exam === 'binnen' ? 'SBF Binnen' : 'SBF See'}
          </Link>
          {sessionStats.total > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <span
                className="px-2 py-0.5 rounded"
                style={{ background: 'rgba(18, 184, 112, 0.10)', color: 'var(--green-signal)' }}
              >
                {sessionStats.correct} ✓
              </span>
              <span
                className="px-2 py-0.5 rounded"
                style={{ background: 'rgba(232, 68, 68, 0.10)', color: 'var(--red-signal)' }}
              >
                {sessionStats.wrong} ✗
              </span>
            </div>
          )}
        </div>

        <div className="mb-5">
          <h1 className="text-base font-semibold mb-2" style={{ color: 'var(--white)' }}>
            {getTopicName(topicId, exam)}
          </h1>
          <ProgressBar
            value={topicProgress.percentage}
            size="sm"
            color={topicProgress.percentage === 100 ? 'green' : 'gold'}
            showLabel
            label={progressLabel}
          />
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
                {Array.from({ length: CORRECT_THRESHOLD }).map((_, i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full border transition-all"
                    style={{
                      background: i < correctCount ? 'var(--green-signal)' : 'transparent',
                      borderColor: i < correctCount ? 'var(--green-signal)' : 'rgba(255,255,255,0.15)',
                    }}
                  />
                ))}
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

          <div className="mt-4 flex justify-end">
            <FeedbackModal
              context={{ questionId: String(currentQuestion.id), questionText: currentQuestion.text }}
              trigger={
                <button
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-opacity hover:opacity-80"
                  style={{
                    background: 'rgba(232,68,68,0.10)',
                    border: '1px solid rgba(232,68,68,0.25)',
                    color: 'var(--red-signal)',
                  }}
                >
                  Fehler melden
                </button>
              }
            />
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
              {selectedAnswer !== currentQuestion.correctAnswer && currentQuestion.hint && (
                <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
                  {currentQuestion.hint}
                </p>
              )}
              {!pendingAdvance && (
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
        <p className="text-sm mb-7 text-center" style={{ color: 'var(--muted)' }}>
          {subtitle}
        </p>

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
