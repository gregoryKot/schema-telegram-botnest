// Чистая математика перетаскивания списка (drag&drop) — без React/DOM, зовёт
// её хук useDragReorder.ts на каждый pointermove/keydown. Полные тесты —
// dragReorder.test.ts.

function clamp(value: number, lo: number, hi: number): number {
  if (hi < lo) return lo;
  return Math.min(hi, Math.max(lo, value));
}

/** Индекс, куда «упадёт» перетаскиваемая строка при вертикальном смещении
 * offsetY (px) от startIndex, с учётом реальных высот строк rowHeights
 * (порядок — как в исходном списке). Строка перескакивает соседа, когда
 * палец прошёл половину высоты перетаскиваемой строки + половину высоты
 * соседа (типовой порог reorder-списков — центр перетаскиваемой строки
 * поравнялся с центром соседней). Диапазон [min, max] — границы сегмента
 * (например, своей группы), дальше которых строку двигать нельзя. */
export function targetIndexFromOffset(
  startIndex: number,
  offsetY: number,
  rowHeights: number[],
  min: number,
  max: number,
): number {
  const lo = clamp(min, 0, rowHeights.length - 1);
  const hi = clamp(max, 0, rowHeights.length - 1);
  const start = clamp(startIndex, lo, hi);
  if (rowHeights.length === 0 || offsetY === 0) return start;

  const draggedHeight = rowHeights[start] ?? 0;
  const dir = offsetY > 0 ? 1 : -1;
  let index = start;
  let remaining = Math.abs(offsetY);

  while (index + dir >= lo && index + dir <= hi) {
    const neighborHeight = rowHeights[index + dir] ?? 0;
    const threshold = draggedHeight / 2 + neighborHeight / 2;
    if (threshold <= 0 || remaining < threshold) break;
    remaining -= threshold;
    index += dir;
  }
  return index;
}

/** Переставляет id из fromIndex в toIndex, остальные сдвигаются на освободившееся
 * место (обычный splice-move). Индексы вне [0, ids.length-1] клэмпятся.
 * fromIndex===toIndex (в т.ч. после клэмпа) — возвращает ТОТ ЖЕ массив
 * (reference equality — удобный признак «ничего не изменилось» для вызывающих). */
export function reorderedIds(
  ids: string[],
  fromIndex: number,
  toIndex: number,
): string[] {
  const hi = ids.length - 1;
  const from = clamp(fromIndex, 0, hi);
  const to = clamp(toIndex, 0, hi);
  if (ids.length === 0 || from === to) return ids;
  const copy = [...ids];
  const [moved] = copy.splice(from, 1);
  copy.splice(to, 0, moved);
  return copy;
}
