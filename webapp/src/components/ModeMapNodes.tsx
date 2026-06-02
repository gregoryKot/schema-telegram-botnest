import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';

interface ModeNodeData {
  label: string;
  note?: string;
  unmetNeed?: string;
  selected?: boolean;
}

const handleStyle = {
  width: 10,
  height: 10,
  background: 'rgba(var(--fg-rgb),0.3)',
  border: 'none',
};

function BaseNode({
  children,
  borderColor,
  bgColor,
  shape = 'rect',
  selected,
}: {
  children: React.ReactNode;
  borderColor: string;
  bgColor: string;
  shape?: 'rect' | 'circle';
  selected?: boolean;
}) {
  const isCircle = shape === 'circle';
  return (
    <div style={{
      background: bgColor,
      border: `2px solid ${selected ? 'var(--accent)' : borderColor}`,
      borderRadius: isCircle ? '50%' : 10,
      width: isCircle ? 130 : 'auto',
      height: isCircle ? 130 : 'auto',
      minWidth: isCircle ? undefined : 140,
      maxWidth: isCircle ? undefined : 180,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: isCircle ? 0 : '10px 14px',
      boxShadow: selected ? `0 0 0 3px rgba(77,71,153,0.25)` : '0 2px 8px rgba(0,0,0,0.12)',
      cursor: 'default',
      userSelect: 'none',
    }}>
      {children}
    </div>
  );
}

function NodeLabel({ label, note }: { label: string; note?: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3 }}>{label}</div>
      {note && <div style={{ fontSize: 11, color: 'var(--text-sub)', marginTop: 4, lineHeight: 1.3 }}>{note}</div>}
    </div>
  );
}

export function TriggerNode({ data, selected }: NodeProps<ModeNodeData>) {
  return (
    <BaseNode borderColor="rgba(var(--fg-rgb),0.35)" bgColor="rgba(var(--fg-rgb),0.06)" selected={selected}>
      <Handle type="target" position={Position.Left} style={handleStyle} />
      <Handle type="source" position={Position.Right} style={handleStyle} />
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 18, marginBottom: 2 }}>⚡</div>
        <NodeLabel label={data.label} note={data.note} />
      </div>
    </BaseNode>
  );
}

export function ChildModeNode({ data, selected }: NodeProps<ModeNodeData>) {
  return (
    <BaseNode borderColor="var(--accent-blue)" bgColor="rgba(100,130,200,0.08)" shape="circle" selected={selected}>
      <Handle type="target" position={Position.Left} style={handleStyle} />
      <Handle type="source" position={Position.Right} style={handleStyle} />
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <NodeLabel label={data.label} note={data.note} />
    </BaseNode>
  );
}

export function CriticModeNode({ data, selected }: NodeProps<ModeNodeData>) {
  return (
    <BaseNode borderColor="var(--accent-red)" bgColor="rgba(200,80,80,0.07)" selected={selected}>
      <Handle type="target" position={Position.Left} style={handleStyle} />
      <Handle type="source" position={Position.Right} style={handleStyle} />
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <NodeLabel label={data.label} note={data.note} />
    </BaseNode>
  );
}

export function CopingModeNode({ data, selected }: NodeProps<ModeNodeData>) {
  return (
    <BaseNode borderColor="var(--accent-orange)" bgColor="rgba(180,120,60,0.07)" selected={selected}>
      <Handle type="target" position={Position.Left} style={handleStyle} />
      <Handle type="source" position={Position.Right} style={handleStyle} />
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <NodeLabel label={data.label} note={data.note} />
    </BaseNode>
  );
}

export function HealthyModeNode({ data, selected }: NodeProps<ModeNodeData>) {
  return (
    <BaseNode borderColor="var(--accent-green)" bgColor="rgba(70,150,100,0.07)" selected={selected}>
      <Handle type="target" position={Position.Left} style={handleStyle} />
      <Handle type="source" position={Position.Right} style={handleStyle} />
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <NodeLabel label={data.label} note={data.note} />
    </BaseNode>
  );
}

export function CustomModeNode({ data, selected }: NodeProps<ModeNodeData>) {
  return (
    <BaseNode borderColor="var(--accent)" bgColor="rgba(77,71,153,0.07)" selected={selected}>
      <Handle type="target" position={Position.Left} style={handleStyle} />
      <Handle type="source" position={Position.Right} style={handleStyle} />
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <NodeLabel label={data.label} note={data.note} />
    </BaseNode>
  );
}

export const NODE_TYPES = {
  trigger: TriggerNode,
  child: ChildModeNode,
  critic: CriticModeNode,
  coping: CopingModeNode,
  healthy: HealthyModeNode,
  custom: CustomModeNode,
};
