import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react';

export interface ModeNodeData {
  label: string;
  note?: string;
  unmetNeed?: string;
  customColor?: string;
  filled?: boolean;
  fillFull?: boolean;
  copingSubtype?: 'over' | 'avoid' | 'surr';  // overcompensation | avoidance | surrender
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

function AllHandles() {
  return (
    <>
      <Handle type="target" position={Position.Left}   style={handleStyle} id="l" />
      <Handle type="source" position={Position.Right}  style={handleStyle} id="r" />
      <Handle type="target" position={Position.Top}    style={handleStyle} id="t" />
      <Handle type="source" position={Position.Bottom} style={handleStyle} id="b" />
    </>
  );
}

function hexToRgb(hex: string) {
  const m = hex.replace('#', '').match(/.{2}/g);
  return m ? `${parseInt(m[0],16)},${parseInt(m[1],16)},${parseInt(m[2],16)}` : null;
}

function bgColor(color: string, filled?: boolean, fillFull?: boolean) {
  const rgb = hexToRgb(color);
  const op  = fillFull ? 0.9 : filled ? 0.22 : 0.08;
  return rgb ? `rgba(${rgb},${op})` : `rgba(var(--fg-rgb),${op})`;
}

function NodeLabel({ label, note, light }: { label: string; note?: string; light?: boolean }) {
  return (
    <div style={{ textAlign: 'center', padding: '4px 6px' }}>
      <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.35, wordBreak: 'break-word',
        color: light ? 'rgba(255,255,255,0.95)' : 'var(--text)' }}>{label}</div>
      {note && <div style={{ fontSize: 11, marginTop: 3, lineHeight: 1.3, wordBreak: 'break-word',
        color: light ? 'rgba(255,255,255,0.75)' : 'var(--text-sub)' }}>{note}</div>}
    </div>
  );
}

