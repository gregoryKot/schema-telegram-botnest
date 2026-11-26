// Все линии диаграммы из данных терапевта и стороны фигур, с которых они
// идут. В широком виде стороны фиксированы колонками (режимы слева, схемы,
// круг, здоровые справа), в узком — одна колонка, и линия выходит вбок.
import type { ConceptGraphModel } from '../conceptGraphTypes';
import { needSide, type NeedCtx } from './diagramNeedRoutes';
import type { Side } from './diagramPorts';
import type { DiagramEdgeKind, DiagramNode } from './diagramTypes';

export interface Link {
  kind: DiagramEdgeKind;
  from: DiagramNode;
  to: DiagramNode;
  sides: [Side, Side];
}

export const center = (n: DiagramNode) => ({
  x: n.x + n.w / 2,
  y: n.y + n.h / 2,
});

/** Все линии из данных; стороны фигур зависят от вида (колонки или одна колонка с дорожками). */
export function collect(
  graph: ConceptGraphModel,
  byId: Map<string, DiagramNode>,
  ctx: NeedCtx,
): Link[] {
  const { wide } = ctx;
  const out: Link[] = [];
  const { critic, child, coping, healthy } = graph.lanes;
  let linkN = 0;
  for (const card of [...critic, ...child, ...coping]) {
    const mode = byId.get(`mode:${card.modeId}`);
    for (const s of card.schemas) {
      const schema = byId.get(`schema:${s.id}`);
      if (!mode || !schema) continue;
      const side: Side = linkN++ % 2 === 0 ? 'left' : 'right';
      const sides: [Side, Side] = wide ? ['right', 'left'] : [side, side];
      out.push({ kind: 'link', from: mode, to: schema, sides });
    }
  }
  for (const card of graph.schemas) {
    const schema = byId.get(`schema:${card.id}`);
    const origin = byId.get(`origin:${card.id}`);
    if (schema && origin) {
      out.push({
        kind: 'origin',
        from: origin,
        to: schema,
        sides: ['bottom', 'top'],
      });
    }
    for (const id of card.needIds) {
      const pill = byId.get(`need:${id}`);
      if (!schema || !pill) continue;
      const to = needSide('blocks', ctx, pill);
      out.push({
        kind: 'blocks',
        from: schema,
        to: pill,
        sides: [wide ? 'right' : to, to],
      });
    }
  }
  for (const card of healthy) {
    const mode = byId.get(`mode:${card.modeId}`);
    for (const n of card.needs) {
      const pill = byId.get(`need:${n.id}`);
      if (!mode || !pill) continue;
      const to = needSide('meets', ctx, pill);
      out.push({
        kind: 'meets',
        from: mode,
        to: pill,
        sides: [wide ? 'left' : to, to],
      });
    }
  }
  return out;
}
