import { useEffect, useState } from 'react';
import { api, type TherapyClientSummary } from '../../api';

/**
 * Клиенты терапевта для выбора из справочника («В план», «Про клиента»): undefined — грузится,
 * null — не пришёл. `skip` — клиент уже известен (справочник из карточки), список не нужен.
 */
export function useTherapyClientList(skip = false): TherapyClientSummary[] | null | undefined {
  const [clients, setClients] = useState<TherapyClientSummary[] | null | undefined>(undefined);
  useEffect(() => {
    if (skip) return;
    let alive = true;
    api.getTherapyClients().then(
      (list) => { if (alive) setClients(list); },
      () => { if (alive) setClients(null); },
    );
    return () => { alive = false; };
  }, [skip]);
  return clients;
}
