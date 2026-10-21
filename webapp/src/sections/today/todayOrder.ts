import type { CSSProperties } from 'react';
import type { TodayBlockId } from '../../../../shared/src/today/todayBlocks';

// Порядок блоков «Сегодня» на телефоне. Блоки лежат в разных контейнерах
// (.ct-main / .ct-aside / .ct-top — на телефоне display: contents), поэтому
// порядок задаёт CSS `order` от переменных --ct-o-<id>, а не разметка:
// client-today.css берёт переменную блока и сдвигает на неё его части
// (фокус + встреча + практики, «Что ещё можно сегодня» + потребности + ...).
// Закреплённые сверху (разбор, «С чего начать») стоят на order 1–2, значок —
// на 90, поэтому блоки band начинаются с 10.
const BASE = 10;
const STEP = 10;

/** Значение `order` каждого блока band по порядку из настройки. */
export function todayBlockOrders(
  orderedIds: TodayBlockId[],
): Record<TodayBlockId, number> {
  const orders = {} as Record<TodayBlockId, number>;
  orderedIds.forEach((id, i) => {
    orders[id] = BASE + i * STEP;
  });
  return orders;
}

/** Inline-переменные для сетки экрана: --ct-o-streak: 20 и т. д. */
export function todayOrderStyle(orderedIds: TodayBlockId[]): CSSProperties {
  const style: Record<string, number> = {};
  for (const [id, order] of Object.entries(todayBlockOrders(orderedIds))) {
    style[`--ct-o-${id}`] = order;
  }
  return style as CSSProperties;
}