// ── Circle node ───────────────────────────────────────────────────────────────
export const ChildModeNode = function ChildModeNode({ data, selected }: NodeProps) {
  const d = data as unknown as ModeNodeData;
  const color = d.customColor ?? TYPE_COLORS.child;
  const light = !!d.fillFull;
  return (
    // outer div fills React Flow container (set by NodeResizer)
    <div style={{ width: '100%', height: '100%', minWidth: 110, minHeight: 110, position: 'relative' }}>
      <NodeResizer minWidth={80} minHeight={80} isVisible={!!selected} color={color} />
      <AllHandles />
      <div style={{
        width: '100%', height: '100%',
        borderRadius: '50%', overflow: 'hidden',
        background: bgColor(color, d.filled, d.fillFull),
        border: `2px solid ${selected ? 'var(--accent)' : color}`,
        boxShadow: selected ? '0 0 0 3px rgba(77,71,153,0.22)' : '0 2px 8px rgba(0,0,0,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <NodeLabel label={d.label} note={d.note} light={light} />
      </div>
    </div>
  );
};

// ── Rect-based nodes ──────────────────────────────────────────────────────────
function makeRectNode(defaultColor: string, radius: number | string = 10, usePentagon = false) {
  return function ModeNode({ data, selected }: NodeProps) {
    const d = data as unknown as ModeNodeData;
    const color = d.customColor ?? defaultColor;
    const light = !!d.fillFull;
    return (
      <div style={{ width: '100%', height: '100%', minWidth: 110, minHeight: 44, position: 'relative' }}>
        <NodeResizer minWidth={80} minHeight={36} isVisible={!!selected} color={color} />
        <AllHandles />
        <div style={{
          width: '100%', height: '100%',
          borderRadius: typeof radius === 'number' ? radius : undefined,
          clipPath: usePentagon ? 'polygon(50% 0%,100% 38%,82% 100%,18% 100%,0% 38%)' : undefined,
          background: bgColor(color, d.filled, d.fillFull),
          border: `2px solid ${selected ? 'var(--accent)' : color}`,
          boxShadow: selected ? '0 0 0 3px rgba(77,71,153,0.22)' : '0 2px 8px rgba(0,0,0,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
          padding: usePentagon ? '20% 10% 12% 10%' : undefined,
        }}>
          <NodeLabel label={d.label} note={d.note} light={light} />
        </div>
      </div>
    );
  };
}

// Critic: chamfered octagon — rigid, institutional, cuts all corners
export const CriticModeNode = function CriticModeNode({ data, selected }: NodeProps) {
  const d = data as unknown as ModeNodeData;
  const color = d.customColor ?? TYPE_COLORS.critic;
  const light = !!d.fillFull;
  return (
    <div style={{ width: '100%', height: '100%', minWidth: 110, minHeight: 50, position: 'relative' }}>
      <NodeResizer minWidth={80} minHeight={40} isVisible={!!selected} color={color} />
      <AllHandles />
      <div style={{
        width: '100%', height: '100%',
        clipPath: 'polygon(14% 0%,86% 0%,100% 14%,100% 86%,86% 100%,14% 100%,0% 86%,0% 14%)',
        background: bgColor(color, d.filled, d.fillFull),
        border: `2px solid ${selected ? 'var(--accent)' : color}`,
        boxShadow: selected ? '0 0 0 3px rgba(77,71,153,0.22)' : '0 2px 8px rgba(0,0,0,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
        padding: '10% 12%',
      }}>
        <NodeLabel label={d.label} note={d.note} light={light} />
      </div>
    </div>
  );
};
export const HealthyModeNode = makeRectNode(TYPE_COLORS.healthy, 10);
export const CustomModeNode  = makeRectNode(TYPE_COLORS.custom,  10);

// Three coping subtypes with distinct shapes
const COPING_CLIPS = {
  over:  'polygon(50% 0%,100% 38%,82% 100%,18% 100%,0% 38%)',         // pentagon — aggression
  avoid: 'polygon(0% 0%,100% 0%,100% 72%,50% 100%,0% 72%)',           // shield — protection/withdrawal
  surr:  undefined,  // soft ellipse via border-radius
};

export const CopingModeNode = function CopingModeNode({ data, selected }: NodeProps) {
  const d = data as unknown as ModeNodeData;
  const color = d.customColor ?? TYPE_COLORS.coping;
  const light = !!d.fillFull;
  const sub = d.copingSubtype ?? 'over';
  const clip = COPING_CLIPS[sub];
  const radius = sub === 'surr' ? 9999 : 0;
  return (
    <div style={{ width: '100%', height: '100%', minWidth: 110, minHeight: 56, position: 'relative' }}>
      <NodeResizer minWidth={80} minHeight={40} isVisible={!!selected} color={color} />
      <AllHandles />
      <div style={{
        width: '100%', height: '100%',
        borderRadius: radius,
        clipPath: clip,
        background: bgColor(color, d.filled, d.fillFull),
        border: `2px solid ${selected ? 'var(--accent)' : color}`,
        boxShadow: selected ? '0 0 0 3px rgba(77,71,153,0.22)' : '0 2px 8px rgba(0,0,0,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
        padding: sub === 'over' ? '22% 10% 10%' : sub === 'avoid' ? '8% 10% 20%' : '8px 14px',
      }}>
        <NodeLabel label={d.label} note={d.note} light={light} />
      </div>
    </div>
  );
};

// ── Cloud node (trigger) ──────────────────────────────────────────────────────
export const TriggerNode = function TriggerNode({ data, selected }: NodeProps) {
  const d = data as unknown as ModeNodeData;
  const color = d.customColor ?? TYPE_COLORS.trigger;
  const light = !!d.fillFull;
  const rgb = hexToRgb(color);
  const fill = rgb ? `rgba(${rgb},${d.fillFull ? 0.85 : d.filled ? 0.2 : 0.09})` : 'rgba(var(--fg-rgb),0.09)';
  const stroke = selected ? 'var(--accent)' : color;
  return (
    <div style={{ width: '100%', height: '100%', minWidth: 130, minHeight: 70, position: 'relative' }}>
      <NodeResizer minWidth={100} minHeight={60} isVisible={!!selected} color={color} />
      <AllHandles />
      <svg viewBox="0 0 100 60" preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
        <path fill={fill} stroke={stroke} strokeWidth="2" vectorEffect="non-scaling-stroke"
          d="M18,52 Q4,52 4,40 Q4,30 13,28 Q11,18 21,16 Q23,7 33,8 Q38,3 46,6 Q52,1 60,5 Q70,2 76,10 Q88,9 92,20 Q100,22 100,33 Q100,45 90,47 Q92,52 82,52 Z" />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '12% 14% 10%',
      }}>
        <NodeLabel label={d.label} note={d.note} light={light} />
      </div>
    </div>
  );
};

// Default node dimensions — ensures circles start square, cloud has landscape ratio
export const NODE_DEFAULT_SIZES: Partial<Record<string, { width: number; height: number }>> = {
  child:   { width: 130, height: 130 },
  trigger: { width: 160, height: 90  },
  coping:  { width: 130, height: 100 },
};

export const NODE_TYPES = {
  trigger: TriggerNode,
  child:   ChildModeNode,
  critic:  CriticModeNode,
  coping:  CopingModeNode,
  healthy: HealthyModeNode,
  custom:  CustomModeNode,
};
