// Четыре знака приложения, которым готовый мотив врёт (docs/design/PAPER_2026-11.md,
// «Мотив → смысл»; ключи — SIGN_KEYS, shared/src/theme/entityLook.ts):
//  • Grounded — заземление 5-4-3-2-1: полоска стоит на линии земли, рядом пять камешков
//    убывающего размера, сложенные стопкой, — пять, четыре, три, два, одно ощущение,
//    замеченные по одному и положенные друг на друга.
//  • Pause — техника «Стоп»: лента-импульс бежит и упирается в дугу мха — ладони Здорового
//    Взрослого останавливают, не ломая ленту.
//  • Haven — безопасное место: рамка мха с открытым верхом (защищено, но не заперто), внутри на
//    земле круг глины — своя маленькая часть — и рядом растёт лист.
//  • Join — «тот же человек»: бледный и полный круг на одной дуге шалфея — два входа, одна часть.
// Палитра — PAPER (только токены); поле 120×64, как у мотивов кабинета.
import { PAPER, type ArtProps } from './paper';
import { PaperSvg as Svg } from './PaperSvg';

/** Камешки заземления снизу вверх: от большого к малому, каждый лежит на предыдущем,
 *  нижний — на земле (y = 58). Стопка, а не россыпь: читается и в строке 44×24. */
const CAIRN = [
  { cx: 80, rx: 21, ry: 7.5, deg: -3, fill: PAPER.brown },
  { cx: 78, rx: 17, ry: 6.5, deg: 4, fill: PAPER.clay },
  { cx: 81, rx: 13.5, ry: 5.5, deg: -4, fill: PAPER.amber },
  { cx: 79, rx: 10.5, ry: 4.6, deg: 3, fill: PAPER.slate },
  { cx: 80.5, rx: 7.5, ry: 3.8, deg: -2, fill: PAPER.moss },
] as const;
const CAIRN_CY = CAIRN.reduce<number[]>((acc, s, i) => [...acc, i === 0 ? 58 - s.ry : acc[i - 1] - CAIRN[i - 1].ry - s.ry], []);

export function Grounded({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <path d="M14 60 H110" stroke={PAPER.sage} strokeWidth="4" strokeLinecap="round" />
      <rect x="30" y="8" width="16" height="50" rx="8" fill={PAPER.moss} />
      {CAIRN.map((s, i) => (
        <ellipse key={s.rx} cx={s.cx} cy={CAIRN_CY[i]} rx={s.rx} ry={s.ry} transform={`rotate(${s.deg} ${s.cx} ${CAIRN_CY[i]})`} fill={s.fill} />
      ))}
    </Svg>
  );
}

export function Pause({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <path d="M6 42 C 14 20, 30 18, 40 32 S 66 46, 90 32" fill="none" stroke={PAPER.clay} strokeWidth="11" strokeLinecap="round" />
      <path d="M90 8 A 26 26 0 0 1 90 56" fill="none" stroke={PAPER.moss} strokeWidth="13" strokeLinecap="round" />
    </Svg>
  );
}

export function Haven({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <path d="M26 6 V46 Q26 58 38 58 H82 Q94 58 94 46 V6" fill="none" stroke={PAPER.moss} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="47" cy="44" r="10" fill={PAPER.clay} />
      <path d="M64 54 C 60 40, 68 26, 84 22 C 86 38, 80 50, 64 54 Z" fill={PAPER.moss} />
    </Svg>
  );
}

/** Бледный круг — сплошной светлый тон, а не прозрачность: в сцене и под тенью-вырезкой
 *  прозрачность снимается (.scn-sign, .scn svg.pp-art), а «бледный» должен остаться бледным. */
const PALE_SLATE = 'color-mix(in srgb, var(--c-slate) 45%, var(--bg))';

export function Join({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <path d="M8 58 Q60 2 112 58" fill="none" stroke={PAPER.sage} strokeWidth="7" strokeLinecap="round" />
      <circle cx="28" cy="38" r="12" fill={PALE_SLATE} />
      <circle cx="92" cy="38" r="12" fill={PAPER.clay} />
    </Svg>
  );
}
