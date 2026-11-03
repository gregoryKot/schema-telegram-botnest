import { Need, DayHistory, NEED_COLORS } from '../../types';
import { IdentityDot } from '../../../../shared/src/components/IdentityDot';
import { pressable } from '../../utils/a11y';
import {
  SPARK_H,
  SPARK_W,
  sparklineGeometry,
} from '../../../../shared/src/history/sparkline';

// Геометрия и окно дней — shared/src/history/sparkline.ts (общие с сайтом).
export function SparklineRow({
  need,
  days,
  selectedRatings,
  onClick,
}: {
  need: Need;
  /** Окно «За N дней» (weekWindow): выбранный день первым. */
  days: DayHistory[];
  selectedRatings: Record<string, number>;
  onClick?: () => void;
}) {
  const color = NEED_COLORS[need.id] ?? '#888';
  const g = sparklineGeometry(days, need.id);
  const score = selectedRatings[need.id] ?? 0;
  const prevScore = days[1]?.ratings[need.id] ?? score;
  const delta = score - prevScore;
  const trendColor =
    delta > 0
      ? 'var(--accent-green)'
      : delta < 0
        ? 'var(--accent-red)'
        : 'var(--text-faint)';
  const trendArrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '—';

  return (
    <div
      className="card"
      {...(onClick ? pressable(onClick) : {})}
      style={{
        borderRadius: 'var(--r-16)',
        padding: '12px 14px',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div className="u-ac12">
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
          }}
        >
          <IdentityDot id={need.id} size={11} />
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
        {/* Маркер — HTML поверх растянутого svg: в svg круг сплющивался. */}
        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <svg
            style={{
              width: '100%',
              height: 28,
              display: 'block',
              overflow: 'visible',
            }}
            viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id={`ag-${need.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.22} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <path d={g.area} fill={`url(#ag-${need.id})`} />
            <polyline
              points={g.points}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <span
            style={{
              position: 'absolute',
              left: `${g.dot.left}%`,
              top: `${g.dot.top}%`,
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: color,
              transform: 'translate(-50%, -50%)',
              transition: 'left 150ms ease, top 150ms ease',
            }}
          />
        </div>
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
