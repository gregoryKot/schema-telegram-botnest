import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react';

export interface ModeNodeData {
  label: string;
  note?: string;
  unmetNeed?: string;
  customColor?: string;
  filled?: boolean;
  fillFull?: boolean;
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
  const m = hex.replace('#','').match(/.{2}/g);
  if (!m) return null;
  return `${parseInt(m[0],16)},${parseInt(m[1],16)},${parseInt(m[2],16)}`;
}

function NodeLabel({ label, note }: { label: string; note?: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '2px 4px' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', lineHeight: 1.35, wordBreak: 'break-word' }}>{label}</div>
      {note && <div style={{ fontSize: 11, color: 'var(--text-sub)', marginTop: 3, lineHeight: 1.3, wordBreak: 'break-word' }}>{note}</div>}
    </div>
  );
}

// ── Rect-based nodes (critic, coping, healthy, custom) ────────────────────────
function RectNode({ data, selected, color, shape = 'rounded' }: {
  data: ModeNodeData; selected?: boolean; color: string; shape?: 'rounded' | 'sharp' | 'pentagon';
}) {
  const rgb = hexToRgb(color);
  const fillOpacity = data.fillFull ? 1 : data.filled ? 0.22 : 0.09;
  const bg = rgb ? `rgba(${rgb},${fillOpacity})` : `rgba(var(--fg-rgb),${fillOpacity})`;
  const border = `2px solid ${selected ? 'var(--accent)' : color}`;

  const clipPath = shape === 'pentagon'
    ? 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)'
    : undefined;
  const borderRadius = shape === 'sharp' ? 4 : shape === 'rounded' ? 10 : 0;

  return (
    <div style={{
      background: bg, border, borderRadius,
      clipPath,
      minWidth: 120, maxWidth: 200,
      padding: shape === 'pentagon' ? '28px 20px 14px' : '10px 14px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: selected ? '0 0 0 3px rgba(77,71,153,0.25)' : '0 2px 8px rgba(0,0,0,0.1)',
      cursor: 'default', userSelect: 'none', position: 'relative',
    }}>
      <NodeResizer minWidth={80} minHeight={36} isVisible={!!selected} color={color} />
      <AllHandles />
      <NodeLabel label={data.label} note={data.note} />
    </div>
  );
}

// ── Circle node (child modes) ─────────────────────────────────────────────────
function CircleNode({ data, selected, color }: { data: ModeNodeData; selected?: boolean; color: string }) {
  const rgb = hexToRgb(color);
  const fillOpacity = data.fillFull ? 1 : data.filled ? 0.22 : 0.09;
  const bg = rgb ? `rgba(${rgb},${fillOpacity})` : `rgba(var(--fg-rgb),${fillOpacity})`;
  const textColor = data.fillFull ? '#fff' : 'var(--text)';
  return (
    <div style={{
      background: bg,
      border: `2px solid ${selected ? 'var(--accent)' : color}`,
      borderRadius: '50%',
      width: 130, height: 130,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: selected ? '0 0 0 3px rgba(77,71,153,0.25)' : '0 2px 8px rgba(0,0,0,0.1)',
      cursor: 'default', userSelect: 'none', position: 'relative',
      color: textColor,
    }}>
      <NodeResizer minWidth={80} minHeight={80} isVisible={!!selected} color={color} />
      <AllHandles />
      <NodeLabel label={data.label} note={data.note} />
    </div>
  );
}

// ── Cloud node (trigger) ──────────────────────────────────────────────────────
function CloudNode({ data, selected, color }: { data: ModeNodeData; selected?: boolean; color: string }) {
  const rgb = hexToRgb(color);
  const fillOpacity = data.fillFull ? 0.85 : data.filled ? 0.18 : 0.08;
  const bg = rgb ? `rgba(${rgb},${fillOpacity})` : 'rgba(var(--fg-rgb),0.08)';
  return (
    <div style={{ position: 'relative', width: 160, height: 90 }}>
      <NodeResizer minWidth={120} minHeight={70} isVisible={!!selected} color={color} />
      <AllHandles />
      <svg viewBox="0 0 160 90" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <path
          d="M30,70 Q10,70 10,55 Q10,42 22,40 Q20,28 32,26 Q34,14 48,14 Q56,8 66,12 Q72,6 82,8 Q94,4 102,14 Q116,12 122,24 Q136,24 138,38 Q150,40 150,54 Q150,70 132,70 Z"
          fill={bg}
          stroke={selected ? 'var(--accent)' : color}
          strokeWidth="2"
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '10px 18px',
      }}>
        <NodeLabel label={data.label} note={data.note} />
      </div>
    </div>
  );
}

// ── Node components ───────────────────────────────────────────────────────────
function makeRectNode(defaultColor: string, shape: 'rounded' | 'sharp' | 'pentagon' = 'rounded') {
  return function ModeNode({ data, selected }: NodeProps) {
    const d = data as unknown as ModeNodeData;
    return <RectNode data={d} selected={selected} color={d.customColor ?? defaultColor} shape={shape} />;
  };
}

export const TriggerNode = function TriggerNode({ data, selected }: NodeProps) {
  const d = data as unknown as ModeNodeData;
  return <CloudNode data={d} selected={selected} color={d.customColor ?? TYPE_COLORS.trigger} />;
};
export const ChildModeNode   = function ChildModeNode({ data, selected }: NodeProps) {
  const d = data as unknown as ModeNodeData;
  return <CircleNode data={d} selected={selected} color={d.customColor ?? TYPE_COLORS.child} />;
};
export const CriticModeNode  = makeRectNode(TYPE_COLORS.critic,  'sharp');
export const CopingModeNode  = makeRectNode(TYPE_COLORS.coping,  'pentagon');
export const HealthyModeNode = makeRectNode(TYPE_COLORS.healthy, 'rounded');
export const CustomModeNode  = makeRectNode(TYPE_COLORS.custom,  'rounded');

export const NODE_TYPES = {
  trigger: TriggerNode,
  child:   ChildModeNode,
  critic:  CriticModeNode,
  coping:  CopingModeNode,
  healthy: HealthyModeNode,
  custom:  CustomModeNode,
};
