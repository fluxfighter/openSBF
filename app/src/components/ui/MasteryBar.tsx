import { SegmentedBar } from '@/components/ui/SegmentedBar';

// Single source of truth for the mastery colours, so bars, legends and inline
// count labels stay in sync everywhere they appear.
export const MASTERY_COLORS = {
  learned: 'var(--mastery-learned)',
  learning: 'var(--mastery-learning)',
  weak: 'var(--mastery-weak)',
  track: 'var(--mastery-track)',
} as const;

export interface MasteryBreakdown {
  passed: number; // gelernt (streak ≥ threshold)
  learning: number; // im Lernen (streak 1–2)
  struggling: number; // schwierig (seen, streak 0)
  total: number;
}

interface MasteryBarProps {
  breakdown: MasteryBreakdown;
  /** Tailwind height class, e.g. "h-1.5" or "h-2". */
  heightClass?: string;
  className?: string;
}

/**
 * The standard catalog-mastery bar used across the app (topic cards,
 * Prüfungsbögen, exam overview, profile). Splits a question set into
 * gelernt · im Lernen · schwierig, with the unseen remainder as neutral track.
 */
export function MasteryBar({ breakdown, heightClass, className }: MasteryBarProps): React.ReactElement {
  const { passed, learning, struggling, total } = breakdown;
  const pct = (n: number): number => (total > 0 ? (n / total) * 100 : 0);
  return (
    <SegmentedBar
      heightClass={heightClass}
      className={className}
      segments={[
        { pct: pct(passed), color: MASTERY_COLORS.learned },
        { pct: pct(learning), color: MASTERY_COLORS.learning },
        { pct: pct(struggling), color: MASTERY_COLORS.weak },
      ]}
    />
  );
}

const LEGEND_ITEMS: ReadonlyArray<{ color: string; label: string }> = [
  { color: MASTERY_COLORS.learned, label: 'gelernt' },
  { color: MASTERY_COLORS.learning, label: 'im Lernen' },
  { color: MASTERY_COLORS.weak, label: 'schwierig' },
  { color: MASTERY_COLORS.track, label: 'neu' },
];

interface MasteryLegendProps {
  className?: string;
}

/** Colour key matching the MasteryBar segments. */
export function MasteryLegend({ className = '' }: MasteryLegendProps): React.ReactElement {
  return (
    <div
      className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs ${className}`}
      style={{ color: 'var(--muted)' }}
    >
      {LEGEND_ITEMS.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}
