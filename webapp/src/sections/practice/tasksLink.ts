import { pluralRu } from '../../../../shared/src/utils/pluralRu';

/** Подпись строки «Задания и цели»: сколько ждёт от терапевта и сколько своих целей. */
export function tasksLinkSub(therapistCount: number, goalsCount: number): string {
  const goals = (n: number, withWord: boolean) =>
    withWord ? `${n} ${pluralRu(n, 'активная цель', 'активные цели', 'активных целей')}` : `${n} ${pluralRu(n, 'цель', 'цели', 'целей')}`;
  if (therapistCount > 0 && goalsCount > 0) return `${therapistCount} от терапевта · ${goals(goalsCount, false)}`;
  if (therapistCount > 0) return `${therapistCount} от терапевта`;
  if (goalsCount > 0) return goals(goalsCount, true);
  return 'Свои цели и шаги к ним';
}
