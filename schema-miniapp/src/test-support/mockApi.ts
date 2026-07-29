// Общий мок среза api для тестов быстрых практик «Здесь и сейчас»
// (BreathingCard, QuickPracticeSheet) — оба мокали один и тот же набор
// методов идентичным блоком, jscpd-храповик не пропустил повтор (правило
// №11: повторяешь блок — выноси в модуль, а не копируй).
//
// vi.mock() всё равно обязан остаться литералом в самом тестовом файле
// (так работает хойстинг vitest), но его тело можно свести к вызову общей
// фабрики. Имя mockPracticeApi начинается с `mock` — vitest хойстит такие
// импорты вместе с vi.mock(), поэтому ссылка на него внутри фабрики валидна.
import { vi } from 'vitest';

/** Мокнутые методы api, которые нужны тестам быстрых практик. */
export function mockPracticeApi() {
  return {
    trackEvent: vi.fn(),
    getPracticeSessions: vi.fn(),
    recordPracticeSession: vi.fn(),
  };
}

/** Общий вид каста замоканного api к записи моков для тестов. */
export function asMockApi(
  api: unknown,
): Record<string, ReturnType<typeof vi.fn>> {
  return api as Record<string, ReturnType<typeof vi.fn>>;
}
