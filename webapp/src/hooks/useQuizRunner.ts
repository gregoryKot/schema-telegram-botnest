import { useCallback, useMemo, useState } from 'react';
import {
  computeQuizResultId,
  type QuizDto,
  type QuizQuestionDto,
  type QuizResultDto,
} from '../../../shared/src/quiz/quizEngine';

export interface QuizRunner {
  /** номер текущего вопроса (0-based) = сколько уже отвечено */
  index: number;
  total: number;
  question: QuizQuestionDto | null;
  finished: boolean;
  result: QuizResultDto | null;
  answer: (optionIdx: number) => void;
  restart: () => void;
}

// Состояние прохождения мини-теста: копим индексы ответов, по последнему
// считаем результат (shared computeQuizResultId — паритет с бэкендом).
export function useQuizRunner(quiz: QuizDto | null): QuizRunner {
  const [picks, setPicks] = useState<number[]>([]);
  const total = quiz?.questions.length ?? 0;

  const answer = useCallback(
    (optionIdx: number) => {
      setPicks((prev) => {
        if (!quiz || prev.length >= quiz.questions.length) return prev;
        const option = quiz.questions[prev.length].options[optionIdx];
        if (!option) return prev;
        return [...prev, optionIdx];
      });
    },
    [quiz],
  );

  const restart = useCallback(() => setPicks([]), []);

  const finished = quiz !== null && picks.length === total && total > 0;
  const result = useMemo(() => {
    if (!quiz || !finished) return null;
    const id = computeQuizResultId(quiz, picks);
    return quiz.results.find((r) => r.id === id) ?? null;
  }, [quiz, finished, picks]);

  return {
    index: Math.min(picks.length, Math.max(total - 1, 0)),
    total,
    question: quiz && !finished ? quiz.questions[picks.length] : null,
    finished,
    result,
    answer,
    restart,
  };
}
