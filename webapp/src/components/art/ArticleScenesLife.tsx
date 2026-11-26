// Обложки статей о привязанности, выгорании, «нет» и самозванце (docs/design/PAPER_MOTIFS_2026-11.md,
// таблица «Обложки статей»). Холст и правила те же, что в ArticleScenesMethod.tsx; какая сцена у
// какой статьи — articleCoverScenes.ts.
import { INK } from './scenePaper';
import { Lift, SceneSvg } from './sceneKit';

/** Оттенок бумаги — из articleCoverModel.ts: у сцены своего по умолчанию нет, источник один. */
type CoverProps = { hue: number };
const GROUND = { stroke: INK.sage, strokeWidth: 7, strokeLinecap: 'round' } as const;
/** Лист с текстом: строки — бледный тон бумаги, как в CoverMended. */
const LINE = { fill: INK.brown, fillOpacity: 0.24 } as const;

/** Пары полосок: наклон вокруг основания на земле (y 218). */
const PAIRS = [
  { x: 38, h: 130, deg: 0, fill: INK.slate },
  { x: 74, h: 122, deg: -16, fill: INK.clay },
  { x: 128, h: 150, deg: 0, fill: INK.moss },
  { x: 166, h: 138, deg: 0, fill: INK.clay },
  { x: 222, h: 126, deg: 0, fill: INK.slate },
  { x: 254, h: 112, deg: 16, fill: INK.plum },
];

/** «Типы привязанности»: три пары. Одна полоска приникла к другой (тревожная), две стоят рядом
 *  с просветом (надёжная), одна отклонилась прочь (избегающая): дистанция в близости. */
export function CoverAttach({ hue }: CoverProps) {
  return (
    <SceneSvg hue={hue} sheet={null}>
      <Lift>
        <path d="M20 222 H300" {...GROUND} />
        {PAIRS.map((p) => (
          <rect key={p.x} x={p.x} y={218 - p.h} width="26" height={p.h} rx="13" fill={p.fill} transform={`rotate(${p.deg} ${p.x + 13} 218)`} />
        ))}
      </Lift>
    </SceneSvg>
  );
}

const PILE = [0, 6, -4, 8, -2, 10, 4].map((dx, i) => ({ dx, y: 202 - i * 16, deg: [-2, 3, -1, 4, -3, 2, 5][i] }));
// Не ниже ширины полоски (20): короче скругление сплющивает её в овал.
const NEEDS = [{ v: 28, fill: INK.moss }, { v: 20, fill: INK.amber }, { v: 36, fill: INK.slate }, { v: 20, fill: INK.clay }, { v: 24, fill: INK.plum }];

/** «Выгорание»: высокая стопка дел, а рядом пять полосок потребностей почти пусты — силы уходят
 *  в «надо», на отдых, игру и близость не остаётся. */
export function CoverDrained({ hue }: CoverProps) {
  return (
    <SceneSvg hue={hue} sheet={null}>
      <Lift>
        <path d="M20 222 H300" {...GROUND} />
        {PILE.map((s) => <rect key={s.y} x={34 + s.dx} y={s.y} width="108" height="14" rx="4" fill={INK.sheet} transform={`rotate(${s.deg} ${88 + s.dx} ${s.y + 7})`} />)}
      </Lift>
      {NEEDS.map((n, i) => (
        <g key={n.fill}>
          <rect x={176 + i * 26} y="90" width="20" height="128" rx="10" fill={INK.hollow} />
          <rect x={176 + i * 26} y={218 - n.v} width="20" height={n.v} rx="10" fill={n.fill} />
        </g>
      ))}
    </SceneSvg>
  );
}

/** Лист-просьба: прямоугольник с двумя строками. */
function Ask({ x, y, deg }: { x: number; y: number; deg: number }) {
  return (
    <g transform={`rotate(${deg} ${x + 28} ${y + 21})`}>
      <rect x={x} y={y} width="56" height="42" rx="8" fill={INK.sheet} />
      <rect x={x + 10} y={y + 12} width="36" height="6" rx="3" {...LINE} />
      <rect x={x + 10} y={y + 24} width="24" height="6" rx="3" {...LINE} />
    </g>
  );
}

/** «Не умею говорить нет»: своя рамка (`Limits`), в ней полоска стоит прямо; просьбы летят
 *  со всех сторон и остаются снаружи — у рамки, а не на плечах. */
export function CoverNo({ hue }: CoverProps) {
  return (
    <SceneSvg hue={hue} sheet={null}>
      <Lift>
        <path d="M20 222 H300" {...GROUND} />
        <rect x="46" y="48" width="92" height="168" rx="24" fill="none" stroke={INK.moss} strokeWidth="12" />
        <rect x="78" y="84" width="28" height="122" rx="14" fill={INK.clay} />
        <Ask x={236} y={40} deg={12} />
        <Ask x={168} y={98} deg={-10} />
        <Ask x={222} y={170} deg={4} />
      </Lift>
    </SceneSvg>
  );
}

// Плиты одной ширины вразнобой (стопка, а не сужающаяся «пирамидка» — пойманное прочтение).
const PODIUM = [
  { dx: -8, fill: INK.amber },
  { dx: 6, fill: INK.moss },
  { dx: -4, fill: INK.slate },
  { dx: 10, fill: INK.clay },
];

/** «Синдром самозванца»: стопка настоящих успехов — плотная и цветная, а полоска на ней —
 *  пунктир с пустотой внутри, у самого края: «я здесь случайно, сейчас заметят». */
export function CoverImpostor({ hue }: CoverProps) {
  return (
    <SceneSvg hue={hue} sheet={null}>
      <Lift>
        <path d="M20 222 H300" {...GROUND} />
        {PODIUM.map((s, i) => <rect key={s.fill} x={64 + s.dx} y={196 - i * 24} width="192" height="22" rx="6" fill={s.fill} />)}
      </Lift>
      <rect x="196" y="32" width="28" height="92" rx="14" fill={INK.hollow} stroke={INK.clay} strokeWidth="5" strokeDasharray="10 8" transform="rotate(8 210 124)" />
    </SceneSvg>
  );
}
