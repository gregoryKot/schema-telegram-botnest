import { useState, useCallback } from 'react';
import { api } from '../api';
import {
  FocusPractice,
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
} from '../utils/todayFocus';
import { useLongPress } from './useLongPress';
import type { CustomizeHighlight } from '../components/TodayCustomizeSheet';

// Настройка экрана «Сегодня»: что показано, какая практика главная и как
// открыт лист настройки. Собрано в один хук, потому что раньше это были восемь
// useState + обработчики прямо в TodaySection (который и так самый большой
// файл мини-аппа, правило №10).
//
// Скрытие блоков — per-device в localStorage (как тема): состояние экрана
// личное для устройства, а не общее для аккаунта.
export function useTodayCustomization() {
  const [practice, setPracticeState] =
    useState<FocusPractice>(getFocusPractice);
  const [streakHidden, setStreakHiddenState] = useState(isStreakHidden);
  const [phraseHidden, setPhraseHiddenState] = useState(isPhraseHidden);
  const [secondaryHidden, setSecondaryHiddenState] =
    useState(isSecondaryHidden);
  const [therapistBannerHidden, setTherapistBannerHiddenState] = useState(
    isTherapistBannerHidden,
  );
  // null — лист закрыт; true — открыт шестерёнкой; строка — открыт долгим
  // нажатием на конкретный блок, его строку подсвечиваем.
  const [sheet, setSheet] = useState<CustomizeHighlight | true | null>(null);

  const openByGear = useCallback(() => {
    setSheet(true);
    api.trackEvent('today_customize_open', { via: 'gear' });
  }, []);

  const openByHold = useCallback((highlight: CustomizeHighlight) => {
    setSheet(highlight);
    api.trackEvent('today_customize_open', { via: 'longpress' });
  }, []);

  const toggle = useCallback(
    (
      block: 'streak' | 'phrase' | 'secondary' | 'therapist_banner',
      current: boolean,
      persist: (v: boolean) => void,
      setState: (v: boolean) => void,
    ) => {
      const next = !current;
      persist(next);
      setState(next);
      api.trackEvent('today_block_toggle', { block, hidden: next });
    },
    [],
  );

  return {
    practice,
    streakHidden,
    phraseHidden,
    secondaryHidden,
    therapistBannerHidden,
    sheet,
    highlight: sheet === true ? undefined : (sheet ?? undefined),
    openByGear,
    closeSheet: useCallback(() => setSheet(null), []),
    // Долгое нажатие на блок — быстрый путь к его настройке (см. useLongPress).
    holdFocus: useLongPress(() => openByHold('practice')),
    holdStreak: useLongPress(() => openByHold('streak')),
    holdPhrase: useLongPress(() => openByHold('phrase')),
    choosePractice: useCallback((p: FocusPractice) => {
      setFocusPractice(p);
      setPracticeState(p);
      api.trackEvent('today_focus_change', { practice: p });
    }, []),
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
