import { useCallback, useState } from 'react';
import { api } from '../../api';
import {
  getFocusPractice, setFocusPractice, isStreakHidden, setStreakHidden, type FocusPractice,
} from '../../../../shared/src/today/todayFocus';

// Настройки «Сегодня», которые правит сам экран. Ключи localStorage и события
// аналитики — те же, что у мини-аппа (shared/today/todayFocus,
// hooks/useTodayCustomization), чтобы настройка была одна на оба фронтенда.

/** Главная практика дня. */
export function useFocusPractice() {
  const [practice, setPracticeState] = useState<FocusPractice>(getFocusPractice);
  const pickPractice = useCallback((p: FocusPractice) => {
    setFocusPractice(p);
    setPracticeState(p);
    api.trackEvent('today_focus_change', { practice: p });
  }, []);
  return { practice, pickPractice };
}

/** Скрытие карточки серии (для кого стрик – источник тревоги, а не мотивации). */
export function useStreakHidden() {
  const [streakHidden, setState] = useState(isStreakHidden);
  const toggleStreak = useCallback(() => {
    const next = !isStreakHidden();
    setStreakHidden(next);
    setState(next);
    api.trackEvent('today_block_toggle', { block: 'streak', hidden: next });
  }, []);
  return { streakHidden, toggleStreak };
}
