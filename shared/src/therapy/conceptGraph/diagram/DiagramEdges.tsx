import { edgeOpacity } from './diagramFocus';
import type { DiagramEdge, Pt } from './diagramTypes';

const ARROW = 9;
const LABEL_H = 18;
/** Ширина буквы подписи в 11px: подпись рисуется в SVG, где нет автоподгона плашки. */
const CHAR_W = 5.9;

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
 * Линии диаграммы одним слоем SVG: под фигурами. Стрелка — marker своего цвета
 * (context-stroke ещё не везде), подпись — плашка у середины ребра.
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
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <path d={`M0,0 L${ARROW},${ARROW / 2} L0,${ARROW} Z`} fill={c} />
          </marker>
        ))}
      </defs>
      {edges.map((e) => {
        const opacity = edgeOpacity(e, focus);
        const wide = e.kind !== 'feeds' && e.kind !== 'need';
        return (
          <g key={e.id}>
            <path
              data-edge={e.id}
              data-kind={e.kind}
              d={edgePath(e.points)}
              fill="none"
              stroke={e.color}
              strokeWidth={wide ? 2 : 1.5}
              strokeDasharray={e.dashed ? '4 4' : undefined}
              strokeLinecap="round"
              markerEnd={`url(#${marker(e.color)})`}
              style={{ opacity, transition: 'opacity 120ms' }}
            />
            {e.label && e.labelAt && (
              <g
                data-edge-label={e.id}
                style={{ opacity, transition: 'opacity 120ms' }}
                transform={`translate(${e.labelAt.x.toFixed(1)} ${e.labelAt.y.toFixed(1)})`}
              >
                <rect
                  x={-(e.label.length * CHAR_W + 12) / 2}
                  y={-LABEL_H / 2}
                  width={e.label.length * CHAR_W + 12}
                  height={LABEL_H}
                  rx={LABEL_H / 2}
                  fill="var(--surface)"
                  stroke={e.color}
                  strokeOpacity={0.5}
                />
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={11}
                  fill="var(--text-sub)"
                >
                  {e.label}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </>
  );
}
