import { useCallback, useEffect, useState } from 'react';
import { api, type ClientBookingOverview } from '../../api';

/**
 * Запись из приложения в «Мой терапевт» (#546): можно ли записаться и свои
 * ближайшие брони — GET /api/client-booking. `overview === null` — ещё не
 * пришло или не удалось: карточка терапевта тогда показывает то же, что без
 * записи (дату от терапевта), а не выдуманное «записей нет».
 * `reload` — после новой записи, чтобы «Ближайшая сессия» взялась из брони.
 */
export function useClientBooking(): { overview: ClientBookingOverview | null; reload: () => void } {
  const [overview, setOverview] = useState<ClientBookingOverview | null>(null);
  const reload = useCallback(() => {
    api.getClientBooking().then(setOverview).catch(() => setOverview(null));
  }, []);
  useEffect(reload, [reload]);
  return { overview, reload };
}
