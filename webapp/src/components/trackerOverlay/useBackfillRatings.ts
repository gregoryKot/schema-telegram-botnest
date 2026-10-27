import { useEffect, useState } from 'react';
import { api } from '../../api';

/** Оценки прошлого дня для бэкфилла из HistorySheet; без `date` не делает запросов. */
export function useBackfillRatings(date: string | undefined) {
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(!!date);
  useEffect(() => {
    if (!date) return;
    api
      .ratings(date)
      .then((r) => setRatings(r))
      .finally(() => setLoading(false));
  }, [date]);
  return { ratings, setRatings, loading };
}
