import { useState } from 'react';
import { Handle, Position, NodeResizer, NodeToolbar, type NodeProps } from '@xyflow/react';
import { useNodeActions } from './modeMapActions';

export interface ModeNodeData {
  label: string;
  note?: string;
  unmetNeed?: string;
  customColor?: string;
  filled?: boolean;
  fillFull?: boolean;
  copingSubtype?: 'over' | 'avoid' | 'surr';
  display?: 'name' | 'note' | 'full';
}

export const TYPE_COLORS: Record<string, string> = {
  trigger:  '#94a3b8',
  child:    '#7aa3d4',
  critic:   '#d47a7a',
  coping:   '#d4a07a',
  healthy:  '#7ab87a',
  custom:   '#9f7ad4',
  behavior: '#8a8f9e',
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

function AllHandles() {
  return (
    <>
      <SideHandles pos={Position.Left}   id="l" />
      <SideHandles pos={Position.Right}  id="r" />
      <SideHandles pos={Position.Top}    id="t" />
      <SideHandles pos={Position.Bottom} id="b" />
    </>
  );
}

// Contextual toolbar shown above a selected node
function NodeTools({ id, selected }: { id: string; selected?: boolean }) {
  const actions = useNodeActions();
  if (!actions) return null;
  const btn: React.CSSProperties = {
    border: 'none', background: 'none', cursor: 'pointer', fontSize: 13,
    padding: '4px 8px', borderRadius: 5, color: 'var(--text-sub)', lineHeight: 1,
  };
  return (
    <NodeToolbar isVisible={!!selected} position={Position.Top} offset={8}>
      <div style={{ display: 'flex', gap: 2, padding: 3, borderRadius: 8,
        background: 'var(--bg-elev)', border: '1px solid rgba(var(--fg-rgb),0.12)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
        <button style={btn} title="Редактировать" onClick={() => actions.edit(id)}>✎</button>
        <button style={btn} title="Дублировать" onClick={() => actions.duplicate(id)}>⧉</button>
        <button style={{ ...btn, color: 'var(--accent-red)' }} title="Удалить" onClick={() => actions.remove(id)}>🗑</button>
      </div>
    </NodeToolbar>
  );
}

function hexToRgb(hex: string) {
  const m = hex.replace('#', '').match(/.{2}/g);
  return m ? `${parseInt(m[0],16)},${parseInt(m[1],16)},${parseInt(m[2],16)}` : null;
}

function fillColor(color: string, filled?: boolean, fillFull?: boolean) {
  const rgb = hexToRgb(color);
  const op = fillFull ? 0.88 : filled ? 0.22 : 0.08;
  return rgb ? `rgba(${rgb},${op})` : `rgba(var(--fg-rgb),${op})`;
}

function NodeLabel({ id, data, light }: { id?: string; data: ModeNodeData; light?: boolean }) {
  const actions = useNodeActions();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.label);

  const display = data.display ?? 'full';
  const showNote = display !== 'name' && !!data.note;
  const showNeed = display === 'full' && !!data.unmetNeed;

  const startEdit = () => { if (id && actions) { setDraft(data.label); setEditing(true); } };
  const commit = () => { if (id && actions) actions.rename(id, draft.trim() || data.label); setEditing(false); };

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
          style={{ width: '90%', fontSize: 13, fontWeight: 600, textAlign: 'center',
            border: '1px solid var(--accent)', borderRadius: 4, background: 'var(--bg-elev)',
            color: 'var(--text)', outline: 'none', padding: '1px 4px' }} />
      ) : (
        <div onDoubleClick={(e) => { e.stopPropagation(); startEdit(); }}
          style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.35, wordBreak: 'break-word', cursor: id ? 'text' : 'default',
            color: light ? 'rgba(255,255,255,0.95)' : 'var(--text)' }}>{data.label}</div>
      )}
      {showNote && <div style={{ fontSize: 11, marginTop: 3, lineHeight: 1.3, wordBreak: 'break-word',
        color: light ? 'rgba(255,255,255,0.75)' : 'var(--text-sub)' }}>{data.note}</div>}
      {showNeed && <div style={{ fontSize: 10, marginTop: 4, lineHeight: 1.25, wordBreak: 'break-word', fontStyle: 'italic',
        color: light ? 'rgba(255,255,255,0.7)' : 'var(--accent)' }}>нужда: {data.unmetNeed}</div>}
    </div>
  );
}

