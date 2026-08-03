// @vitest-environment jsdom
// Контрактный тест api-мока (docs/TEST_TRUST_PLAN.md, п.3): компонентные
// тесты подменяют весь модуль '../api' через vi.mock() и сами перечисляют,
// какие методы там есть — TypeScript эту фабрику не проверяет (vi.mock —
// произвольный объект), поэтому переименование/удаление метода в РЕАЛЬНОМ
// api.ts не ловится тестом, который его мокает: мок остаётся старым,
// тест зелёный, а в проде компонент вызывает несуществующий api.xxx.
//
// Список ниже ведётся ВРУЧНУЮ — это все имена, которые встречаются в
// vi.mock('...api...', () => ({ api: { <имя>: vi.fn() ... } })) по всем
// *.test.tsx этого пакета (сверено грепом на момент написания). Если
// добавляешь новый мок с новым методом — добавь имя и сюда.
import { describe, it, expect } from 'vitest';
import { api } from './api';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- сверка ключей рантайм-объекта, не бизнес-логика
const realApi = api as unknown as Record<string, any>;

const MOCKED_API_METHODS = [
  // exercises/LetterEx.test.tsx
  'getLetters', 'createLetter',
  // exercises/FlashcardEx.test.tsx
  'saveSchemaNote', 'saveModeNote',
  // exercises/BeliefCheckEx.test.tsx
  'getBeliefChecks', 'createBeliefCheck',
  // SchemaFlashcard.test.tsx
  'getFlashcards', 'createFlashcard',
  // NoteSheet.test.tsx
  'getNote', 'saveNote',
  // CrisisCard.test.tsx, многие другие — fire-and-forget аналитика
  'trackEvent',
  // SettingsSheet.test.tsx
  'getSettings', 'getPair', 'getTherapyRelation', 'getTherapistRequest', 'getExport', 'deleteAllUserData',
  // TrackerOverlay.test.tsx
  'ratings', 'saveRating',
  // BookingPicker.test.tsx
  'getSlots', 'getBookingOptions', 'bookSlot', 'cancelBooking',
  // utils/addressForm.test.tsx — уже покрыт getSettings выше
  // pages/DonatePage.test.tsx
  'donate',
  // pages/SubscribePage.test.tsx
  'getSubscriptionOptions', 'getSubscriptionByToken', 'subscribe', 'cancelSubscription',
] as const;

describe('api.contract — мокаемые методы существуют в реальном api.ts', () => {
  it.each(MOCKED_API_METHODS)('api.%s — существует и является функцией', (name) => {
    expect(typeof realApi[name]).toBe('function');
  });

  it('список в MOCKED_API_METHODS не содержит дублей (иначе он врёт о полноте)', () => {
    expect(new Set(MOCKED_API_METHODS).size).toBe(MOCKED_API_METHODS.length);
  });
});
