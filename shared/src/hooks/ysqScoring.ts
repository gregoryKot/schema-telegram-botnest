// Скоринг теста на схемы: вычисление баллов, критерий выраженности,
// активность в истории. Чистая логика (правило №10), покрыта тестами
// useYsqTest.test.ts. Данные схем — в ./ysqSchemas.

import { SCHEMAS } from './ysqSchemas';

export type Phase = 'intro' | 'test' | 'result';

export interface SchemaScore {
  sum: number;
  max: number;
  pct: number;
  pct5plus: number;
  /** Средний балл по вопросам схемы, 1–6 (0 если ни одного ответа). */
  avg: number;
  /** Число ответов «5» или «6» — для человекочитаемого «N из M». */
  n5plus: number;
  /** Всего вопросов в схеме (знаменатель метрик). */
  nQuestions: number;
}

// Порог активности по среднему баллу: «часто так» и выше в среднем по схеме.
// Классический подсчёт (>50% ответов 5–6) ловит только крайние ответы: профиль
// из сплошных «4» давал 0% по всем схемам (инцидент 2026-07). Схема считается
// выраженной по ЛЮБОМУ из двух критериев.
export const AVG_ACTIVE_THRESHOLD = 4;

export function isSchemaScoreActive(s: {
  pct5plus: number;
  avg?: number;
}): boolean {
  return s.pct5plus > 50 || (s.avg ?? 0) >= AVG_ACTIVE_THRESHOLD;
}

export function computeScores(answers: number[]): Record<string, SchemaScore> {
  const result: Record<string, SchemaScore> = {};
  for (const schema of SCHEMAS) {
    const vals = schema.questions
      .map((q) => answers[q - 1] ?? 0)
      .filter((v) => v > 0);
    const sum = vals.reduce((a, b) => a + b, 0);
    const max = schema.questions.length * 6;
    const pct = Math.round((sum / max) * 100);
    const n5plus = vals.filter((v) => v >= 5).length;
    const nQuestions = schema.questions.length;
    const pct5plus =
      vals.length > 0 ? Math.round((n5plus / nQuestions) * 100) : 0;
    const avg =
      vals.length > 0
        ? Math.round((sum / schema.questions.length) * 10) / 10
        : 0;
    result[schema.name] = { sum, max, pct, pct5plus, avg, n5plus, nQuestions };
  }
  return result;
}

/** Ширина бара для среднего балла: 1 → 0%, 6 → 100%. */
export function avgBarPct(avg: number): number {
  return Math.max(0, Math.round(((avg - 1) / 5) * 100));
}

export interface YsqHistoryEntry {
  id: number;
  completedAt: string;
  // avg опционален: старые ответы сервера могли его не содержать —
  // тогда активность считается только по классике.
  scores: { id: string; pct5plus: number; avg?: number }[];
}

/** Число выраженных схем в записи истории (оба критерия). */
export function countActiveInHistory(entry: YsqHistoryEntry): number {
  return entry.scores.filter(isSchemaScoreActive).length;
}
