// Порядок пунктов быстрых действий (per-device, localStorage) — generic-по-
// ключу принцип, как у quickActionPrefs.ts (скрытие). Хранится ПЛОСКИЙ список
// id поверхности: элементы из него — первыми (в его порядке), остальные —
// следом в порядке реестра (stable), новый пункт реестра появляется сам.

export const PLUS_ACTIONS_ORDER_KEY = 'quick_actions_order_plus';
export const TOOLS_ACTIONS_ORDER_KEY = 'quick_actions_order_tools';

// Разбор/сериализация — общий примитив stringArrayStorage (пустой порядок =
// «как в реестре»). Реэкспорт под прежними именами — API и тесты не меняются.
export {
  parseStringArray as parseActionOrder,
  serializeStringArray as serializeActionOrder,
  readStringArray as getActionOrder,
} from './stringArrayStorage';
import { readStringArray, writeStringArray } from './stringArrayStorage';
import { reorderedIds } from './dragReorder';

/** Элементы из order — первыми (в его порядке); остальные — следом, в порядке
 * items (stable). Группа «плюса»: order общий на поверхность, items — id
 * только этой группы; «Инструменты»: items — весь список. */
export function applyActionOrder<T extends { id: string }>(
  items: T[],
  order: string[],
): T[] {
  const index = new Map(order.map((id, i) => [id, i]));
  const known: T[] = [];
  const rest: T[] = [];
  for (const item of items) (index.has(item.id) ? known : rest).push(item);
  known.sort((a, b) => index.get(a.id)! - index.get(b.id)!);
  return [...known, ...rest];
}

/** rangeMin/rangeMax — абсолютные индексы сегмента группы в ПЛОСКОМ списке
 * (после сплющивания) — граница для useDragReorder. Список без групп — одна. */
export function withDragRange<T extends { id: string }>(
  groups: T[][],
): (T & { rangeMin: number; rangeMax: number })[] {
  const result: (T & { rangeMin: number; rangeMax: number })[] = [];
  let offset = 0;
  for (const g of groups) {
    const rangeMin = offset;
    const rangeMax = offset + g.length - 1;
    for (const item of g) result.push({ ...item, rangeMin, rangeMax });
    offset += g.length;
  }
  return result;
}

/** Пишет полный порядок поверхности: переставленный сегмент соседей встаёт
 * на место их первого вхождения, остальные id порядка не двигаются. */
function persistReorder(
  key: string,
  displayedSiblingIds: string[],
  reordered: string[],
): void {
  const siblings = new Set(displayedSiblingIds);
  const base: string[] = [];
  let insertAt = -1;
  for (const x of readStringArray(key)) {
    if (siblings.has(x)) {
      if (insertAt === -1) insertAt = base.length;
    } else {
      base.push(x);
    }
  }
  if (insertAt === -1) insertAt = base.length;
  writeStringArray(key, [
    ...base.slice(0, insertAt),
    ...reordered,
    ...base.slice(insertAt),
  ]);
}

/** Переставляет id на toIndex СРЕДИ displayedSiblingIds (полный список группы/
 * поверхности в эффективном порядке). toIndex вне диапазона — клэмпится;
 * no-op (id не найден или итог не изменился) — false, storage не трогается. */
export function applyReorderToIndex(
  key: string,
  displayedSiblingIds: string[],
  id: string,
  toIndex: number,
): boolean {
  const fromIndex = displayedSiblingIds.indexOf(id);
  if (fromIndex === -1) return false;
  const reordered = reorderedIds(displayedSiblingIds, fromIndex, toIndex);
  if (reordered === displayedSiblingIds) return false;
  persistReorder(key, displayedSiblingIds, reordered);
  return true;
}
