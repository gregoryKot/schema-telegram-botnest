// NeedMini — small need indicator with fill-bar for TodaySection

import { Need, COLORS } from '../../types';
import { useNeedData } from '../../needData';
import { hexToRgb } from './helpers';

export function NeedMini({
  need,
  value,
  yesterday,
  onTap,
}: {
  need: Need;
  value: number | undefined;
  yesterday?: number;
  onTap: () => void;
}) {
  const NEED_DATA = useNeedData();
  const color = COLORS[need.id] ?? '#888';
  const rgb = hexToRgb(color);
  const filled = value !== undefined && value !== null;
  const delta = filled && yesterday !== undefined ? value - yesterday : null;

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onTap();
      }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 5,
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <div
        style={{
          width: 46,
          height: 46,
          borderRadius: 14,
          position: 'relative',
          overflow: 'hidden',
          background: filled ? `rgba(${rgb},0.14)` : 'var(--surface)',
          border: `1.5px solid ${filled ? color + '44' : 'var(--border-color)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'border-color 0.2s',
        }}
      >
        {filled && (
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: `${(value / 10) * 100}%`,
              background: `linear-gradient(to top, ${color}55, ${color}14)`,
              transition: 'height 0.4s ease',
            }}
          />
        )}
        <span
          style={{
            position: 'relative',
            fontSize: filled ? 14 : 18,
            fontWeight: 700,
            color: filled ? color : 'var(--text-faint)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {filled ? value : need.emoji}
        </span>
        {/* Yesterday delta badge */}
        {delta !== null && delta !== 0 && (
          <div
            style={{
              position: 'absolute',
              top: 2,
              right: 2,
              fontSize: 7,
              fontWeight: 700,
              lineHeight: 1,
              color: delta > 0 ? 'var(--accent-green)' : 'var(--accent-red)',
              background:
                delta > 0
                  ? 'color-mix(in srgb, var(--accent-green) 18%, transparent)'
                  : 'color-mix(in srgb, var(--accent-red) 18%, transparent)',
              borderRadius: 4,
              padding: '1px 3px',
            }}
          >
            {delta > 0 ? '+' : ''}
            {delta}
          </div>
        )}
      </div>
      <span
        style={{
          fontSize: 9,
          color: 'var(--text-faint)',
          fontWeight: 600,
          textAlign: 'center',
          letterSpacing: '0.02em',
          lineHeight: 1.2,
          maxWidth: 52,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {NEED_DATA[need.id]?.short ?? need.chartLabel}
      </span>
    </div>
  );
}
