import { Need, COLORS } from '../../types';

const SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)';

function petalPath(
  cx: number,
  cy: number,
  r: number,
  ca: number,
  hs: number,
): string {
  if (r < 1) return '';
  const a1 = ca - hs,
    a2 = ca + hs;
  const x1 = cx + r * Math.cos(a1),
    y1 = cy + r * Math.sin(a1);
  const x2 = cx + r * Math.cos(a2),
    y2 = cy + r * Math.sin(a2);
  return `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
}
function arcPath2(
  cx: number,
  cy: number,
  r: number,
  ca: number,
  hs: number,
): string {
  const a1 = ca - hs,
    a2 = ca + hs;
  const x1 = cx + r * Math.cos(a1),
    y1 = cy + r * Math.sin(a1);
  const x2 = cx + r * Math.cos(a2),
    y2 = cy + r * Math.sin(a2);
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

export function NeedsWheel({
  needs,
  ratings,
  prevRatings = {},
  childhoodRatings = {},
  onClickNeed,
  onClickCenter,
}: {
  needs: Need[];
  ratings: Record<string, number>;
  prevRatings?: Record<string, number>;
  childhoodRatings?: Partial<Record<string, number>>;
  onClickNeed?: (n: Need) => void;
  onClickCenter?: () => void;
}) {
  const W = 360,
    H = 280,
    cx = W / 2,
    cy = H / 2,
    R = cy - 20;
  const SPREAD = (34 * Math.PI) / 180,
    n = needs.length,
    CENTER_R = 41;
  const avg =
    n > 0 ? needs.reduce((s, nd) => s + (ratings[nd.id] ?? 0), 0) / n : 0;
  const prevAvg =
    Object.keys(prevRatings).length > 0
      ? needs.reduce((s, nd) => s + (prevRatings[nd.id] ?? 0), 0) / n
      : null;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ display: 'block', width: '100%', height: 280 }}
    >
      {[2, 5, 8, 10].map((ring) => (
        <circle
          key={ring}
          cx={cx}
          cy={cy}
          r={(R * ring) / 10}
          fill="none"
          stroke="rgba(var(--fg-rgb),0.04)"
          strokeWidth={ring === 10 ? 1.5 : 1}
        />
      ))}
      {needs.map((need, i) => {
        const angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
        const d = petalPath(cx, cy, R, angle, SPREAD);
        return d ? (
          <path key={`g-${need.id}`} d={d} fill="rgba(var(--fg-rgb),0.055)" />
        ) : null;
      })}
      {needs.map((need, i) => {
        const angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
        const value = ratings[need.id] ?? 0;
        const r = Math.sqrt(value / 10) * R;
        const color = COLORS[need.id] ?? '#888';
        const d = petalPath(cx, cy, r, angle, SPREAD);
        return d ? (
          <path
            key={need.id}
            d={d}
            fill={color}
            fillOpacity={0.9}
            stroke={color}
            strokeWidth={1}
            strokeOpacity={0.4}
            strokeLinejoin="round"
            style={{
              transformOrigin: `${cx}px ${cy}px`,
              animation: `sector-in 400ms ${SPRING} ${i * 80}ms both`,
            }}
          />
        ) : null;
      })}
      {needs.map((need, i) => {
        const angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
        return [0.25, 0.5, 0.75].map((frac) => (
          <path
            key={`a-${need.id}-${frac}`}
            d={arcPath2(cx, cy, R * frac, angle, SPREAD)}
            fill="none"
            stroke="rgba(var(--fg-rgb),0.1)"
            strokeWidth={1}
          />
        ));
      })}
      {Object.keys(childhoodRatings).length > 0 &&
        needs.map((need, i) => {
          const angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
          const r = Math.sqrt((childhoodRatings[need.id] ?? 0) / 10) * R;
          const d = petalPath(cx, cy, r, angle, SPREAD);
          return d ? (
            <path
              key={`c-${need.id}`}
              d={d}
              fill="none"
              stroke="rgba(var(--fg-rgb),0.4)"
              strokeWidth={2}
              strokeDasharray="4 3"
              strokeLinejoin="round"
            />
          ) : null;
        })}
      <circle
        cx={cx}
        cy={cy}
        r={CENTER_R}
        fill="var(--bg)"
        stroke="rgba(var(--fg-rgb),0.05)"
        strokeWidth={1}
      />
      <text
        x={cx}
        y={cy - 20}
        textAnchor="middle"
        fontSize={11}
        fill="rgba(var(--fg-rgb),0.4)"
      >
        индекс
      </text>
      <text
        x={cx}
        y={cy + 8}
        textAnchor="middle"
        fontSize={32}
        fontWeight={700}
        fill="var(--text)"
      >
        {avg.toFixed(1)}
      </text>
      {prevAvg !== null && prevAvg > 0 && (
        <text
          x={cx}
          y={cy + 24}
          textAnchor="middle"
          fontSize={11}
          fill="rgba(var(--fg-rgb),0.35)"
        >
          {avg >= prevAvg ? '↑' : '↓'} вчера {prevAvg.toFixed(1)}
        </text>
      )}
      {onClickNeed &&
        needs.map((need, i) => {
          const angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
          const d = petalPath(cx, cy, R, angle, SPREAD);
          return d ? (
            <path
              key={`h-${need.id}`}
              d={d}
              fill="transparent"
              onClick={() => onClickNeed(need)}
              style={{ cursor: 'pointer' }}
            />
          ) : null;
        })}
      {onClickCenter && (
        <circle
          cx={cx}
          cy={cy}
          r={CENTER_R}
          fill="transparent"
          onClick={onClickCenter}
          style={{ cursor: 'pointer' }}
        />
      )}
    </svg>
  );
}
