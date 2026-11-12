import { useEffect, useRef, useState } from 'react';
import { useViewport } from '@xyflow/react';
import { MMIcon } from './modeMapIcons';
import '../styles/sheet-modemap.css';
import '../styles/modemap-paper.css';

// Couple "Mode Cycle Clash" lanes: Partner A on the left, Partner B on the right.
// Дорожки — бумага двух оттенков (небо 240 и персик 45, не ближе 40°) в координатах холста;
// подписи партнёров — листки тех же оттенков в полосе под тулбаром, всегда под рукой.
const A_HUE = 240, B_HUE = 45;
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
    const hue = { '--h': side === 'a' ? A_HUE : B_HUE } as React.CSSProperties;
    const val = side === 'a' ? names.a : names.b;
    return editing === side ? (
      <input ref={inputRef} defaultValue={val}
        onBlur={e => { save({ ...names, [side]: e.target.value.trim() || (side === 'a' ? 'Партнёр А' : 'Партнёр Б') }); setEditing(null); }}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditing(null); }}
        className="ds-input mm2-lane-input" style={hue} />
    ) : (
      <button onDoubleClick={() => setEditing(side)} onClick={() => setEditing(side)} title="Переименовать партнёра" aria-label="Переименовать партнёра"
        className="mm2-lane-chip" style={hue}>
        <i />
        {val}
      </button>
    );
  };

  return (
    <>
      {/* Дорожки — два листа бумаги в координатах холста (styles/modemap-paper.css) */}
      <div className="mm2-lanes">
        <div style={{ transform: `translate(${x}px, ${y}px) scale(${zoom})` }}>
          <div className="mm2-lane is-a" style={{ left: -SPAN, top: -SPAN, width: SPAN, height: SPAN * 2 }} />
          <div className="mm2-lane is-b" style={{ left: 0, top: -SPAN, width: SPAN, height: SPAN * 2 }} />
        </div>
      </div>
      {/* Editable partner chips — fixed top bar */}
      <div className="mm2-lane-bar">
        <div className="mm2-lane-chips">
          {chip('a')}
          <MMIcon name="swap" size={14} className="mm2-lane-sep" />
          {chip('b')}
        </div>
      </div>
    </>
  );
}
