import type { FlowEdge, FlowNode } from '../modeMapFlow';
import type { ModeMapNode } from '../../api';
import { NEED_ORDER } from '../../../../shared/src/needs/needData';
import { HUB_DIAMETER, nodesInsideHub } from './hubGeometry';
import { WHEEL_CENTER_Y, WHEEL_NODE_W, needHandle } from './needWheel';

type Data = ModeMapNode['data'];
const needOf = (n: FlowNode): string | undefined => {
  const id = (n.data as Data).needId;
  return n.type === 'need' && id && (NEED_ORDER as readonly string[]).includes(id) ? id : undefined;
};

/**
 * Старый круг-рамка с таблетками → колесо (владелец 2026-11-10: «круг непонятно
 * для чего»). Таблетки потребностей внутри круга уходят, их линии переходят к
 * сектору своей потребности (ручка need:<id>), заметка таблетки — в текст
 * «Сейчас» этой потребности. Колесо встаёт центром туда, где был центр круга.
 * Прочие фигуры внутри круга остаются на месте. Не круг — null.
 */
export function convertToWheel(hubId: string, nodes: FlowNode[], edges: FlowEdge[]): { nodes: FlowNode[]; edges: FlowEdge[] } | null {
  const hub = nodes.find((n) => n.id === hubId && n.type === 'needs');
  if (!hub) return null;
  const pills = new Map(nodesInsideHub(hub, nodes).map((n) => [n.id, needOf(n)] as const).filter((e): e is [string, string] => !!e[1]));
  const notes = Object.fromEntries([...pills].map(([id, need]) => [need, (nodes.find((n) => n.id === id)?.data as Data).note])
    .filter(([, note]) => !!note));
  const d = (hub.data as Data).diameter ?? HUB_DIAMETER;
  const wheelHub: FlowNode = {
    ...hub,
    position: { x: hub.position.x + d / 2 - WHEEL_NODE_W / 2, y: hub.position.y + d / 2 - WHEEL_CENTER_Y },
    data: { ...hub.data, wheel: { period: 'now', ...(Object.keys(notes).length ? { notes: { now: notes } } : {}) } },
  };
  const rewire = (e: FlowEdge): FlowEdge => {
    const [s, t] = [pills.get(e.source), pills.get(e.target)];
    return {
      ...e,
      ...(s ? { source: hubId, sourceHandle: needHandle(s) } : {}),
      ...(t ? { target: hubId, targetHandle: needHandle(t) } : {}),
    };
  };
  const seen = new Set<string>();
  const newEdges = edges.map(rewire).filter((e) => {
    const key = `${e.source} ${e.sourceHandle ?? ''} ${e.target} ${e.targetHandle ?? ''}`;
    if (e.source === e.target || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { nodes: nodes.filter((n) => !pills.has(n.id)).map((n) => (n.id === hubId ? wheelHub : n)), edges: newEdges };
}
