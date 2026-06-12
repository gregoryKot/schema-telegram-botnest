import { useState, useRef, useLayoutEffect } from 'react';
import { Handle, Position, NodeToolbar, type NodeProps } from '@xyflow/react';
import { useNodeActions } from './modeMapActions';
import { MMIcon } from './modeMapIcons';

export interface ModeNodeData {
  label: string;
  note?: string;
  unmetNeed?: string;
  customColor?: string;
  filled?: boolean;
  fillFull?: boolean;
  copingSubtype?: 'over' | 'avoid' | 'surr';
  display?: 'name' | 'note' | 'full';
  healthyResponse?: string;
  strokeWidth?: 'thin' | 'normal' | 'bold';
  fontSize?: 'sm' | 'md' | 'lg';
  side?: 'A' | 'B';
}

// Node colours now come from the site's earthy palette tokens (index.css --c-*),
// so they're consistent with the rest of the app and adapt to light/dark. Coping
// subtypes share ONE colour (clay) and are told apart by SHAPE, not hue.
export const TYPE_COLORS: Record<string, string> = {
  trigger:  'var(--c-slate)',
  child:    'var(--c-teal)',
  critic:   'var(--c-rose)',
  coping:   'var(--c-clay)',
  healthy:  'var(--c-moss)',
  custom:   'var(--c-plum)',
  behavior: 'var(--c-ochre)',
};

// Connection dots at the 4 sides. Hidden by default, revealed on node hover
// (CSS rule .react-flow__node:hover .mm-handle in index.css) so it's obvious
// you can drag from here to draw a line. connectionRadius makes the drop
// forgiving. Each side has source + target (same id) for loose mode + swap.
// Bigger hit area (18px) so it's easy to grab and start a line; the visible
// dot is drawn via the ::after pseudo in index.css. Source on top of target.
const dotStyle: React.CSSProperties = {
  width: 18, height: 18, background: 'transparent', border: 'none',
};

function SideHandles({ pos, id }: { pos: Position; id: string }) {
  return (
    <>
      <Handle type="target" position={pos} id={id} className="mm-handle" style={dotStyle} />
      <Handle type="source" position={pos} id={id} className="mm-handle" style={dotStyle} />
    </>
  );
}

// Full-node drop target — only catches pointer events while a connection is being
// drawn (.react-flow.connecting in index.css). Lets you drop a line ANYWHERE on a
// node instead of hunting for a dot. Normal dragging still works (pointer-events:none).
const coverStyle: React.CSSProperties = {
  position: 'absolute', inset: 0, width: '100%', height: '100%',
  minWidth: 0, minHeight: 0, transform: 'none', borderRadius: 'inherit',
  background: 'transparent', border: 'none',
};

function AllHandles() {
  return (
    <>
      <Handle type="target" position={Position.Top} id="c" className="mm-node-target" style={coverStyle} />
      <SideHandles pos={Position.Left}   id="l" />
      <SideHandles pos={Position.Right}  id="r" />
      <SideHandles pos={Position.Top}    id="t" />
      <SideHandles pos={Position.Bottom} id="b" />
    </>
  );
}

const STROKE_CYCLE: ('thin' | 'normal' | 'bold')[] = ['thin', 'normal', 'bold'];
const FONT_CYCLE: ('sm' | 'md' | 'lg')[] = ['sm', 'md', 'lg'];
const next = <T,>(arr: T[], cur: T): T => arr[(arr.indexOf(cur) + 1) % arr.length];

