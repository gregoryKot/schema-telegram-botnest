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

type Track = (name: string, meta?: Record<string, unknown>) => void;
type HideableBlock = 'streak' | 'phrase' | 'secondary' | 'therapist_banner';

/**
 * Настройка экрана «Сегодня» — что показано, какая практика главная, в каком
 * порядке блоки. Одна логика на оба фронтенда (правило №3): ключи localStorage
 * и события аналитики те же, поэтому выбор один. Хранение per-device;
 * onChanged — точка синхронизации между устройствами (у мини-аппа
 * notifyPrefsChanged; у сайта подключается отдельным PR).
 *
 * Площадка передаёт track (api.trackEvent) и onChanged; долгое нажатие на
 * блок (useLongPress мини-аппа) строит поверх openByHold.
 */
export function useTodayCustomization({
  track,
  onChanged,
}: {
  track: Track;
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
    track,
    onChanged,
  });

  const openByGear = useCallback(() => {
    setSheet(true);
    track('today_customize_open', { via: 'gear' });
  }, [track]);

  const openByHold = useCallback(
    (highlight: CustomizeHighlight) => {
      setSheet(highlight);
      track('today_customize_open', { via: 'longpress' });
    },
    [track],
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
      track('today_block_toggle', { block, hidden: next });
    },
    [track, onChanged],
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
        track('today_focus_change', { practice: p });
      },
      [track, onChanged],
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
