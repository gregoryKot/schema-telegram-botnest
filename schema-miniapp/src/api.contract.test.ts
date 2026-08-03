// @vitest-environment jsdom
// Контрактный тест api-мока (docs/TEST_TRUST_PLAN.md, п.3) — парный тест
// webapp/src/api.contract.test.ts (правило №3). Компонентные тесты подменяют
// весь модуль '../api' через vi.mock() и сами перечисляют методы —
// TypeScript эту фабрику не проверяет (vi.mock — произвольный объект),
// поэтому переименование/удаление метода в РЕАЛЬНОМ api.ts не ловится
// тестом, который его мокает: мок остаётся старым, тест зелёный, а в
// проде компонент вызывает несуществующий api.xxx.
//
// Список ниже ведётся ВРУЧНУЮ — это все имена, которые встречаются в
// vi.mock('...api...', () => ({ api: { <имя>: vi.fn() ... } })) (включая
// общую фабрику test-support/mockApi.ts) по всем *.test.tsx этого пакета
// (сверено грепом на момент написания). Если добавляешь новый мок с новым
// методом — добавь имя и сюда.
import { describe, it, expect } from 'vitest';
import { api } from './api';

const realApi = api as unknown as Record<string, any>;

const MOCKED_API_METHODS = [
  // почти все компонентные тесты — fire-and-forget аналитика
  'trackEvent',
  // WeeklyQuestion.test.tsx, NoteSheet.test.tsx
  'saveNote',
  'getNote',
  // LetterToSelf.test.tsx
  'getLetters',
  'createLetter',
  // test-support/mockApi.ts (BreathingCard.test.tsx, QuickPracticeSheet.test.tsx)
  'getPracticeSessions',
  'recordPracticeSession',
  // YSQTestSheet.test.tsx
  'getYsqHistory',
  'getYsqResult',
  'getYsqProgress',
  'saveYsqProgress',
  'saveYsqResult',
  'deleteYsqProgress',
  'deleteYsqResult',
  // SchemaIntroSheet.test.tsx
  'getSchemaNotes',
  'saveSchemaNote',
  // TrackerOverlay.test.tsx
  'ratings',
  'saveRating',
  // BeliefCheck.test.tsx
  'getBeliefChecks',
  'createBeliefCheck',
  // ModeIntroSheet.test.tsx
  'getModeNotes',
  'saveModeNote',
  // SafePlace.test.tsx
  'getSafePlace',
  'saveSafePlace',
] as const;

describe('api.contract — мокаемые методы существуют в реальном api.ts', () => {
  it.each(MOCKED_API_METHODS)(
    'api.%s — существует и является функцией',
    (name) => {
      expect(typeof realApi[name]).toBe('function');
    },
  );

  it('список в MOCKED_API_METHODS не содержит дублей (иначе он врёт о полноте)', () => {
    expect(new Set(MOCKED_API_METHODS).size).toBe(MOCKED_API_METHODS.length);
  });
});
