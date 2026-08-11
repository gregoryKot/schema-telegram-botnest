import { useState } from 'react';
import {
  applyActionOrder,
  applyReorderToIndex,
  getActionOrder,
} from './quickActionOrder';
import { notifyPrefsChanged } from './uiPrefsSync';

// Общий хук для обеих поверхностей («Инструменты» — один список как
// единственную группу). Диапазон драга считает вызывающий (withDragRange),
// тут — только сохранение перестановки СРЕДИ СОСЕДЕЙ СВОЕЙ ГРУППЫ.
type ReorderDir = 'up' | 'down' | false;

export function useQuickActionOrder<T extends { id: string }>(
  key: string,
  groups: T[][],
): { ordered: T[][]; onReorder: (id: string, toIndex: number) => ReorderDir } {
  const [order, setOrder] = useState<string[]>(() => getActionOrder(key));
  const ordered = groups.map((g) => applyActionOrder(g, order));

  function onReorder(id: string, toIndex: number): ReorderDir {
    const group = ordered.find((g) => g.some((a) => a.id === id));
    if (!group) return false;
    const siblingIds = group.map((a) => a.id);
    const fromIndex = siblingIds.indexOf(id);
    const moved = applyReorderToIndex(key, siblingIds, id, toIndex);
    if (!moved) return false;
    setOrder(getActionOrder(key));
    notifyPrefsChanged();
    return toIndex < fromIndex ? 'up' : 'down';
  }

  return { ordered, onReorder };
}
