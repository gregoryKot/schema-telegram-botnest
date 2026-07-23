// Скоринг мини-тестов. Блок PARITY_CASES зеркален кейсам в
// webapp/src/hooks/useQuizRunner.test.ts (бэкенд и сайт считают одинаково —
// та же схема паритета, что у ysq.ts ↔ useYsqTest.ts).
import { computeQuizResult, isValidPicks } from './quiz-logic';
import { buildQuizzes } from './quiz-registry';
import type { Quiz } from './quiz.types';

// Маленький синтетический тест: 3 вопроса, голоса прозрачны.
const TINY: Quiz = {
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

// ── PARITY_CASES: не менять без зеркального изменения в useQuizRunner.test.ts ──
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

describe('quiz-logic: подсчёт результата', () => {
  it.each(PARITY_CASES)(
    'кейс паритета %#: $picks → $expected',
    ({ picks, expected }) => {
      expect(computeQuizResult(TINY, picks)?.id ?? null).toBe(expected);
    },
  );

  it('ничью забирает результат, стоящий раньше в quiz.results', () => {
    // 4 вопроса: 2×a и 2×b → 'a' (первый в results).
    const even: Quiz = {
      ...TINY,
      questions: [...TINY.questions, TINY.questions[0]],
    };
    expect(computeQuizResult(even, [0, 0, 1, 1])?.id).toBe('a');
    // При обратном порядке results ничью заберёт 'b'.
    const flipped: Quiz = { ...even, results: [...even.results].reverse() };
    expect(computeQuizResult(flipped, [0, 0, 1, 1])?.id).toBe('b');
  });

  it('isValidPicks: частичный набор валиден, переполнение и мусор — нет', () => {
    expect(isValidPicks(TINY, [])).toBe(true);
    expect(isValidPicks(TINY, [1, 0])).toBe(true);
    expect(isValidPicks(TINY, [1, 0, 1])).toBe(true);
    expect(isValidPicks(TINY, [1, 0, 1, 0])).toBe(false);
    expect(isValidPicks(TINY, [2])).toBe(false);
    expect(isValidPicks(TINY, [NaN])).toBe(false);
  });

  it('на реальном контенте: единогласные ответы дают ожидаемый режим', () => {
    const drives = buildQuizzes('ty').find((q) => q.id === 'drives')!;
    // Во всех вопросах выбираем вариант, голосующий за 'adult'.
    const picks = drives.questions.map((q) =>
      q.options.findIndex((o) => o.resultId === 'adult'),
    );
    expect(computeQuizResult(drives, picks)?.id).toBe('adult');
  });

  it('на реальном контенте: результат считается для любых полных наборов', () => {
    for (const quiz of buildQuizzes('vy')) {
      const first = computeQuizResult(
        quiz,
        quiz.questions.map(() => 0),
      );
      const last = computeQuizResult(
        quiz,
        quiz.questions.map((q) => q.options.length - 1),
      );
      expect(first).not.toBeNull();
      expect(last).not.toBeNull();
    }
  });
});
