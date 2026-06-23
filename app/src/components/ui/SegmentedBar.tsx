interface Segment {
  /** Width as a percentage of the whole bar (0–100). */
  pct: number;
  /** CSS color (token or value) for this segment. */
  color: string;
}

interface SegmentedBarProps {
  segments: Segment[];
  /** Tailwind height class, e.g. "h-1.5" or "h-2". */
  heightClass?: string;
  className?: string;
}

/**
 * A horizontal progress bar split into multiple colored segments laid out
 * left-to-right. The remaining width (100 − sum of segments) stays as the
 * neutral track. Used for topic / Prüfungsbogen mastery breakdowns:
 * gelernt · lernend · schwierig · (rest).
 */
export function SegmentedBar({
  segments,
  heightClass = 'h-1.5',
  className = '',
}: SegmentedBarProps): React.ReactElement {
  return (
    <div
      className={`${heightClass} rounded-full overflow-hidden ${className}`}
      style={{ background: 'rgba(255,255,255,0.07)' }}
    >
      <div className="h-full flex">
        {segments.map((seg, i) =>
          seg.pct > 0 ? (
            <div
              key={i}
              className="h-full transition-all duration-500"
              style={{ width: `${seg.pct}%`, background: seg.color }}
            />
          ) : null,
        )}
      </div>
    </div>
  );
}
