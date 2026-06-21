'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { loadProgress, getQuestionStreak, getQuestionWrongCount, getQuestionKey } from '@/lib/progress';
import { isDue } from '@/lib/srs';
import { getExamQuestions, getExamTopics } from '@/data/topics';
import { tutorialForTopic } from '@/data/tutorials';
import { isBinnenZusatzOnly } from '@/lib/settings';
import { useMounted } from '@/hooks/useMounted';
import type { AccentColor, ExamType, Question, UserProgress } from '@/lib/types';

type Status = 'neu' | 'lernend' | 'gelernt';
type Filter = 'alle' | Status | 'schwierig';

interface StatusInfo {
  status: Status;
  due: boolean;
  hard: boolean; // answered wrong at least twice
}

function questionStatus(progress: UserProgress, q: Question, exam: ExamType): StatusInfo {
  const entry = progress.questions[getQuestionKey(q.id, exam)];
  const streak = getQuestionStreak(progress, q.id, exam);
  const hard = getQuestionWrongCount(progress, q.id, exam) >= 2;
  if (!entry) return { status: 'neu', due: false, hard };
  const due = isDue(entry);
  if (streak >= 3) return { status: 'gelernt', due, hard };
  return { status: 'lernend', due, hard };
}

const STATUS_LABEL: Record<Status, string> = {
  neu: 'Neu',
  lernend: 'Lernend',
  gelernt: 'Gelernt',
};

const STATUS_COLOR: Record<Status, string> = {
  neu: 'var(--muted)',
  lernend: 'var(--gold)',
  gelernt: 'var(--green-signal)',
};

interface QuestionRowProps {
  question: Question;
  info: StatusInfo;
  exam: ExamType;
  accentVar: string;
}

