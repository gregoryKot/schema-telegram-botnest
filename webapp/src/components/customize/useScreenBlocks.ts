import { api } from '../../api';
import { useIsMobile } from '../useIsMobile';
import { notifyPrefsChanged } from '../../utils/uiPrefsSync';
import { useScreenBlocks as useSharedScreenBlocks } from '../../../../shared/src/screens/useScreenBlocks';
import {
  SCREEN_HIDDEN_KEYS,
  type HiddenCustomizableScreen,
  type ScreenBlockId,
} from '../../../../shared/src/screens/screenBlocks';
import type { LongPressProps } from '../../../../shared/src/hooks/useLongPress';

const deps = { api, onChanged: notifyPrefsChanged };

// Скрытие + порядок блоков «Профиля» и «Паттернов» на сайте: логика общая с
// мини-аппом (shared/screens/useScreenBlocks), ключи localStorage и события
// аналитики те же — выбор один на обе площадки. Здесь транспорт сайта
// (аналитика, точка синхронизации) и долгое нажатие на блок — только на
// телефоне: на десктопе жест гасил бы правый клик по карточкам, а кнопка
// «Настроить экран» есть в шапке.
export function useScreenBlocks(screen: HiddenCustomizableScreen) {
  const blocks = useSharedScreenBlocks(screen, SCREEN_HIDDEN_KEYS[screen], deps);
  const phone = useIsMobile();
  const { holdProps } = blocks;
  const hold = (id: ScreenBlockId): LongPressProps | undefined => (phone ? holdProps(id) : undefined);
  return { ...blocks, hold };
}

export type SiteScreenBlocks = ReturnType<typeof useScreenBlocks>;
