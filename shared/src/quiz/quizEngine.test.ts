// Подсчёт результата мини-теста (без похода на сервер). Ошибка тут = юзер
// видит чужой результат про себя, поэтому кейсы зеркалят
// src/quiz/quiz-logic.spec.ts (бэкенд) — те же PARITY_CASES, чтобы клиент и
// сервер не разъехались в подсчёте (см. комментарий-паритет в quizEngine.ts).
import { describe, expect, it } from 'vitest';
import { computeQuizResultId, type QuizDto } from './quizEngine';

// Маленький синтетический тест: 3 вопроса, голоса прозрачны (то же 'tiny'
// из quiz-logic.spec.ts).
const TINY: QuizDto = {
  id: 'tiny',
  emoji: '🧪',
  title: 'т',
  teaser: 'т',
  intro: 'т',
  questions: [
    {
      text: '1',
      options: [
        { label: 'a', resultId: 'a' },
        { label: 'b', resultId: 'b' },
      ],
    },
    {
      text: '2',
      options: [
        { label: 'a', resultId: 'a' },
        { label: 'b', resultId: 'b' },
      ],
    },
    {
      text: '3',
      options: [
        { label: 'a', resultId: 'a' },
        { label: 'b', resultId: 'b' },
      ],
    },
  ],
  results: [
    { id: 'a', emoji: 'a', title: 'a', text: 'a', hint: 'a' },
    { id: 'b', emoji: 'b', title: 'b', text: 'b', hint: 'b' },
  ],
};

// ── PARITY_CASES: не менять без зеркального изменения в quiz-logic.spec.ts ──
const PARITY_CASES: Array<{ picks: number[]; expected: string | null }> = [
  { picks: [0, 0, 0], expected: 'a' }, // единогласно
  { picks: [1, 1, 0], expected: 'b' }, // большинство
  { picks: [0, 1, 0], expected: 'a' },
  { picks: [0, 1], expected: null }, // неполный набор
  { picks: [0, 1, 5], expected: null }, // индекс вне вариантов
  { picks: [0, 1, -1], expected: null },
  { picks: [0, 1, 0.5], expected: null },
  { picks: [0, 1, 0, 0], expected: null }, // лишний ответ
];

describe('computeQuizResultId: паритет с бэкендом (quiz-logic.ts)', () => {
  it.each(PARITY_CASES)(
    'кейс паритета %#: $picks → $expected',
    ({ picks, expected }) => {
      expect(computeQuizResultId(TINY, picks)).toBe(expected);
    },
  );

  it('ничью забирает результат, стоящий раньше в quiz.results', () => {
    // 4 вопроса: 2×a и 2×b → 'a' (первый в results).
    const even: QuizDto = {
      ...TINY,
      questions: [...TINY.questions, TINY.questions[0]],
    };
    expect(computeQuizResultId(even, [0, 0, 1, 1])).toBe('a');
    // При обратном порядке results ничью заберёт 'b' — граница логики
    // "первый в results выигрывает", а не "первый по алфавиту id".
    const flipped: QuizDto = {
      ...even,
      results: [...even.results].reverse(),
    };
    expect(computeQuizResultId(flipped, [0, 0, 1, 1])).toBe('b');
  });

  it('пустой набор ответов для непустого теста — null, не крэш', () => {
    expect(computeQuizResultId(TINY, [])).toBeNull();
  });

  it('quiz без results (некорректные данные) — null для любых пиков', () => {
    const noResults: QuizDto = { ...TINY, results: [] };
    expect(computeQuizResultId(noResults, [0, 0, 0])).toBeNull();
  });
});
