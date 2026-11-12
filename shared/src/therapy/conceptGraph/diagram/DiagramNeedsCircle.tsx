import type { DiagramCircle } from './diagramTypes';

/** Круг базовых потребностей и его подпись: слой SVG под фигурами и линиями. */
export function DiagramNeedsCircle({
  circle,
  titleY,
}: {
  circle: DiagramCircle;
  /** Высота середины подписи. */
  titleY: number;
}) {
  return (
    <>
      <circle
        data-needs-circle
        cx={circle.cx}
        cy={circle.cy}
        r={circle.r}
        fill="var(--surface)"
        stroke="var(--line-strong)"
        strokeWidth={1.5}
      />
      <text
        x={circle.cx}
        y={titleY}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={12}
        fontWeight={700}
        fill="var(--text)"
      >
        {circle.title}
      </text>
    </>
  );
}
