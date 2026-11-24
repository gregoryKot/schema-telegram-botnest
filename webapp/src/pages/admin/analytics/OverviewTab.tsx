import { useState } from 'react';
import type { AdminAnalyticsDays, AdminOverview } from '../../../../../shared/src/analytics/adminAnalytics';
import { card } from '../shared';
import { Skeleton } from '../../../components/Skeleton';
import { analyticsApi } from './analyticsApi';
import { useAdminData } from './useAdminData';
import { BarChart } from './BarChart';
import { FeatureBars } from './FeatureBars';
import { SERIES_LABELS, type ChartSeries } from './format';
import { EmptyNote, ErrorRetry, Hint, Pills, Title } from './ui';

const SERIES_ITEMS = (Object.keys(SERIES_LABELS) as ChartSeries[]).map((id) => ({ id, label: SERIES_LABELS[id] }));

function tiles(t: AdminOverview['totals'], days: number): [string, number][] {
  return [
    ['Сегодня заходили', t.activeToday], ['За неделю', t.active7], [`Новых за ${days} дн.`, t.newInPeriod],
    ['Всего людей', t.users], ['Терапевтов', t.therapists], ['Клиентов в терапии', t.clientsInTherapy],
  ];
}

export function OverviewTab({ adminKey, days }: { adminKey: string; days: AdminAnalyticsDays }) {
  const { data, error, loading, retry } = useAdminData(() => analyticsApi.overview(adminKey, days), [adminKey, days]);
  const [series, setSeries] = useState<ChartSeries>('active');
  if (error) return <ErrorRetry message={error} onRetry={retry} />;
  return (
    <div>
      <Hint>Сколько людей пользуется приложением, как это меняется по дням и чем именно.</Hint>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 16 }}>
        {loading || !data
          ? Array.from({ length: 6 }, (_, i) => <Skeleton key={i} height={84} radius={14} />)
          : tiles(data.totals, days).map(([label, n]) => (
            <div key={label} style={{ ...card, marginBottom: 0, padding: 14 }}>
              <div style={{ fontSize: 30, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--serif)' }}>{n}</div>
              <div className="u-sub13">{label}</div>
            </div>
          ))}
      </div>
      <div style={card}>
        <Title>По дням</Title>
        <div className="u-mb12"><Pills label="Что показывать" items={SERIES_ITEMS} value={series} onChange={setSeries} /></div>
        {loading || !data ? <Skeleton height={190} radius={10} />
          : data.daily.length ? <BarChart daily={data.daily} series={series} /> : <EmptyNote />}
      </div>
      <div style={card}>
        <Title>Чем пользуются чаще всего</Title>
        {loading || !data ? <Skeleton height={160} radius={10} /> : <FeatureBars rows={data.features} />}
      </div>
    </div>
  );
}
