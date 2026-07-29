// Общий мок среза api для тестов быстрых практик «Здесь и сейчас»
// (BreathingCard, QuickPracticeSheet) — оба мокали один и тот же набор
// методов идентичным блоком, jscpd-храповик не пропустил повтор (правило
// №11: повторяешь блок — выноси в модуль, а не копируй).
//
// vi.mock() хойстится ВЫШЕ импортов, поэтому синхронно сослаться на
// импортированную фабрику нельзя (TDZ: «Cannot access __vi_import__ before
// initialization»). Рабочий способ — асинхронная фабрика с динамическим
// импортом, она выполняется уже после инициализации модулей:
//   vi.mock('../api', async () => {
//     const { mockPracticeApi } = await import('../test-support/mockApi');
//     return { api: mockPracticeApi() };
//   });
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
