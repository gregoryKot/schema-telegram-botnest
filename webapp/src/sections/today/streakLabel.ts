import { pluralRu } from '../../../../shared/src/utils/pluralRu';

/** «5 дней подряд» — с согласованным словом: 1 день, 2 дня, 5 дней. */
export function streakDaysLabel(streak: number): string {
  return `${streak} ${pluralRu(streak, 'день', 'дня', 'дней')} подряд`;
}
