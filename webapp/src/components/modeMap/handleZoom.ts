import { useEffect } from 'react';
import { useStore } from '@xyflow/react';

// Ручки связи на карте режимов живут в координатах холста и масштабируются вместе с ним: на
// фит-зуме ~0,5 зона 28px под пальцем (index.css, @media (hover: none)) на экране была ≈14.
// Размер зоны делится на текущий зум и уходит в CSS-переменную на корне .react-flow, чтобы на
// экране оставались те же 28. Границы: не больше 40 (низ узла RectNode — иначе ручки сверху и
// снизу накрыли бы узел целиком, и его стало бы не утащить) и не меньше 18 (зона ручки у мыши).
export const HANDLE_HIT_VAR = '--mm-handle-hit';
const SCREEN_PX = 28;
const MIN_PX = 18;
const MAX_PX = 40;

/** Зона ручки в px холста для текущего зума; битый зум — прежние 28. */
export function handleHitPx(zoom: number): number {
  if (!Number.isFinite(zoom) || zoom <= 0) return SCREEN_PX;
  return Math.min(MAX_PX, Math.max(MIN_PX, SCREEN_PX / zoom));
}

/** Держит переменную зоны ручки на корне холста в ногу с зумом. Звать внутри <ReactFlow>. */
export function useHandleZoomVar(): void {
  const zoom = useStore((s) => s.transform[2]);
  const root = useStore((s) => s.domNode);
  useEffect(() => {
    root?.style.setProperty(HANDLE_HIT_VAR, `${handleHitPx(zoom).toFixed(1)}px`);
  }, [root, zoom]);
}
