import { useCallback, useEffect, useState } from 'react';
import { api, type UserId } from '../../api';

export type ClientChildhood =
  | { status: 'idle' | 'loading' | 'error' }
  | { status: 'ready'; ratings: Record<string, number> };

/**
 * Оценки клиента из упражнения «Колесо детства» (0–10 по потребностям) для колеса на
 * холсте терапевта. Берутся из данных клиента для терапевта (client-data): клиент,
 * закрывший профиль от терапевта, отдаёт пусто — как и YSQ. Без клиента — idle.
 */
export function useClientChildhood(clientId: UserId | undefined) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<ClientChildhood>({ status: clientId == null ? 'idle' : 'loading' });
  useEffect(() => {
    if (clientId == null) return;
    let alive = true;
    api.getTherapyClientData(clientId)
      .then((d) => { if (alive) setState({ status: 'ready', ratings: d.childhoodRatings ?? {} }); })
      .catch(() => { if (alive) setState({ status: 'error' }); });
    return () => { alive = false; };
  }, [clientId, attempt]);
  const retry = useCallback(() => { setState({ status: 'loading' }); setAttempt((a) => a + 1); }, []);
  return { state, retry };
}
