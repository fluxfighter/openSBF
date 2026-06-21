'use client';

import { useState } from 'react';
import Link from 'next/link';
import { seePruefungsboegen } from '@/data/pruefungsboegen';
import { loadProgress, getTopicProgress, getPruefungsbogenStats } from '@/lib/progress';
import { useMounted } from '@/hooks/useMounted';
import type { PruefungsbogenStats, UserProgress } from '@/lib/types';

const PASS_MAX_WRONG = 3;
const QUESTIONS_PER_BOGEN = 30;

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

interface PbCardProps {
  nummer: number;
  coverage: { passed: number; total: number; percentage: number };
  stats: PruefungsbogenStats;
}

function PbCard({ nummer, coverage, stats }: PbCardProps): React.ReactElement {
  const numStr = String(nummer).padStart(2, '0');
  const everPassed = stats.passedCount > 0;
  const attempted = stats.attempts > 0;

  let borderColor = 'var(--border)';
  if (everPassed) borderColor = 'rgba(18,184,112,0.25)';
  else if (attempted) borderColor = 'rgba(232,68,68,0.20)';

  return (
    <Link
      href={`/see/pruefungsboegen/${nummer}`}
      className="group flex flex-col rounded-xl p-4 transition-all hover:opacity-90"
      style={{ background: 'var(--navy)', border: `1px solid ${borderColor}` }}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>Bogen</span>
          <div className="text-2xl font-bold tabular-nums" style={{ color: 'var(--seafoam-light)' }}>
            {numStr}
          </div>
        </div>
        {attempted && (
          <span
            className="text-xs px-2 py-0.5 rounded-full font-semibold mt-0.5"
            style={{
              background: everPassed ? 'rgba(18,184,112,0.12)' : 'rgba(232,68,68,0.10)',
              color: everPassed ? 'var(--green-signal)' : 'var(--red-signal)',
            }}
          >
            {everPassed ? 'Bestanden' : 'Versucht'}
          </span>
        )}
      </div>

      {/* Catalog coverage: how many of this bogen's questions you've mastered */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span style={{ color: 'var(--muted)' }}>Fragen gelernt</span>
          <span className="font-semibold tabular-nums" style={{ color: 'var(--white)' }}>
            {coverage.passed}/{coverage.total}
          </span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${coverage.percentage}%`,
              background: coverage.percentage === 100 ? 'var(--green-signal)' : 'var(--seafoam)',
            }}
          />
        </div>
      </div>

      {/* Attempt statistics */}
      {attempted ? (
        <div className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
          <span className="font-semibold" style={{ color: 'var(--white)' }}>
            {stats.attempts}
          </span>{' '}
          {stats.attempts === 1 ? 'Versuch' : 'Versuche'} ·{' '}
          <span className="tabular-nums">⌀ {stats.avgCorrect}/30</span> ·{' '}
          <span style={{ color: stats.passedCount > 0 ? 'var(--green-signal)' : 'var(--muted)' }}>
            {stats.passedCount}× best.
          </span>
        </div>
      ) : (
        <span className="text-xs" style={{ color: 'rgba(106,136,168,0.5)' }}>
          Noch nicht versucht
        </span>
      )}
    </Link>
  );
}

export default function PruefungsboegePage(): React.ReactElement {
  const mounted = useMounted();
  const [loaded] = useState<UserProgress | null>(() => {
    if (typeof window === 'undefined') return null;
    return loadProgress();
  });
  // Fresh random order on every visit (the page remounts on navigation).
  const [order] = useState<number[]>(() => shuffle(seePruefungsboegen.map((pb) => pb.nummer)));

  const progress = mounted ? loaded : null;

  const Header = (
    <div className="mb-6">
      <Link
        href="/see"
        className="text-xs font-medium transition-opacity hover:opacity-70 mb-8 inline-block"
        style={{ color: 'var(--muted)' }}
      >
        ← SBF See
      </Link>
      <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--white)' }}>
        Prüfungsbögen
      </h1>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
        15 offizielle Prüfungsbögen nach ELWIS-Fragenkatalog — je 30 Fragen.
        Bestanden bei max. {PASS_MAX_WRONG} Fehlern (≥{QUESTIONS_PER_BOGEN - PASS_MAX_WRONG}/30 richtig).
      </p>
    </div>
  );

  if (!mounted || !progress) {
    return (
      <div className="min-h-screen px-4 py-10" style={{ background: 'var(--navy-deep)' }}>
        <div className="max-w-2xl mx-auto">
          {Header}
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Lädt…</p>
        </div>
      </div>
    );
  }

  const cards = order.map((nummer) => {
    const pb = seePruefungsboegen.find((p) => p.nummer === nummer);
    const ids = pb?.questionIds ?? [];
    return {
      nummer,
      coverage: getTopicProgress(progress, ids, 'see'),
      stats: getPruefungsbogenStats(progress, nummer),
    };
  });

  const attemptedCount = cards.filter((c) => c.stats.attempts > 0).length;
  const passedCount = cards.filter((c) => c.stats.passedCount > 0).length;

  return (
    <div className="min-h-screen px-4 py-10" style={{ background: 'var(--navy-deep)' }}>
      <div className="max-w-2xl mx-auto">
        {Header}

        {attemptedCount > 0 && (
          <div
            className="flex items-center gap-4 px-4 py-3 rounded-lg text-sm mb-6"
            style={{ background: 'var(--navy)', border: '1px solid var(--border)' }}
          >
            <div className="text-center">
              <div className="font-bold tabular-nums" style={{ color: 'var(--white)' }}>
                {attemptedCount}/15
              </div>
              <div className="text-xs" style={{ color: 'var(--muted)' }}>versucht</div>
            </div>
            <div className="w-px self-stretch" style={{ background: 'var(--border)' }} />
            <div className="text-center">
              <div
                className="font-bold tabular-nums"
                style={{ color: passedCount > 0 ? 'var(--green-signal)' : 'var(--muted)' }}
              >
                {passedCount}/15
              </div>
              <div className="text-xs" style={{ color: 'var(--muted)' }}>bestanden</div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {cards.map((c) => (
            <PbCard key={c.nummer} nummer={c.nummer} coverage={c.coverage} stats={c.stats} />
          ))}
        </div>

        <div
          className="mt-8 px-4 py-3 rounded-lg text-xs leading-relaxed"
          style={{
            background: 'rgba(38, 136, 164, 0.06)',
            border: '1px solid rgba(38, 136, 164, 0.15)',
            color: 'var(--muted)',
          }}
        >
          Einer dieser 15 Bögen wird in der Prüfung vorgelegt. Reihenfolge und Antworten erscheinen
          zufällig — erst nach Abgabe werden alle Ergebnisse gezeigt. Zusätzlich zur schriftlichen
          Prüfung ist eine Navigationsaufgabe auf Karte D49 zu lösen.
        </div>
      </div>
    </div>
  );
}
