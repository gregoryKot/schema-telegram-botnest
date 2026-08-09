import { useCallback, useState } from 'react';
import { api } from '../api';
import { readStringArray } from '../utils/stringArrayStorage';
import {
  applyActionOrder,
  moveAction,
  type MoveDir,
} from '../utils/quickActionOrder';
import {
  SCREEN_BLOCK_ORDER,
  type CustomizableScreen,
  type ScreenBlockId,
} from '../utils/screenBlocks';
import { notifyPrefsChanged } from '../utils/uiPrefsSync';

// Порядок скрываемых блоков «Профиля»/«Паттернов» — тот же generic-по-ключу
// примитив (applyActionOrder/moveAction), что у порядка меню «плюс»/
// «Инструментов» (utils/quickActionOrder.ts, см. useQuickActionOrder), с id
// блока экрана вместо id быстрого действия. Вынесено из useScreenBlocks
// (файл-храповик у потолка, правило №10 CLAUDE.md) — там скрытие, здесь
// порядок, вместе не влезли бы.
const ORDER_KEYS: Record<CustomizableScreen, string> = {
  profile: 'screen_order_profile',
  patterns: 'screen_order_patterns',
};

export function useScreenBlockOrder(screen: CustomizableScreen): {
  orderedIds: ScreenBlockId[];
  move: (id: string, dir: MoveDir) => boolean;
} {
  const key = ORDER_KEYS[screen];
  const [order, setOrder] = useState<string[]>(() => readStringArray(key));

  const orderedIds = applyActionOrder(
    SCREEN_BLOCK_ORDER[screen].map((id) => ({ id })),
    order,
  ).map((x) => x.id);

  // Свопает id СРЕДИ ВСЕХ блоков экрана (orderedIds — уже полный список
  // «Профиля»/«Паттернов» в эффективном порядке). Край — false без записи и
  // без события (симметрично moveAction/useQuickActionOrder.onMove).
  const move = useCallback(
    (id: string, dir: MoveDir): boolean => {
      const moved = moveAction(key, orderedIds, id, dir);
      if (moved) {
        setOrder(readStringArray(key));
        notifyPrefsChanged();
        api.trackEvent('screen_block_move', { screen, block: id, dir });
      }
      return moved;
    },
    [screen, key, orderedIds],
  );

  return { orderedIds, move };
}
