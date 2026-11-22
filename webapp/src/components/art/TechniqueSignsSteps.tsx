// Знаки техник «Справочника»: шаги, мысли и границы (docs/design/PAPER_2026-11.md, таблица
// техник). Язык тот же: полоска — живая сила; камешек — мысль на месте; лента — момент,
// который зацепил; лист растения — рост. Какой знак у какой техники — techniqueSigns.ts.
import { HEART_PATH } from './PaperArtSigns';
import { PAPER, type ArtProps } from './paper';
import { PaperSvg as Svg } from './PaperSvg';
import { Ground } from './techniqueSignParts';

const ROUND = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const BOX = '0 0 120 64';

/** Дневник схем: лист, сверху лента-момент, под ней две строки — что это было и что нужно. */
export function DiarySheet({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox={BOX}>
      <rect x="28" y="4" width="64" height="56" rx="8" transform="rotate(-4 60 32)" fill={PAPER.sage} />
      <path d="M40 20 C 46 10, 52 28, 60 18 S 72 10, 80 18" {...ROUND} stroke={PAPER.clay} strokeWidth="6" />
      <rect x="40" y="32" width="40" height="7" rx="3.5" fill={PAPER.moss} />
      <rect x="40" y="45" width="26" height="7" rx="3.5" fill={PAPER.moss} />
    </Svg>
  );
}

/** Журнал позитивных данных: камешки-факты копятся в чаше, ещё один на подходе. */
export function PebbleBowl({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox={BOX}>
      <ellipse cx="46" cy="40" rx="12" ry="8" fill={PAPER.clay} />
      <ellipse cx="72" cy="42" rx="12" ry="8" fill={PAPER.amber} />
      <ellipse cx="59" cy="27" rx="11" ry="7" fill={PAPER.sage} />
      <ellipse cx="90" cy="11" rx="10" ry="6.5" transform="rotate(-18 90 11)" fill={PAPER.clay} />
      <path d="M20 28 C 22 64, 98 64, 100 28" {...ROUND} stroke={PAPER.moss} strokeWidth="7" />
    </Svg>
  );
}

/** Поведенческий эксперимент: слева камешек-ожидание пунктиром, справа — что вышло на деле. */
export function TryStep({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox={BOX}>
      <Ground />
      <ellipse cx="24" cy="30" rx="15" ry="10" fill={PAPER.hollow} stroke={PAPER.clay} strokeWidth="3" strokeDasharray="5 5" />
      <rect x="52" y="14" width="16" height="42" rx="8" fill={PAPER.moss} />
      <ellipse cx="96" cy="30" rx="15" ry="10" fill={PAPER.clay} />
    </Svg>
  );
}

/** Поведенческая активация: маленькие дела-камешки в ряд, из последнего прорастает лист. */
export function Activation({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox={BOX}>
      <ellipse cx="22" cy="52" rx="12" ry="7.5" fill={PAPER.clay} />
      <ellipse cx="52" cy="52" rx="12" ry="7.5" fill={PAPER.clay} />
      <ellipse cx="82" cy="52" rx="12" ry="7.5" fill={PAPER.clay} />
      <path d="M82 46 C 82 34, 84 26, 90 18" {...ROUND} stroke={PAPER.sage} strokeWidth="5" />
      <path d="M88 20 C 88 6, 100 2, 114 4 C 114 18, 104 26, 88 20 Z" fill={PAPER.moss} />
    </Svg>
  );
}

/** Экспозиция: полоска шаг за шагом подходит к большому кругу и с каждым шагом выше. */
export function Approach({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox={BOX}>
      <circle cx="92" cy="30" r="22" fill={PAPER.slate} />
      <Ground />
      <rect x="10" y="34" width="13" height="22" rx="6.5" fill={PAPER.sage} />
      <rect x="30" y="26" width="13" height="30" rx="6.5" fill={PAPER.sage} />
      <rect x="50" y="16" width="14" height="40" rx="7" fill={PAPER.moss} />
    </Svg>
  );
}

