import { Need, COLORS } from '../../types';

export function NeedRow({
  need,
  value,
  onTap,
}: {
  need: Need;
  value: number;
  onTap?: () => void;
}) {
  const color = COLORS[need.id] ?? '#888';
  const pct = (value / 10) * 100;
  const levelLabel =
    value === 0 ? '—' : value <= 3 ? 'низко' : value <= 6 ? 'средне' : 'хорошо';
  const levelColor =
    value === 0
      ? 'var(--text-faint)'
      : value <= 3
        ? 'var(--accent-red)'
        : value <= 6
          ? 'var(--accent-yellow)'
          : 'var(--accent-green)';

  return (
    <div
      onClick={onTap}
      className="card"
      role={onTap ? 'button' : undefined}
      tabIndex={onTap ? 0 : undefined}
      onKeyDown={
        onTap
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onTap();
              }
            }
          : undefined
      }
      style={{
        borderRadius: 16,
        padding: '12px 14px',
        cursor: onTap ? 'pointer' : 'default',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            flexShrink: 0,
            background: `color-mix(in srgb, ${color} 15%, transparent)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
          }}
        >
          {need.emoji}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 5,
            }}
          >
            <span
              style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}
            >
              {need.chartLabel}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{ fontSize: 11, fontWeight: 600, color: levelColor }}
              >
                {levelLabel}
              </span>
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color,
                  minWidth: 20,
                  textAlign: 'right',
                }}
              >
                {value}
              </span>
            </div>
          </div>
          <div
            style={{
              height: 4,
              background: 'rgba(var(--fg-rgb),0.07)',
              borderRadius: 4,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${pct}%`,
                height: '100%',
                background: color,
                borderRadius: 4,
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
