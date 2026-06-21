'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { loadProgress, getExamOverallProgress } from '@/lib/progress';
import { getQueueCounts, getReadiness } from '@/lib/srs';
import { getStreak, getXp, getTodayCount } from '@/lib/gamification';
import { isBinnenZusatzOnly } from '@/lib/settings';
import { useMounted } from '@/hooks/useMounted';
import { getBinnenQuestions, getAllSeeQuestions } from '@/data/topics';
import { CertificateCard } from '@/components/ui/CertificateCard';

interface ExamHomeStats {
  binnenReady: number;
  seeReady: number;
  binnenMastered: number; // 3×-correct mastery — drives the certificate
  seeMastered: number;
  binnenSeen: number;
  seeSeen: number;
  binnenDue: number;
  seeDue: number;
  streak: number;
  xp: number;
  today: number;
}

const ZERO_STATS: ExamHomeStats = {
  binnenReady: 0,
  seeReady: 0,
  binnenMastered: 0,
  seeMastered: 0,
  binnenSeen: 0,
  seeSeen: 0,
  binnenDue: 0,
  seeDue: 0,
  streak: 0,
  xp: 0,
  today: 0,
};

function useExamProgress(): ExamHomeStats {
  const [stats] = useState<ExamHomeStats>(() => {
    const progress = loadProgress();
    const binnen = getBinnenQuestions(isBinnenZusatzOnly());
    const see = getAllSeeQuestions();
    const binnenReadiness = getReadiness(progress, 'binnen', binnen);
    const seeReadiness = getReadiness(progress, 'see', see);
    return {
      binnenReady: binnenReadiness.percentage,
      seeReady: seeReadiness.percentage,
      binnenMastered: getExamOverallProgress(progress, binnen.map((q) => q.id), 'binnen').percentage,
      seeMastered: getExamOverallProgress(progress, see.map((q) => q.id), 'see').percentage,
      binnenSeen: binnenReadiness.seen,
      seeSeen: seeReadiness.seen,
      binnenDue: getQueueCounts(progress, 'binnen', binnen).total,
      seeDue: getQueueCounts(progress, 'see', see).total,
      streak: getStreak(progress),
      xp: getXp(progress),
      today: getTodayCount(progress),
    };
  });
  return stats;
}

