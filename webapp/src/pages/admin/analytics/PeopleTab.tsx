import type { AdminAnalyticsDays } from '../../../../../shared/src/analytics/adminAnalytics';
import { card } from '../shared';
import { analyticsApi } from './analyticsApi';
import { useAdminData } from './useAdminData';
import { agoLabel, daysWord, timesWord } from './format';
import { CardsSkeleton, EmptyNote, ErrorRetry, Hint } from './ui';

const ROLE = { CLIENT: 'клиент', THERAPIST: 'терапевт' } as const;

export function PeopleTab({ adminKey, days }: { adminKey: string; days: AdminAnalyticsDays }) {
  const { data, error, loading, retry } = useAdminData(() => analyticsApi.people(adminKey, days), [adminKey, days]);
  const now = new Date();
  if (error) return <ErrorRetry message={error} onRetry={retry} />;
  return (
    <div>
      <Hint>Самые активные люди за период: сколько действий, сколько дней заходили и чем пользуются чаще всего.</Hint>
      {loading || !data ? <CardsSkeleton count={5} height={84} /> : !data.length ? <EmptyNote /> : (
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {data.map((p) => (
            <li key={p.id} style={{ ...card, marginBottom: 0, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <strong className="u-fg">{p.name || 'Без имени'} <span style={{ fontWeight: 400, color: 'var(--text-sub)', fontSize: 13 }}>· {ROLE[p.role]}</span></strong>
                <span className="u-sub13">последний заход: {agoLabel(p.lastActive, now) ?? '—'}</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-sub)', margin: '4px 0' }}>
                Действий: {p.events} · заходил в приложение дней: {p.activeDays} из {daysWord(days)}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text)' }}>
                {p.top.length ? p.top.map((t) => `${t.title} (${timesWord(t.count)})`).join(' · ') : 'Любимых функций пока нет'}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
