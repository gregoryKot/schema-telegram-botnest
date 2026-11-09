// Обложки статей о пути в терапию: подходит ли метод, первая встреча, сколько длится, как
// растёт Здоровый Взрослый (docs/design/PAPER_2026-11.md, таблица «Обложки статей»).
// Холст и правила те же, что в ArticleScenesMethod.tsx; какая сцена у какой статьи —
// articleCoverScenes.ts.
import { INK } from './scenePaper';
import { Lift, SceneSvg } from './sceneKit';

/** Оттенок бумаги — из articleCoverModel.ts: у сцены своего по умолчанию нет, источник один. */
type CoverProps = { hue: number };
const GROUND = { stroke: INK.sage, strokeWidth: 7, strokeLinecap: 'round' } as const;
const LEAF = 'M26 58 C 26 24, 56 8, 100 8 C 100 44, 70 60, 26 58 Z';
const VEIN = 'M30 56 C 48 44, 70 30, 96 12';

/** «Подходит ли мне»: весы. Слева давние слои, справа один камешек — взвесить, что у вас:
 *  повторяющийся с детства паттерн или точечная история, где первым идёт другой метод. */
export function CoverScales({ hue }: CoverProps) {
  return (
    <SceneSvg hue={hue} sheet={null}>
      <Lift>
        <path d="M24 222 H296" {...GROUND} />
        <path d="M160 132 L 198 214 H 122 Z" fill={INK.sage} stroke={INK.sage} strokeWidth="12" strokeLinejoin="round" />
        <g transform="rotate(-9 160 126)">
          <rect x="28" y="120" width="264" height="12" rx="6" fill={INK.brown} />
          <rect x="34" y="94" width="104" height="26" rx="13" fill={INK.sage} />
          <rect x="48" y="68" width="76" height="26" rx="13" fill={INK.moss} />
          <rect x="62" y="42" width="48" height="26" rx="13" fill={INK.clay} />
          <ellipse cx="252" cy="106" rx="22" ry="14" fill={INK.clay} />
        </g>
      </Lift>
    </SceneSvg>
  );
}

/** Строки вопроса и плашки ответов опросника (вторая выбрана) — как у карточки SceneQuiz. */
const QUESTION = [{ y: 66, w: 92 }, { y: 86, w: 60 }];
const ANSWERS = [{ y: 114, fill: INK.brown, op: '.14' }, { y: 146, fill: INK.moss, op: '1' }, { y: 178, fill: INK.brown, op: '.14' }];

/** «Первая сессия»: карточка опросника и две реплики — разговор и анкета. */
export function CoverFirstSession({ hue }: CoverProps) {
  return (
    <SceneSvg hue={hue} sheet={null}>
      <Lift by={6}>
        <g transform="rotate(-8 106 132)">
          <rect x="34" y="40" width="144" height="188" rx="20" fill={INK.sheet} />
          {QUESTION.map((l) => <rect key={l.y} x="58" y={l.y} width={l.w} height="10" rx="5" fill={INK.brown} fillOpacity=".3" />)}
          {ANSWERS.map((a) => <rect key={a.y} x="56" y={a.y} width="104" height="22" rx="11" fill={a.fill} fillOpacity={a.op} />)}
        </g>
        <ellipse cx="226" cy="84" rx="76" ry="48" fill={INK.sage} />
        <path d="M194 124 L 176 160 L 220 130 Z" fill={INK.sage} />
        <ellipse cx="244" cy="174" rx="60" ry="38" fill={INK.clay} />
        <path d="M268 204 L 284 234 L 246 210 Z" fill={INK.clay} />
      </Lift>
    </SceneSvg>
  );
}

/** Три растения: полоска и листья, с каждым этапом выше. `leaves` — где лист и его поворот. */
const STAGES = [
  { x: 50, w: 26, h: 60, leaves: ['translate(76 196) scale(.5) translate(-26 -58)'] },
  { x: 140, w: 28, h: 124, leaves: ['translate(140 158) scale(.7) scale(-1 1) translate(-26 -58)'] },
  {
    x: 236, w: 30, h: 188,
    leaves: ['translate(266 86) scale(.62) translate(-26 -58)', 'translate(236 138) scale(.76) scale(-1 1) translate(-26 -58)'],
  },
];

/** «Сколько длится»: три этапа — росток, полоска с листом, высокая полоска с двумя. */
export function CoverStages({ hue }: CoverProps) {
  return (
    <SceneSvg hue={hue} sheet={null}>
      <Lift>
        <path d="M20 222 H300" {...GROUND} />
        {STAGES.map((s) => (
          <g key={s.x}>
            <rect x={s.x} y={218 - s.h} width={s.w} height={s.h} rx={s.w / 2} fill={INK.moss} />
            {s.leaves.map((t) => <path key={t} d={LEAF} transform={t} fill={INK.moss} />)}
          </g>
        ))}
      </Lift>
      {STAGES.flatMap((s) => s.leaves).map((t) => (
        <path key={t} d={VEIN} transform={t} fill="none" stroke={INK.sage} strokeWidth="7" strokeLinecap="round" />
      ))}
    </SceneSvg>
  );
}

/** Круги повторений на одной земле — каждый следующий крупнее (радиус), последний — Здоровый
 *  Взрослый, внутри которого вырос лист. */
const GROWTH = [{ cx: 29, r: 7 }, { cx: 55, r: 11 }, { cx: 90, r: 16 }, { cx: 138, r: 24 }] as const;
const BIG = { cx: 234, r: 64 } as const;

/** «Откуда берётся Здоровый Взрослый»: повторение растит — круги мха на одной земле, каждый
 *  крупнее, и большой круг с листом внутри (знак Grown). */
export function CoverGrowth({ hue }: CoverProps) {
  const leaf = `translate(${BIG.cx} ${218 - BIG.r}) scale(1.06) translate(-63 -33)`;
  return (
    <SceneSvg hue={hue} sheet={null}>
      <Lift>
        <path d="M20 222 H300" {...GROUND} />
        {GROWTH.map((b) => <circle key={b.cx} cx={b.cx} cy={218 - b.r} r={b.r} fill={INK.moss} />)}
        <circle cx={BIG.cx} cy={218 - BIG.r} r={BIG.r} fill={INK.moss} />
      </Lift>
      <path d={LEAF} transform={leaf} fill={INK.sage} />
      <path d={VEIN} transform={leaf} fill="none" stroke={INK.moss} strokeWidth="6" strokeLinecap="round" />
    </SceneSvg>
  );
}
