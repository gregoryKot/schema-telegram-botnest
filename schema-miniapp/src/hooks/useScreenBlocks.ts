import { api } from '../api';
import { useScreenBlocks as useSharedScreenBlocks } from '../../../shared/src/screens/useScreenBlocks';
import type { CustomizableScreen } from '../../../shared/src/screens/screenBlocks';
import { notifyPrefsChanged } from '../utils/uiPrefsSync';

const deps = {
  track: (name: string, meta?: Record<string, unknown>) =>
    api.trackEvent(name, meta),
  onChanged: notifyPrefsChanged,
};

// Скрытие + порядок блоков экрана — логика общая с сайтом
// (shared/screens/useScreenBlocks); здесь только транспорт мини-аппа:
// аналитика и синхронизация настроек между устройствами.
export function useScreenBlocks(
  screen: CustomizableScreen,
  storageKey: string,
) {
  return useSharedScreenBlocks(screen, storageKey, deps);
}
