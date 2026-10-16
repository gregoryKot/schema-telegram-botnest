import { hueStyle, NEED_HUE } from '../../../lib/tone';
import { NEEDS } from './needs';

export function WheelSvg({ ratings }: { ratings: Record<string, number> }) {
  const size = 240,
    cx = 120,
    cy = 120,
    maxR = 80;
  const angles = NEEDS.map(
    (_, i) => (i * 2 * Math.PI) / NEEDS.length - Math.PI / 2,
  );
  const pts = NEEDS.map((n, i) => {
    const r = (ratings[n.id] / 10) * maxR;
    return `${(cx + r * Math.cos(angles[i])).toFixed(1)},${(cy + r * Math.sin(angles[i])).toFixed(1)}`;
  }).join(' ');
  const shortLabel: Record<string, string> = {
    attachment: 'Привяз.',
    autonomy: 'Автоном.',
    expression: 'Выраж.',
    play: 'Спонтан.',
    limits: 'Границы',
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="ex2-cw-svg"
    >
      {[0.25, 0.5, 0.75, 1].map((p) => (
        <polygon
          key={p}
          points={angles
            .map(
              (a) =>
                `${(cx + maxR * p * Math.cos(a)).toFixed(1)},${(cy + maxR * p * Math.sin(a)).toFixed(1)}`,
            )
            .join(' ')}
          fill="none"
          stroke="var(--line)"
          strokeWidth={1}
        />
      ))}
      {angles.map((a, i) => (
        <line
          key={i}
          x1={cx}
          y1={cy}
          x2={(cx + maxR * Math.cos(a)).toFixed(1)}
          y2={(cy + maxR * Math.sin(a)).toFixed(1)}
          stroke="var(--line)"
          strokeWidth={1}
        />
      ))}
      <polygon
        points={pts}
        fill="var(--accent-soft)"
        stroke="var(--accent)"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      {NEEDS.map((n, i) => {
        const r = (ratings[n.id] / 10) * maxR;
        return (
          <g key={n.id}>
            <circle
              cx={cx + r * Math.cos(angles[i])}
              cy={cy + r * Math.sin(angles[i])}
              r={4}
              className="ex2-cw-dot"
              style={hueStyle(NEED_HUE[n.id])}
            />
            <text
              x={(cx + (maxR + 22) * Math.cos(angles[i])).toFixed(1)}
              y={(cy + (maxR + 22) * Math.sin(angles[i])).toFixed(1)}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={9.5}
              fontWeight={600}
              fill="var(--text-sub)"
              style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}
            >
              {shortLabel[n.id]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
