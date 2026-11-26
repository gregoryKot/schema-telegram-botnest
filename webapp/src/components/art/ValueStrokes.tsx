// Пять полосок-оценок дня — одна разметка на знак `Strokes values` и сегодняшний лист `SceneCheckIn values`:
// по одной на потребность в порядке NEED_ORDER (оценки — dayStrokeValues). Оценённая — цвет данных своей
// потребности (NEED_DATA_PAPER) и длина по оценке (strokeLen); неоценённая (null) — data-rated="no" и пустой
// тон: атрибут PAPER.hollow, а бледный тон своей потребности с кромкой даёт одно правило `.pp-strokes-values`
// (styles/paper.css). Своего «нет оценки → вид» у мест нет: пустой день везде читается пустым.
import { NEED_DATA_PAPER, PAPER } from './paper';
import { STROKE_GEOMS, strokeLen } from './strokeLen';

interface Props {
  values: readonly (number | null)[];
  /** Холст: знак Strokes или сегодняшний лист SceneCheckIn (STROKE_GEOMS). */
  at: keyof typeof STROKE_GEOMS;
  /** Наклон полосок в градусах вокруг их низа (знак Strokes); без него — прямо. */
  tilt?: readonly number[];
}

export function ValueStrokes({ values, at, tilt }: Props) {
  const g = STROKE_GEOMS[at];
  return (
    <g className="pp-strokes-values">
      {values.slice(0, 5).map((v, i) => {
        const h = strokeLen(v, g);
        return (
          <rect
            key={i} data-rated={v == null ? 'no' : 'yes'} data-value={v ?? undefined} color={NEED_DATA_PAPER[i]}
            x={g.x + i * g.step} y={g.foot - h} width={g.w} height={h} rx={g.w / 2}
            fill={v == null ? PAPER.hollow : NEED_DATA_PAPER[i]}
            transform={tilt && `rotate(${tilt[i]} ${g.x + i * g.step + g.w / 2} ${g.foot})`}
          />
        );
      })}
    </g>
  );
}
