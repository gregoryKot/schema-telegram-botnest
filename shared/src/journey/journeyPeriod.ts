// Период ленты «Моего пути»: за всё время / последние 7 / последние 30 дней —
// чипы фильтра, заголовки карточек и сам фильтр. Вынесено из journeyMeta
// (правило №10: реестр типов подошёл к потолку размера файла).
import { dateStringMs } from '../utils/calendarDate';
import type { JourneyItem } from './journeyMeta';

// Период ленты: за всё время / последние 7 / последние 30 дней.
export type JourneyPeriod = 'all' | 'week' | 'month';

export const JOURNEY_PERIODS: Array<{ id: JourneyPeriod; label: string }> = [
  { id: 'all', label: 'Всё время' },
  { id: 'week', label: 'Неделя' },
  { id: 'month', label: 'Месяц' },
];

/** Заголовок карточки/шеринга по выбранному периоду. */
export const JOURNEY_PERIOD_TITLE: Record<JourneyPeriod, string> = {
  all: 'Мой путь',
  week: 'Моя неделя',
  month: 'Мой месяц',
};

/** Подпись под заголовком карточки: за какой срок собрана сводка. */
export const JOURNEY_PERIOD_SUBTITLE: Record<JourneyPeriod, string> = {
  all: 'за всё время',
  week: 'за последние 7 дней',
  month: 'за последние 30 дней',
};

/**
 * Фильтр по периоду (скользящие 7/30 дней). Чистая, не мутирует вход.
 *
 * Дата записи разбирается через dateStringMs: календарный день `YYYY-MM-DD`
 * берётся полночью UTC. До инцидента 2026-09-17 тут стояло `${at}T00:00:00`
 * без `Z` — полночь зоны машины, и на UTC+3 запись «ровно на границе» окна
 * выпадала из выборки, а под TZ=UTC тот же тест зеленел.
 */
export function filterJourneyByPeriod(
  items: readonly JourneyItem[],
  period: JourneyPeriod,
  now = new Date(),
): JourneyItem[] {
  if (period === 'all') return [...items];
  const days = period === 'week' ? 7 : 30;
  const from = now.getTime() - days * 86_400_000;
  return items.filter((i) => {
    const t = dateStringMs(i.at);
    return !Number.isNaN(t) && t >= from;
  });
}
