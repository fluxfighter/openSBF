'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { loadProgress, getExamOverallProgress } from '@/lib/progress';
import { getAllBinnenQuestions, getAllSeeQuestions } from '@/data/topics';
import { CertificateCard } from '@/components/ui/CertificateCard';

const tutorialLinks = [
  { href: '/lernen/lichter-grundlagen', label: 'Lichterführung Grundlagen' },
  { href: '/lernen/lichter-see', label: 'Lichter nach KVR' },
  { href: '/lernen/ausweichregeln-kvr', label: 'Ausweichregeln KVR' },
  { href: '/lernen/ausweichregeln-binnen', label: 'Ausweichregeln Binnen' },
  { href: '/lernen/seezeichen', label: 'Seezeichen & Betonnung' },
  { href: '/lernen/navigation-grundlagen', label: 'Navigation' },
  { href: '/lernen/schallzeichen-see', label: 'Schallzeichen See' },
  { href: '/lernen/schallzeichen-binnen', label: 'Schallzeichen Binnen' },
  { href: '/lernen/sicherheit-ausruestung', label: 'Sicherheit & Ausrüstung' },
  { href: '/lernen/knoten', label: 'Knoten & Tauwerk' },
  { href: '/navigation', label: 'Navigationsrechner' },
];

function useExamProgress(): { binnenPct: number; seePct: number } {
  const [binnenPct] = useState(() => {
    const progress = loadProgress();
    return getExamOverallProgress(progress, getAllBinnenQuestions().map((q) => q.id), 'binnen').percentage;
  });
  const [seePct] = useState(() => {
    const progress = loadProgress();
    return getExamOverallProgress(progress, getAllSeeQuestions().map((q) => q.id), 'see').percentage;
  });
  return { binnenPct, seePct };
}

export default function HomePage(): React.ReactElement {
  const { binnenPct, seePct } = useExamProgress();
  const hasStarted = binnenPct > 0 || seePct > 0;

  const examCards = [
    {
      title: 'SBF Binnen',
      sub: 'Binnenschifffahrtsstraßen',
      href: '/binnen',
      pct: binnenPct,
      color: 'gold' as const,
      icon: '🚢',
    },
    {
      title: 'SBF See',
      sub: 'Seeschifffahrtsstraßen',
      href: '/see',
      pct: seePct,
      color: 'seafoam' as const,
      icon: '⛵',
    },
  ];

  return (
    <div className="min-h-screen" style={{ background: 'var(--navy-deep)' }}>
      {/* Header */}
      <section className="px-4 pt-16 pb-10 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-3xl mx-auto">
          <h1
            className="text-3xl sm:text-4xl font-bold mb-2"
            style={{ fontFamily: 'Playfair Display, serif', color: 'var(--white)' }}
          >
            Open<span style={{ color: 'var(--gold)' }}>SBF</span>
          </h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            {hasStarted
              ? 'Mach weiter, wo du aufgehört hast.'
              : 'Deine Lernplattform für den Sportbootführerschein Binnen & See.'}
          </p>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* Progress cards */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--muted)' }}>
            Dein Fortschritt
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
                      color: card.pct > 0 ? 'var(--white)' : 'var(--muted)',
                    }}
                  >
                    {card.pct}%
                  </span>
                </div>

                <ProgressBar value={card.pct} size="sm" color={card.color} />

                <Link
                  href={card.href}
                  className="inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90"
                  style={
                    card.pct > 0
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
                  {card.pct > 0 ? 'Weiterüben →' : 'Starten →'}
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* Certificates */}
        {(binnenPct === 100 || seePct === 100) && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--muted)' }}>
              Errungenschaften
            </h2>
            <div className="space-y-4">
              {binnenPct === 100 && <CertificateCard exam="SBF Binnen" color="gold" />}
              {seePct === 100 && <CertificateCard exam="SBF See" color="seafoam" />}
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
              { href: '/lernen', icon: '📖', label: 'Theorie' },
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

        {/* Tutorial links */}
        <section>
          <div className="rounded-xl p-6" style={{ background: 'var(--navy)', border: '1px solid var(--border)' }}>
            <div className="flex items-baseline justify-between mb-5">
              <div>
                <h2 className="text-base font-semibold" style={{ color: 'var(--white)' }}>
                  Theorie & Wissen
                </h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                  Kurze Erklärungen zu den wichtigsten Themen
                </p>
              </div>
              <Link
                href="/lernen"
                className="text-xs font-medium transition-opacity hover:opacity-70"
                style={{ color: 'var(--gold)' }}
              >
                Alle anzeigen →
              </Link>
            </div>
            <div className="grid sm:grid-cols-2 gap-1">
              {tutorialLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-sm transition-colors hover:bg-white/5"
                  style={{ color: 'var(--muted)' }}
                >
                  <span className="w-1 h-1 rounded-full shrink-0" style={{ background: 'var(--gold)', opacity: 0.7 }} />
                  <span className="hover:text-white transition-colors">{link.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
