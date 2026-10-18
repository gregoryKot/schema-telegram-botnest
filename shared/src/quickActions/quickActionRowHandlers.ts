import type { QuickActionSurface } from './quickActionPrefs';

// Отправка события аналитики (api.trackEvent фронтенда) — инъекцией: shared не
// знает про api конкретной площадки.
export type TrackEvent = (name: string, meta?: Record<string, unknown>) => void;

// Обработчики строки листа «плюс»/«Инструменты»: аналитика инъекцией в
// CustomizeRow — общий компонент со ScreenCustomizeSheet (у того своя,
// screen_block_*, в useScreenBlocks/*). Лист остаётся тонким мэппером.
export function makeQuickActionRowHandlers(
  surface: QuickActionSurface,
  onToggle: (id: string, hidden: boolean) => void,
  onReorder: (id: string, toIndex: number) => 'up' | 'down' | false,
  track: TrackEvent,
) {
  function handleToggle(id: string, wasHidden: boolean) {
    const nextHidden = !wasHidden;
    track('quick_action_toggle', {
      action: id,
      hidden: nextHidden,
      surface,
    });
    onToggle(id, nextHidden);
  }

  function handleReorder(id: string, toIndex: number) {
    const dir = onReorder(id, toIndex);
    if (dir) {
      track('quick_action_move', { action: id, surface, dir });
    }
  }

  return { handleToggle, handleReorder };
}
