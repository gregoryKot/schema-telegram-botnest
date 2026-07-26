// Кольцо-пончик со средней оценкой дня. Вынесено из TrackerOverlay.tsx
// (правило №10).
export function SummaryDonut({ avg }: { avg: number }) {
  const s = 52,
    r = 20,
    cx = 26,
    cy = 26;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(avg / 10, 1));
  return (
    <svg width={s} height={s}>
      <defs>
        <linearGradient id="dg2" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--accent-pink)" />
          <stop offset="50%" stopColor="var(--accent-yellow)" />
          <stop offset="100%" stopColor="var(--accent-green)" />
        </linearGradient>
      </defs>
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="var(--surface-2)"
        strokeWidth={5}
      />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="url(#dg2)"
        strokeWidth={5}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: 'stroke-dashoffset 0.35s ease' }}
      />
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={11}
        fontWeight={600}
        fill="var(--text)"
      >
        {Math.round((avg / 10) * 100)}%
      </text>
    </svg>
  );
}
