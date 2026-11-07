import { useEffect, useState } from 'react';
import { api, ApiError, reportClientError } from '../../api';
import type { ClientSharedConcept } from '../../../../shared/src/therapy/clientConceptualization';

export type MyConceptState =
  | { status: 'loading' }
  | { status: 'ready'; concept: ClientSharedConcept }
  /** 404: терапевт выключил показ (или связь закончилась), пока строка ещё висела. */
  | { status: 'hidden' }
  | { status: 'error' };

/**
 * Схема случая клиента для листа «Схема случая» (GET /api/therapy/my-concept,
 * мимо кеша — показ выключает терапевт). Открытие — событие
 * client_concept_opened (литералом, его видит трипваер analytics-sync), отказ
 * сети — отчёт наверх: экран-тупик без отчёта молчал бы (правило №14).
 */
export function useMyConcept(): MyConceptState {
  const [state, setState] = useState<MyConceptState>({ status: 'loading' });
  useEffect(() => {
    let alive = true;
    api.getMyConcept().then(
      (concept) => {
        if (!alive) return;
        setState({ status: 'ready', concept });
        api.trackEvent('client_concept_opened');
      },
      (e: unknown) => {
        if (!alive) return;
        if (e instanceof ApiError && e.status === 404) return setState({ status: 'hidden' });
        setState({ status: 'error' });
        reportClientError({ message: 'my concept load failed', section: 'profile.myConcept' });
      },
    );
    return () => { alive = false; };
  }, []);
  return state;
}
