import type { ModeMapNode } from '../../api';

/** Диаметр круга потребностей по умолчанию (как круг схемы случая при ширине 1400). */
export const HUB_DIAMETER = 340;

interface Box {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data?: unknown;
  measured?: { width?: number; height?: number };
}

const diameterOf = (n: Box) => (n.data as ModeMapNode['data'] | undefined)?.diameter ?? HUB_DIAMETER;

/**
 * Ноды, чей центр лежит внутри круга потребностей `hub`. Размер ноды берётся из
 * измеренного (measured); у ещё не измеренной центр совпадает с левым верхним
 * углом. Сами круги в список не входят: круг внутри круга не тащится.
 */
export function nodesInsideHub<T extends Box>(hub: Box, nodes: T[]): T[] {
  const r = diameterOf(hub) / 2;
  const cx = hub.position.x + r;
  const cy = hub.position.y + r;
  return nodes.filter((n) => {
    if (n.id === hub.id || n.type === 'needs') return false;
    const x = n.position.x + (n.measured?.width ?? 0) / 2;
    const y = n.position.y + (n.measured?.height ?? 0) / 2;
    return Math.hypot(x - cx, y - cy) <= r;
  });
}
