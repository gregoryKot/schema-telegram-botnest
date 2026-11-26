// Проценты колеса потребностей на схеме случая (ConceptNeedLink, лист Farrell &
// Shaw): оценка 0–10 выбранного периода становится заливкой таблетки и числом
// «N%», подсказка таблетки перечисляет все оценённые периоды. Чистые функции:
// раскладку они не двигают — таблетка остаётся той же ширины и высоты.
import {
  NEED_PERIOD_LABEL,
  NEED_PERIODS,
  needPct,
  needRatings,
  type ConceptNeedLink,
  type NeedPeriod,
} from '../needLinks';
import type { DiagramNode } from './diagramTypes';

export type { NeedPeriod };
type Links = readonly ConceptNeedLink[] | undefined;

const ratedIn = (links: Links, p: NeedPeriod): boolean =>
  Object.keys(needRatings(links, p)).length > 0;

/** Есть ли в колесе хоть одна оценка: без неё нет ни процентов, ни переключателя. */
export const hasNeedRatings = (links: Links): boolean =>
  NEED_PERIODS.some((p) => ratedIn(links, p));

/** Период, с которого открывается схема: «Сейчас», а без его оценок — ближайший оценённый. */
export const defaultNeedPeriod = (links: Links): NeedPeriod =>
  [...NEED_PERIODS].reverse().find((p) => ratedIn(links, p)) ?? 'now';

/** «Привязанность: детство 20%, 11–17 лет 30%, сейчас 50%» — только оценённые периоды. */
export function needPctTitle(
  name: string,
  links: Links,
  needId: string,
): string | undefined {
  const parts = NEED_PERIODS.flatMap((p) => {
    const v = needRatings(links, p)[needId];
    return v === undefined
      ? []
      : [`${NEED_PERIOD_LABEL[p].toLowerCase()} ${needPct(v)}`];
  });
  return parts.length ? `${name}: ${parts.join(', ')}` : undefined;
}

/**
 * Таблетки потребностей с процентом выбранного периода (`pct`, 0–100) и
 * подсказкой (`title`). Потребность без оценки за период — без `pct`, без
 * единой оценки — как была; без оценок в колесе фигуры возвращаются как есть.
 */
export function rateNeedNodes(
  nodes: DiagramNode[],
  links: Links,
  period: NeedPeriod = 'now',
): DiagramNode[] {
  if (!hasNeedRatings(links)) return nodes;
  const ratings = needRatings(links, period);
  return nodes.map((n) => {
    if (n.kind !== 'need' || !n.needId) return n;
    const title = needPctTitle(n.label, links, n.needId);
    if (!title) return n;
    const v = ratings[n.needId];
    return { ...n, title, ...(v === undefined ? {} : { pct: v * 10 }) };
  });
}
