'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { TopicCard } from '@/components/quiz/TopicCard';
import { ProgressBar } from '@/components/ui/ProgressBar';
import {
  loadProgress,
  getTopicProgress,
  isTopicPassed,
  getExamOverallProgress,
  getHardestQuestions,
  getBookmarkCount,
} from '@/lib/progress';
import { getQueueCounts, getReadiness, type QueueCounts } from '@/lib/srs';
import { getBinnenTopics, getBinnenQuestions } from '@/data/topics';
import { isBinnenZusatzOnly, setBinnenZusatzOnly } from '@/lib/settings';
import { useMounted } from '@/hooks/useMounted';
import type { ExamType, Topic, Question, AccentColor, TopicProgressEntry } from '@/lib/types';

const BOOKMARKED_TOPIC_ID = 'gemerkte-fragen';

interface ExamTopicsPageProps {
  exam: ExamType;
  topics: Topic[];
  getAllQuestions: () => Question[];
  title: string;
  subtitle: string;
  accentColor: AccentColor;
  explanationContent: React.ReactNode;
  quickLinks?: React.ReactNode;
}

interface ExamProgressSnapshot {
  overall: { passed: number; total: number; percentage: number };
  progressData: Record<string, TopicProgressEntry>;
  hardCount: number;
  bookmarkCount: number;
  queue: QueueCounts;
  readiness: number;
}

function computeExamProgress(
  exam: ExamType,
  topics: Topic[],
  getAllQuestions: () => Question[],
): ExamProgressSnapshot {
  const progress = loadProgress();
  const allQuestions = getAllQuestions();
  const allIds = allQuestions.map((q) => q.id);
  const progressData: Record<string, TopicProgressEntry> = {};

  topics.forEach((topic) => {
    const tp = getTopicProgress(progress, topic.questionIds, exam);
    progressData[topic.id] = { ...tp, isPassed: isTopicPassed(progress, topic.questionIds, exam) };
  });

  const hardCount = getHardestQuestions(progress, exam, allQuestions).length;
  return {
    overall: getExamOverallProgress(progress, allIds, exam),
    progressData,
    hardCount,
    bookmarkCount: getBookmarkCount(progress, exam, allIds),
    queue: getQueueCounts(progress, exam, allQuestions),
    readiness: getReadiness(progress, exam, allQuestions).percentage,
  };
}

