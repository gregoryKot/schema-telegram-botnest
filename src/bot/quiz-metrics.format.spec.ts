// Форматтер блока «Мини-тесты» в /stats: полные данные, пустая БД (без
// NaN/0%-мусора), подписи без словаря и сверка QUIZ_LABELS ↔ QUIZ_IDS.
import {
  formatQuizMetrics,
  QUIZ_LABELS,
  QuizMetrics,
} from './quiz-metrics.format';
import { QUIZ_IDS } from '../quiz/quiz-registry';

const FULL: QuizMetrics = {
  started30: 200,
  completed30: 150,
  completedLegacyBot30: 90,
  byQuiz30: [
    { quiz: 'drives', count: 80 },
    { quiz: 'critic', count: 45 },
    { quiz: 'battery', count: 25 },
  ],
};

const EMPTY: QuizMetrics = {
  started30: 0,
  completed30: 0,
  completedLegacyBot30: 0,
  byQuiz30: [],
};

describe('formatQuizMetrics', () => {
  it('полные данные: воронка, строка про старые события из бота, разбивка по тестам', () => {
    const text = formatQuizMetrics(FULL);
    expect(text).toContain('Мини-тесты без регистрации');
    expect(text).toContain('Начали: 200 · дошли до результата: 150 (75%)');
    expect(text).toContain('Из них раньше из бота: 90');
    expect(text).toContain('«Кто у руля» — 80');
    expect(text).toContain('«Батарейка» — 25');
    // Язык без терминов: никаких сырых ключей и англицизмов.
    expect(text).not.toMatch(/quiz|event|src|completed|started/i);
  });

  it('старых событий из бота нет — строки про бот нет совсем, без нового нуля', () => {
    const text = formatQuizMetrics({ ...FULL, completedLegacyBot30: 0 });
    expect(text).toContain('Начали: 200 · дошли до результата: 150 (75%)');
    expect(text).not.toMatch(/бот/i);
  });

  it('пустая БД: дружелюбная строка, без NaN и процентов', () => {
    const text = formatQuizMetrics(EMPTY);
    expect(text).toContain('Пока никто не пробовал');
    expect(text).not.toMatch(/NaN|%|undefined|0 · /);
  });

  it('деление на ноль не даёт мусора (дошли есть, начал 0 — миграция логов)', () => {
    const text = formatQuizMetrics({ ...FULL, started30: 0 });
    expect(text).not.toContain('NaN');
    expect(text).not.toContain('Infinity');
  });

  it('QUIZ_LABELS покрывает каждый тест из реестра (сверка реестров)', () => {
    for (const id of QUIZ_IDS) {
      expect(QUIZ_LABELS[id]).toBeDefined();
    }
  });

  it('неизвестный id теста не роняет отчёт — печатается как есть', () => {
    const text = formatQuizMetrics({
      ...FULL,
      byQuiz30: [{ quiz: 'legacy_quiz', count: 3 }],
    });
    expect(text).toContain('legacy_quiz — 3');
  });
});
