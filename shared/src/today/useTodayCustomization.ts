import { useCallback, useState } from 'react';
import {
  type FocusPractice,
  getFocusPractice,
  setFocusPractice,
  isStreakHidden,
  setStreakHidden,
  isSecondaryHidden,
  setSecondaryHidden,
  isTherapistBannerHidden,
  setTherapistBannerHidden,
  isPhraseHidden,
  setPhraseHidden,
} from './todayFocus';
import {
  TODAY_BLOCK_ORDER,
  TODAY_ORDER_KEY,
  type CustomizeHighlight,
  type TodayBlockId,
} from './todayBlocks';
import { useBlockOrder } from '../utils/useBlockOrder';

import type { TrackApi } from '../quickActions/quickActionRowHandlers';
type HideableBlock = 'streak' | 'phrase' | 'secondary' | 'therapist_banner';

/**
 * Настройка экрана «Сегодня» — что показано, какая практика главная, в каком
 * порядке блоки. Одна логика на оба фронтенда (правило №3): ключи localStorage
 * и события аналитики те же, поэтому выбор один. Хранение per-device;
 * onChanged — точка синхронизации между устройствами (у мини-аппа
 * notifyPrefsChanged; у сайта подключается отдельным PR).
 *
 * Площадка передаёт api (с trackEvent: имя события — литерал в вызове, трипваер правила №8) и onChanged; долгое нажатие на
 * блок (useLongPress мини-аппа) строит поверх openByHold.
 */
export function useTodayCustomization({
  api,
  onChanged,
}: {
  api: TrackApi;
  onChanged?: () => void;
}) {
  const [practice, setPracticeState] =
    useState<FocusPractice>(getFocusPractice);
  const [streakHidden, setStreakHiddenState] = useState(isStreakHidden);
  const [phraseHidden, setPhraseHiddenState] = useState(isPhraseHidden);
  const [secondaryHidden, setSecondaryHiddenState] =
    useState(isSecondaryHidden);
  const [therapistBannerHidden, setTherapistBannerHiddenState] = useState(
    isTherapistBannerHidden,
  );
  // null — лист закрыт; true — открыт кнопкой; строка — открыт долгим
  // нажатием на конкретный блок, его строку подсвечиваем.
  const [sheet, setSheet] = useState<CustomizeHighlight | true | null>(null);
  const order = useBlockOrder<TodayBlockId>({
    screen: 'today',
    storageKey: TODAY_ORDER_KEY,
    defaults: TODAY_BLOCK_ORDER,
    api,
    onChanged,
  });

  const openByGear = useCallback(() => {
    setSheet(true);
    api.trackEvent('today_customize_open', { via: 'gear' });
  }, [api]);

  const openByHold = useCallback(
    (highlight: CustomizeHighlight) => {
      setSheet(highlight);
      api.trackEvent('today_customize_open', { via: 'longpress' });
    },
    [api],
  );

  const toggle = useCallback(
    (
      block: HideableBlock,
      current: boolean,
      persist: (v: boolean) => void,
      setState: (v: boolean) => void,
    ) => {
      const next = !current;
      persist(next);
      setState(next);
      onChanged?.();
      api.trackEvent('today_block_toggle', { block, hidden: next });
    },
    [api, onChanged],
  );

  return {
    practice,
    streakHidden,
    phraseHidden,
    secondaryHidden,
    therapistBannerHidden,
    orderedIds: order.orderedIds,
    reorder: order.reorder,
    sheet,
    highlight: sheet === true ? undefined : (sheet ?? undefined),
    openByGear,
    openByHold,
    closeSheet: useCallback(() => setSheet(null), []),
    choosePractice: useCallback(
      (p: FocusPractice) => {
        setFocusPractice(p);
        setPracticeState(p);
        onChanged?.();
        api.trackEvent('today_focus_change', { practice: p });
      },
      [api, onChanged],
    ),
    toggleStreak: useCallback(
      () =>
        toggle('streak', streakHidden, setStreakHidden, setStreakHiddenState),
      [toggle, streakHidden],
    ),
    togglePhrase: useCallback(
      () =>
        toggle('phrase', phraseHidden, setPhraseHidden, setPhraseHiddenState),
      [toggle, phraseHidden],
    ),
    toggleSecondary: useCallback(
      () =>
        toggle(
          'secondary',
          secondaryHidden,
          setSecondaryHidden,
          setSecondaryHiddenState,
        ),
      [toggle, secondaryHidden],
    ),
    toggleTherapistBanner: useCallback(
      () =>
        toggle(
          'therapist_banner',
          therapistBannerHidden,
          setTherapistBannerHidden,
          setTherapistBannerHiddenState,
        ),
      [toggle, therapistBannerHidden],
    ),
  };
}
