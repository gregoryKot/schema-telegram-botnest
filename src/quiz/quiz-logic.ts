// Подсчёт результата мини-теста: каждый ответ «голосует» за результат,
// побеждает большинство; ничью забирает тот, кто раньше в quiz.results.
//
// Зеркало для сайта — shared/src/quiz/quizEngine.ts (бэкенд не может
// импортировать shared: tsconfig rootDir=src). Паритет закреплён одинаковыми
// кейсами в quiz-logic.spec.ts и webapp/src/hooks/useQuizRunner.test.ts —
// как у ysq.ts ↔ useYsqTest.ts.
import type { Quiz, QuizResult } from './quiz.types';

/** Валиден ли (возможно неполный) набор ответов для этого теста. */
export function isValidPicks(quiz: Quiz, picks: number[]): boolean {
  if (picks.length > quiz.questions.length) return false;
  return picks.every(
    (p, i) =>
      Number.isInteger(p) && p >= 0 && p < quiz.questions[i].options.length,
  );
}

/** Результат по ПОЛНОМУ набору ответов; null — набор неполный/битый. */
export function computeQuizResult(
  quiz: Quiz,
  picks: number[],
): QuizResult | null {
  if (picks.length !== quiz.questions.length) return null;
  if (!isValidPicks(quiz, picks)) return null;
  const votes = new Map<string, number>();
  picks.forEach((p, i) => {
    const id = quiz.questions[i].options[p].resultId;
    votes.set(id, (votes.get(id) ?? 0) + 1);
  });
  let best: QuizResult | null = null;
  let bestVotes = -1;
  for (const r of quiz.results) {
    const v = votes.get(r.id) ?? 0;
    if (v > bestVotes) {
      best = r;
      bestVotes = v;
    }
  }
  return best;
}
