import { api } from '../../api';
import type { QuickActionSurface } from '../../utils/quickActionPrefs';

// Обработчики строки листа «плюс»/«Инструменты»: аналитика
// (quick_action_toggle/move) инъекцией в CustomizeRow — общий компонент со
// ScreenCustomizeSheet (у того своя аналитика, screen_block_*, в
// useScreenBlocks/useScreenBlockOrder). Вынесено из QuickActionCustomizeSheet,
// чтобы лист остался тонким мэппером (правило «одна механика — компонент»).
export function makeQuickActionRowHandlers(
  surface: QuickActionSurface,
  onToggle: (id: string, hidden: boolean) => void,
  onMove: (id: string, dir: 'up' | 'down') => boolean,
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

  function handleMove(id: string, dir: 'up' | 'down') {
    if (onMove(id, dir)) {
      api.trackEvent('quick_action_move', { action: id, surface, dir });
    }
  }

  return { handleToggle, handleMove };
}
