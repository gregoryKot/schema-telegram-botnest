// @vitest-environment jsdom
// Раннер мини-тестов + ПАРИТЕТ скоринга с бэкендом. Блок PARITY_CASES
// зеркален src/quiz/quiz-logic.spec.ts (схема ysq.ts ↔ useYsqTest.ts):
// меняешь там — меняй и здесь.
import { renderHook, act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useQuizRunner } from './useQuizRunner';
import {
  computeQuizResultId,
  type QuizDto,
} from '../../../shared/src/quiz/quizEngine';

const q = (n: string) => ({
  text: n,
  options: [
    { label: 'a', resultId: 'a' },
    { label: 'b', resultId: 'b' },
  ],
});

const TINY: QuizDto = {
  id: 'tiny',
  emoji: '🧪',
  title: 'т',
  teaser: 'т',
  intro: 'т',
  questions: [q('1'), q('2'), q('3')],
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

describe('computeQuizResultId — паритет с бэкендом', () => {
  it.each(PARITY_CASES)('кейс %#: $picks → $expected', ({ picks, expected }) => {
    expect(computeQuizResultId(TINY, picks)).toBe(expected);
  });

  it('ничью забирает результат, стоящий раньше в quiz.results', () => {
    const even: QuizDto = { ...TINY, questions: [...TINY.questions, q('4')] };
    expect(computeQuizResultId(even, [0, 0, 1, 1])).toBe('a');
    const flipped: QuizDto = { ...even, results: [...even.results].reverse() };
    expect(computeQuizResultId(flipped, [0, 0, 1, 1])).toBe('b');
  });
});

describe('useQuizRunner', () => {
  it('идёт по вопросам, в конце отдаёт результат', () => {
    const { result } = renderHook(() => useQuizRunner(TINY));
    expect(result.current.total).toBe(3);
    expect(result.current.question?.text).toBe('1');

    act(() => result.current.answer(1));
    expect(result.current.index).toBe(1);
    expect(result.current.question?.text).toBe('2');

    act(() => result.current.answer(1));
    act(() => result.current.answer(0));
    expect(result.current.finished).toBe(true);
    expect(result.current.question).toBeNull();
    expect(result.current.result?.id).toBe('b');
  });

  it('невалидный индекс варианта игнорируется, лишние ответы не копятся', () => {
    const { result } = renderHook(() => useQuizRunner(TINY));
    act(() => result.current.answer(7));
    expect(result.current.index).toBe(0);
    act(() => result.current.answer(0));
    act(() => result.current.answer(0));
    act(() => result.current.answer(0));
    act(() => result.current.answer(0)); // уже finished — не должно упасть
    expect(result.current.finished).toBe(true);
    expect(result.current.result?.id).toBe('a');
  });

  it('restart сбрасывает прохождение', () => {
    const { result } = renderHook(() => useQuizRunner(TINY));
    act(() => result.current.answer(0));
    act(() => result.current.answer(0));
    act(() => result.current.answer(0));
    expect(result.current.finished).toBe(true);
    act(() => result.current.restart());
    expect(result.current.finished).toBe(false);
    expect(result.current.index).toBe(0);
    expect(result.current.result).toBeNull();
  });

  it('quiz = null (ещё грузится): пустое состояние без падений', () => {
    const { result } = renderHook(() => useQuizRunner(null));
    expect(result.current.total).toBe(0);
    expect(result.current.finished).toBe(false);
    act(() => result.current.answer(0));
    expect(result.current.result).toBeNull();
  });
});
