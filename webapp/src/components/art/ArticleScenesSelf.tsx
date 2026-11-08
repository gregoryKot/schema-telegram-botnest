// Обложки статей о себе и близких: самооценка, повторяющийся сценарий в отношениях, ВДА
// (docs/design/PAPER_2026-11.md, таблица «Обложки статей»). Холст и правила те же, что в
// ArticleScenesMethod.tsx; какая сцена у какой статьи — articleCoverScenes.ts.
import { INK } from './scenePaper';
import { Lift, SceneSvg } from './sceneKit';

/** Оттенок бумаги — из articleCoverModel.ts: у сцены своего по умолчанию нет, источник один. */
type CoverProps = { hue: number };
const GROUND = { stroke: INK.sage, strokeWidth: 7, strokeLinecap: 'round' } as const;
const RIBBON = { fill: 'none', strokeWidth: 15, strokeLinecap: 'round' } as const;

/** «При низкой самооценке»: зеркало. Полоска стоит прямо, а в зеркале — бледная, маленькая и
 *  согнутая: «со мной что-то не так» — искажённое отражение, а не правда о себе. */
export function CoverMirror({ hue }: CoverProps) {
  return (
    <SceneSvg hue={hue} sheet={null}>
      <Lift>
        <path d="M20 222 H300" {...GROUND} />
        <path d="M98 220 L 108 200 H 140 L 150 220 Z" fill={INK.amber} />
        <ellipse cx="124" cy="118" rx="72" ry="86" fill={INK.amber} />
        <ellipse cx="124" cy="118" rx="60" ry="74" fill={INK.sky} />
        <rect x="226" y="62" width="30" height="156" rx="15" fill={INK.moss} />
      </Lift>
      <path d="M138 178 C 138 156, 128 142, 106 130" fill="none" stroke={INK.moss} strokeOpacity=".45" strokeWidth="20" strokeLinecap="round" />
    </SceneSvg>
  );
}

// Лемниската ∞ (центр 160×142, полуширина 128, по вертикали ×1.55), точки посчитаны заранее.
// Верхние полупетли — изнанка, за полосками; нижние — лицо, поверх: лента обвивает обе.
const LOOP_BACK = [
  'M160 142 C154.3 133.4 149 124.5 142.9 116.3 C136.8 108.2 130.6 99.7 123.4 92.9 C116.2 86.2 108.3 79.1 99.7 75.9 C91 72.6 80.6 70 71.3 73.3 C62.1 76.5 50.7 84.1 44.1 95.5 C37.6 107 32 126.5 32 142',
  'M160 142 C165.7 133.4 171 124.5 177.1 116.3 C183.2 108.2 189.4 99.7 196.6 92.9 C203.8 86.2 211.7 79.1 220.3 75.9 C229 72.6 239.4 70 248.7 73.3 C257.9 76.5 269.3 84.1 275.9 95.5 C282.4 107 288 126.5 288 142',
];
const LOOP_FRONT = [
  'M32 142 C32 157.5 37.6 177 44.1 188.5 C50.7 199.9 62.1 207.5 71.3 210.7 C80.6 214 91 211.4 99.7 208.1 C108.3 204.9 116.2 197.8 123.4 191.1 C130.6 184.3 136.8 175.8 142.9 167.7 C149 159.5 154.3 150.6 160 142',
  'M288 142 C288 157.5 282.4 177 275.9 188.5 C269.3 199.9 257.9 207.5 248.7 210.7 C239.4 214 229 211.4 220.3 208.1 C211.7 204.9 203.8 197.8 196.6 191.1 C189.4 184.3 183.2 175.8 177.1 167.7 C171 159.5 165.7 150.6 160 142',
];

/** «Повторяющийся сценарий в отношениях»: две полоски, и бесконечная петля обвивает обе —
 *  сменить партнёра мало, петля та же, пока схема не замечена. */
export function CoverLoop({ hue }: CoverProps) {
  return (
    <SceneSvg hue={hue} sheet={null}>
      <Lift>
        <path d="M20 222 H300" {...GROUND} />
        {LOOP_BACK.map((d) => <path key={d} d={d} stroke={INK.clayBack} {...RIBBON} />)}
        <rect x="71" y="38" width="28" height="180" rx="14" fill={INK.moss} />
        <rect x="221" y="38" width="28" height="180" rx="14" fill={INK.slate} />
        {LOOP_FRONT.map((d) => <path key={d} d={d} stroke={INK.clay} {...RIBBON} />)}
      </Lift>
    </SceneSvg>
  );
}

/** Полоски вокруг рамки шатаются — детство в хаосе: наклон вокруг основания на земле. */
const SWAY = [
  { x: 34, h: 124, deg: -24, fill: INK.plum },
  { x: 70, h: 92, deg: 16, fill: INK.amber },
  { x: 234, h: 110, deg: 22, fill: INK.slate },
  { x: 268, h: 136, deg: -14, fill: INK.plum },
];

/** «ВДА»: вокруг шатаются чужие полоски — детство в хаосе; посередине своя рамка (знак границ
 *  Limits крупно), и в ней полоска стоит прямо: опора, безопасность и право на свою жизнь. */
export function CoverOwnFrame({ hue }: CoverProps) {
  return (
    <SceneSvg hue={hue} sheet={null}>
      <Lift>
        <path d="M20 222 H300" {...GROUND} />
        {SWAY.map((s) => (
          <rect key={s.x} x={s.x} y={218 - s.h} width="22" height={s.h} rx="11" fill={s.fill} transform={`rotate(${s.deg} ${s.x + 11} 218)`} />
        ))}
        <rect x="104" y="40" width="112" height="176" rx="26" fill="none" stroke={INK.moss} strokeWidth="13" />
        <rect x="146" y="78" width="28" height="120" rx="14" fill={INK.clay} />
      </Lift>
    </SceneSvg>
  );
}
