// Мини-тесты без регистрации: типы ответа GET /api/quizzes и подсчёт
// результата на клиенте (результат мгновенный, без похода на сервер).
//
// Зеркало бэкенда — src/quiz/quiz-logic.ts (бэкенд не может импортировать
// shared: tsconfig rootDir=src). Паритет закреплён одинаковыми кейсами в
// src/quiz/quiz-logic.spec.ts и webapp/src/hooks/useQuizRunner.test.ts —
// та же схема, что у ysq.ts ↔ useYsqTest.ts.

export interface QuizOptionDto {
  label: string;
  resultId: string;
}

export interface QuizQuestionDto {
  text: string;
  options: QuizOptionDto[];
}

export interface QuizResultDto {
  id: string;
  emoji: string;
  title: string;
  text: string;
  hint: string;
}

export interface QuizDto {
  id: string;
  emoji: string;
  title: string;
  teaser: string;
  intro: string;
  questions: QuizQuestionDto[];
  /** порядок = приоритет при ничьей (первый выигрывает) */
  results: QuizResultDto[];
}

/**
 * Каждый ответ голосует за свой resultId; побеждает большинство, ничью
 * забирает результат, стоящий раньше в quiz.results. null — набор ответов
 * неполный или битый.
 */
export function computeQuizResultId(
  quiz: QuizDto,
  picks: number[],
): string | null {
  if (picks.length !== quiz.questions.length) return null;
  const tally: Record<string, number> = {};
  for (let i = 0; i < picks.length; i++) {
    if (!Number.isInteger(picks[i]) || picks[i] < 0) return null;
    const option = quiz.questions[i].options[picks[i]];
    if (!option) return null;
    tally[option.resultId] = (tally[option.resultId] ?? 0) + 1;
  }
  return quiz.results.reduce<{ id: string | null; votes: number }>(
    (acc, r) =>
      (tally[r.id] ?? 0) > acc.votes
        ? { id: r.id, votes: tally[r.id] ?? 0 }
        : acc,
    { id: null, votes: -1 },
  ).id;
}
