import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react';

export interface ModeNodeData {
  label: string;
  note?: string;
  unmetNeed?: string;
  customColor?: string;
  filled?: boolean;
  fillFull?: boolean;
  copingSubtype?: 'over' | 'avoid' | 'surr';
}

export const TYPE_COLORS: Record<string, string> = {
  trigger: '#94a3b8',
  child:   '#7aa3d4',
  critic:  '#d47a7a',
  coping:  '#d4a07a',
  healthy: '#7ab87a',
  custom:  '#9f7ad4',
};

const handleStyle = { width: 9, height: 9, background: 'rgba(var(--fg-rgb),0.25)', border: 'none' };
const hiddenHandleStyle = { ...handleStyle, opacity: 0, pointerEvents: 'none' as const };

// Each of the 4 sides has BOTH a source and target handle with the same id.
// This lets any side act as source OR target (needed for direction swap +
// loose-mode dragging). The source handle is shown; the target is invisible
// but stacked at the same spot.
function SideHandles({ pos, id }: { pos: Position; id: string }) {
  return (
    <>
      <Handle type="target" position={pos} id={id} style={hiddenHandleStyle} />
      <Handle type="source" position={pos} id={id} style={handleStyle} />
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

function hexToRgb(hex: string) {
  const m = hex.replace('#', '').match(/.{2}/g);
  return m ? `${parseInt(m[0],16)},${parseInt(m[1],16)},${parseInt(m[2],16)}` : null;
}

function fillColor(color: string, filled?: boolean, fillFull?: boolean) {
  const rgb = hexToRgb(color);
  const op = fillFull ? 0.88 : filled ? 0.22 : 0.08;
  return rgb ? `rgba(${rgb},${op})` : `rgba(var(--fg-rgb),${op})`;
}

function NodeLabel({ label, note, unmetNeed, light }: { label: string; note?: string; unmetNeed?: string; light?: boolean }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.35, wordBreak: 'break-word',
        color: light ? 'rgba(255,255,255,0.95)' : 'var(--text)' }}>{label}</div>
      {note && <div style={{ fontSize: 11, marginTop: 3, lineHeight: 1.3, wordBreak: 'break-word',
        color: light ? 'rgba(255,255,255,0.75)' : 'var(--text-sub)' }}>{note}</div>}
      {unmetNeed && <div style={{ fontSize: 10, marginTop: 4, lineHeight: 1.25, wordBreak: 'break-word', fontStyle: 'italic',
        color: light ? 'rgba(255,255,255,0.7)' : 'var(--accent)' }}>нужда: {unmetNeed}</div>}
    </div>
  );
}

// ── SVG-based shape node — clean borders, no clip-path/border conflicts ────────
// Text sits in an absolutely positioned div, constrained to the safe inner area.
function SvgShapeNode({ data, selected, color, svgPath, textPadding, minW = 110, minH = 60, resizer = true }: {
  data: ModeNodeData; selected?: boolean; color: string;
  svgPath: string;   // SVG path in "0 0 100 100" viewBox space
  textPadding: string; // CSS padding for text container
  minW?: number; minH?: number; resizer?: boolean;
}) {
  const stroke = selected ? 'var(--accent)' : color;
  const fill = fillColor(color, data.filled, data.fillFull);
  const light = !!data.fillFull;
  return (
    <div style={{ width: '100%', height: '100%', minWidth: minW, minHeight: minH, position: 'relative' }}>
      {resizer && <NodeResizer minWidth={minW - 30} minHeight={minH - 20} isVisible={!!selected} color={color} />}
      <AllHandles />
      {/* SVG shape — fill + stroke, no clip-path issues */}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
        <path d={svgPath} fill={fill} stroke={stroke} strokeWidth="2" vectorEffect="non-scaling-stroke"
          filter={!selected ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' : undefined} />
      </svg>
      {/* Text — not clipped, constrained by padding */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: textPadding, pointerEvents: 'none' }}>
        <NodeLabel label={data.label} note={data.note} light={light} />
      </div>
    </div>
  );
}

// ── Rect-based nodes (rectangle, no clip-path) ────────────────────────────────
function makeRectNode(defaultColor: string, radius = 10) {
  return function ModeNode({ data, selected }: NodeProps) {
    const d = data as unknown as ModeNodeData;
    const color = d.customColor ?? defaultColor;
    const light = !!d.fillFull;
    return (
      <div style={{ width: '100%', height: '100%', minWidth: 110, minHeight: 44, position: 'relative' }}>
        <NodeResizer minWidth={80} minHeight={36} isVisible={!!selected} color={color} />
        <AllHandles />
        <div style={{
          width: '100%', height: '100%', borderRadius: radius,
          background: fillColor(color, d.filled, d.fillFull),
          border: `2px solid ${selected ? 'var(--accent)' : color}`,
          boxShadow: selected ? '0 0 0 3px rgba(77,71,153,0.22)' : '0 2px 8px rgba(0,0,0,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden', padding: '10px 14px',
        }}>
          <NodeLabel label={d.label} note={d.note} unmetNeed={d.unmetNeed} light={light} />
        </div>
      </div>
    );
  };
}

