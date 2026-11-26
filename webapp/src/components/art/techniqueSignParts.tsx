// Общие детали знаков техник (TechniqueSigns*.tsx): реплика с хвостиком и линия земли —
// те же пропорции, что у мотивов Talk и Horizon.
import { PAPER } from './paper';

/** Реплика: овал с хвостиком вниз-влево (`l`) или вниз-вправо (`r`); пропорции хвостика — как у Talk. */
export function Bubble({ cx, cy, rx, ry, fill, tail, opacity }: {
  cx: number; cy: number; rx: number; ry: number; fill: string; tail: 'l' | 'r'; opacity?: number;
}) {
  const k = tail === 'l' ? -1 : 1;
  const d = `M${cx + k * rx * 0.59} ${cy + ry * 0.8} L ${cx + k * rx * 0.76} ${cy + ry * 1.4} L ${cx + k * rx * 0.18} ${cy + ry * 0.9} Z`;
  return (
    <g fill={fill} fillOpacity={opacity}>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} />
      <path d={d} />
    </g>
  );
}

/** Линия земли: на ней стоит полоска — живая сила. */
export function Ground({ y = 56 }: { y?: number }) {
  return <path d={`M8 ${y} H112`} fill="none" strokeLinecap="round" stroke={PAPER.sage} strokeWidth="5" />;
}
