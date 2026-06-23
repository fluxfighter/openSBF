'use client';

import Link from 'next/link';
import type { Topic } from '@/lib/types';
import { MasteryBar, MASTERY_COLORS } from '@/components/ui/MasteryBar';

interface TopicCardProps {
  topic: Topic;
  passed: number;
  learning: number;
  struggling: number;
  total: number;
  percentage: number;
  isPassed: boolean;
  exam: 'binnen' | 'see';
}

export function TopicCard({
  topic,
  passed,
  learning,
  struggling,
  total,
  percentage,
  isPassed,
  exam,
}: TopicCardProps): React.ReactElement {
  const seen = passed + learning + struggling;
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

      <MasteryBar className="mb-2" breakdown={{ passed, learning, struggling, total }} />

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs tabular-nums" style={{ color: 'var(--muted)' }}>
          {seen > 0 ? (
            <>
              <span style={{ color: MASTERY_COLORS.learned }}>{passed}</span>
              {learning > 0 && <span style={{ color: MASTERY_COLORS.learning }}> · {learning}</span>}
              {struggling > 0 && <span style={{ color: MASTERY_COLORS.weak }}> · {struggling}</span>}
              <span style={{ color: 'var(--muted)' }}> / {total}</span>
            </>
          ) : (
            `0 / ${total} Fragen`
          )}
        </span>
        <span
          className="text-xs font-medium tabular-nums shrink-0"
          style={{ color: isPassed ? 'var(--green-signal)' : 'var(--muted)' }}
        >
          {percentage}%
        </span>
      </div>
    </Link>
  );
}
