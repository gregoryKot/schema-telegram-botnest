import { useCallback, useMemo, useState } from 'react';
import type { ModeMapKind, UserId } from '../../api';
import type { ClientConcept } from './clientConceptContext';
import { canvasConcept, missingOnCanvas, toClientConcept, type ConceptResponse, type GraphEdge, type GraphNode } from './conceptSync';
import type { ConceptSyncState } from './conceptSyncContext';
import { useClientConcept } from './useClientConcept';
import { useConceptBackSync } from './useConceptBackSync';

interface Params {
  clientId: UserId | null | undefined;
  kind?: ModeMapKind;
  nodes: readonly GraphNode[];
  edges: readonly GraphEdge[];
}

/**
 * Концептуализация клиента для открытой карты и связь с полями в обе стороны
 * (#963). Грузится один раз; ответ записи с холста и свежая концептуализация
 * из «Добавить на карту» заменяют загруженную — таблетки схем на узлах, палитра
 * и строка связи видят новое сразу, без второго запроса.
 */
export function useConceptSync({ clientId, kind, nodes, edges }: Params): ConceptSyncState {
  const loaded = useClientConcept(clientId);
  const [fresh, setFresh] = useState<{ id: UserId | null | undefined; value: ClientConcept } | null>(null);
  const concept = fresh && fresh.id === clientId ? fresh.value : loaded;
  const replaceConcept = useCallback((c: ConceptResponse) => setFresh({ id: clientId, value: toClientConcept(c) }), [clientId]);

  const active = clientId != null;
  const couple = kind === 'couple';
  const canvas = useMemo(() => canvasConcept(nodes, edges), [nodes, edges]);
  const { status, lastAdded, retry, markToMap } = useConceptBackSync({
    clientId, enabled: active && !couple, canvas, concept, onSaved: replaceConcept,
  });
  const missing = useMemo(() => (concept && concept !== 'failed' ? missingOnCanvas(concept, canvas) : null), [concept, canvas]);

  return useMemo(
    () => ({ active, couple, concept, missing, status, lastAdded, retry, markToMap, replaceConcept }),
    [active, couple, concept, missing, status, lastAdded, retry, markToMap, replaceConcept],
  );
}