export function ExamTopicsPage({
  exam,
  topics,
  getAllQuestions,
  title,
  subtitle,
  accentColor,
  explanationContent,
  quickLinks,
}: ExamTopicsPageProps): React.ReactElement {
  const mounted = useMounted();
  const [zusatz, setZusatz] = useState<boolean>(() => exam === 'binnen' && isBinnenZusatzOnly());

  const { overall, progressData, hardCount, bookmarkCount, queue, readiness, effectiveTopics } = useMemo(() => {
    const t = exam === 'binnen' ? getBinnenTopics(zusatz) : topics;
    const getQs: () => Question[] = exam === 'binnen' ? () => getBinnenQuestions(zusatz) : getAllQuestions;
    return { ...computeExamProgress(exam, t, getQs), effectiveTopics: t };
  }, [exam, zusatz, topics, getAllQuestions]);

  const toggleZusatz = (): void => {
    setZusatz((v) => {
      setBinnenZusatzOnly(!v);
      return !v;
    });
  };

  const passedTopics = Object.values(progressData).filter((p) => p.isPassed).length;
  const totalTopics = effectiveTopics.length;

  // Small-bites motivation: how many days to finish at a steady pace.
  const remaining = Math.max(0, overall.total - overall.passed);
  const daysAt10 = Math.ceil(remaining / 10);
  const daysAt20 = Math.ceil(remaining / 20);

  const accentVar = accentColor === 'gold' ? 'var(--gold)' : 'var(--seafoam)';
  const accentBg = accentColor === 'gold' ? 'rgba(188, 147, 50, 0.08)' : 'rgba(38, 136, 164, 0.08)';
  const accentBorder = accentColor === 'gold' ? 'rgba(188, 147, 50, 0.18)' : 'rgba(38, 136, 164, 0.18)';

  // Header is static (props); the progress-derived body waits for mount to keep
  // SSR and the first client render identical (no hydration mismatch).
  if (!mounted) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--navy-deep)' }}>
        <div className="border-b px-4 py-10" style={{ borderColor: 'var(--border)' }}>
          <div className="max-w-5xl mx-auto">
            <Link
              href="/"
              className="text-xs font-medium mb-6 inline-block transition-opacity hover:opacity-70"
              style={{ color: 'var(--muted)' }}
            >
              ← Start
            </Link>
            <h1 className="text-3xl font-bold mb-1" style={{ color: 'var(--white)' }}>
              {title}
            </h1>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              {subtitle}
            </p>
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4 py-10">
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Lädt…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--navy-deep)' }}>
      <div className="border-b px-4 py-10" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-5xl mx-auto">
          <Link
            href="/"
            className="text-xs font-medium mb-6 inline-block transition-opacity hover:opacity-70"
            style={{ color: 'var(--muted)' }}
          >
            ← Start
          </Link>

          <h1 className="text-3xl font-bold mb-1" style={{ color: 'var(--white)' }}>
            {title}
          </h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            {subtitle}
          </p>

          <div className="mt-6 max-w-md">
            <ProgressBar
              value={overall.percentage}
              showLabel
              label={`${overall.passed}/${overall.total} Fragen · ${passedTopics}/${totalTopics} Themen`}
              size="md"
              color={accentColor}
              animated={overall.percentage > 0 && overall.percentage < 100}
            />
          </div>

          {exam === 'binnen' && (
            <button
              onClick={toggleZusatz}
              className="mt-5 flex items-center gap-3 text-left"
              role="switch"
              aria-checked={zusatz}
            >
              <span
                className="relative w-9 h-5 rounded-full transition-colors shrink-0"
                style={{ background: zusatz ? accentVar : 'rgba(255,255,255,0.12)' }}
              >
                <span
                  className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                  style={{ left: zusatz ? '18px' : '2px' }}
                />
              </span>
              <span className="text-xs" style={{ color: 'var(--muted)' }}>
                Nur Zusatzfragen (ohne Basis) —{' '}
                <span style={{ color: 'var(--white)' }}>für alle, die schon SBF See lernen</span>
              </span>
            </button>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-10">
        {/* Primary action: today's spaced-repetition queue */}
        <Link
          href={`/ueben/${exam}/heute`}
          className="block mb-8 rounded-2xl p-5 sm:p-6 transition-opacity hover:opacity-95"
          style={{
            background: `linear-gradient(135deg, ${accentBg}, rgba(255,255,255,0.02))`,
            border: `1px solid ${accentBorder}`,
          }}
        >
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg leading-none">⚡</span>
                <h2 className="text-lg font-bold" style={{ color: 'var(--white)' }}>
                  Heute lernen
                </h2>
              </div>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                {queue.total > 0 ? (
                  <>
                    <span style={{ color: accentVar, fontWeight: 600 }}>{queue.total} Karten</span> fällig
                    {queue.fresh > 0 && ` · ${queue.fresh} neu`}
                  </>
                ) : (
                  'Alles erledigt — komm später wieder oder übe ein Thema gezielt.'
                )}
              </p>
            </div>
            <span
              className="px-5 py-2.5 rounded-xl text-sm font-semibold shrink-0"
              style={{ background: accentVar, color: 'var(--navy-deepest)' }}
            >
              {queue.total > 0 ? 'Start →' : 'Wiederholen →'}
            </span>
          </div>

          <div className="mt-5 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>
                Prüfungsreife
              </span>
              <span className="text-xs font-semibold tabular-nums" style={{ color: accentVar }}>
                {readiness}%
              </span>
            </div>
            <ProgressBar value={readiness} size="sm" color={accentColor} />
            {remaining > 0 && (
              <p className="text-xs mt-2.5" style={{ color: 'var(--muted)' }}>
                Noch <span style={{ color: 'var(--white)', fontWeight: 600 }}>{remaining}</span> Fragen ·
                {' '}10/Tag → <span style={{ color: 'var(--white)' }}>{daysAt10}&nbsp;Tage</span> ·
                {' '}20/Tag → <span style={{ color: 'var(--white)' }}>{daysAt20}&nbsp;Tage</span>
              </p>
            )}
          </div>
        </Link>

        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--white)' }}>
            Themengebiete
          </h2>
          <Link
            href={`/${exam}/fragen`}
            className="text-xs font-medium transition-opacity hover:opacity-80"
            style={{ color: accentVar }}
          >
            Alle Fragen ansehen →
          </Link>
        </div>

        {hardCount > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--white)' }}>
              Deine Problemfragen
            </h2>
            <Link
              href={`/ueben/${exam}/schwierige-fragen`}
              className="flex items-center justify-between p-4 rounded-xl transition-opacity hover:opacity-80"
              style={{
                background: 'rgba(232, 68, 68, 0.07)',
                border: '1px solid rgba(232, 68, 68, 0.22)',
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-base shrink-0"
                  style={{ background: 'rgba(232, 68, 68, 0.12)', color: 'var(--red-signal)' }}
                >
                  ✗
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--white)' }}>
                    Problemfragen wiederholen
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                    {hardCount} {hardCount === 1 ? 'Frage' : 'Fragen'} häufig falsch beantwortet
                  </p>
                </div>
              </div>
              <span className="text-xs" style={{ color: 'var(--muted)' }}>→</span>
            </Link>
          </div>
        )}

        {bookmarkCount > 0 && (
          <div className="mb-6">
            <Link
              href={`/ueben/${exam}/${BOOKMARKED_TOPIC_ID}`}
              className="flex items-center justify-between p-4 rounded-xl transition-opacity hover:opacity-80"
              style={{
                background: 'rgba(188, 147, 50, 0.07)',
                border: '1px solid rgba(188, 147, 50, 0.22)',
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-base shrink-0"
                  style={{ background: 'rgba(188, 147, 50, 0.12)', color: 'var(--gold)' }}
                >
                  🔖
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--white)' }}>
                    Gemerkte Fragen üben
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                    {bookmarkCount} {bookmarkCount === 1 ? 'Frage' : 'Fragen'} vorgemerkt
                  </p>
                </div>
              </div>
              <span className="text-xs" style={{ color: 'var(--muted)' }}>→</span>
            </Link>
          </div>
        )}

        {quickLinks && <div className="mb-6">{quickLinks}</div>}

        <div className="grid sm:grid-cols-2 gap-3">
          {effectiveTopics
            .filter((t) => (progressData[t.id]?.total ?? 0) > 0)
            .map((topic) => {
              const pd = progressData[topic.id] ?? { passed: 0, total: 0, percentage: 0, isPassed: false };
              return (
                <TopicCard
                  key={topic.id}
                  topic={topic}
                  passed={pd.passed}
                  total={pd.total}
                  percentage={pd.percentage}
                  isPassed={pd.isPassed}
                  exam={exam}
                />
              );
            })}
        </div>

        <div
          className="mt-8 p-5 rounded-xl"
          style={{ background: 'var(--navy)', border: '1px solid var(--border)' }}
        >
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--white)' }}>
            So funktioniert die Prüfungsvorbereitung
          </h3>
          <ul className="text-xs space-y-2" style={{ color: 'var(--muted)' }}>
            {explanationContent}
          </ul>
        </div>
      </div>
    </div>
  );
}
