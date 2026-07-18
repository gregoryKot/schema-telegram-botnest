import { useEffect, useRef, useState } from 'react';
import { useViewport } from '@xyflow/react';

// Couple "Mode Cycle Clash" lanes: Partner A on the left, Partner B on the right.
// The tinted bands live in flow coordinates (pan/zoom with the canvas); the editable
// name chips are a fixed top bar so they stay reachable.
const A_COLOR = 'var(--accent-blue)';
const B_COLOR = 'var(--accent-orange)';
const SPAN = 4000;

function nameKey(mapId: number) { return `modemap_couple_${mapId}`; }
function readNames(mapId: number): { a: string; b: string } {
  try { const v = JSON.parse(localStorage.getItem(nameKey(mapId)) ?? '{}'); return { a: v.a || 'Партнёр А', b: v.b || 'Партнёр Б' }; }
  catch { return { a: 'Партнёр А', b: 'Партнёр Б' }; }
}

export function ModeMapCoupleLanes({ mapId }: { mapId: number }) {
  const { x, y, zoom } = useViewport();
  const [names, setNames] = useState(() => readNames(mapId));
  const [editing, setEditing] = useState<'a' | 'b' | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const save = (next: { a: string; b: string }) => {
    setNames(next);
    try { localStorage.setItem(nameKey(mapId), JSON.stringify(next)); } catch { /* ignore */ }
  };

  const chip = (side: 'a' | 'b') => {
    const color = side === 'a' ? A_COLOR : B_COLOR;
    const val = side === 'a' ? names.a : names.b;
    return editing === side ? (
      <input ref={inputRef} defaultValue={val}
        onBlur={e => { save({ ...names, [side]: e.target.value.trim() || (side === 'a' ? 'Партнёр А' : 'Партнёр Б') }); setEditing(null); }}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditing(null); }}
        style={{ width: 130, fontSize: 12.5, fontWeight: 600, textAlign: 'center', padding: '4px 8px', borderRadius: 999,
          border: `1.5px solid ${color}`, background: 'var(--bg-elev)', color: 'var(--text)', outline: 'none' }} />
    ) : (
      <button onDoubleClick={() => setEditing(side)} onClick={() => setEditing(side)} title="Переименовать партнёра" aria-label="Переименовать партнёра"
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 999, cursor: 'text',
          fontSize: 12.5, fontWeight: 600, color,
          background: `color-mix(in srgb, ${color} 12%, var(--bg-elev))`,
          border: `1px solid color-mix(in srgb, ${color} 40%, transparent)` }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />
        {val}
      </button>
    );
  };

  return (
    <>
      {/* Tinted bands — flow coordinates */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', transformOrigin: '0 0', transform: `translate(${x}px, ${y}px) scale(${zoom})` }}>
          <div style={{ position: 'absolute', left: -SPAN, top: -SPAN, width: SPAN, height: SPAN * 2,
            background: `color-mix(in srgb, ${A_COLOR} 6%, transparent)` }} />
          <div style={{ position: 'absolute', left: 0, top: -SPAN, width: SPAN, height: SPAN * 2,
            background: `color-mix(in srgb, ${B_COLOR} 6%, transparent)` }} />
          <div style={{ position: 'absolute', left: -0.5, top: -SPAN, width: 1, height: SPAN * 2,
            background: 'rgba(var(--fg-rgb),0.12)' }} />
        </div>
      </div>
      {/* Editable partner chips — fixed top bar */}
      <div style={{ position: 'absolute', top: 10, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 10, zIndex: 4, pointerEvents: 'none' }}>
        <div style={{ display: 'flex', gap: 10, pointerEvents: 'all' }}>
          {chip('a')}
          <span style={{ alignSelf: 'center', fontSize: 12, color: 'var(--text-faint)' }}>⇄</span>
          {chip('b')}
        </div>
      </div>
    </>
  );
}