// ── SVG-based shape node — clean borders, no clip-path/border conflicts ────────
// Text sits in an absolutely positioned div, constrained to the safe inner area.
function SvgShapeNode({ id, data, selected, color, svgPath, textPadding, minW = 110, minH = 60, keepRatio }: {
  id: string; data: ModeNodeData; selected?: boolean; color: string;
  svgPath: string;       // SVG path in "0 0 100 100" viewBox space
  textPadding: string;   // CSS padding for text container
  minW?: number; minH?: number;
  keepRatio?: boolean;   // фиксировать пропорции при ресайзе
}) {
  const stroke = selected ? 'var(--accent)' : color;
  const fill = fillColor(color, data.filled, data.fillFull);
  const light = !!data.fillFull;
  return (
    <div style={{ width: '100%', height: '100%', minWidth: minW, minHeight: minH, position: 'relative' }}>
      <NodeTools id={id} selected={selected} />
      <NodeResizer minWidth={minW - 30} minHeight={minH - 20} isVisible={!!selected} color={color}
        keepAspectRatio={!!keepRatio} />
      <AllHandles />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
        <path d={svgPath} fill={fill} stroke={stroke} strokeWidth="2" vectorEffect="non-scaling-stroke"
          filter={!selected ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' : undefined} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: textPadding, pointerEvents: 'none' }}>
        <NodeLabel id={id} data={data} light={light} />
      </div>
    </div>
  );
}

// ── Rect-based nodes — always hug the text (no manual resize needed) ──────────
function makeRectNode(defaultColor: string, radius = 10) {
  return function ModeNode({ id, data, selected }: NodeProps) {
    const d = data as unknown as ModeNodeData;
    const color = d.customColor ?? defaultColor;
    const light = !!d.fillFull;
    return (
      <div style={{ position: 'relative', width: 'max-content', minWidth: 110, maxWidth: 260, minHeight: 40 }}>
        <NodeTools id={id} selected={selected} />
        <AllHandles />
        <div style={{
          borderRadius: radius,
          background: fillColor(color, d.filled, d.fillFull),
          border: `2px solid ${selected ? 'var(--accent)' : color}`,
          boxShadow: selected ? '0 0 0 3px rgba(77,71,153,0.22)' : '0 2px 8px rgba(0,0,0,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden', padding: '10px 16px', boxSizing: 'border-box',
        }}>
          <NodeLabel id={id} data={d} light={light} />
        </div>
      </div>
    );
  };
}

// ── Named SVG paths (viewBox 0 0 100 100) ─────────────────────────────────────
const CRITIC_PATH   = 'M12,0 L88,0 L100,12 L100,88 L88,100 L12,100 L0,88 L0,12 Z';
const PENTA_PATH    = 'M50,0 L100,38 L82,100 L18,100 L0,38 Z';
const SHIELD_PATH   = 'M0,0 L100,0 L100,70 L50,100 L0,70 Z';
const BEHAVIOR_PATH = 'M0,0 L82,0 L100,50 L82,100 L0,100 Z';  // right-pointing tag — outcome

// ── Exported nodes ────────────────────────────────────────────────────────────
export const CriticModeNode = function CriticModeNode({ id, data, selected }: NodeProps) {
  const d = data as unknown as ModeNodeData;
  // Octagon: corners are 12% chamfers — text safe within ~14% padding, free resize OK
  return <SvgShapeNode id={id} data={d} selected={selected}
    color={d.customColor ?? TYPE_COLORS.critic}
    svgPath={CRITIC_PATH} textPadding="16% 16%" minW={120} minH={60} />;
};

export const CopingModeNode = function CopingModeNode({ id, data, selected }: NodeProps) {
  const d = data as unknown as ModeNodeData;
  const color = d.customColor ?? TYPE_COLORS.coping;
  const sub = d.copingSubtype ?? 'over';

  if (sub === 'surr') {
    // Capsule/ellipse — no SVG needed, border-radius handles it
    const light = !!d.fillFull;
    return (
      <div style={{ width: '100%', height: '100%', minWidth: 110, minHeight: 44, position: 'relative' }}>
        <NodeTools id={id} selected={selected} />
        <NodeResizer minWidth={80} minHeight={36} isVisible={!!selected} color={color} />
        <AllHandles />
        <div style={{
          width: '100%', height: '100%', borderRadius: 9999,
          background: fillColor(color, d.filled, d.fillFull),
          border: `2px solid ${selected ? 'var(--accent)' : color}`,
          boxShadow: selected ? '0 0 0 3px rgba(77,71,153,0.22)' : '0 2px 8px rgba(0,0,0,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden', padding: '8px 18px',
        }}>
          <NodeLabel id={id} data={d} light={light} />
        </div>
      </div>
    );
  }

  if (sub === 'avoid') {
    // Shield: point at bottom — text in upper rectangular zone, keep ratio
    return <SvgShapeNode id={id} data={d} selected={selected} color={color}
      svgPath={SHIELD_PATH} textPadding="14% 14% 32%" minW={120} minH={120} keepRatio />;
  }

  // 'over' — pentagon: apex at top, keep ratio so it doesn't flatten
  return <SvgShapeNode id={id} data={d} selected={selected} color={color}
    svgPath={PENTA_PATH} textPadding="32% 16% 12%" minW={120} minH={120} keepRatio />;
};

export const ChildModeNode = function ChildModeNode({ id, data, selected }: NodeProps) {
  const d = data as unknown as ModeNodeData;
  const color = d.customColor ?? TYPE_COLORS.child;
  const light = !!d.fillFull;
  return (
    <div style={{ width: '100%', height: '100%', minWidth: 110, minHeight: 110, position: 'relative' }}>
      <NodeTools id={id} selected={selected} />
      <NodeResizer minWidth={90} minHeight={90} isVisible={!!selected} color={color} keepAspectRatio />
      <AllHandles />
      <div style={{
        width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden',
        background: fillColor(color, d.filled, d.fillFull),
        border: `2px solid ${selected ? 'var(--accent)' : color}`,
        boxShadow: selected ? '0 0 0 3px rgba(77,71,153,0.22)' : '0 2px 8px rgba(0,0,0,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        // Inscribed square: keep text off the curved edge
        padding: '18%',
      }}>
        <NodeLabel id={id} data={d} light={light} />
      </div>
    </div>
  );
};

export const TriggerNode = function TriggerNode({ id, data, selected }: NodeProps) {
  const d = data as unknown as ModeNodeData;
  const color = d.customColor ?? TYPE_COLORS.trigger;
  const rgb = hexToRgb(color);
  const fill = rgb ? `rgba(${rgb},${d.fillFull ? 0.85 : d.filled ? 0.2 : 0.09})` : 'rgba(var(--fg-rgb),0.09)';
  const stroke = selected ? 'var(--accent)' : color;
  const light = !!d.fillFull;
  return (
    <div style={{ width: '100%', height: '100%', minWidth: 130, minHeight: 70, position: 'relative' }}>
      <NodeTools id={id} selected={selected} />
      <NodeResizer minWidth={100} minHeight={60} isVisible={!!selected} color={color} />
      <AllHandles />
      <svg viewBox="0 0 100 60" preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
        <path fill={fill} stroke={stroke} strokeWidth="2" vectorEffect="non-scaling-stroke"
          d="M18,52 Q4,52 4,40 Q4,30 13,28 Q11,18 21,16 Q23,7 33,8 Q38,3 46,6 Q52,1 60,5 Q70,2 76,10 Q88,9 92,20 Q100,22 100,33 Q100,45 90,47 Q92,52 82,52 Z" />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: '12% 14% 10%', pointerEvents: 'none' }}>
        <NodeLabel id={id} data={d} light={light} />
      </div>
    </div>
  );
};

export const HealthyModeNode = makeRectNode(TYPE_COLORS.healthy, 10);
export const CustomModeNode  = makeRectNode(TYPE_COLORS.custom,  10);

export const BehaviorNode = function BehaviorNode({ id, data, selected }: NodeProps) {
  const d = data as unknown as ModeNodeData;
  return <SvgShapeNode id={id} data={d} selected={selected}
    color={d.customColor ?? TYPE_COLORS.behavior}
    svgPath={BEHAVIOR_PATH} textPadding="14% 22% 14% 12%" minW={120} minH={56} />;
};

export const NODE_DEFAULT_SIZES: Partial<Record<string, { width: number; height: number }>> = {
  child:    { width: 130, height: 130 },
  trigger:  { width: 160, height: 90  },
  coping:   { width: 150, height: 135 },
  critic:   { width: 150, height: 80  },
  behavior: { width: 150, height: 70  },
};

export const NODE_TYPES = {
  trigger:  TriggerNode,
  child:    ChildModeNode,
  critic:   CriticModeNode,
  coping:   CopingModeNode,
  healthy:  HealthyModeNode,
  custom:   CustomModeNode,
  behavior: BehaviorNode,
};
