import { useEffect, useState } from 'react';
import { api, type UserId } from '../../api';
import type { ClientConceptState } from './clientConceptContext';
import { toClientConcept } from './conceptSync';

/** Один запрос концептуализации на открытую карту; без clientId (личная карта клиента) не грузит. */
export function useClientConcept(clientId: UserId | null | undefined): ClientConceptState {
  const [state, setState] = useState<{ id: UserId | null | undefined; value: ClientConceptState }>({ id: clientId, value: null });
  useEffect(() => {
    if (clientId == null) return;
    let alive = true;
    api.getConceptualization(clientId)
      .then(c => { if (alive) setState({ id: clientId, value: toClientConcept(c) }); })
      .catch(() => { if (alive) setState({ id: clientId, value: 'failed' }); }); // не пусто — иначе «схем нет» вместо «не загрузилось»
    return () => { alive = false; };
  }, [clientId]);
  return state.id === clientId ? state.value : null;
}
