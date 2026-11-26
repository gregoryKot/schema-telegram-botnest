import { DRAG_TYPE } from '../modeMapData';
import type { Draft } from './modeDraft';

export const startNodeDrag = (e: React.DragEvent, node: Draft) => {
  e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(node));
  e.dataTransfer.effectAllowed = 'copy';
};
