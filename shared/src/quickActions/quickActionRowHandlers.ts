import type { QuickActionSurface } from './quickActionPrefs';

// Аналитика — инъекцией api площадки: shared не знает про api конкретного
// фронтенда. Именно объект с trackEvent, а не голая функция: имя события
// остаётся строковым литералом прямо в вызове метода api, и трипваер правила №8
// (src/security/analytics-sync.invariants.spec.ts) находит его грепом.
export type TrackEvent = (name: string, meta?: Record<string, unknown>) => void;
export interface TrackApi {
  trackEvent: TrackEvent;
}

// Обработчики строки листа «плюс»/«Инструменты»: аналитика инъекцией в
// CustomizeRow — общий компонент со ScreenCustomizeSheet (у того своя,
// screen_block_*, в useScreenBlocks/*). Лист остаётся тонким мэппером.
export function makeQuickActionRowHandlers(
  surface: QuickActionSurface,
  onToggle: (id: string, hidden: boolean) => void,
  onReorder: (id: string, toIndex: number) => 'up' | 'down' | false,
  api: TrackApi,
) {
  function handleToggle(id: string, wasHidden: boolean) {
    const nextHidden = !wasHidden;
    api.trackEvent('quick_action_toggle', {
      action: id,
      hidden: nextHidden,
      surface,
    });
    onToggle(id, nextHidden);
  }

  function handleReorder(id: string, toIndex: number) {
    const dir = onReorder(id, toIndex);
    if (dir) {
      api.trackEvent('quick_action_move', { action: id, surface, dir });
    }
  }

  return { handleToggle, handleReorder };
}
