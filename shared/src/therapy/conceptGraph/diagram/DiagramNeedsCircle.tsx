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
        fill="color-mix(in srgb, var(--accent) 6%, transparent)"
        stroke="color-mix(in srgb, var(--accent) 45%, transparent)"
        strokeWidth={2}
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
