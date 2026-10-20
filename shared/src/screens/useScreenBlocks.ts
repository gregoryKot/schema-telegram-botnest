import { useCallback, useState } from 'react';
import {
  readStringArray,
  writeStringArray,
} from '../utils/stringArrayStorage';
import { useLongPress, LongPressProps } from '../hooks/useLongPress';
import { useBlockOrder } from '../utils/useBlockOrder';
import {
  SCREEN_BLOCK_IDS,
  SCREEN_BLOCK_ORDER,
  SCREEN_ORDER_KEYS,
  type ScreenBlockId,
  type CustomizableScreen,
} from './screenBlocks';

type Track = (name: string, meta?: Record<string, unknown>) => void;

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
 * механика на оба фронтенда (правило №3). Площадка передаёт track
 * (api.trackEvent) и onChanged (синхронизация настроек между устройствами —
 * у мини-аппа notifyPrefsChanged, у сайта пока нет). Лист настройки у
 * площадок свой, состояние — это.
 */
export function useScreenBlocks(
  screen: CustomizableScreen,
  storageKey: string,
  { track, onChanged }: { track: Track; onChanged?: () => void },
) {
  const [hidden, setHidden] = useState<string[]>(() =>
    readStringArray(storageKey),
  );
  const order = useBlockOrder<ScreenBlockId>({
    screen,
    storageKey: SCREEN_ORDER_KEYS[screen],
    defaults: SCREEN_BLOCK_ORDER[screen],
    track,
    onChanged,
  });
  const [sheet, setSheet] = useState<ScreenBlockId | true | null>(null);

  const isHidden = useCallback((id: string) => hidden.includes(id), [hidden]);

  const openByGear = useCallback(() => {
    setSheet(true);
    track('screen_customize_open', { screen, via: 'gear' });
  }, [screen, track]);

  const openByHold = useCallback(
    (highlight: ScreenBlockId) => {
      setSheet(highlight);
      track('screen_customize_open', { screen, via: 'longpress' });
    },
    [screen, track],
  );

  const closeSheet = useCallback(() => setSheet(null), []);

  const toggle = useCallback(
    (id: string) => {
      setHidden((prev) => {
        const nextHidden = !prev.includes(id);
        const next = nextHidden ? [...prev, id] : prev.filter((x) => x !== id);
        writeStringArray(storageKey, next);
        onChanged?.();
        track('screen_block_toggle', {
          screen,
          block: id,
          hidden: nextHidden,
        });
        return next;
      });
    },
    [screen, storageKey, track, onChanged],
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
