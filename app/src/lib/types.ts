export type ExamType = 'binnen' | 'see';

export type AnswerKey = 'a' | 'b' | 'c' | 'd';

export type AccentColor = 'gold' | 'seafoam';

export interface Answer {
  key: AnswerKey;
  text: string;
}

export interface Question {
  id: number;
  text: string;
  answers: Answer[];
  correctAnswer: 'a';
  topic: string;
  hint?: string;
  hasImage?: boolean;
  imageDescription?: string;
  imagePath?: string;
}

export interface Topic {
  id: string;
  name: string;
  description: string;
  icon: string;
  exam: ExamType | 'both';
  questionIds: number[];
}

export type SrsGrade = 'again' | 'good' | 'easy';

export interface QuestionProgress {
  questionId: number;
  exam: ExamType;
  correctCount: number;
  wrongCount: number;
  lastAnswered: string;
  // Spaced-repetition scheduling (SM-2-light). Optional so progress data
  // written before SRS existed keeps loading; backfilled on next answer.
  ease?: number; // ease factor, >= 1.3
  intervalDays?: number; // current review interval in days
  due?: string; // ISO timestamp of next review
  reps?: number; // consecutive successful reviews (resets to 0 on a wrong answer)
  bestReps?: number; // highest reps streak ever reached (for the regression "ghost")
  lapses?: number; // number of times the card was forgotten
}

export interface TopicProgress {
  topicId: string;
  exam: ExamType;
  passed: boolean;
  totalQuestions: number;
  passedQuestions: number;
}

export interface UserProgress {
  questions: Record<string, QuestionProgress>;
  topics: Record<string, TopicProgress>;
  pruefungsboegen: Record<string, ExamResult[]>;
  // Bookmarked ("gemerkte") questions, keyed by `${exam}_${id}`.
  bookmarks: Record<string, boolean>;
  lastUpdated: string;
}

export interface TutorialSection {
  id: string;
  title: string;
  content: string;
  relatedTopics?: string[];
}

export interface SessionStats {
  correct: number;
  wrong: number;
  total: number;
}

export interface TopicProgressEntry {
  passed: number;
  learning: number;
  total: number;
  percentage: number;
  learningPct: number;
  isPassed: boolean;
}

export interface Pruefungsbogen {
  nummer: number;
  questionIds: number[];
}

export interface ExamResult {
  takenAt: string;
  correct: number;
  wrong: number;
  total: number;
  basisCorrect: number;
  basisTotal: number;
  specificCorrect: number;
  specificTotal: number;
  passed: boolean;
}

export interface PruefungsbogenStats {
  attempts: number;
  avgCorrect: number; // average correct answers per attempt (out of 30)
  passedCount: number; // how many attempts passed
  bestCorrect: number;
  lastCorrect: number | null;
  lastPassed: boolean | null;
}
