// Обложки статей о методе — сцены из языка знаков (docs/design/PAPER_2026-11.md, таблица
// «Обложки статей»): слои — схема, полоска — потребность, круги — режимы, камешки — мысли,
// реплики — разговор с человеком. Холст 320×260 без листа-подложки: фигуры лежат прямо на
// цветной бумаге обложки, как листы SceneCover. Главное — в полосе y 30–230: на телефоне
// обложка 3:1 срезает верх и низ. Какая сцена у какой статьи — articleCoverScenes.ts.
import { INK } from './scenePaper';
import { Lift, SceneSvg } from './sceneKit';

/** Оттенок бумаги — из articleCoverModel.ts: у сцены своего по умолчанию нет, источник один. */
type CoverProps = { hue: number };
const GROUND = { stroke: INK.sage, strokeWidth: 7, strokeLinecap: 'round' } as const;
const LEAF = 'M26 58 C 26 24, 56 8, 100 8 C 100 44, 70 60, 26 58 Z';
const VEIN = 'M30 56 C 48 44, 70 30, 96 12';

/** «Что такое схема-терапия»: из пластов земли — слоёв, наросших за годы, — растёт полоска
 *  с листом: метод видит слои и то живое, что под ними. */
export function CoverRoots({ hue }: CoverProps) {
  const leaf = 'translate(176 112) scale(-.86 .86) translate(-26 -58)';
  return (
    <SceneSvg hue={hue} sheet={null}>
      <Lift>
        <rect x="176" y="40" width="30" height="118" rx="15" fill={INK.moss} />
        <path d={LEAF} transform={leaf} fill={INK.moss} />
        <rect x="22" y="196" width="276" height="28" rx="14" fill={INK.slate} />
        <rect x="40" y="170" width="236" height="28" rx="14" fill={INK.sage} transform="rotate(-1.5 158 184)" />
        <rect x="82" y="144" width="190" height="28" rx="14" fill={INK.clay} transform="rotate(2 177 158)" />
      </Lift>
      <path d={VEIN} transform={leaf} fill="none" stroke={INK.sage} strokeWidth="6" strokeLinecap="round" />
    </SceneSvg>
  );
}

/** Пять доменов по порядку (DOMAIN_HUE): сколько в домене схем и цвет его бумаги. 5+4+2+3+4 = 18. */
const DOMAIN_STACKS = [
  { count: 5, fill: INK.clay, tilt: -3 },
  { count: 4, fill: INK.amber, tilt: 2 },
  { count: 2, fill: INK.moss, tilt: -2 },
  { count: 3, fill: INK.slate, tilt: 3 },
  { count: 4, fill: INK.plum, tilt: -1.5 },
] as const;

/** «18 схем Янга»: восемнадцать слоёв в пяти стопках — пять доменов. */
export function CoverSchemaStacks({ hue }: CoverProps) {
  return (
    <SceneSvg hue={hue} sheet={null}>
      <Lift>
        <path d="M18 222 H302" {...GROUND} />
        {DOMAIN_STACKS.map((s, i) => {
          const cx = 46 + i * 57;
          return (
            <g key={cx} transform={`rotate(${s.tilt} ${cx} 218)`}>
              {Array.from({ length: s.count }, (_, k) => {
                const w = 54 - k * 7;
                return <rect key={k} x={cx - w / 2} y={192 - k * 31} width={w} height="26" rx="13" fill={s.fill} />;
              })}
            </g>
          );
        })}
      </Lift>
    </SceneSvg>
  );
}

/** «Режимы»: части по очереди у руля. Позади круги копинга (сланец) и Критика (слива) — сейчас
 *  не у руля; впереди на одной земле большой круг Здорового Взрослого и маленький — ребёнка. */
export function CoverModes({ hue }: CoverProps) {
  const leaf = 'translate(262 218) scale(.78) rotate(-40) translate(-26 -58)';
  return (
    <SceneSvg hue={hue} sheet={null}>
      <Lift>
        <circle cx="92" cy="94" r="54" fill={INK.slate} />
        <circle cx="198" cy="70" r="40" fill={INK.plum} />
        <path d="M24 222 H296" {...GROUND} />
        <circle cx="134" cy="160" r="58" fill={INK.moss} />
        <circle cx="222" cy="192" r="26" fill={INK.clay} />
        <path d={LEAF} transform={leaf} fill={INK.moss} />
      </Lift>
      <path d={VEIN} transform={leaf} fill="none" stroke={INK.sage} strokeWidth="6" strokeLinecap="round" />
    </SceneSvg>
  );
}

/** Волна поверхности: над ней видно, под ней — нет. */
const WATERLINE = 'M18 104 C 44 92, 64 116, 92 104 S 140 92, 166 104 S 214 116, 240 104 S 288 92, 302 102';

/** «Схема-терапия и КПТ»: как айсберг. Над водой камешек — мысль здесь и сейчас (с ней работает
 *  КПТ); под водой, шире и глубже, — слои, откуда взялось убеждение за этой мыслью. */
export function CoverDepth({ hue }: CoverProps) {
  return (
    <SceneSvg hue={hue} sheet={null}>
      <Lift>
        <ellipse cx="160" cy="80" rx="34" ry="21" transform="rotate(-10 160 80)" fill={INK.clay} />
        <path d={WATERLINE} fill="none" stroke={INK.slate} strokeWidth="7" strokeLinecap="round" />
        <rect x="40" y="122" width="240" height="28" rx="14" fill={INK.sage} />
        <rect x="70" y="156" width="180" height="28" rx="14" fill={INK.moss} />
        <rect x="104" y="190" width="112" height="28" rx="14" fill={INK.plum} />
      </Lift>
    </SceneSvg>
  );
}

/** «Схема-терапия и разговорная терапия»: в большой реплике разговора лежат слои — разговор
 *  идёт по карте схем; рядом ответная реплика. */
export function CoverTalkMap({ hue }: CoverProps) {
  return (
    <SceneSvg hue={hue} sheet={null}>
      <Lift>
        <ellipse cx="138" cy="106" rx="116" ry="72" fill={INK.sage} />
        <path d="M80 166 L 56 214 L 126 176 Z" fill={INK.sage} />
        <rect x="92" y="62" width="92" height="22" rx="11" fill={INK.clay} />
        <rect x="72" y="92" width="132" height="22" rx="11" fill={INK.moss} />
        <rect x="52" y="122" width="172" height="22" rx="11" fill={INK.slate} />
        <ellipse cx="240" cy="180" rx="62" ry="36" fill={INK.clay} />
        <path d="M264 206 L 278 230 L 240 214 Z" fill={INK.clay} />
      </Lift>
    </SceneSvg>
  );
}
