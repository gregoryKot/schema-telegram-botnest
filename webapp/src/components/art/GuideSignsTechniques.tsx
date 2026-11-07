// Знаки техник в подсказках терапевту — тот же язык, что у клиента
// (docs/design/PAPER_2026-11.md, таблица техник): лента — момент, который зацепил
// и закрутился; круги — части; полоска — живая сила; камешек — мысль на месте;
// рамка — граница; лист растения — рост. Стулья, письма, осознанность, самосострадание
// и когнитивная работа берут готовый мотив (Talk, Sheets, Breath, Heart, Pebbles) — их здесь нет.
// Какой знак у какой техники — guideSignsModel.ts.
import { Talk } from './PaperArtSigns';
import { PAPER, type ArtProps } from './paper';
import { PaperSvg as Svg } from './PaperSvg';

const ROUND = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/** Прорыв паттерна: из ленты-петли старой привычки по ступенькам выходит полоска. */
export function PatternSteps({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <path
        d="M10 56 C 4 28, 38 16, 40 34 C 42 50, 18 50, 20 37 C 22 26, 40 30, 46 54"
        {...ROUND} stroke={PAPER.clay} strokeWidth="9"
      />
      <rect x="50" y="50" width="20" height="10" rx="4" fill={PAPER.sage} />
      <rect x="72" y="40" width="20" height="20" rx="4" fill={PAPER.sage} />
      <rect x="94" y="30" width="20" height="30" rx="4" fill={PAPER.sage} />
      <rect x="96" y="4" width="16" height="24" rx="8" fill={PAPER.moss} />
    </Svg>
  );
}

/** Рескриптинг: в петлю старой сцены входит большой круг, и у ленты другой конец. */
export function Rescript({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <path
        d="M6 54 C 6 26, 38 12, 42 30 C 45 44, 24 46, 24 34 C 24 24, 42 22, 60 32"
        {...ROUND} stroke={PAPER.clay} strokeWidth="9"
      />
      <path d="M84 22 C 94 16, 102 12, 112 8" {...ROUND} stroke={PAPER.sage} strokeWidth="9" />
      <circle cx="72" cy="32" r="16" fill={PAPER.moss} />
    </Svg>
  );
}

/** Образ будущего: полоска стоит прямо на линии, перед ней встаёт солнце над горизонтом. */
export function Horizon({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <path d="M62 54 A 26 26 0 0 1 114 54 Z" fill={PAPER.amber} />
      <path d="M8 54 H112" {...ROUND} stroke={PAPER.sage} strokeWidth="5" />
      <rect x="26" y="10" width="16" height="44" rx="8" fill={PAPER.moss} />
    </Svg>
  );
}

/** Историческая ролевая игра: две реплики, левая бледная — из прошлого. */
export function TalkPast({ size }: ArtProps) {
  return <Talk size={size} past />;
}

/** Флеш-карты: карточка в колоде, на ней камешек — мысль, положенная на место. */
export function Flashcard({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <rect x="26" y="8" width="72" height="46" rx="8" transform="rotate(8 62 31)" fill={PAPER.moss} />
      <rect x="22" y="9" width="72" height="46" rx="8" transform="rotate(-5 58 32)" fill={PAPER.sage} />
      <ellipse cx="58" cy="32" rx="17" ry="11" transform="rotate(-18 58 32)" fill={PAPER.clay} />
    </Svg>
  );
}

const HEART_D =
  'M60 58 C 40 46, 20 36, 20 22 C 20 12, 30 6, 40 10 C 48 13, 56 20, 60 26 C 64 20, 72 13, 80 10 C 90 6, 100 12, 100 22 C 100 36, 80 46, 60 58 Z';

/** Эмпатическая конфронтация: сердце в рамке — бережно и с границей одновременно. */
export function HeartFrame({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <rect x="27" y="4" width="66" height="56" rx="14" fill="none" stroke={PAPER.moss} strokeWidth="6" />
      <path d={HEART_D} transform="translate(60 33) scale(.55) translate(-60 -32)" fill={PAPER.clay} />
    </Svg>
  );
}

/** За и против: два камешка на перекладине весов — что режим даёт и сколько стоит. */
export function Scales({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <path d="M60 38 L 71 58 H 49 Z" fill={PAPER.sage} stroke={PAPER.sage} strokeWidth="4" strokeLinejoin="round" />
      <g transform="rotate(-7 60 35)">
        <rect x="12" y="32" width="96" height="7" rx="3.5" fill={PAPER.brown} />
        <ellipse cx="28" cy="23" rx="15" ry="9" fill={PAPER.moss} />
        <ellipse cx="92" cy="25" rx="11" ry="7" fill={PAPER.clay} />
      </g>
    </Svg>
  );
}

/** Интервью с режимом: круги-части бледные, слово у одной — она в цвете и с репликой. */
export function Spotlight({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <circle cx="26" cy="40" r="14" fill={PAPER.sage} />
      <circle cx="46" cy="16" r="10" fill={PAPER.sage} />
      <circle cx="52" cy="52" r="8" fill={PAPER.sage} />
      <circle cx="82" cy="30" r="18" fill={PAPER.clay} />
      <path d="M92 44 L 104 60 L 80 48 Z" fill={PAPER.clay} />
    </Svg>
  );
}

/** Образ Здорового Взрослого: большой ровный круг, внутри вырос лист. */
export function Grown({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <circle cx="60" cy="32" r="29" fill={PAPER.moss} />
      <g transform="translate(60 33) scale(.48) translate(-63 -33)">
        <path d="M26 58 C 26 24, 56 8, 100 8 C 100 44, 70 60, 26 58 Z" fill={PAPER.sage} />
        <path d="M30 56 C 48 44, 70 30, 96 12" {...ROUND} stroke={PAPER.moss} strokeWidth="7" />
      </g>
    </Svg>
  );
}
