import { useMemo, type ReactNode } from 'react';
import type { ModeMapKind, UserId } from '../../api';
import { ModeMapConceptContext, SchemasOnCanvasContext } from './clientConceptContext';
import { schemasOnCanvasKey } from './nodeSchemaIds';
import { useClientConcept } from './useClientConcept';

interface Props {
  clientId: UserId | null | undefined;
  kind?: ModeMapKind;
  nodes?: readonly { type?: string; data?: Record<string, unknown> }[];
  children: ReactNode;
}

/**
 * Грузит концептуализацию клиента один раз и раздаёт её палитре и узлам карты.
 * На карте пары связей «режим ↔ схемы» нет: концептуализация — одного клиента,
 * а на карте режимы двух людей, и чей узел, системе неоткуда знать.
 */
export function ModeMapConceptProvider({ clientId, kind, nodes = [], children }: Props) {
  const loaded = useClientConcept(clientId);
  const concept = useMemo(
    () => (kind === 'couple' && loaded && loaded !== 'failed' ? { ...loaded, modeLinks: [] } : loaded),
    [kind, loaded],
  );
  return (
    <ModeMapConceptContext.Provider value={concept}>
      <SchemasOnCanvasContext.Provider value={schemasOnCanvasKey(nodes)}>{children}</SchemasOnCanvasContext.Provider>
    </ModeMapConceptContext.Provider>
  );
}
