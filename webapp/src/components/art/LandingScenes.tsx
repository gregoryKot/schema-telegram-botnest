// Сцены «Как это работает» — крупные картинки лендинга из элементов языка знаков
// (docs/design/PAPER_2026-11.md: полоска — потребность, лента — момент, который
// закрутился, лист — рост, камешки — наблюдения).
//  • SceneChildhood — колесо: пять полосок-потребностей вокруг круга-детства; одной
//    не хватило — она короче и бледнее остальных, без тени: недополученная потребность.
//  • SceneTrigger — бумажная лента полтора витка обвила полоску: схема срабатывает
//    раньше мысли. Концы ленты срезаны прямо, изнанка на тон темнее лицевой стороны.
//  • SceneNotice — согнутая полоска (как было) бледная, рядом та же стоит прямо, у
//    основания прорастает лист; камешки на земле — наблюдения, которые к этому привели.
// `hue` — бумага листа-подложки; её же берёт пункт (STEP_LOOK в productContent.ts) для
// полоски под номером шага — сверка в productContent.test.tsx.
import { INK } from './scenePaper';
import { Lift, SceneSvg } from './sceneKit';

/** Полоски колеса по кругу от верхней; последней (слева вверху) не хватило. */
const SPOKES = [INK.teal, INK.moss, INK.plum, INK.amber, INK.slate];
const HUB = { x: 160, y: 128 } as const;

export function SceneChildhood({ hue = 45 }: { hue?: number }) {
  const spoke = (i: number) => `rotate(${i * 72} ${HUB.x} ${HUB.y})`;
  const last = SPOKES.length - 1;
  return (
    <SceneSvg hue={hue} patch={240} patchAt="tr" blob="a">
      <rect x="145" y="50" width="30" height="48" rx="15" fill={SPOKES[last]} fillOpacity=".38" transform={spoke(last)} />
      <Lift>
        {SPOKES.slice(0, last).map((fill, i) => (
          <rect key={fill} x="145" y="26" width="30" height="72" rx="15" fill={fill} transform={spoke(i)} />
        ))}
        <circle cx={HUB.x} cy={HUB.y} r="25" fill={INK.clay} />
      </Lift>
    </SceneSvg>
  );
}

// Лента вокруг полоски (x = 160): винтовая линия (радиус 56, шаг 56, наклон витка 18),
// точки посчитаны заранее. Хвост лежит на земле слева и входит в лицевую половину витка,
// дальше изнанка за полоской и второй лицевой полувиток; верхний конец уходит вправо-вверх.
// Стыки лица и изнанки — скруглённые (как сгиб), свободные концы срезаны прямо: поверх
// скруглённого конца лежит короткий отрезок той же ленты с прямым срезом (RIBBON_CUTS).
const RIBBON_BACK =
  'M216 168 C216 161 210 154 200 148 C189 143 175 138 160 136 C145 134 131 133 120 134 C110 135 104 138 104 140';
const RIBBON_FRONT = [
  'M38 227 C74 228 122 206 160 200 C175 198 189 193 200 188 C210 182 216 175 216 168',
  'M104 140 C104 142 110 145 120 146 C131 147 145 146 160 144 C175 142 189 137 200 132 C210 126 216 119 216 112 C216 94 232 76 258 62',
];
/** Прямые срезы свободных концов: по касательной к концу, накрывают его скругление. */
const RIBBON_CUTS = ['M24 226.6 L46 227.2', 'M251 65.7 L265 58.2'];

export function SceneTrigger({ hue = 25 }: { hue?: number }) {
  const ribbon = { fill: 'none', strokeWidth: 14, strokeLinecap: 'round' } as const;
  return (
    <SceneSvg hue={hue} patch={135} patchAt="bl" blob="b">
      <Lift>
        <rect x="58" y="216" width="204" height="14" rx="7" fill={INK.sage} />
        <path d={RIBBON_BACK} stroke={INK.clayBack} {...ribbon} />
        <rect x="146" y="52" width="28" height="168" rx="14" fill={INK.moss} />
        {RIBBON_FRONT.map((d) => <path key={d} d={d} stroke={INK.clay} {...ribbon} />)}
        {RIBBON_CUTS.map((d) => <path key={d} d={d} stroke={INK.clay} {...ribbon} strokeLinecap="butt" />)}
      </Lift>
    </SceneSvg>
  );
}

export function SceneNotice({ hue = 135, patch = 45 }: { hue?: number; patch?: number }) {
  return (
    <SceneSvg hue={hue} patch={patch} patchAt="tr" blob="c">
      <path d="M112 210 C112 174 98 148 62 124" fill="none" stroke={INK.slate} strokeOpacity=".3" strokeWidth="26" strokeLinecap="round" />
      <Lift>
        <path d="M30 218 H290" stroke={INK.sage} strokeWidth="7" strokeLinecap="round" />
        <rect x="146" y="62" width="28" height="152" rx="14" fill={INK.moss} />
        <path d="M218 214 C218 188 224 168 238 154" fill="none" stroke={INK.moss} strokeWidth="6" strokeLinecap="round" />
        <path d="M238 154 C232 122 256 100 292 100 C294 134 270 156 238 154 Z" fill={INK.moss} />
        <path d="M220 190 C232 174 254 172 268 180 C256 198 234 202 220 190 Z" fill={INK.sage} />
        <ellipse cx="42" cy="204" rx="15" ry="9" transform="rotate(-14 42 204)" fill={INK.amber} />
        <ellipse cx="72" cy="207" rx="12" ry="8" transform="rotate(-14 72 207)" fill={INK.clay} />
        <ellipse cx="96" cy="209" rx="9" ry="6" transform="rotate(-14 96 209)" fill={INK.slate} />
      </Lift>
    </SceneSvg>
  );
}