// ── Named SVG paths (viewBox 0 0 100 100) ─────────────────────────────────────
const CRITIC_PATH   = 'M12,0 L88,0 L100,12 L100,88 L88,100 L12,100 L0,88 L0,12 Z';
const PENTA_PATH    = 'M50,0 L100,38 L82,100 L18,100 L0,38 Z';
const SHIELD_PATH   = 'M0,0 L100,0 L100,70 L50,100 L0,70 Z';

// ── Exported nodes ────────────────────────────────────────────────────────────
export const CriticModeNode = function CriticModeNode({ data, selected }: NodeProps) {
  const d = data as unknown as ModeNodeData;
  return <SvgShapeNode data={d} selected={selected}
    color={d.customColor ?? TYPE_COLORS.critic}
    svgPath={CRITIC_PATH} textPadding="10% 14%" minW={110} minH={50} />;
};

export const CopingModeNode = function CopingModeNode({ data, selected }: NodeProps) {
  const d = data as unknown as ModeNodeData;
  const color = d.customColor ?? TYPE_COLORS.coping;
  const sub = d.copingSubtype ?? 'over';

  if (sub === 'surr') {
    // Capsule/ellipse — no SVG needed, border-radius handles it
    const light = !!d.fillFull;
    return (
      <div style={{ width: '100%', height: '100%', minWidth: 110, minHeight: 44, position: 'relative' }}>
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
          <NodeLabel label={d.label} note={d.note} light={light} />
        </div>
      </div>
    );
  }

  if (sub === 'avoid') {
    return <SvgShapeNode data={d} selected={selected} color={color}
      svgPath={SHIELD_PATH} textPadding="10% 12% 34%" minW={110} minH={80} />;
  }

  // 'over' — pentagon
  return <SvgShapeNode data={d} selected={selected} color={color}
    svgPath={PENTA_PATH} textPadding="26% 14% 10%" minW={110} minH={80} />;
};

export const ChildModeNode = function ChildModeNode({ data, selected }: NodeProps) {
  const d = data as unknown as ModeNodeData;
  const color = d.customColor ?? TYPE_COLORS.child;
  const light = !!d.fillFull;
  return (
    <div style={{ width: '100%', height: '100%', minWidth: 110, minHeight: 110, position: 'relative' }}>
      <NodeResizer minWidth={80} minHeight={80} isVisible={!!selected} color={color} />
      <AllHandles />
      <div style={{
        width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden',
        background: fillColor(color, d.filled, d.fillFull),
        border: `2px solid ${selected ? 'var(--accent)' : color}`,
        boxShadow: selected ? '0 0 0 3px rgba(77,71,153,0.22)' : '0 2px 8px rgba(0,0,0,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <NodeLabel label={d.label} note={d.note} unmetNeed={d.unmetNeed} light={light} />
      </div>
    </div>
  );
};

export const TriggerNode = function TriggerNode({ data, selected }: NodeProps) {
  const d = data as unknown as ModeNodeData;
  const color = d.customColor ?? TYPE_COLORS.trigger;
  const rgb = hexToRgb(color);
  const fill = rgb ? `rgba(${rgb},${d.fillFull ? 0.85 : d.filled ? 0.2 : 0.09})` : 'rgba(var(--fg-rgb),0.09)';
  const stroke = selected ? 'var(--accent)' : color;
  const light = !!d.fillFull;
  return (
    <div style={{ width: '100%', height: '100%', minWidth: 130, minHeight: 70, position: 'relative' }}>
      <NodeResizer minWidth={100} minHeight={60} isVisible={!!selected} color={color} />
      <AllHandles />
      <svg viewBox="0 0 100 60" preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
        <path fill={fill} stroke={stroke} strokeWidth="2" vectorEffect="non-scaling-stroke"
          d="M18,52 Q4,52 4,40 Q4,30 13,28 Q11,18 21,16 Q23,7 33,8 Q38,3 46,6 Q52,1 60,5 Q70,2 76,10 Q88,9 92,20 Q100,22 100,33 Q100,45 90,47 Q92,52 82,52 Z" />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: '12% 14% 10%', pointerEvents: 'none' }}>
        <NodeLabel label={d.label} note={d.note} light={light} />
      </div>
    </div>
  );
};

export const HealthyModeNode = makeRectNode(TYPE_COLORS.healthy, 10);
export const CustomModeNode  = makeRectNode(TYPE_COLORS.custom,  10);

export const NODE_DEFAULT_SIZES: Partial<Record<string, { width: number; height: number }>> = {
  child:   { width: 130, height: 130 },
  trigger: { width: 160, height: 90  },
  coping:  { width: 140, height: 110 },
};

export const NODE_TYPES = {
  trigger: TriggerNode,
  child:   ChildModeNode,
  critic:  CriticModeNode,
  coping:  CopingModeNode,
  healthy: HealthyModeNode,
  custom:  CustomModeNode,
};
