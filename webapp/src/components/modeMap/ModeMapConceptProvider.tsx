import type { ReactNode } from 'react';
import type { UserId } from '../../api';
import { ModeMapConceptContext } from './clientConceptContext';
import { useClientConcept } from './useClientConcept';

/** Грузит концептуализацию клиента один раз и раздаёт её палитре и узлам карты. */
export function ModeMapConceptProvider({ clientId, children }: { clientId: UserId | null | undefined; children: ReactNode }) {
  return <ModeMapConceptContext.Provider value={useClientConcept(clientId)}>{children}</ModeMapConceptContext.Provider>;
}
