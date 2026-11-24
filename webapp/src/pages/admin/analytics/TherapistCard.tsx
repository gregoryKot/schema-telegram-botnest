import { THERAPIST_ACTION_LABELS, type AdminTherapistActions, type AdminTherapistRow } from '../../../../../shared/src/analytics/adminAnalytics';
import { card } from '../shared';
import { agoLabel, barHeights, daysWord } from './format';
import { Bar } from './ui';

const KEYS = Object.keys(THERAPIST_ACTION_LABELS) as (keyof AdminTherapistActions)[];
const sub = { color: 'var(--text-sub)', fontSize: 13 } as const;

function MiniBars({ values }: { values: number[] }) {
  const h = barHeights(values);
  return (
    <div aria-hidden style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 36 }}>
      {h.map((v, i) => <div key={i} style={{ flex: 1, height: `${Math.max(v, 4)}%`, background: v ? 'var(--accent)' : 'var(--line)', borderRadius: 'var(--r-4)' }} />)}
    </div>
  );
}

export function TherapistCard({ row, now, days }: { row: AdminTherapistRow; now: Date; days: number }) {
  const ago = agoLabel(row.lastActive, now);
  const c = row.clients;
  const maxAction = Math.max(0, ...KEYS.map((k) => row.actions[k]));
  const shown = KEYS.filter((k) => row.actions[k] > 0);
  return (
    <div style={{ ...card, marginBottom: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 16, color: 'var(--text)' }}>{row.name || 'Без имени'}</strong>
        <span style={sub}>{ago ? `последний заход: ${ago}` : 'заходов не было'}</span>
      </div>
      <div style={{ ...sub, margin: '4px 0 12px' }}>
        Заходов: {row.activeDays} из {daysWord(days)}. Клиенты: {c.active} действующих, {c.pending} ждут ответа, {c.ended} завершённых, {c.virtual} без приложения.
      </div>
      {row.total === 0 ? (
        <div style={{ ...sub, fontStyle: 'italic' }}>За период действий нет</div>
      ) : (
        <>
          <MiniBars values={row.daily} />
          <ul style={{ listStyle: 'none', margin: '12px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {shown.map((k) => (
              <li key={k}>
                <div className="u-mb4" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span className="u-fg">{THERAPIST_ACTION_LABELS[k]}</span>
                  <span className="u-sub">{row.actions[k]}</span>
                </div>
                <Bar pct={Math.round((row.actions[k] / maxAction) * 100)} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
