import { edgeOpacity } from './diagramFocus';
import type { DiagramEdge, Pt } from './diagramTypes';

const ARROW = 9;
const BADGE_R = 11;

/** Цепочка кубических кривых → строка пути. */
export function edgePath(points: Pt[]): string {
  const f = (p: Pt) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  let d = `M${f(points[0])}`;
  for (let i = 1; i + 2 < points.length; i += 3) {
    d += ` C${f(points[i])} ${f(points[i + 1])} ${f(points[i + 2])}`;
  }
  return d;
}

/**
 * Значок на линии: красный ✗ — схема блокирует потребность, зелёный ✓ —
 * потребность, о которой уже умеют заботиться. Знак нарисован путём, а не
 * символом: он одинаков в любом шрифте и не зависит от эмодзи платформы.
 */
function Badge({ at, kind }: { at: Pt; kind: 'block' | 'meet' }) {
  const block = kind === 'block';
  return (
    <g
      data-badge={kind}
      transform={`translate(${at.x.toFixed(1)} ${at.y.toFixed(1)})`}
    >
      <circle
        r={BADGE_R}
        fill={block ? 'var(--accent-red)' : 'var(--accent-green)'}
        stroke="var(--surface)"
        strokeWidth={2}
      />
      <path
        d={block ? 'M-4,-4 L4,4 M4,-4 L-4,4' : 'M-4.5,0.5 L-1.5,3.5 L4.5,-3.5'}
        fill="none"
        stroke={block ? 'var(--on-accent-red)' : 'var(--on-accent)'}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

/**
 * Линии диаграммы одним слоем SVG: под фигурами. Стрелка — marker своего цвета
 * (context-stroke ещё не везде); у связи режим ⇄ схема стрелки на обоих концах.
 */
export function DiagramEdges({
  edges,
  focus,
  uid,
}: {
  edges: DiagramEdge[];
  focus: string | null;
  uid: string;
}) {
  const colors = [...new Set(edges.map((e) => e.color))];
  const marker = (color: string) => `${uid}-arrow-${colors.indexOf(color)}`;
  return (
    <>
      <defs>
        {colors.map((c) => (
          <marker
            key={c}
            id={marker(c)}
            viewBox={`0 0 ${ARROW} ${ARROW}`}
            markerWidth={ARROW}
            markerHeight={ARROW}
            refX={ARROW - 1}
            refY={ARROW / 2}
            orient="auto-start-reverse"
            markerUnits="userSpaceOnUse"
          >
            <path d={`M0,0 L${ARROW},${ARROW / 2} L0,${ARROW} Z`} fill={c} />
          </marker>
        ))}
      </defs>
      {edges.map((e) => {
        const opacity = edgeOpacity(e, focus);
        const url = `url(#${marker(e.color)})`;
        return (
          <g key={e.id}>
            <path
              data-edge={e.id}
              data-kind={e.kind}
              d={edgePath(e.points)}
              fill="none"
              stroke={e.color}
              strokeWidth={e.kind === 'blocks' || e.kind === 'meets' ? 2 : 1.5}
              strokeLinecap="round"
              markerEnd={url}
              markerStart={e.both ? url : undefined}
              style={{ opacity, transition: 'opacity 120ms' }}
            />
            {e.badge && (
              <g style={{ opacity, transition: 'opacity 120ms' }}>
                <Badge at={e.badge.at} kind={e.badge.kind} />
              </g>
            )}
          </g>
        );
      })}
    </>
  );
}
