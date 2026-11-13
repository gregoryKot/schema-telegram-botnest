// Вариант мотива по счёту (значки достижений: полоски серии, листы «дней всего») — геометрия
// из shared/src/share/kit/countedSigns.ts, той же, что рисуют canvas-карточки; сверка —
// webapp/src/share/signsCanvas.test.ts. Здесь только перевод фигур в SVG на бумаге PAPER.
import type { SignDrawing } from '../../../../shared/src/share/kit/signTable';
import { PAPER, type ArtProps } from './paper';
import { PaperSvg as Svg } from './PaperSvg';

export function CountedSign({ drawing, size }: ArtProps & { drawing: SignDrawing }) {
  return (
    <Svg size={size} viewBox={`0 0 ${drawing.view[0]} ${drawing.view[1]}`}>
      {drawing.prims.map((p, i) => p.t === 'rect' && (
        <rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} rx={p.rx}
          fill={p.fill && p.fill !== 'surface' ? PAPER[p.fill] : undefined}
          transform={p.rot ? `rotate(${p.rot.join(' ')})` : undefined} />
      ))}
    </Svg>
  );
}
