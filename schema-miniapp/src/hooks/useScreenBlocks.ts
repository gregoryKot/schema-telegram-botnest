import { useCallback, useState } from 'react';
import { api } from '../api';
import { readStringArray, writeStringArray } from '../utils/stringArrayStorage';
import { useLongPress, LongPressProps } from './useLongPress';
import { useScreenBlockOrder } from './useScreenBlockOrder';
import {
  SCREEN_BLOCK_IDS,
  type ScreenBlockId,
  type CustomizableScreen,
} from '../utils/screenBlocks';
import { notifyPrefsChanged } from '../utils/uiPrefsSync';

// Generic-скрытие+порядок блоков экрана; порядок — хук useScreenBlockOrder (правило «одна механика — компонент», файл-храповик у потолка).
export function useScreenBlocks(
  screen: CustomizableScreen,
  storageKey: string,
) {
  const [hidden, setHidden] = useState<string[]>(() =>
    readStringArray(storageKey),
  );
  const order = useScreenBlockOrder(screen);
  const [sheet, setSheet] = useState<ScreenBlockId | true | null>(null);

  const isHidden = useCallback((id: string) => hidden.includes(id), [hidden]);

  const openByGear = useCallback(() => {
    setSheet(true);
    api.trackEvent('screen_customize_open', { screen, via: 'gear' });
  }, [screen]);

  const openByHold = useCallback(
    (highlight: ScreenBlockId) => {
      setSheet(highlight);
      api.trackEvent('screen_customize_open', { screen, via: 'longpress' });
    },
    [screen],
  );

  const closeSheet = useCallback(() => setSheet(null), []);

  const toggle = useCallback(
    (id: string) => {
      setHidden((prev) => {
        const nextHidden = !prev.includes(id);
        const next = nextHidden ? [...prev, id] : prev.filter((x) => x !== id);
        writeStringArray(storageKey, next);
        notifyPrefsChanged();
        api.trackEvent('screen_block_toggle', {
          screen,
          block: id,
          hidden: nextHidden,
        });
        return next;
      });
    },
    [screen, storageKey],
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
