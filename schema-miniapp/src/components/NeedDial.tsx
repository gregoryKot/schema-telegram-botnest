// NeedDial.tsx — Arc gauge component for needs tracker
// Place at: src/components/NeedDial.tsx
//
// Usage:
//   <NeedDial need={need} color={COLORS[need.id]} value={ratings[need.id] ?? 0} onChange={v => setRating(need.id, v)} />

import React, { useCallback, useRef } from 'react';
import { Need } from '../types';
import { NEED_DATA } from '../needData';

interface Props {
  need: Need;
  color: string;
  value: number;
  onChange: (v: number) => void;
  size?: number;
}

// ── Arc geometry constants ────────────────────────────────────────────────────
const DEFAULT_SIZE = 280;
const STROKE = 13;
const ARC_START  = 135;  // degrees — bottom-left
const ARC_SWEEP  = 270;  // degrees — ¾ circle

function polarXY(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = (deg - 90) * Math.PI / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function arcPath(cx: number, cy: number, r: number, fromDeg: number, sweep: number): string {
  const s = Math.min(Math.max(sweep, 0.001), ARC_SWEEP - 0.001);
  const [sx, sy] = polarXY(cx, cy, r, fromDeg);
  const [ex, ey] = polarXY(cx, cy, r, fromDeg + s);
  return `M ${sx.toFixed(2)} ${sy.toFixed(2)} A ${r} ${r} 0 ${s > 180 ? 1 : 0} 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`;
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function NeedDial({ need, color, value, onChange, size = DEFAULT_SIZE }: Props) {
  const cx = size / 2;
  const cy = size / 2 + 8; // slightly below center for better arc feel
  const r  = size * 0.386;

  const fillSweep  = (value / 10) * ARC_SWEEP;
  const [dotX, dotY] = polarXY(cx, cy, r, ARC_START + Math.max(fillSweep, 0.5));
  const rgb = hexToRgb(color);

  // Level indicator
  const levelColor = value === 0
    ? 'var(--text-faint)'
    : value <= 3 ? 'var(--accent-red)'
    : value <= 6 ? 'var(--accent-yellow)'
    : 'var(--accent-green)';
  const levelLabel = value === 0 ? '· · ·' : value <= 3 ? 'низко' : value <= 6 ? 'средне' : 'хорошо';

  // ── Interaction ──────────────────────────────────────────────────────────────
  const handleInteraction = useCallback((clientX: number, clientY: number, rect: DOMRect) => {
    const scaleX = size / rect.width;
    const scaleY = (size + 16) / rect.height;
    const x = (clientX - rect.left) * scaleX - cx;
    const y = (clientY - rect.top)  * scaleY - cy;
    const dist = Math.sqrt(x * x + y * y);
    if (dist < r - STROKE * 3 || dist > r + STROKE * 3) return;
    let angle = Math.atan2(x, -y) * 180 / Math.PI;
    if (angle < 0) angle += 360;
    let rel = angle - ARC_START;
    if (rel < 0) rel += 360;
    if (rel > ARC_SWEEP) return;
    onChange(Math.max(0, Math.min(10, Math.round(rel / ARC_SWEEP * 10))));
  }, [cx, cy, r, onChange]);

  const svgRef = useRef<SVGSVGElement>(null);

  const handleClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    handleInteraction(e.clientX, e.clientY, svgRef.current.getBoundingClientRect());
  }, [handleInteraction]);

  // Touch support
  const isDragging = useRef(false);
  const handleTouchStart = useCallback((e: React.TouchEvent<SVGSVGElement>) => {
    isDragging.current = true;
    e.stopPropagation(); // prevent outer swipe handler from capturing this touch
    if (!svgRef.current) return;
    const t = e.touches[0];
    handleInteraction(t.clientX, t.clientY, svgRef.current.getBoundingClientRect());
  }, [handleInteraction]);
  const handleTouchMove = useCallback((e: React.TouchEvent<SVGSVGElement>) => {
    if (!isDragging.current || !svgRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    const t = e.touches[0];
    handleInteraction(t.clientX, t.clientY, svgRef.current.getBoundingClientRect());
  }, [handleInteraction]);
  const handleTouchEnd = useCallback((e: React.TouchEvent<SVGSVGElement>) => {
    isDragging.current = false;
    e.stopPropagation(); // prevent outer swipe handler from firing on dial release
  }, []);

  const W = size, H = size + 16;

  return (
    <div style={{ position: 'relative', width: W, height: H, userSelect: 'none' }}>
      <svg ref={svgRef} width={W} height={H} viewBox={`0 0 ${W} ${H}`}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ cursor: 'pointer', display: 'block', touchAction: 'none' }}>

        {/* Ambient glow */}
        {value > 0 && (
          <circle cx={cx} cy={cy} r={r - STROKE}
            fill={`rgba(${rgb},0.05)`} />
        )}

        {/* Track arc */}
        <path d={arcPath(cx, cy, r, ARC_START, ARC_SWEEP)}
          fill="none" strokeWidth={STROKE} strokeLinecap="round"
          style={{ stroke: 'var(--track-color)' }} />

        {/* Tick marks */}
        {Array.from({ length: 11 }, (_, i) => {
          const [tx, ty] = polarXY(cx, cy, r, ARC_START + (i / 10) * ARC_SWEEP);
          return (
            <circle key={i} cx={tx.toFixed(2)} cy={ty.toFixed(2)} r={1.8}
              fill={i <= value ? color + '70' : 'var(--track-color)'} />
          );
        })}

        {/* Value fill arc */}
        {value > 0 && (
          <path d={arcPath(cx, cy, r, ARC_START, fillSweep)}
            fill="none" stroke={color} strokeWidth={STROKE} strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 7px ${color}80)` }} />
        )}

        {/* Thumb dot */}
        {value > 0 && (
          <>
            <circle cx={dotX.toFixed(2)} cy={dotY.toFixed(2)} r={STROKE / 2 + 4}
              style={{ fill: 'var(--bg)' }} />
            <circle cx={dotX.toFixed(2)} cy={dotY.toFixed(2)} r={STROKE / 2 - 1}
              fill={color}
              style={{ filter: `drop-shadow(0 0 8px ${color})` }} />
          </>
        )}
      </svg>

      {/* Center label */}
      <div style={{
        position: 'absolute', left: 0, right: 0, top: 0, height: H,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        <div style={{
          fontSize: 11, fontWeight: 500, letterSpacing: '0.02em',
          color: 'var(--text-faint)', marginBottom: 6,
          textAlign: 'center', maxWidth: 120, lineHeight: 1.3,
        }}>
          {NEED_DATA[need.id]?.subtitle ?? need.chartLabel}
        </div>
        <div style={{
          fontSize: 76, fontWeight: 800, letterSpacing: '-5px', lineHeight: 1,
          color: value > 0 ? 'var(--text)' : 'var(--text-faint)',
          fontVariantNumeric: 'tabular-nums', transition: 'color 0.3s',
        }}>
          {value}
        </div>
        <div style={{
          fontSize: 12, fontWeight: 600, color: levelColor,
          marginTop: 8, transition: 'color 0.3s',
        }}>
          {levelLabel}
        </div>
      </div>
    </div>
  );
}
