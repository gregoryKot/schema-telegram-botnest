import { Need, COLORS } from '../../types';

export function InsightCard({
  needs,
  ratings,
  onTap,
}: {
  needs: Need[];
  ratings: Record<string, number>;
  onTap?: (n: Need) => void;
}) {
  const rated = needs.filter((n) => (ratings[n.id] ?? 0) > 0);
  if (rated.length === 0) return null;
  const lowest = rated.reduce((min, n) =>
    (ratings[n.id] ?? 0) < (ratings[min.id] ?? 0) ? n : min,
  );
  const color = COLORS[lowest.id] ?? '#888';
  const value = ratings[lowest.id] ?? 0;
  return (
    <div
      onClick={() => onTap?.(lowest)}
      role={onTap ? 'button' : undefined}
      tabIndex={onTap ? 0 : undefined}
      onKeyDown={
        onTap
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onTap(lowest);
              }
            }
          : undefined
      }
      style={{
        background: `color-mix(in srgb, ${color} 8%, var(--surface))`,
        border: `1px solid color-mix(in srgb, ${color} 20%, transparent)`,
        borderRadius: 16,
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        cursor: onTap ? 'pointer' : 'default',
        boxShadow: `0 2px 12px color-mix(in srgb, ${color} 10%, transparent)`,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          flexShrink: 0,
          background: `color-mix(in srgb, ${color} 18%, transparent)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
        }}
      >
        {lowest.emoji}
      </div>
      <div style={{ flex: 1 }}>
        <div
          style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 2 }}
        >
          Стоит уделить внимание
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
          {lowest.chartLabel}
        </div>
        <div style={{ fontSize: 12, color, fontWeight: 600, marginTop: 1 }}>
          оценка {value} из 10
        </div>
      </div>
      {onTap && (
        <span style={{ fontSize: 16, color: 'var(--text-faint)' }}>›</span>
      )}
    </div>
  );
}
