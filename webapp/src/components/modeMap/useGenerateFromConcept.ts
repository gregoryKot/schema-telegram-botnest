import { useCallback, useState, type MutableRefObject } from 'react';
import { api, reportClientError, type ModeMapEdge, type ModeMapNode, type UserId } from '../../api';
import { buildConceptGraph } from '../../../../shared/src/therapy/conceptGraph/conceptGraphModel';
import { conceptGraphSource } from '../../../../shared/src/therapy/conceptGraph/conceptGraphSource';
import { pickForm, useAddressForm } from '../../utils/addressForm';
import { fromFlowEdges, fromFlowNodes, type FlowEdge, type FlowNode } from '../modeMapFlow';
import { conceptToModeMap } from './conceptToModeMap';

interface Params {
  clientId: UserId;
  nodesRef: MutableRefObject<FlowNode[]>;
  edgesRef: MutableRefObject<FlowEdge[]>;
  /** Тот же путь, что у шаблонов: история, сохранение, подгон масштаба. */
  insert: (nodes: ModeMapNode[], edges: ModeMapEdge[]) => void;
}

/**
 * Пункт меню «Из концептуализации клиента»: схема случая клиента ложится на
 * открытую карту — режимы, схемы с убеждениями, опыт, круг потребностей и линии
 * ✗/✓. Конвертер тот же, что у кнопки «Открыть на холсте»; уже стоящее на карте
 * не дублируется. Отказ не молчит: он уходит в телеметрию и виден терапевту (`failed`).
 */
export function useGenerateFromConcept({ clientId, nodesRef, edgesRef, insert }: Params) {
  const form = useAddressForm();
  const [failed, setFailed] = useState(false);

  const generate = useCallback(async () => {
    setFailed(false);
    try {
      const concept = await api.getConceptualization(clientId);
      const graph = buildConceptGraph(conceptGraphSource(concept ?? {}), (ty, vy) => pickForm(form, ty, vy));
      const { nodes, edges } = conceptToModeMap(
        graph, fromFlowNodes(nodesRef.current), Date.now(), fromFlowEdges(edgesRef.current),
      );
      if (nodes.length > 0 || edges.length > 0) insert(nodes, edges);
    } catch (e) {
      setFailed(true);
      reportClientError({
        message: `mode map from concept failed: ${e instanceof Error ? e.message : 'unknown'}`,
        section: 'therapist.modeMap',
      });
    }
  }, [clientId, form, nodesRef, edgesRef, insert]);

  return { generate, failed };
}
