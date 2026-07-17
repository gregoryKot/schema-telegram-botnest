import { useMemo } from 'react';
import { useTr } from '../../utils/addressForm';
import { COLORS } from '../../types';
import { NEED_IDS, NeedId, buildNeedMeta } from './data';

export function ChildhoodWheel({
  ratings,
}: {
  ratings: Record<NeedId, number>;
}) {
  const NEED_META = buildNeedMeta(useTr());
  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = 80;
  const angles = useMemo(
    () => NEED_IDS.map((_, i) => (i * 2 * Math.PI) / 5 - Math.PI / 2),
    [],
  );
  const valuePoints = NEED_IDS.map((id, i) => {
    const r = (ratings[id] / 10) * maxR;
    return `${(cx + r * Math.cos(angles[i])).toFixed(1)},${(cy + r * Math.sin(angles[i])).toFixed(1)}`;
  }).join(' ');

  return (
    <svg
      width={size}
      height={size}
      style={{ display: 'block', margin: '0 auto' }}
    >
      {/* Grid rings */}
      {[0.25, 0.5, 0.75, 1].map((pct) => (
        <polygon
          key={pct}
          points={angles
            .map(
              (a) =>
                `${(cx + maxR * pct * Math.cos(a)).toFixed(1)},${(cy + maxR * pct * Math.sin(a)).toFixed(1)}`,
            )
            .join(' ')}
          fill="none"
          stroke="rgba(var(--fg-rgb),0.06)"
          strokeWidth={1}
        />
      ))}
      {/* Axis lines */}
      {angles.map((a, i) => (
        <line
          key={i}
          x1={cx}
          y1={cy}
          x2={(cx + maxR * Math.cos(a)).toFixed(1)}
          y2={(cy + maxR * Math.sin(a)).toFixed(1)}
          stroke="rgba(var(--fg-rgb),0.07)"
          strokeWidth={1}
        />
      ))}
      {/* Value polygon */}
      <polygon
        points={valuePoints}
        fill="color-mix(in srgb, var(--accent) 18%, transparent)"
        stroke="#a78bfa"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      {/* Per-need dots + value labels */}
      {NEED_IDS.map((id, i) => {
        const r = (ratings[id] / 10) * maxR;
        const color = COLORS[id] ?? '#888';
        const dotX = cx + r * Math.cos(angles[i]);
        const dotY = cy + r * Math.sin(angles[i]);
        const labelR = maxR + 22;
        const labelX = cx + labelR * Math.cos(angles[i]);
        const labelY = cy + labelR * Math.sin(angles[i]);
        return (
          <g key={id}>
            <circle
              cx={dotX.toFixed(1)}
              cy={dotY.toFixed(1)}
              r={4}
              fill={color}
            />
            <text
              x={labelX.toFixed(1)}
              y={labelY.toFixed(1)}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={13}
              style={{ userSelect: 'none' }}
            >
              {NEED_META[id].emoji}
            </text>
            <text
              x={labelX.toFixed(1)}
              y={(labelY + 14).toFixed(1)}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={9}
              fill={color}
              fontWeight={600}
              style={{ userSelect: 'none' }}
            >
              {ratings[id]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
