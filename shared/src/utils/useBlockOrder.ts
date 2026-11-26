import { useState } from 'react';
import { readStringArray } from './stringArrayStorage';
import {
  applyActionOrder,
  applyReorderToIndex,
} from '../quickActions/quickActionOrder';

import type { TrackApi } from '../quickActions/quickActionRowHandlers';

/**
 * Порядок блоков экрана (per-device localStorage, синхронизируется через
 * onChanged → uiPrefsSync). Один механизм на «Сегодня», «Профиль»,
 * «Паттерны» и на оба фронтенда (правило №3): список без групп, один сегмент;
 * сохранённый порядок — первыми, новые блоки реестра встают следом сами.
 *
 * reorder переставляет id СРЕДИ displayedIds (по умолчанию — все блоки
 * экрана; «Сегодня» передаёт видимое подмножество). no-op — false, без
 * записи и без события screen_block_move.
 */
export function useBlockOrder<T extends string>({
  screen,
  storageKey,
  defaults,
  api,
  onChanged,
}: {
  screen: string;
  storageKey: string;
  defaults: readonly T[];
  api: TrackApi;
  onChanged?: () => void;
}): {
  orderedIds: T[];
  reorder: (id: string, toIndex: number, displayedIds?: string[]) => boolean;
} {
  const [order, setOrder] = useState<string[]>(() =>
    readStringArray(storageKey),
  );

  const orderedIds = applyActionOrder(
    defaults.map((id) => ({ id })),
    order,
  ).map((x) => x.id);

  const reorder = (
    id: string,
    toIndex: number,
    displayedIds?: string[],
  ): boolean => {
    const displayed = displayedIds ?? orderedIds;
    const fromIndex = displayed.indexOf(id);
    const moved = applyReorderToIndex(storageKey, displayed, id, toIndex);
    if (moved) {
      setOrder(readStringArray(storageKey));
      onChanged?.();
      api.trackEvent('screen_block_move', {
        screen,
        block: id,
        dir: toIndex < fromIndex ? 'up' : 'down',
      });
    }
    return moved;
  };

  return { orderedIds, reorder };
}