export default function HomePage(): React.ReactElement {
  const mounted = useMounted();
  const raw = useExamProgress();
  // Until mounted, render neutral zeros so SSR and the first client render match.
  const stats = mounted ? raw : ZERO_STATS;
  const { binnenMastered, seeMastered, binnenDue, seeDue, streak, xp, today } = stats;

  // One coherent "today": progress toward clearing the cards actually due today
  // (answered today + still due), so the home goal == the learning queue.
  const dueTotal = binnenDue + seeDue;
  const todayTarget = today + dueTotal;
  const todayPct = todayTarget > 0 ? Math.round((today / todayTarget) * 100) : 0;
  const goalReached = today > 0 && dueTotal === 0;

  const examCards = [
    {
      title: 'SBF Binnen',
      sub: 'Binnenschifffahrtsstraßen',
      href: '/binnen',
      ready: stats.binnenReady,
      seen: stats.binnenSeen,
      due: binnenDue,
      color: 'gold' as const,
      icon: '🚢',
      exam: 'binnen' as const,
    },
    {
      title: 'SBF See',
      sub: 'Seeschifffahrtsstraßen',
      href: '/see',
      ready: stats.seeReady,
      seen: stats.seeSeen,
      due: seeDue,
      color: 'seafoam' as const,
      icon: '⛵',
      exam: 'see' as const,
    },
  ];

  return (
    <div className="min-h-screen" style={{ background: 'var(--navy-deep)' }}>
      {/* Header */}
      <section className="px-4 pt-10 pb-10 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-3xl mx-auto">
          {/* Gamification strip — streak, today's queue goal, XP */}
          <div className="grid grid-cols-3 gap-3">
            <div
              className="rounded-xl px-3 py-3 text-center"
              style={{ background: 'var(--navy)', border: '1px solid var(--border)' }}
            >
              <div className="text-xl font-bold tabular-nums" style={{ color: streak > 0 ? 'var(--gold)' : 'var(--muted)' }}>
                🔥 {streak}
              </div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                Tage Streak
              </div>
            </div>
            <div
              className="rounded-xl px-3 py-3 text-center"
              style={{
                background: goalReached ? 'rgba(18, 184, 112, 0.10)' : 'var(--navy)',
                border: `1px solid ${goalReached ? 'rgba(18, 184, 112, 0.30)' : 'var(--border)'}`,
              }}
            >
              <div
                className="text-xl font-bold tabular-nums"
                style={{ color: goalReached ? 'var(--green-signal)' : 'var(--white)' }}
              >
                {goalReached ? '✓' : dueTotal > 0 ? `${today}/${todayTarget}` : today}
              </div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                {dueTotal > 0 ? 'Heute fällig' : 'Heute gelernt'}
              </div>
            </div>
            <div
              className="rounded-xl px-3 py-3 text-center"
              style={{ background: 'var(--navy)', border: '1px solid var(--border)' }}
            >
              <div className="text-xl font-bold tabular-nums" style={{ color: 'var(--seafoam-light)' }}>
                {xp}
              </div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                XP
              </div>
            </div>
          </div>

          {dueTotal > 0 && (
            <div className="mt-3">
              <ProgressBar value={todayPct} size="sm" color="seafoam" />
            </div>
          )}
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* Progress cards */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--muted)' }}>
            Prüfungsreife
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {examCards.map((card) => (
              <div
                key={card.title}
                className="rounded-xl p-5 flex flex-col gap-4"
                style={{ background: 'var(--navy)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl leading-none">{card.icon}</span>
                    <div>
                      <div className="text-sm font-semibold" style={{ color: 'var(--white)' }}>
                        {card.title}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                        {card.sub}
                      </div>
                    </div>
                  </div>
                  <span
                    className="text-xs font-semibold tabular-nums px-2 py-0.5 rounded"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      color: card.seen > 0 ? 'var(--white)' : 'var(--muted)',
                    }}
                  >
                    {card.ready}%
                  </span>
                </div>

                <div>
                  <ProgressBar value={card.ready} size="sm" color={card.color} />
                  <p className="text-xs mt-1.5" style={{ color: 'var(--muted)' }}>
                    Voraussichtliche Prüfungsreife
                  </p>
                </div>

                {card.due > 0 ? (
                  <Link
                    href={`/ueben/${card.exam}/heute`}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90"
                    style={{
                      background: card.color === 'gold' ? 'var(--gold)' : 'var(--seafoam)',
                      color: 'var(--navy-deepest)',
                    }}
                  >
                    ⚡ Heute lernen · {card.due}
                  </Link>
                ) : (
                  <Link
                    href={card.href}
                    className="inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90"
                    style={
                      card.seen > 0
                        ? {
                            background: card.color === 'gold' ? 'rgba(188,147,50,0.12)' : 'rgba(77,201,176,0.12)',
                            color: card.color === 'gold' ? 'var(--gold-light)' : 'var(--seafoam-light)',
                            border: `1px solid ${card.color === 'gold' ? 'rgba(188,147,50,0.25)' : 'rgba(77,201,176,0.25)'}`,
                          }
                        : {
                            background: card.color === 'gold' ? 'var(--gold)' : 'var(--seafoam)',
                            color: 'var(--navy-deepest)',
                          }
                    }
                  >
                    {card.seen > 0 ? 'Weiterüben →' : 'Starten →'}
                  </Link>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Certificates — earned at full mastery (every question 3× correct) */}
        {(binnenMastered === 100 || seeMastered === 100) && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--muted)' }}>
              Errungenschaften
            </h2>
            <div className="space-y-4">
              {binnenMastered === 100 && <CertificateCard exam="SBF Binnen" color="gold" />}
              {seeMastered === 100 && <CertificateCard exam="SBF See" color="seafoam" />}
            </div>
          </section>
        )}

        {/* Quick actions */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--muted)' }}>
            Schnellzugriff
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { href: '/lernen', icon: '📖', label: 'Theorie & Wissen' },
              { href: '/navigation', icon: '🧭', label: 'Navigation' },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center gap-2 py-4 px-3 rounded-xl text-center transition-colors hover:bg-white/5"
                style={{ background: 'var(--navy)', border: '1px solid var(--border)' }}
              >
                <span className="text-2xl leading-none">{item.icon}</span>
                <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>
                  {item.label}
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
