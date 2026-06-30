import { useRef, useCallback } from 'react';
import { COLORS, YESTERDAY } from '../types';

const HINTS: Record<string, string> = {
  attachment: 'близость · связь',
  autonomy:   'свобода · выбор',
  expression: 'честность · голос',
  play:       'игра · лёгкость',
  limits:     'уважение · защита',
};

function NeedIcon({ id, color }: { id: string; color: string }) {
  const props = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    stroke: color,
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  switch (id) {
    case 'attachment':
      return <svg {...props}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>;
    case 'autonomy':
      return <svg {...props}><circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" /></svg>;
    case 'expression':
      return <svg {...props}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>;
    case 'play':
      return <svg {...props}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>;
    case 'limits':
      return <svg {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>;
    default:
      return null;
  }
}

const BADGE_NEUTRAL: React.CSSProperties = {
  fontSize: 11, fontWeight: 500, padding: '2px 6px', borderRadius: 20,
  background: 'rgba(var(--fg-rgb),0.07)', color: 'var(--text-sub)',
};
const BADGE_POSITIVE: React.CSSProperties = {
  fontSize: 11, fontWeight: 500, padding: '2px 6px', borderRadius: 20,
  background: 'color-mix(in srgb, var(--accent-green) 15%, transparent)', color: '#06d6a0',
};

function DeltaBadge({ delta }: { delta: number }) {
  if (delta === 0) return null;
  if (delta > 0) return <span style={BADGE_POSITIVE}>+{delta}</span>;
  return <span style={BADGE_NEUTRAL}>{delta}</span>;
}

interface Props {
  id: string;
  emoji: string;
  label: string;
  value: number | undefined;
  saved: boolean;
  locked?: boolean;
  onUnlock?: () => void;
  onChange: (value: number) => void;
  onTap?: () => void;
  showTooltip?: boolean;
}

export function NeedSlider({ id, label, value, onChange, onTap, locked, onUnlock }: Props) {
  const color = COLORS[id] ?? '#888';
  const hasValue = value !== undefined;
  const pct = hasValue ? value * 10 : 0;
  const delta = hasValue ? value - (YESTERDAY[id] ?? 0) : null;
  const trackRef = useRef<HTMLDivElement>(null);

  const calcValue = useCallback((clientX: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onChange(Math.round(pct * 10));
  }, [onChange]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    calcValue(e.clientX);
  }, [calcValue]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons === 0) return;
    calcValue(e.clientX);
  }, [calcValue]);

  return (
    <div style={{ marginBottom: 20 }}>
      {/* Top row: icon block + label/hint + score/delta */}
      <div onClick={onTap} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, cursor: onTap ? 'pointer' : 'default' }}>
        {/* Colored icon box */}
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: color + '1f',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <NeedIcon id={id} color={color} />
        </div>

        {/* Name + hint */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)', lineHeight: 1.2 }}>{label}</div>
          <div style={{ fontSize: 11, color: 'var(--text-sub)', marginTop: 3 }}>
            {HINTS[id] ?? ''}
          </div>
        </div>

        {/* "?" hint icon */}
        <div style={{ flexShrink: 0 }}>
          <div style={{
            width: 18, height: 18, borderRadius: '50%',
            background: 'rgba(var(--fg-rgb),0.08)',
            color: 'var(--text-sub)',
            fontSize: 11, fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>?</div>
        </div>

        {/* Score + edit button or delta */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          {locked ? (
            <div
              onClick={(e) => { e.stopPropagation(); onUnlock?.(); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: color + '18',
                border: `1px solid ${color}33`,
                borderRadius: 8, padding: '3px 8px',
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 15, fontWeight: 600, color }}>{value}</span>
              <span style={{ fontSize: 10, color: 'var(--text-sub)' }}>/10</span>
              <span style={{ fontSize: 11, color: color + 'aa', marginLeft: 2 }}>✎</span>
            </div>
          ) : hasValue ? (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                <span style={{ fontSize: 17, fontWeight: 600, color }}>{value}</span>
                <span style={{ fontSize: 12, color: 'var(--text-sub)' }}>/10</span>
              </div>
              {delta !== null && <DeltaBadge delta={delta} />}
            </>
          ) : (
            <span style={{ fontSize: 15, color: 'var(--text-faint)' }}>—</span>
          )}
        </div>
      </div>

      {/* Slider track — disabled when locked, active when unlocked */}
      <div
        ref={trackRef}
        onPointerDown={locked ? undefined : handlePointerDown}
        onPointerMove={locked ? undefined : handlePointerMove}
        style={{
          position: 'relative',
          padding: '12px 0',
          cursor: locked ? 'default' : 'pointer',
          touchAction: locked ? 'auto' : 'none',
          userSelect: 'none',
        }}
      >
        {/* Track */}
        <div style={{ height: 6, borderRadius: 6, background: 'rgba(var(--fg-rgb),0.07)', overflow: 'hidden' }}>
          <div style={{
            width: `${pct}%`,
            height: '100%',
            borderRadius: 6,
            background: locked
              ? `linear-gradient(to right, ${color}33, ${color}55)`
              : `linear-gradient(to right, ${color}55, ${color})`,
          }} />
        </div>

        {/* Yesterday reference marker */}
        {!locked && (YESTERDAY[id] ?? 0) > 0 && (
          <div style={{
            position: 'absolute',
            left: `${(YESTERDAY[id] ?? 0) * 10}%`,
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 2,
            height: 16,
            borderRadius: 1,
            background: hasValue ? `${color}40` : `${color}70`,
            pointerEvents: 'none',
            zIndex: 2,
          }} />
        )}

        {/* Thumb — always visible; dimmed when locked */}
        {!locked && (
          <div style={{
            position: 'absolute',
            left: `${pct}%`,
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: hasValue ? color : 'rgba(var(--fg-rgb),0.25)',
            border: '2px solid var(--bg)',
            pointerEvents: 'none',
            zIndex: 1,
          }} />
        )}
        {locked && hasValue && (
          <div style={{
            position: 'absolute',
            left: `${pct}%`,
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: color,
            border: '2px solid var(--bg)',
            pointerEvents: 'none',
            zIndex: 1,
            opacity: 0.45,
          }} />
        )}
      </div>
    </div>
  );
}
