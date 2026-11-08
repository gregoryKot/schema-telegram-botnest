// Обложки статей «Помогает ли схема-терапия при…»: травма, тревога и депрессия, перфекционизм
// (docs/design/PAPER_2026-11.md, таблица «Обложки статей»). Холст и правила те же, что в
// ArticleScenesMethod.tsx; какая сцена у какой статьи — articleCoverScenes.ts.
import { INK } from './scenePaper';
import { Lift, SceneSvg } from './sceneKit';

/** Оттенок бумаги — из articleCoverModel.ts: у сцены своего по умолчанию нет, источник один. */
type CoverProps = { hue: number };
const GROUND = { stroke: INK.sage, strokeWidth: 7, strokeLinecap: 'round' } as const;

/** Строки истории на листе (y и длина) и трещина через весь лист сверху вниз. */
const STORY = [{ y: 98, w: 152 }, { y: 118, w: 152 }, { y: 138, w: 152 }, { y: 158, w: 152 }, { y: 178, w: 152 }, { y: 198, w: 96 }];
const CRACK = 'M158 78 L166 98 L152 118 L170 138 L156 158 L174 178 L160 198 L168 220';
const LEAF = 'M26 58 C 26 24, 56 8, 100 8 C 100 44, 70 60, 26 58 Z';

/** «При травме»: лист своей истории с трещиной, заполненной золотом (кинцуги): тяжёлый опыт не
 *  стирают — с ним работают, и он становится частью целого; из трещины растёт лист. */
export function CoverMended({ hue }: CoverProps) {
  const leaf = 'translate(159 82) rotate(-34) scale(.7) translate(-26 -58)';
  return (
    <SceneSvg hue={hue} sheet={null}>
      <g transform="rotate(-4 160 150)">
        <Lift by={6}>
          <path d={LEAF} transform={leaf} fill={INK.moss} />
          <rect x="64" y="78" width="192" height="142" rx="14" fill={INK.sheet} />
        </Lift>
        {STORY.map((l) => <rect key={l.y} x="84" y={l.y} width={l.w} height="9" rx="4.5" fill={INK.brown} fillOpacity=".24" />)}
        <path d={CRACK} fill="none" stroke={INK.amber} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </SceneSvg>
  );
}

/** «При тревоге и депрессии»: туча из тех же слоёв-полос, что у схемы, повисла над полоской —
 *  та поникла, как росток без света, а из-за тучи уже выглядывает солнце. */
export function CoverCloud({ hue }: CoverProps) {
  const droop = 'translate(78 134) rotate(150) scale(.46) translate(-26 -58)';
  return (
    <SceneSvg hue={hue} sheet={null}>
      <Lift>
        <path d="M20 222 H300" {...GROUND} />
        <circle cx="244" cy="62" r="40" fill={INK.amber} />
        <rect x="128" y="34" width="84" height="40" rx="20" fill={INK.slate} />
        <rect x="186" y="52" width="88" height="40" rx="20" fill={INK.slate} />
        <rect x="86" y="62" width="120" height="40" rx="20" fill={INK.slate} />
        <rect x="110" y="84" width="184" height="40" rx="20" fill={INK.slate} />
        <path d="M118 216 C 114 178, 102 152, 78 134" fill="none" stroke={INK.moss} strokeWidth="24" strokeLinecap="round" />
        <path d={LEAF} transform={droop} fill={INK.moss} />
      </Lift>
    </SceneSvg>
  );
}

/** Деления мерила снизу вверх и две отметки на нём: здоровая (шалфей, вровень с полоской) и
 *  недостижимая (слива — цвет домена сверхбдительности, где живут жёсткие стандарты). */
const TICKS = [196, 176, 156, 136, 116, 96, 76, 56];

/** «При перфекционизме»: мерило. Полоска выросла до своей отметки, а мерить себя тянет по
 *  самой верхней — где грань между здоровым стандартом и схемой. */
export function CoverBar({ hue }: CoverProps) {
  return (
    <SceneSvg hue={hue} sheet={null}>
      <Lift>
        <path d="M20 222 H300" {...GROUND} />
        <g transform="rotate(-4 120 128)">
          <rect x="88" y="32" width="72" height="186" rx="8" fill={INK.sheet} />
          {TICKS.map((y, i) => <rect key={y} x="88" y={y} width={i % 2 ? 22 : 34} height="6" rx="3" fill={INK.brown} fillOpacity=".3" />)}
          <rect x="80" y="122" width="56" height="12" rx="6" fill={INK.sage} />
          <rect x="80" y="40" width="96" height="14" rx="7" fill={INK.plum} />
        </g>
        <rect x="190" y="124" width="30" height="94" rx="15" fill={INK.clay} />
      </Lift>
    </SceneSvg>
  );
}
