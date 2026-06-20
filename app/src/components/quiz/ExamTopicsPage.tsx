'use client';

import { useState } from 'react';
import Link from 'next/link';
import { TopicCard } from '@/components/quiz/TopicCard';
import { ProgressBar } from '@/components/ui/ProgressBar';
import {
  loadProgress,
  getTopicProgress,
  isTopicPassed,
  getExamOverallProgress,
  getHardestQuestions,
} from '@/lib/progress';
import { getQueueCounts, getReadiness, type QueueCounts } from '@/lib/srs';
import type { ExamType, Topic, Question, AccentColor, TopicProgressEntry } from '@/lib/types';

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
  const [{ overall, progressData, hardCount, queue, readiness }] = useState(() =>
    computeExamProgress(exam, topics, getAllQuestions),
  );

  const passedTopics = Object.values(progressData).filter((p) => p.isPassed).length;

  const accentVar = accentColor === 'gold' ? 'var(--gold)' : 'var(--seafoam)';
  const accentBg = accentColor === 'gold' ? 'rgba(188, 147, 50, 0.08)' : 'rgba(38, 136, 164, 0.08)';
  const accentBorder = accentColor === 'gold' ? 'rgba(188, 147, 50, 0.18)' : 'rgba(38, 136, 164, 0.18)';

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

          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div>
              <h1
                className="text-3xl font-bold mb-1"
                style={{ fontFamily: 'Playfair Display, serif', color: 'var(--white)' }}
              >
                {title}
              </h1>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                {subtitle}
              </p>
            </div>

            <div
              className="px-4 py-2.5 rounded-lg text-center"
              style={{ background: accentBg, border: `1px solid ${accentBorder}` }}
            >
              <div className="text-xl font-bold tabular-nums" style={{ color: accentVar }}>
                {passedTopics} / {topics.length}
              </div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                Themen bestanden
              </div>
            </div>
          </div>

          <div className="mt-6 max-w-sm">
            <ProgressBar
              value={overall.percentage}
              showLabel
              label={`${overall.passed} von ${overall.total} Fragen`}
              size="md"
              color={accentColor}
              animated={overall.percentage > 0 && overall.percentage < 100}
            />
          </div>
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
          </div>
        </Link>

        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--white)' }}>
            Themengebiete
          </h2>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>
            3× richtig = bestanden
          </span>
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

        {quickLinks && <div className="mb-6">{quickLinks}</div>}

        <div className="grid sm:grid-cols-2 gap-3">
          {topics
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