// Contextual toolbar shown above a selected node
function NodeTools({ id, selected, data }: { id: string; selected?: boolean; data?: ModeNodeData }) {
  const actions = useNodeActions();
  if (!actions) return null;
  const sw = data?.strokeWidth ?? 'normal';
  const fz = data?.fontSize ?? 'md';
  const btn: React.CSSProperties = {
    border: 'none', background: 'none', cursor: 'pointer', fontSize: 13,
    padding: '4px 8px', borderRadius: 5, color: 'var(--text-sub)', lineHeight: 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
  const sep = <div style={{ width: 1, alignSelf: 'stretch', background: 'rgba(var(--fg-rgb),0.12)', margin: '2px 1px' }} />;
  return (
    <NodeToolbar isVisible={!!selected} position={Position.Top} offset={8}>
      <div style={{ display: 'flex', gap: 2, padding: 3, borderRadius: 8, alignItems: 'center',
        background: 'var(--bg-elev)', border: '1px solid var(--line-strong)',
        boxShadow: 'var(--shadow-2)' }}>
        <button style={btn} title="Редактировать" onClick={() => actions.edit(id)}><MMIcon name="edit" size={15} /></button>
        {sep}
        <button style={btn} title={`Толщина контура: ${({ thin: 'тонкий', normal: 'обычный', bold: 'жирный' } as const)[sw]} (нажми, чтобы сменить)`}
          onClick={() => actions.patchData(id, { strokeWidth: next(STROKE_CYCLE, sw) })}>
          <span style={{ display: 'inline-block', width: 16, height: sw === 'thin' ? 1.5 : sw === 'bold' ? 4 : 2.5,
            borderRadius: 3, background: 'var(--text-sub)' }} />
        </button>
        <button style={{ ...btn, fontWeight: 700, fontSize: fz === 'sm' ? 11 : fz === 'lg' ? 17 : 14 }}
          title={`Размер текста: ${({ sm: 'мелкий', md: 'средний', lg: 'крупный' } as const)[fz]} (нажми, чтобы сменить)`}
          onClick={() => actions.patchData(id, { fontSize: next(FONT_CYCLE, fz) })}>A</button>
        {sep}
        <button style={btn} title="Дублировать" onClick={() => actions.duplicate(id)}><MMIcon name="copy" size={15} /></button>
        <button style={{ ...btn, color: 'var(--accent-red)' }} title="Удалить" onClick={() => actions.remove(id)}><MMIcon name="trash" size={15} /></button>
      </div>
    </NodeToolbar>
  );
}

// Partner badge for couple maps (А / Б) — small corner chip
function SideBadge({ side }: { side?: 'A' | 'B' }) {
  if (!side) return null;
  const color = side === 'A' ? 'var(--accent-blue)' : 'var(--accent-orange)';
  return (
    <div style={{ position: 'absolute', top: -8, left: -8, zIndex: 4, width: 19, height: 19, borderRadius: '50%',
      background: color, color: '#fff', fontSize: 11, fontWeight: 700, lineHeight: 1,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: '2px solid var(--bg-elev)', pointerEvents: 'none' }}>
      {side === 'A' ? 'А' : 'Б'}
    </div>
  );
}

function hexToRgb(hex: string) {
  const m = hex.replace('#', '').match(/.{2}/g);
  return m ? `${parseInt(m[0],16)},${parseInt(m[1],16)},${parseInt(m[2],16)}` : null;
}

// Accepts both a CSS token (e.g. 'var(--c-teal)') and a legacy stored hex
// ('#7aa3d4' from older saved maps). Tokens use color-mix so the fill stays
// theme-aware; hexes keep the old rgba path for backward compatibility.
function fillColor(color: string, filled?: boolean, fillFull?: boolean) {
  const op = fillFull ? 0.88 : filled ? 0.22 : 0.08;
  if (color.startsWith('#')) {
    const rgb = hexToRgb(color);
    return rgb ? `rgba(${rgb},${op})` : `rgba(var(--fg-rgb),${op})`;
  }
  return `color-mix(in srgb, ${color} ${Math.round(op * 100)}%, transparent)`;
}

// Contour thickness + text size — minimal per-node settings
const STROKE_PX: Record<string, number> = { thin: 1.5, normal: 2.5, bold: 4 };
const strokePx = (d: ModeNodeData) => STROKE_PX[d.strokeWidth ?? 'normal'] ?? 2.5;
const FONT_PX: Record<string, number> = { sm: 11.5, md: 13.5, lg: 16.5 };
const fontPx = (d: ModeNodeData) => FONT_PX[d.fontSize ?? 'md'] ?? 13.5;

function NodeLabel({ id, data, light }: { id?: string; data: ModeNodeData; light?: boolean }) {
  const actions = useNodeActions();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.label);

  const display = data.display ?? 'full';
  const showNote = display !== 'name' && !!data.note;
  const showNeed = display === 'full' && !!data.unmetNeed;
  const showHealthy = display === 'full' && !!data.healthyResponse;

  const startEdit = () => { if (id && actions) { setDraft(data.label); setEditing(true); } };
  const commit = () => { if (id && actions) actions.rename(id, draft.trim() || data.label); setEditing(false); };
  const fs = fontPx(data);
  const subFs = Math.max(10, fs - 2.5);

  return (
    <div style={{ textAlign: 'center', pointerEvents: 'all' }}>
      {editing ? (
        <input autoFocus value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); e.stopPropagation(); }}
          onClick={e => e.stopPropagation()}
          onDoubleClick={e => e.stopPropagation()}
          className="nodrag"
          style={{ width: '90%', fontSize: fs, fontWeight: 600, textAlign: 'center',
            border: '1px solid var(--accent)', borderRadius: 4, background: 'var(--bg-elev)',
            color: 'var(--text)', outline: 'none', padding: '1px 4px' }} />
      ) : (
        <div onDoubleClick={(e) => { e.stopPropagation(); startEdit(); }}
          style={{ fontSize: fs, fontWeight: 600, lineHeight: 1.35, wordBreak: 'break-word', cursor: id ? 'text' : 'default',
            color: light ? 'rgba(255,255,255,0.95)' : 'var(--text)' }}>{data.label}</div>
      )}
      {showNote && <div style={{ fontSize: subFs, marginTop: 3, lineHeight: 1.3, wordBreak: 'break-word',
        color: light ? 'rgba(255,255,255,0.75)' : 'var(--text-sub)' }}>{data.note}</div>}
      {showNeed && <div style={{ fontSize: subFs - 1, marginTop: 4, lineHeight: 1.25, wordBreak: 'break-word', fontStyle: 'italic',
        color: light ? 'rgba(255,255,255,0.7)' : 'var(--accent)' }}>потребность: {data.unmetNeed}</div>}
      {showHealthy && <div style={{ fontSize: subFs - 1, marginTop: 4, lineHeight: 1.3, wordBreak: 'break-word',
        color: light ? 'rgba(255,255,255,0.8)' : 'var(--c-moss)' }}>🌿 {data.healthyResponse}</div>}
    </div>
  );
}

