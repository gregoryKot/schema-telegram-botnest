import { useCallback, useState } from 'react';
import { api } from '../api';
import { readStringArray } from '../utils/stringArrayStorage';
import {
  applyActionOrder,
  applyReorderToIndex,
} from '../utils/quickActionOrder';
import {
  SCREEN_BLOCK_ORDER,
  type CustomizableScreen,
  type ScreenBlockId,
} from '../utils/screenBlocks';
import { notifyPrefsChanged } from '../utils/uiPrefsSync';

// Порядок блоков «Профиля»/«Паттернов» — тот же generic-по-ключу примитив,
// что у меню «плюс»/«Инструментов» (utils/quickActionOrder.ts). Вынесено из
// useScreenBlocks (файл-храповик у потолка) — список без групп, один сегмент.
const ORDER_KEYS: Record<CustomizableScreen, string> = {
  profile: 'screen_order_profile',
  patterns: 'screen_order_patterns',
  today: 'screen_order_today',
};

export function useScreenBlockOrder(screen: CustomizableScreen): {
  orderedIds: ScreenBlockId[];
  reorder: (id: string, toIndex: number, displayedIds?: string[]) => boolean;
} {
  const key = ORDER_KEYS[screen];
  const [order, setOrder] = useState<string[]>(() => readStringArray(key));

  const orderedIds = applyActionOrder(
    SCREEN_BLOCK_ORDER[screen].map((id) => ({ id })),
    order,
  ).map((x) => x.id);

  // Переставляет id СРЕДИ displayedIds (по умолчанию — все блоки экрана;
  // «Сегодня» передаёт видимое подмножество: строка баннера терапевта есть
  // не у всех). no-op — false без записи/события.
  const reorder = useCallback(
    (id: string, toIndex: number, displayedIds?: string[]): boolean => {
      const displayed = displayedIds ?? orderedIds;
      const fromIndex = displayed.indexOf(id);
      const moved = applyReorderToIndex(key, displayed, id, toIndex);
      if (moved) {
        setOrder(readStringArray(key));
        notifyPrefsChanged();
        api.trackEvent('screen_block_move', {
          screen,
          block: id,
          dir: toIndex < fromIndex ? 'up' : 'down',
        });
      }
      return moved;
    },
    [screen, key, orderedIds],
  );

  return { orderedIds, reorder };
}
