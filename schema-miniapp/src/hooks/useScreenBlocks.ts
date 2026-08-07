import { useCallback, useState } from 'react';
import { api } from '../api';
import { readStringArray, writeStringArray } from '../utils/stringArrayStorage';
import { useLongPress, LongPressProps } from './useLongPress';
import {
  SCREEN_BLOCK_IDS,
  type ScreenBlockId,
  type CustomizableScreen,
} from '../utils/screenBlocks';

// Generic-скрытие блоков экрана: сейчас «Профиль», следующим шагом
// «Паттерны» — тот же хук, другой screen/storageKey (правило «одна механика —
// один компонент»). Форма состояния — как в useTodayCustomization (sheet: id |
// true | null, openByGear/openByHold), только по реестру SCREEN_BLOCK_IDS
// вместо отдельного useState на каждый блок.
export function useScreenBlocks(
  screen: CustomizableScreen,
  storageKey: string,
) {
  const [hidden, setHidden] = useState<string[]>(() =>
    readStringArray(storageKey),
  );
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

  // useLongPress вызывается по разу на КАЖДЫЙ id реестра — SCREEN_BLOCK_IDS
  // фиксирован и не меняется между рендерами, поэтому число и порядок вызовов
  // хука стабильны (holdProps ниже отдаёт только то, что реально нужно экрану).
  const holdMap = {} as Record<ScreenBlockId, LongPressProps>;
  for (const id of SCREEN_BLOCK_IDS) {
    holdMap[id] = useLongPress(() => openByHold(id));
  }

  return {
    hidden,
    isHidden,
    toggle,
    sheet,
    highlight: sheet === true ? undefined : (sheet ?? undefined),
    openByGear,
    openByHold,
    closeSheet,
    holdProps: (id: ScreenBlockId) => holdMap[id],
  };
}
