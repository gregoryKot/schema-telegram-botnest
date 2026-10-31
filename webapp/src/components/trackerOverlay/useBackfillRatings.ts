import { useEffect, useState } from 'react';
import { api, reportClientError } from '../../api';

/**
 * Оценки прошлого дня для бэкфилла из HistorySheet; без `date` не делает запросов.
 * Отказ запроса — пустой день (оценки можно поставить заново) и отчёт наверх, а не вечный скелетон.
 */
export function useBackfillRatings(date: string | undefined) {
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(!!date);
  useEffect(() => {
    if (!date) return;
    api
      .ratings(date)
      .then((r) => setRatings(r))
      .catch(() => {
        setRatings({});
        reportClientError({ message: 'tracker backfill ratings load failed', section: 'tracker' });
      })
      .finally(() => setLoading(false));
  }, [date]);
  return { ratings, setRatings, loading };
}
