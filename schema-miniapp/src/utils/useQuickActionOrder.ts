import { useState } from 'react';
import {
  applyActionOrder,
  getActionOrder,
  moveAction,
  type MoveDir,
} from './quickActionOrder';
import { notifyPrefsChanged } from './uiPrefsSync';

// Общий крючок для обеих поверхностей (правило «одна механика — один
// компонент»): «Инструменты» — один список как единственную группу. Стрелка
// двигает пункт только СРЕДИ СОСЕДЕЙ ЕГО ГРУППЫ — group и есть эта граница.
export function useQuickActionOrder<T extends { id: string }>(
  key: string,
  groups: T[][],
): { ordered: T[][]; onMove: (id: string, dir: MoveDir) => boolean } {
  const [order, setOrder] = useState<string[]>(() => getActionOrder(key));
  const ordered = groups.map((g) => applyActionOrder(g, order));
  function onMove(id: string, dir: MoveDir): boolean {
    const group = ordered.find((g) => g.some((a) => a.id === id));
    if (!group) return false;
    const moved = moveAction(
      key,
      group.map((a) => a.id),
      id,
      dir,
    );
    if (moved) setOrder(getActionOrder(key));
    if (moved) notifyPrefsChanged();
    return moved;
  }

  return { ordered, onMove };
}
