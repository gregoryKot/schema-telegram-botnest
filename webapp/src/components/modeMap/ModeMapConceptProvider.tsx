import { useMemo, type ReactNode } from 'react';
import type { ModeMapKind, UserId } from '../../api';
import { ModeMapConceptContext, SchemasOnCanvasContext } from './clientConceptContext';
import type { GraphEdge, GraphNode } from './conceptSync';
import { ConceptSyncContext } from './conceptSyncContext';
import { schemasOnCanvasKey } from './nodeSchemaIds';
import { useConceptSync } from './useConceptSync';
import { WheelProvider } from './WheelProvider'; // колесо потребностей клиента: данные и запись

interface Props { clientId: UserId | null | undefined; kind?: ModeMapKind; nodes?: readonly GraphNode[]; edges?: readonly GraphEdge[]; children: ReactNode }
const NONE: never[] = [];

/**
 * Грузит концептуализацию клиента один раз и раздаёт её палитре, узлам карты и строке связи с полями (useConceptSync).
 * На карте пары связей «режим ↔ схемы» нет: концептуализация — одного клиента,
 * а на карте режимы двух людей, и чей узел, системе неоткуда знать.
 */
export function ModeMapConceptProvider({ clientId, kind, nodes = NONE, edges = NONE, children }: Props) {
  const sync = useConceptSync({ clientId, kind, nodes, edges });
  const loaded = sync.concept;
  const concept = useMemo(() => (kind === 'couple' && loaded && loaded !== 'failed' ? { ...loaded, modeLinks: [] } : loaded), [kind, loaded]);
  return (
    <ModeMapConceptContext.Provider value={concept}><ConceptSyncContext.Provider value={sync}>
      <SchemasOnCanvasContext.Provider value={schemasOnCanvasKey(nodes)}><WheelProvider clientId={clientId}>{children}</WheelProvider></SchemasOnCanvasContext.Provider>
    </ConceptSyncContext.Provider></ModeMapConceptContext.Provider>
  );
}