function QuestionRow({ question, info, exam, accentVar }: QuestionRowProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const tutorialId = tutorialForTopic(question.topic, exam);

  // Stable shuffled answer order so the correct one isn't always first.
  const answers = useMemo(() => {
    const out = [...question.answers];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(((question.id * 9301 + (i + 1) * 49297) % 233280) / 233280 * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }, [question]);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: 'var(--navy)', border: '1px solid var(--border)' }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5"
      >
        <span
          className="shrink-0 w-2 h-2 rounded-full"
          style={{ background: info.due ? 'var(--seafoam)' : STATUS_COLOR[info.status] }}
          title={info.due ? 'Fällig' : STATUS_LABEL[info.status]}
        />
        <span className="text-xs tabular-nums shrink-0" style={{ color: 'var(--muted)' }}>
          #{question.id}
        </span>
        <span className="text-sm flex-1 line-clamp-1" style={{ color: 'var(--white)' }}>
          {question.text}
        </span>
        {info.hard && (
          <span className="shrink-0 text-xs" style={{ color: 'var(--red-signal)' }}>schwierig</span>
        )}
        <span
          className="shrink-0 text-xs px-2 py-0.5 rounded-full"
          style={{ color: STATUS_COLOR[info.status], background: 'rgba(255,255,255,0.05)' }}
        >
          {STATUS_LABEL[info.status]}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
          <p className="text-sm font-medium leading-relaxed mt-3 mb-3" style={{ color: 'var(--white)' }}>
            {question.text}
          </p>
          <div className="space-y-1.5">
            {answers.map((a) => {
              const correct = a.key === question.correctAnswer;
              return (
                <div
                  key={a.key}
                  className="flex items-start gap-2 px-3 py-2 rounded-lg text-sm leading-snug"
                  style={{
                    background: correct ? 'rgba(18,184,112,0.10)' : 'transparent',
                    border: `1px solid ${correct ? 'rgba(18,184,112,0.30)' : 'var(--border)'}`,
                    color: correct ? 'var(--green-signal)' : 'var(--muted)',
                  }}
                >
                  <span className="shrink-0 mt-px">{correct ? '✓' : '○'}</span>
                  <span>{a.text}</span>
                </div>
              );
            })}
          </div>
          {question.hint && (
            <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
              💡 {question.hint}
            </p>
          )}
          <div className="mt-3 flex items-center gap-4">
            <Link
              href={`/ueben/${exam}/${question.topic}`}
              className="text-xs font-medium transition-opacity hover:opacity-80"
              style={{ color: accentVar }}
            >
              Thema üben →
            </Link>
            {tutorialId && (
              <Link
                href={`/lernen/${tutorialId}`}
                className="text-xs font-medium transition-opacity hover:opacity-80"
                style={{ color: 'var(--muted)' }}
              >
                Mehr dazu →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface QuestionOverviewProps {
  exam: ExamType;
  title: string;
  accentColor: AccentColor;
}

export function QuestionOverview({ exam, title, accentColor }: QuestionOverviewProps): React.ReactElement {
  const mounted = useMounted();
  const [filter, setFilter] = useState<Filter>('alle');
  const [topic, setTopic] = useState<string>('alle');

  const accentVar = accentColor === 'gold' ? 'var(--gold)' : 'var(--seafoam)';
  const zusatz = exam === 'binnen' && isBinnenZusatzOnly();
  const topics = getExamTopics(exam, zusatz);

  // Computed each render; the React Compiler memoizes automatically.
  const progress = mounted ? loadProgress() : null;
  const all = progress
    ? getExamQuestions(exam, zusatz).map((q) => ({ question: q, info: questionStatus(progress, q, exam) }))
    : [];
  const counts = {
    alle: all.length,
    neu: all.filter((r) => r.info.status === 'neu').length,
    lernend: all.filter((r) => r.info.status === 'lernend').length,
    gelernt: all.filter((r) => r.info.status === 'gelernt').length,
    schwierig: all.filter((r) => r.info.hard).length,
  };
  const rows = all.filter((r) => {
    if (topic !== 'alle' && r.question.topic !== topic) return false;
    if (filter === 'alle') return true;
    if (filter === 'schwierig') return r.info.hard;
    return r.info.status === filter;
  });

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: 'alle', label: 'Alle', count: counts.alle },
    { key: 'neu', label: 'Neu', count: counts.neu },
    { key: 'lernend', label: 'Lernend', count: counts.lernend },
    { key: 'gelernt', label: 'Gelernt', count: counts.gelernt },
    { key: 'schwierig', label: 'Schwierig', count: counts.schwierig },
  ];

  return (
    <div className="min-h-screen" style={{ background: 'var(--navy-deep)' }}>
      <div className="border-b px-4 py-8" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-3xl mx-auto">
          <Link
            href={`/${exam}`}
            className="text-xs font-medium mb-5 inline-block transition-opacity hover:opacity-70"
            style={{ color: 'var(--muted)' }}
          >
            ← {title}
          </Link>
          <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--white)' }}>
            Alle Fragen
          </h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Status jeder Frage auf einen Blick — tippe eine Frage an, um sie zu wiederholen.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Status filter chips */}
        <div className="flex flex-wrap gap-2 mb-3">
          {filters.map((f) => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                style={{
                  background: active ? accentVar : 'var(--navy)',
                  color: active ? 'var(--navy-deepest)' : 'var(--muted)',
                  border: `1px solid ${active ? accentVar : 'var(--border)'}`,
                }}
              >
                {f.label} · {f.count}
              </button>
            );
          })}
        </div>

        {/* Topic filter */}
        <select
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className="mb-5 w-full sm:w-auto px-3 py-2 rounded-lg text-sm outline-none"
          style={{ background: 'var(--navy)', border: '1px solid var(--border)', color: 'var(--white)' }}
        >
          <option value="alle">Alle Themen</option>
          {topics.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>

        {!mounted ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Lädt…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Keine Fragen in dieser Auswahl.</p>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <QuestionRow
                key={r.question.id}
                question={r.question}
                info={r.info}
                exam={exam}
                accentVar={accentVar}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
