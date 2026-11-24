import { useMemo, useState } from 'react';
import type { AdminAnalyticsDays } from '../../../../../shared/src/analytics/adminAnalytics';
import { pluralRu } from '../../../../../shared/src/utils/pluralRu';
import { analyticsApi } from './analyticsApi';
import { useAdminData } from './useAdminData';
import { SORT_LABELS, sortTherapists, type TherapistSort } from './format';
import { TherapistCard } from './TherapistCard';
import { CardsSkeleton, EmptyNote, ErrorRetry, Hint, Pills } from './ui';

const SORT_ITEMS = (Object.keys(SORT_LABELS) as TherapistSort[]).map((id) => ({ id, label: SORT_LABELS[id] }));

export function TherapistsTab({ adminKey, days }: { adminKey: string; days: AdminAnalyticsDays }) {
  const { data, error, loading, retry } = useAdminData(() => analyticsApi.therapists(adminKey, days), [adminKey, days]);
  const [sort, setSort] = useState<TherapistSort>('activity');
  const sorted = useMemo(() => (data ? sortTherapists(data, sort) : []), [data, sort]);
  const now = new Date();
  if (error) return <ErrorRetry message={error} onRetry={retry} />;
  const n = data?.length ?? 0;
  const busy = data?.filter((r) => r.total > 0).length ?? 0;
  return (
    <div>
      <Hint>Что делают терапевты в приложении: заходы, клиенты и работа по видам. Кто тише всех, видно сразу.</Hint>
      {loading || !data ? <CardsSkeleton count={4} height={150} /> : !n ? <EmptyNote>Терапевтов пока нет</EmptyNote> : (
        <>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', margin: '0 0 12px' }}>
            {n} {pluralRu(n, 'терапевт', 'терапевта', 'терапевтов')}, из них {busy} что-то делали за период
          </p>
          <div className="u-mb14"><Pills label="Сортировка" items={SORT_ITEMS} value={sort} onChange={setSort} /></div>
          <div className="u-col12">
            {sorted.map((r) => <TherapistCard key={r.id} row={r} now={now} days={days} />)}
          </div>
        </>
      )}
    </div>
  );
}
