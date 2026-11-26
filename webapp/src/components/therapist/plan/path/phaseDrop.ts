import { useState, type DragEvent } from 'react';

export const PLAN_ITEM_DRAG_TYPE = 'application/plan-item';

/** Зона сброса строки пункта (карточка фазы, «Без фазы»): `over` — подсветка, `props` — на элемент зоны.
 *  Чужое перетаскивание (не строка плана) зону не трогает. */
export function usePhaseDrop(onDropItem: (itemId: number) => void) {
  const [over, setOver] = useState(false);
  const mine = (e: DragEvent) => Array.from(e.dataTransfer.types).includes(PLAN_ITEM_DRAG_TYPE);
  const props = {
    onDragOver: (e: DragEvent) => { if (!mine(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setOver(true); },
    onDragLeave: (e: DragEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false); },
    onDrop: (e: DragEvent) => {
      setOver(false);
      if (!mine(e)) return;
      const id = Number(e.dataTransfer.getData(PLAN_ITEM_DRAG_TYPE));
      if (!Number.isInteger(id)) return;
      e.preventDefault();
      onDropItem(id);
    },
  };
  return { over, props };
}
