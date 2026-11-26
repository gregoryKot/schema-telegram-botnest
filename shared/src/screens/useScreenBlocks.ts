import { useCallback, useState } from 'react';
import { readStringArray, writeStringArray } from '../utils/stringArrayStorage';
import { useLongPress, type LongPressProps } from '../hooks/useLongPress';
import { useBlockOrder } from '../utils/useBlockOrder';
import {
  SCREEN_BLOCK_IDS,
  SCREEN_BLOCK_ORDER,
  SCREEN_ORDER_KEYS,
  type ScreenBlockId,
  type CustomizableScreen,
} from './screenBlocks';

import type { TrackApi } from '../quickActions/quickActionRowHandlers';

/** Что лист «Настроить экран» берёт у useScreenBlocks (оба фронтенда). */
export interface ScreenBlocksApi {
  hidden: string[];
  orderedIds: ScreenBlockId[];
  highlight?: ScreenBlockId;
  toggle: (id: ScreenBlockId) => void;
  reorder: (id: string, toIndex: number) => boolean;
  closeSheet: () => void;
}

/**
 * Generic-скрытие + порядок блоков экрана («Профиль», «Паттерны»), одна
 * механика на оба фронтенда (правило №3). Площадка передаёт api
 * (с trackEvent) и onChanged (синхронизация настроек между устройствами —
 * у мини-аппа notifyPrefsChanged, у сайта пока нет). Лист настройки у
 * площадок свой, состояние — это.
 */
export function useScreenBlocks(
  screen: CustomizableScreen,
  storageKey: string,
  { api, onChanged }: { api: TrackApi; onChanged?: () => void },
) {
  const [hidden, setHidden] = useState<string[]>(() =>
    readStringArray(storageKey),
  );
  const order = useBlockOrder<ScreenBlockId>({
    screen,
    storageKey: SCREEN_ORDER_KEYS[screen],
    defaults: SCREEN_BLOCK_ORDER[screen],
    api,
    onChanged,
  });
  const [sheet, setSheet] = useState<ScreenBlockId | true | null>(null);

  const isHidden = useCallback((id: string) => hidden.includes(id), [hidden]);

  const openByGear = useCallback(() => {
    setSheet(true);
    api.trackEvent('screen_customize_open', { screen, via: 'gear' });
  }, [screen, api]);

  const openByHold = useCallback(
    (highlight: ScreenBlockId) => {
      setSheet(highlight);
      api.trackEvent('screen_customize_open', { screen, via: 'longpress' });
    },
    [screen, api],
  );

  const closeSheet = useCallback(() => setSheet(null), []);

  const toggle = useCallback(
    (id: string) => {
      setHidden((prev) => {
        const nextHidden = !prev.includes(id);
        const next = nextHidden ? [...prev, id] : prev.filter((x) => x !== id);
        writeStringArray(storageKey, next);
        onChanged?.();
        api.trackEvent('screen_block_toggle', {
          screen,
          block: id,
          hidden: nextHidden,
        });
        return next;
      });
    },
    [screen, storageKey, api, onChanged],
  );

  // useLongPress — по разу на КАЖДЫЙ id реестра (фиксирован, стабильный порядок вызовов хука); holdProps ниже отдаёт только то, что нужно экрану.
  const holdMap = {} as Record<ScreenBlockId, LongPressProps>;
  for (const id of SCREEN_BLOCK_IDS) {
    holdMap[id] = useLongPress(() => openByHold(id));
  }

  return {
    hidden,
    isHidden,
    toggle,
    ...order,
    sheet,
    highlight: sheet === true ? undefined : (sheet ?? undefined),
    openByGear,
    openByHold,
    closeSheet,
    holdProps: (id: ScreenBlockId) => holdMap[id],
  };
}
