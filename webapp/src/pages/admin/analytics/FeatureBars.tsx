import type { AdminFeatureRow } from '../../../../../shared/src/analytics/adminAnalytics';
import { barHeights, peopleWord, timesWord } from './format';
import { Bar, EmptyNote } from './ui';

export function FeatureBars({ rows }: { rows: AdminFeatureRow[] }) {
  if (!rows.length) return <EmptyNote />;
  const pct = barHeights(rows.map((r) => r.events));
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {rows.map((r, i) => (
        <li key={r.id}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 14, marginBottom: 4 }}>
            <span className="u-fg">{r.title}</span>
            <span style={{ color: 'var(--text-sub)', textAlign: 'right' }}>{timesWord(r.events)} · {peopleWord(r.users)}</span>
          </div>
          <Bar pct={pct[i]} />
        </li>
      ))}
    </ul>
  );
}
