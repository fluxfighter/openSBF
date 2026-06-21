'use client';

import Link from 'next/link';
import { ExamTopicsPage } from '@/components/quiz/ExamTopicsPage';
import { seeTopics, getAllSeeQuestions } from '@/data/topics';

const explanationItems = (
  <>
    <li>Basisfragen (1–72) sind identisch mit SBF Binnen; spezifisch sind KVR, Seezeichen, Schallzeichen und Navigation</li>
    <li>
      <span style={{ color: 'var(--white)' }}>Heute lernen</span> zeigt genau die fälligen Karten —
      neue und zur Wiederholung im richtigen Abstand (Spaced Repetition)
    </li>
    <li>
      Eine Frage gilt nach <span style={{ color: 'var(--white)' }}>3× richtig</span> als sicher
      gelernt; falsch beantwortete tauchen früher wieder auf
    </li>
    <li>
      Die <span style={{ color: 'var(--white)' }}>Prüfungsreife</span> schätzt, wie viel des Katalogs
      du gerade sicher beherrschst; <span style={{ color: 'var(--white)' }}>Prüfungsbögen</span>{' '}
      simulieren die echte Prüfung
    </li>
    <li>Dein Fortschritt wird automatisch auf deinen Geräten synchronisiert</li>
  </>
);

const pruefungsboegensLink = (
  <Link
    href="/see/pruefungsboegen"
    className="flex items-center justify-between p-4 rounded-xl transition-opacity hover:opacity-80"
    style={{
      background: 'rgba(38, 136, 164, 0.07)',
      border: '1px solid rgba(38, 136, 164, 0.22)',
    }}
  >
    <div className="flex items-center gap-3">
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center text-base shrink-0"
        style={{ background: 'rgba(38, 136, 164, 0.15)', color: 'var(--seafoam-light)' }}
      >
        📋
      </div>
      <div>
        <p className="text-sm font-medium" style={{ color: 'var(--white)' }}>
          Prüfungsbögen üben
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
          15 offizielle Bögen · je 30 Fragen · Prüfungssimulation
        </p>
      </div>
    </div>
    <span className="text-xs" style={{ color: 'var(--muted)' }}>→</span>
  </Link>
);

export default function SeePage(): React.ReactElement {
  return (
    <ExamTopicsPage
      exam="see"
      topics={seeTopics}
      getAllQuestions={getAllSeeQuestions}
      title="SBF See"
      subtitle="Sportbootführerschein Seeschifffahrtsstraßen"
      accentColor="seafoam"
      explanationContent={explanationItems}
      quickLinks={pruefungsboegensLink}
    />
  );
}
