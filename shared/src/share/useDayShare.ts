// Хук карточки дня для DayShareButton обоих фронтендов: собирает пропсы
// ShareCardSheet (draw/тексты/kind) из оценок. Во фронтах остаётся только
// вёрстка кнопки и свой ShareCardSheet (правило №3).
import { useMemo } from 'react';
import type { Need } from '../types';
import { makeDayShare } from './cards/dayCard';
import { fmtDate, todayStr } from '../utils/format';

export function useDayShare(
  needs: Need[],
  ratings: Record<string, number>,
  date: string | undefined,
  link: string,
) {
  return useMemo(
    () => makeDayShare(needs, ratings, fmtDate(date ?? todayStr()), link),
    [needs, ratings, date, link],
  );
}
