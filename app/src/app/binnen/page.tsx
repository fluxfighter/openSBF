'use client';

import { ExamTopicsPage } from '@/components/quiz/ExamTopicsPage';
import { binnenTopics, getAllBinnenQuestions } from '@/data/topics';

const explanationItems = (
  <>
    <li>
      <span style={{ color: 'var(--white)' }}>Heute lernen</span> ist der schnellste Weg: es zeigt
      genau die Karten, die heute fällig sind — neue und zur Wiederholung
    </li>
    <li>
      Karten kommen{' '}
      <span style={{ color: 'var(--white)' }}>im richtigen Abstand wieder</span> (Spaced
      Repetition) — eine Frage gilt nach 3× richtig als sicher gelernt
    </li>
    <li>
      Falsch beantwortete Fragen tauchen{' '}
      <span style={{ color: 'var(--white)' }}>früher erneut auf</span>; gehäufte Fehler sammeln sich
      unter <span style={{ color: 'var(--white)' }}>Problemfragen</span>
    </li>
    <li>
      Die <span style={{ color: 'var(--white)' }}>Prüfungsreife</span> schätzt, wie viel des Katalogs
      du gerade sicher beherrschst
    </li>
    <li>Dein Fortschritt wird automatisch auf deinen Geräten synchronisiert</li>
  </>
);

export default function BinnenPage(): React.ReactElement {
  return (
    <ExamTopicsPage
      exam="binnen"
      topics={binnenTopics}
      getAllQuestions={getAllBinnenQuestions}
      title="SBF Binnen"
      subtitle="Sportbootführerschein Binnenschifffahrtsstraßen"
      accentColor="gold"
      explanationContent={explanationItems}
    />
  );
}
