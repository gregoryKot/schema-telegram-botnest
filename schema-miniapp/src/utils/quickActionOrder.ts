// Порядок пунктов быстрых действий (per-device, localStorage) — тот же
// generic-по-ключу принцип, что у quickActionPrefs.ts (скрытие рядом, не тут:
// правило «одна механика — один компонент», не дублируем parse/get).
// Модель: хранится ПЛОСКИЙ список id поверхности. Элементы, чьи id в списке,
// идут по нему первыми; остальные — следом, в порядке реестра (stable) — так
// новый пункт реестра появляется сам, без миграции (симметрично скрытию).

export type MoveDir = 'up' | 'down';

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

/** Элементы, чьи id есть в order, — в начале (в его порядке); остальные —
 * следом, в исходном порядке items (stable). Работает и для группы «плюса»
 * (order — общий на поверхность, items — только id этой группы), и для
 * полного списка «Инструментов». */
export function applyActionOrder<T extends { id: string }>(
  items: T[],
  order: string[],
): T[] {
  const index = new Map(order.map((id, i) => [id, i]));
  const known: T[] = [];
  const rest: T[] = [];
  for (const item of items) {
    (index.has(item.id) ? known : rest).push(item);
  }
  known.sort((a, b) => index.get(a.id)! - index.get(b.id)!);
  return [...known, ...rest];
}

/** Первый/последний элемент списка — для дизейбла стрелок на краях. Список —
 * уже отображаемые соседи (вся группа «плюса», весь список «Инструментов»). */
export function withMoveFlags<T extends { id: string }>(
  items: T[],
): (T & { disabledUp: boolean; disabledDown: boolean })[] {
  return items.map((item, i) => ({
    ...item,
    disabledUp: i === 0,
    disabledDown: i === items.length - 1,
  }));
}

/** Переставляет id местами с соседом СРЕДИ displayedSiblingIds (полный
 * список группы/поверхности в текущем эффективном порядке) и сохраняет
 * получившийся полный порядок поверхности. На краю (соседа нет) — false,
 * localStorage не трогается. */
export function moveAction(
  key: string,
  displayedSiblingIds: string[],
  id: string,
  dir: MoveDir,
): boolean {
  const idx = displayedSiblingIds.indexOf(id);
  if (idx === -1) return false;
  const swapWith = dir === 'up' ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= displayedSiblingIds.length) return false;

  const swapped = [...displayedSiblingIds];
  [swapped[idx], swapped[swapWith]] = [swapped[swapWith], swapped[idx]];

  // Текущий порядок мог не знать часть/все siblings (новые id реестра) —
  // вставляем свопнутый блок туда, где siblings стояли впервые (или в конец,
  // если это первая перестановка вообще); остальные id порядка не двигаются.
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
    ...swapped,
    ...base.slice(insertAt),
  ]);
  return true;
}
