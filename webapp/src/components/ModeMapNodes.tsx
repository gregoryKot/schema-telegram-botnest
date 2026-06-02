import { Handle, Position, type NodeProps } from '@xyflow/react';

export interface ModeNodeData {
  label: string;
  note?: string;
  unmetNeed?: string;
  customColor?: string;
  filled?: boolean;
}

// Default colors per type
export const TYPE_COLORS: Record<string, string> = {
  trigger: 'rgba(var(--fg-rgb),0.4)',
  child:   '#7aa3d4',
  critic:  '#d47a7a',
  coping:  '#d4a07a',
  healthy: '#7ab87a',
  custom:  '#7a7ad4',
};

const handleStyle = {
  width: 9, height: 9,
  background: 'rgba(var(--fg-rgb),0.25)',
  border: 'none',
};

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

function BaseNode({ children, borderColor, bgOpacity = 0.08, shape = 'rect', selected }: {
  children: React.ReactNode;
  borderColor: string;
  bgOpacity?: number;
  shape?: 'rect' | 'circle';
  selected?: boolean;
}) {
  // Parse hex color to rgba for fill — fallback to semi-transparent
  const fillRgb = hexToRgb(borderColor);
  const bg = fillRgb
    ? `rgba(${fillRgb},${bgOpacity})`
    : `rgba(var(--fg-rgb),${bgOpacity})`;
  const border = selected ? 'var(--accent)' : borderColor;

  return (
    <div style={{
      background: bg,
      border: `2px solid ${border}`,
      borderRadius: shape === 'circle' ? '50%' : 10,
      width:    shape === 'circle' ? 130 : 'auto',
      height:   shape === 'circle' ? 130 : 'auto',
      minWidth: shape === 'circle' ? undefined : 140,
      maxWidth: shape === 'circle' ? undefined : 190,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: shape === 'circle' ? 0 : '10px 14px',
      boxShadow: selected
        ? '0 0 0 3px rgba(77,71,153,0.25)'
        : '0 2px 8px rgba(0,0,0,0.1)',
      cursor: 'default',
      userSelect: 'none',
    }}>
      {children}
    </div>
  );
}

function hexToRgb(hex: string): string | null {
  const m = hex.replace('#', '').match(/.{2}/g);
  if (!m || m.length < 3) return null;
  return `${parseInt(m[0], 16)},${parseInt(m[1], 16)},${parseInt(m[2], 16)}`;
}

function NodeLabel({ label, note }: { label: string; note?: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3 }}>{label}</div>
      {note && <div style={{ fontSize: 11, color: 'var(--text-sub)', marginTop: 4, lineHeight: 1.3 }}>{note}</div>}
    </div>
  );
}

function makeNode(defaultColor: string, shape: 'rect' | 'circle' = 'rect') {
  return function ModeNode({ data, selected }: NodeProps) {
    const d = data as unknown as ModeNodeData;
    const color = d.customColor ?? defaultColor;
    const fillOpacity = d.filled ? 0.18 : 0.08;
    return (
      <BaseNode borderColor={color} bgOpacity={fillOpacity} shape={shape} selected={selected}>
        <AllHandles />
        <NodeLabel label={d.label} note={d.note} />
      </BaseNode>
    );
  };
}

export const TriggerNode = function TriggerNode({ data, selected }: NodeProps) {
  const d = data as unknown as ModeNodeData;
  const color = d.customColor ?? TYPE_COLORS.trigger;
  return (
    <BaseNode borderColor={color} bgOpacity={d.filled ? 0.15 : 0.06} shape="rect" selected={selected}>
      <AllHandles />
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 18, marginBottom: 2 }}>⚡</div>
        <NodeLabel label={d.label} note={d.note} />
      </div>
    </BaseNode>
  );
};

export const ChildModeNode  = makeNode(TYPE_COLORS.child,   'circle');
export const CriticModeNode = makeNode(TYPE_COLORS.critic,  'rect');
export const CopingModeNode = makeNode(TYPE_COLORS.coping,  'rect');
export const HealthyModeNode= makeNode(TYPE_COLORS.healthy, 'rect');
export const CustomModeNode = makeNode(TYPE_COLORS.custom,  'rect');

export const NODE_TYPES = {
  trigger: TriggerNode,
  child:   ChildModeNode,
  critic:  CriticModeNode,
  coping:  CopingModeNode,
  healthy: HealthyModeNode,
  custom:  CustomModeNode,
};
