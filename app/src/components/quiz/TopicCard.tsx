'use client';

import Link from 'next/link';
import type { Topic } from '@/lib/types';

interface TopicCardProps {
  topic: Topic;
  passed: number;
  learning: number;
  total: number;
  percentage: number;
  learningPct: number;
  isPassed: boolean;
  exam: 'binnen' | 'see';
}

export function TopicCard({ topic, passed, learning, total, percentage, learningPct, isPassed, exam }: TopicCardProps): React.ReactElement {
  const seen = passed + learning;
  return (
    <Link
      href={`/ueben/${exam}/${topic.id}`}
      className="block p-4 rounded-xl transition-all nautical-card"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3">
          <span className="text-lg mt-0.5 shrink-0">{topic.icon}</span>
          <div>
            <h3 className="text-sm font-semibold leading-snug" style={{ color: 'var(--white)' }}>
              {topic.name}
            </h3>
            <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--muted)' }}>
              {topic.description}
            </p>
          </div>
        </div>
        {isPassed && (
          <span
            className="shrink-0 text-xs font-medium px-2 py-0.5 rounded"
            style={{
              background: 'rgba(18, 184, 112, 0.12)',
              color: 'var(--green-signal)',
              border: '1px solid rgba(18, 184, 112, 0.25)',
            }}
          >
            Bestanden
          </span>
        )}
      </div>

      {/* Segmented progress bar: green = gelernt, gold/seafoam = lernend */}
      <div
        className="h-1.5 rounded-full overflow-hidden mb-2"
        style={{ background: 'rgba(255,255,255,0.07)' }}
      >
        <div className="h-full flex">
          {percentage > 0 && (
            <div
              className="h-full transition-all duration-500"
              style={{ width: `${percentage}%`, background: 'var(--green-signal)' }}
            />
          )}
          {learningPct > 0 && (
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${learningPct}%`,
                background: exam === 'see' ? 'var(--seafoam)' : 'var(--gold)',
                opacity: 0.7,
              }}
            />
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: 'var(--muted)' }}>
          {seen > 0 ? (
            <>
              <span style={{ color: 'var(--green-signal)' }}>{passed}</span>
              {learning > 0 && (
                <span style={{ color: exam === 'see' ? 'var(--seafoam)' : 'var(--gold)' }}>
                  {' '}+{learning}
                </span>
              )}
              <span> / {total}</span>
            </>
          ) : (
            `0 / ${total} Fragen`
          )}
        </span>
        <span
          className="text-xs font-medium tabular-nums"
          style={{ color: isPassed ? 'var(--green-signal)' : 'var(--muted)' }}
        >
          {percentage}%
        </span>
      </div>
    </Link>
  );
}
