import { api } from '../../api';
import type { QuickActionSurface } from '../../utils/quickActionPrefs';

// Обработчики строки листа «плюс»/«Инструменты»: аналитика инъекцией в
// CustomizeRow — общий компонент со ScreenCustomizeSheet (у того своя,
// screen_block_*, в useScreenBlocks/*). Лист остаётся тонким мэппером.
export function makeQuickActionRowHandlers(
  surface: QuickActionSurface,
  onToggle: (id: string, hidden: boolean) => void,
  onReorder: (id: string, toIndex: number) => 'up' | 'down' | false,
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