/** Обзор ценностей: полоска стоит на земле, над ней дугой — три разных круга: что важно. */
export function Values({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox={BOX}>
      <Ground />
      <rect x="52" y="30" width="16" height="26" rx="8" fill={PAPER.moss} />
      <circle cx="24" cy="28" r="13" fill={PAPER.amber} />
      <circle cx="60" cy="13" r="10" fill={PAPER.clay} />
      <circle cx="96" cy="28" r="13" fill={PAPER.plum} />
    </Svg>
  );
}

/** Линия жизни: линия с подъёмами и спадами, на ней круги — события, от давнего к нынешнему. */
export function LifeLine({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox={BOX}>
      <path d="M8 46 C 26 46, 30 22, 48 26 S 66 50, 82 40 S 100 18, 112 16" {...ROUND} stroke={PAPER.sage} strokeWidth="5" />
      <circle cx="20" cy="44" r="6" fill={PAPER.clay} />
      <circle cx="48" cy="26" r="8" fill={PAPER.clay} />
      <circle cx="74" cy="44" r="8" fill={PAPER.slate} />
      <circle cx="102" cy="22" r="10" fill={PAPER.moss} />
    </Svg>
  );
}

/** Окно толерантности: волна чувства ходит между двумя границами и не выходит за них. */
export function ToleranceWindow({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox={BOX}>
      <path d="M10 8 H110 M10 56 H110" {...ROUND} stroke={PAPER.moss} strokeWidth="6" />
      <path d="M12 32 C 22 16, 34 16, 46 32 S 70 48, 82 32 S 100 20, 108 30" {...ROUND} stroke={PAPER.clay} strokeWidth="8" />
    </Svg>
  );
}

/** Уровни валидации: вокруг сердца два контура — признание подходит к чувству слой за слоем. */
export function LevelsHeart({ size }: ArtProps) {
  const at = (k: number) => `translate(60 33) scale(${k}) translate(-60 -32)`;
  return (
    <Svg size={size} viewBox={BOX}>
      <path d={HEART_PATH} transform={at(0.98)} {...ROUND} stroke={PAPER.sage} strokeWidth="5.5" />
      <path d={HEART_PATH} transform={at(0.64)} {...ROUND} stroke={PAPER.moss} strokeWidth="8.5" />
      <path d={HEART_PATH} transform={at(0.28)} fill={PAPER.clay} />
    </Svg>
  );
}

/** Разделение с мыслью: круг остаётся на берегу, мысль-камешек уплывает по воде. */
export function Defusion({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox={BOX}>
      <circle cx="26" cy="32" r="17" fill={PAPER.moss} />
      <path d="M52 50 C 62 42, 72 58, 84 50 S 104 42, 114 50" {...ROUND} stroke={PAPER.slate} strokeWidth="5" />
      <ellipse cx="86" cy="32" rx="16" ry="10" transform="rotate(-12 86 32)" fill={PAPER.clay} />
    </Svg>
  );
}

/** Пирог ответственности: круг поделён на доли, своя — небольшая и выдвинута. */
export function Pie({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox={BOX}>
      <path d="M60 32 L 60 4 A 28 28 0 0 1 74 56.2 Z" fill={PAPER.slate} />
      <path d="M60 32 L 74 56.2 A 28 28 0 0 1 32.4 27.1 Z" fill={PAPER.sage} />
      <path d="M60 32 L 32.4 27.1 A 28 28 0 0 1 60 4 Z" transform="translate(-4 -5)" fill={PAPER.clay} />
    </Svg>
  );
}

/** Стоп — назад — исследуй: ход упирается в полоску-стоп, дуга возвращает к моменту-кругу. */
export function Rewind({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox={BOX}>
      <path d="M8 48 H92" {...ROUND} stroke={PAPER.clay} strokeWidth="8" />
      <path d="M92 34 C 92 6, 40 6, 40 32" {...ROUND} stroke={PAPER.sage} strokeWidth="5" />
      <circle cx="40" cy="48" r="11" fill={PAPER.moss} />
      <rect x="100" y="26" width="10" height="34" rx="5" fill={PAPER.moss} />
    </Svg>
  );
}
