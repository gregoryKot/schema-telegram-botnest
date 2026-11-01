import { useEffect, useState } from 'react';
import { api, type UserId } from '../../api';
import { normalizeModeLinks } from '../../../../shared/src/therapy/conceptGraph/modeLinks';
import type { ClientConceptState } from './clientConceptContext';

const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/** Один запрос концептуализации на открытую карту; без clientId (личная карта клиента) не грузит. */
export function useClientConcept(clientId: UserId | null | undefined): ClientConceptState {
  const [state, setState] = useState<{ id: UserId | null | undefined; value: ClientConceptState }>({ id: clientId, value: null });
  useEffect(() => {
    if (clientId == null) return;
    let alive = true;
    api.getConceptualization(clientId)
      .then(c => { if (alive) setState({ id: clientId, value: { schemaIds: strs(c?.schemaIds), modeIds: strs(c?.modeIds), modeLinks: normalizeModeLinks(c?.modeLinks) } }); })
      .catch(() => { if (alive) setState({ id: clientId, value: 'failed' }); }); // не пусто — иначе «схем нет» вместо «не загрузилось»
    return () => { alive = false; };
  }, [clientId]);
  return state.id === clientId ? state.value : null;
}
