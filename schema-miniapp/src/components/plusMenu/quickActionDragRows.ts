import { useDragReorder } from '../../hooks/useDragReorder';

// Обвязка useDragReorder для QuickActionCustomizeSheet: хук работает с
// ПЛОСКИМ списком действий поверхности (высоты/индексы считаются по нему), а
// onReorder листа — group-local (utils/quickActionOrder.withDragRange задаёт
// каждому действию его сегмент rangeMin..rangeMax). Здесь — единственное
// место конвертации глобальный→локальный индекс (правило «одна механика»).
interface RangedAction {
  id: string;
  label: string;
  rangeMin: number;
  rangeMax: number;
}

export function useQuickActionDragRows<T extends RangedAction>(
  actions: T[],
  onReorder: (id: string, toIndex: number) => void,
) {
  const drag = useDragReorder({
    ids: actions.map((a) => a.id),
    onReorder: (id, toIndexGlobal) => {
      const a = actions.find((x) => x.id === id);
      if (a) onReorder(id, toIndexGlobal - a.rangeMin);
    },
  });

  function rowProps(a: T) {
    return {
      dragHandleProps: drag.handleProps(a.id, a.label, {
        min: a.rangeMin,
        max: a.rangeMax,
      }),
      rowRef: drag.registerRow(a.id),
      drag: { offsetY: drag.offsetFor(a.id), lifted: drag.drag?.id === a.id },
    };
  }

  return { rowProps };
}
