import { Need, DayHistory, COLORS } from '../../types';

export function SparklineRow({
  need,
  history,
  selectedIdx,
  selectedRatings,
  onClick,
}: {
  need: Need;
  history: DayHistory[];
  selectedIdx: number;
  selectedRatings: Record<string, number>;
  onClick?: () => void;
}) {
  const color = COLORS[need.id] ?? '#888';
  const W = 100,
    H = 28;
  const reversed = [...history].reverse();
  const n = reversed.length;
  const xStep = n > 1 ? W / (n - 1) : W / 2;
  const yFor = (v: number) =>
    v === 0 ? H - 1 : 25 - ((Math.min(v, 10) - 1) / 9) * 23;
  const pts = reversed.map((day, i) => ({
    x: i * xStep,
    y: yFor(day.ratings[need.id] ?? 0),
  }));
  const dotIdx = Math.max(0, Math.min(n - 1 - selectedIdx, n - 1));
  const dot = pts[dotIdx];
  const score = selectedRatings[need.id] ?? 0;
  const prevScore = history[selectedIdx + 1]?.ratings[need.id] ?? score;
  const delta = score - prevScore;
  const trendColor =
    delta > 0
      ? 'var(--accent-green)'
      : delta < 0
        ? 'var(--accent-red)'
        : 'var(--text-faint)';
  const trendArrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '—';
  const linePath = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');
  const areaPath = `${linePath} L ${pts[n - 1].x.toFixed(1)} ${H} L 0 ${H} Z`;
  const polyStr = pts
    .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');

  return (
    <div
      onClick={onClick}
      className="card"
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      style={{
        borderRadius: 16,
        padding: '12px 14px',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 9,
            flexShrink: 0,
            background: `color-mix(in srgb, ${color} 15%, transparent)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
          }}
        >
          {need.emoji}
        </div>
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--text)',
            width: 80,
            flexShrink: 0,
          }}
        >
          {need.chartLabel}
        </span>
        <svg
          style={{ flex: 1, height: 28, display: 'block', overflow: 'visible' }}
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id={`ag-${need.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.22} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#ag-${need.id})`} />
          <polyline
            points={polyStr}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle
            cx={dot.x}
            cy={dot.y}
            r={3.5}
            fill={color}
            style={{ transition: 'cx 150ms ease, cy 150ms ease' }}
          />
        </svg>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: 15,
              fontWeight: 700,
              color,
              minWidth: 18,
              textAlign: 'right',
            }}
          >
            {score}
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, color: trendColor }}>
            {trendArrow}
          </span>
        </div>
      </div>
    </div>
  );
}
