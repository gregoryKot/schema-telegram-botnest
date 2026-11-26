import type { Connection } from '@xyflow/react';
import type { EdgeType, ModeMapEdge } from '../../api';
import { toFlowEdges, type FlowEdge } from '../modeMapFlow';
import { EDGE_TYPE_MARK, EDGE_TYPE_STYLE } from './edgeTypes';
import { needOfHandle, wheelEdgeType } from './needWheel';

/**
 * Новая линия, проведённая на холсте. Обычная — «активирует», нейтральным цветом.
 * К сектору колеса потребностей — сразу та линия, которую рисует схема случая:
 * от схемы «✗» (красный пунктир), от здорового режима «✓» (зелёная). Вид — через
 * toFlowEdges, как у линий, загруженных с сервера.
 */
export function connectEdge(conn: Connection, nodes: readonly { id: string; type?: string }[], stamp = Date.now()): FlowEdge {
  const typeOf = (id: string) => nodes.find((n) => n.id === id)?.type;
  const other = needOfHandle(conn.targetHandle) ? conn.source : needOfHandle(conn.sourceHandle) ? conn.target : null;
  const edgeType: EdgeType = (other && wheelEdgeType(typeOf(other))) || 'activates';
  const edge: ModeMapEdge = {
    id: `e_${conn.source}_${conn.target}_${stamp}`,
    source: conn.source, target: conn.target, sourceHandle: conn.sourceHandle, targetHandle: conn.targetHandle,
    data: { edgeType, ...EDGE_TYPE_STYLE[edgeType] },
    ...(EDGE_TYPE_MARK[edgeType] ? { label: EDGE_TYPE_MARK[edgeType] } : {}),
  };
  return toFlowEdges([edge])[0];
}
