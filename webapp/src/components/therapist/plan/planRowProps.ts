import type { DragEvent } from 'react';
import { isQuietStatus } from './planModel';
import { PLAN_ITEM_DRAG_TYPE } from './path/phaseDrop';

/** Класс строки пункта: «сделано», тихие статусы, зачёркнутое «не нужно». */
export const rowClass = (status: string) =>
  `pl-item${status === 'done' ? ' is-done' : ''}${isQuietStatus(status) ? ' is-quiet' : ''}${status === 'dropped' ? ' is-dropped' : ''}`;

/** Перетаскивание строки на фазу — только когда фазы переданы (раскладка «По фазам») и строка не правится. */
export const rowDragProps = (id: number, enabled: boolean) => ({
  draggable: enabled,
  onDragStart: enabled ? (e: DragEvent) => { e.dataTransfer.setData(PLAN_ITEM_DRAG_TYPE, String(id)); e.dataTransfer.effectAllowed = 'move'; } : undefined,
});