// ── SVG-based shape node — content-hug: the box sizes to the TEXT, the shape (SVG)
// fills it, so the label is always inside. non-scaling-stroke keeps the border even
// on any aspect. No fixed size / resizer → text can never overflow the figure.
// Scale a path string (coords in a base viewBox) to pixel coords (x,y alternating).
function scalePath(d: string, sx: number, sy: number): string {
  let i = 0;
  return d.replace(/-?\d+(\.\d+)?/g, n => (parseFloat(n) * (i++ % 2 === 0 ? sx : sy)).toFixed(2));
}

function SvgShapeNode({ id, data, selected, color, svgPath, viewBox = '0 0 100 100', textPadding, minW = 116, minH = 64, maxW = 210 }: {
  id: string; data: ModeNodeData; selected?: boolean; color: string;
  svgPath: string; viewBox?: string;
  textPadding: string;   // px padding so text stays off the angled/curved edges
  minW?: number; minH?: number; maxW?: number;
}) {
  const stroke = selected ? 'var(--accent)' : color;
  const fill = fillColor(color, data.filled, data.fillFull);
  const light = !!data.fillFull;

  // Render the contour 1:1 in real pixels (no non-uniform scaling) → the stroke is
  // EXACTLY the same thickness on every side. We measure the box and rebuild the path.
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setSize({ w: el.offsetWidth, h: el.offsetHeight });   // measure before paint (no flicker)
    const ro = new ResizeObserver(() => setSize({ w: el.offsetWidth, h: el.offsetHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const [, , bw, bh] = viewBox.split(/\s+/).map(Number);
  const ready = size.w > 0 && size.h > 0;
  const d = ready ? scalePath(svgPath, size.w / bw, size.h / bh) : svgPath;

  return (
    <div ref={ref} style={{ position: 'relative', width: 'max-content', maxWidth: maxW, minWidth: minW, minHeight: minH,
      display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>
      <NodeTools id={id} selected={selected} data={data} />
      <SideBadge side={data.side} />
      <AllHandles />
      <svg viewBox={ready ? `0 0 ${size.w} ${size.h}` : viewBox} preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}>
        <path d={d} fill={fill} stroke={stroke} strokeWidth={strokePx(data)}
          strokeLinejoin="round" strokeLinecap="round" shapeRendering="geometricPrecision" />
      </svg>
      <div style={{ position: 'relative', padding: textPadding, pointerEvents: 'none', boxSizing: 'border-box' }}>
        <NodeLabel id={id} data={data} light={light} />
      </div>
    </div>
  );
}

// ── Rect-based nodes — hug the text ───────────────────────────────────────────
function makeRectNode(defaultColor: string, radius = 10) {
  return function ModeNode({ id, data, selected }: NodeProps) {
    const d = data as unknown as ModeNodeData;
    const color = d.customColor ?? defaultColor;
    const light = !!d.fillFull;
    return (
      <div style={{ position: 'relative', width: 'max-content', minWidth: 110, maxWidth: 260, minHeight: 40 }}>
        <NodeTools id={id} selected={selected} data={d} />
        <SideBadge side={d.side} />
        <AllHandles />
        <div style={{
          borderRadius: radius,
          background: fillColor(color, d.filled, d.fillFull),
          border: `${strokePx(d)}px solid ${selected ? 'var(--accent)' : color}`,
          boxShadow: selected ? '0 0 0 3px var(--accent-line)' : 'var(--shadow-1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden', padding: '10px 16px', boxSizing: 'border-box',
        }}>
          <NodeLabel id={id} data={d} light={light} />
        </div>
      </div>
    );
  };
}

// ── Named SVG paths (viewBox 0 0 100 100 unless noted) ────────────────────────
const CRITIC_PATH   = 'M29.3,0 L70.7,0 L100,29.3 L100,70.7 L70.7,100 L29.3,100 L0,70.7 L0,29.3 Z';
const PENTA_PATH    = 'M50,2 L97.6,36.6 L79.4,92.4 L20.6,92.4 L2.4,36.6 Z';
const SHIELD_PATH   = 'M4,4 L96,4 L96,62 Q96,78 50,96 Q4,78 4,62 Z';
const BEHAVIOR_PATH = 'M2,2 L80,2 L98,50 L80,98 L2,98 Z';  // right-pointing tag — outcome
const TRIGGER_PATH  = 'M18,52 Q4,52 4,40 Q4,30 13,28 Q11,18 21,16 Q23,7 33,8 Q38,3 46,6 Q52,1 60,5 Q70,2 76,10 Q88,9 92,20 Q100,22 100,33 Q100,45 90,47 Q92,52 82,52 Z';

// ── Exported nodes ────────────────────────────────────────────────────────────
export const CriticModeNode = function CriticModeNode({ id, data, selected }: NodeProps) {
  const d = data as unknown as ModeNodeData;
  return <SvgShapeNode id={id} data={d} selected={selected}
    color={d.customColor ?? TYPE_COLORS.critic}
    svgPath={CRITIC_PATH} textPadding="16px 24px" minW={120} minH={86} maxW={210} />;
};

export const CopingModeNode = function CopingModeNode({ id, data, selected }: NodeProps) {
  const d = data as unknown as ModeNodeData;
  const color = d.customColor ?? TYPE_COLORS.coping;
  const sub = d.copingSubtype ?? 'over';

  if (sub === 'surr') {
    // Pill (capsule) — hugs text
    const light = !!d.fillFull;
    return (
      <div style={{ position: 'relative', width: 'max-content', maxWidth: 220, minWidth: 130 }}>
        <NodeTools id={id} selected={selected} data={d} />
        <SideBadge side={d.side} />
        <AllHandles />
        <div style={{
          minWidth: 130, borderRadius: 9999,
          background: fillColor(color, d.filled, d.fillFull),
          border: `${strokePx(d)}px solid ${selected ? 'var(--accent)' : color}`,
          boxShadow: selected ? '0 0 0 3px var(--accent-line)' : 'var(--shadow-1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden', padding: '10px 22px', boxSizing: 'border-box',
        }}>
          <NodeLabel id={id} data={d} light={light} />
        </div>
      </div>
    );
  }

  if (sub === 'avoid') {
    // Shield: point at bottom — extra bottom padding
    return <SvgShapeNode id={id} data={d} selected={selected} color={color}
      svgPath={SHIELD_PATH} textPadding="14px 18px 30px" minW={122} minH={120} maxW={200} />;
  }

  // 'over' — pentagon: apex at top — extra top padding
  return <SvgShapeNode id={id} data={d} selected={selected} color={color}
    svgPath={PENTA_PATH} textPadding="30px 20px 14px" minW={122} minH={116} maxW={200} />;
};

export const ChildModeNode = function ChildModeNode({ id, data, selected }: NodeProps) {
  const d = data as unknown as ModeNodeData;
  const color = d.customColor ?? TYPE_COLORS.child;
  const light = !!d.fillFull;
  // Ellipse/circle (CSS border-radius) — hugs text; outer hosts handles (not clipped)
  return (
    <div style={{ position: 'relative', width: 'max-content', maxWidth: 200, minWidth: 118 }}>
      <NodeTools id={id} selected={selected} data={d} />
      <SideBadge side={d.side} />
      <AllHandles />
      <div style={{
        minWidth: 118, minHeight: 118, borderRadius: '50%', overflow: 'hidden',
        background: fillColor(color, d.filled, d.fillFull),
        border: `${strokePx(d)}px solid ${selected ? 'var(--accent)' : color}`,
        boxShadow: selected ? '0 0 0 3px var(--accent-line)' : 'var(--shadow-1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px 28px', boxSizing: 'border-box',
      }}>
        <NodeLabel id={id} data={d} light={light} />
      </div>
    </div>
  );
};

export const TriggerNode = function TriggerNode({ id, data, selected }: NodeProps) {
  const d = data as unknown as ModeNodeData;
  return <SvgShapeNode id={id} data={d} selected={selected}
    color={d.customColor ?? TYPE_COLORS.trigger}
    svgPath={TRIGGER_PATH} viewBox="0 0 100 60" textPadding="18px 22px 14px" minW={132} minH={76} maxW={210} />;
};

export const HealthyModeNode = makeRectNode(TYPE_COLORS.healthy, 10);
export const CustomModeNode  = makeRectNode(TYPE_COLORS.custom,  10);

export const BehaviorNode = function BehaviorNode({ id, data, selected }: NodeProps) {
  const d = data as unknown as ModeNodeData;
  return <SvgShapeNode id={id} data={d} selected={selected}
    color={d.customColor ?? TYPE_COLORS.behavior}
    svgPath={BEHAVIOR_PATH} textPadding="12px 30px 12px 16px" minW={120} minH={56} maxW={220} />;
};

// Nodes auto-size to their content now — no fixed sizes.
export const NODE_DEFAULT_SIZES: Partial<Record<string, { width: number; height: number }>> = {};

export const NODE_TYPES = {
  trigger:  TriggerNode,
  child:    ChildModeNode,
  critic:   CriticModeNode,
  coping:   CopingModeNode,
  healthy:  HealthyModeNode,
  custom:   CustomModeNode,
  behavior: BehaviorNode,
};
