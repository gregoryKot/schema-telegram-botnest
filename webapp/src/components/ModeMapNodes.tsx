import { useState, useRef, useLayoutEffect } from 'react';
import type { NodeProps } from '@xyflow/react';
import { TYPE_COLORS } from './modeMapData';
import {
  BEHAVIOR_PATH,
  CRITIC_PATH,
  PENTA_PATH,
  SHIELD_PATH,
  TRIGGER_PATH,
  scalePath,
} from '../../../shared/src/modeMap/modeShapes';
import { fillColor, strokePx, type ModeNodeData } from './modeMap/nodeStyle';
import { AllHandles, NodeLabel, NodeTools, SideBadge } from './modeMap/nodeParts';
import { RectNode } from './modeMap/RectNode';

// TYPE_COLORS/NODE_DEFAULT_SIZES/NODE_TYPES вынесены в modeMapData.ts / modeMapRegistry.ts — этот файл экспортирует только компоненты.
// Общие части фигур (тулбар, ручки, подпись, стиль) — modeMap/nodeParts.tsx и nodeStyle.ts.

// ── SVG-based shape node — content-hug: the box sizes to the TEXT, the shape (SVG)
// fills it, so the label is always inside. non-scaling-stroke keeps the border even
// on any aspect. No fixed size / resizer → text can never overflow the figure.
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

// Прямоугольные фигуры — общий RectNode (его же берут фигуры схемы случая).
export function HealthyModeNode(props: NodeProps) {
  return <RectNode {...props} defaultColor={TYPE_COLORS.healthy} />;
}
export function CustomModeNode(props: NodeProps) {
  return <RectNode {...props} defaultColor={TYPE_COLORS.custom} />;
}

export const BehaviorNode = function BehaviorNode({ id, data, selected }: NodeProps) {
  const d = data as unknown as ModeNodeData;
  return <SvgShapeNode id={id} data={d} selected={selected}
    color={d.customColor ?? TYPE_COLORS.behavior}
    svgPath={BEHAVIOR_PATH} textPadding="12px 30px 12px 16px" minW={120} minH={56} maxW={220} />;
};

// Nodes auto-size to their content now — no fixed sizes.