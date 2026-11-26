// Знаки техник «Справочника»: сцены, разговоры и части (docs/design/PAPER_2026-11.md, таблица
// техник). Язык тот же: лента — момент, который зацепил; круг — часть; реплика — слово части;
// камешек — мысль на месте; рамка — граница. Какой знак у какой техники — techniqueSigns.ts.
import { HEART_PATH } from './PaperArtSigns';
import { PAPER, type ArtProps } from './paper';
import { PaperSvg as Svg } from './PaperSvg';
import { Bubble, Ground } from './techniqueSignParts';

const ROUND = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const BOX = '0 0 120 64';

/** Диагностическая визуализация: взрослый-кольцо стоит рядом с петлёй сцены и смотрит, не входя. */
export function SceneLook({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox={BOX}>
      <path d="M8 54 C 8 26, 40 12, 44 30 C 47 44, 26 46, 26 34 C 26 24, 44 22, 60 32" {...ROUND} stroke={PAPER.clay} strokeWidth="9" />
      <circle cx="90" cy="32" r="18" fill="none" stroke={PAPER.moss} strokeWidth="7" />
    </Svg>
  );
}

/** Диалог режимов в воображении: две реплики внутри одного большого круга. */
export function TalkInner({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox={BOX}>
      <circle cx="60" cy="32" r="30" fill={PAPER.sage} />
      <Bubble cx={49} cy={25} rx={15} ry={9} fill={PAPER.moss} tail="l" />
      <Bubble cx={72} cy={38} rx={13} ry={8} fill={PAPER.clay} tail="r" />
    </Svg>
  );
}

/** Стулья онлайн: одна реплика в рамке экрана, вторая — по эту сторону. */
export function TalkScreen({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox={BOX}>
      <rect x="8" y="7" width="60" height="48" rx="11" fill="none" stroke={PAPER.moss} strokeWidth="6" />
      <Bubble cx={38} cy={27} rx={19} ry={11} fill={PAPER.sage} tail="l" />
      <Bubble cx={92} cy={36} rx={21} ry={13} fill={PAPER.clay} tail="r" />
    </Svg>
  );
}

/** Спор со схемой: реплике схемы отвечает реплика крупнее и выше, в ней довод-камешек. */
export function TalkSchema({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox={BOX}>
      <Bubble cx={38} cy={40} rx={28} ry={15} fill={PAPER.clay} tail="l" />
      <Bubble cx={80} cy={24} rx={31} ry={18} fill={PAPER.moss} tail="r" />
      <ellipse cx="80" cy="24" rx="12" ry="7" transform="rotate(-18 80 24)" fill={PAPER.sage} />
    </Svg>
  );
}

/** Ролевая игра сегодняшней ситуации: полоска стоит на земле и говорит другому человеку. */
export function TalkNow({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox={BOX}>
      <Ground />
      <rect x="16" y="24" width="15" height="32" rx="7.5" fill={PAPER.moss} />
      <Bubble cx={58} cy={18} rx={23} ry={12} fill={PAPER.clay} tail="l" />
      <circle cx="98" cy="42" r="13" fill={PAPER.slate} />
    </Svg>
  );
}

/** Три стула Здорового Взрослого: один и тот же круг на трёх сиденьях-ступенях — три шага ответа. */
export function ThreeChairs({ size }: ArtProps) {
  const seats = [{ x: 24, y: 46 }, { x: 60, y: 36 }, { x: 96, y: 26 }];
  return (
    <Svg size={size} viewBox={BOX}>
      {seats.map((c) => (
        <g key={c.x}>
          <rect x={c.x - 14} y={c.y + 10} width="28" height={54 - c.y} rx="5" fill={PAPER.sage} />
          <circle cx={c.x} cy={c.y - 4} r="13" fill={PAPER.moss} />
        </g>
      ))}
    </Svg>
  );
}

/** Мотивационное интервью: у одного круга две свои реплики, та, что про перемену, громче. */
export function Ambivalence({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox={BOX}>
      <circle cx="56" cy="46" r="15" fill={PAPER.moss} />
      <Bubble cx={24} cy={18} rx={16} ry={10} fill={PAPER.slate} opacity={0.45} tail="r" />
      <Bubble cx={90} cy={20} rx={24} ry={14} fill={PAPER.clay} tail="l" />
    </Svg>
  );
}

/** Суд над мыслью: мысль-камешек на подставке, с двух сторон — реплики обвинения и защиты. */
export function Courtroom({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox={BOX}>
      <rect x="40" y="50" width="40" height="11" rx="5" fill={PAPER.sage} />
      <ellipse cx="60" cy="41" rx="16" ry="9.5" fill={PAPER.clay} />
      <Bubble cx={25} cy={20} rx={21} ry={13} fill={PAPER.slate} tail="r" />
      <Bubble cx={95} cy={20} rx={21} ry={13} fill={PAPER.moss} tail="l" />
    </Svg>
  );
}

/** Сократовский диалог: в реплике только вопрос-многоточие, а камешек кладёт сам человек. */
export function Socratic({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox={BOX}>
      <Bubble cx={42} cy={26} rx={32} ry={18} fill={PAPER.sage} tail="l" />
      <circle cx="29" cy="26" r="4" fill={PAPER.moss} />
      <circle cx="42" cy="26" r="4" fill={PAPER.moss} />
      <circle cx="55" cy="26" r="4" fill={PAPER.moss} />
      <ellipse cx="96" cy="44" rx="17" ry="11" transform="rotate(-18 96 44)" fill={PAPER.clay} />
    </Svg>
  );
}

/** Настройка на схему: от круга взрослого к маленькому кругу идут дуги — слушает и подстраивается. */
export function Attune({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox={BOX}>
      <circle cx="26" cy="32" r="16" fill={PAPER.moss} />
      <path d="M52 20 A 16 16 0 0 1 52 44" {...ROUND} stroke={PAPER.sage} strokeWidth="6" />
      <path d="M66 12 A 26 26 0 0 1 66 52" {...ROUND} stroke={PAPER.sage} strokeWidth="6" />
      <circle cx="100" cy="32" r="11" fill={PAPER.clay} />
    </Svg>
  );
}

/** Переходные объекты: маленький круг уходит, и с ним — частица большого круга. */
export function Keepsake({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox={BOX}>
      <circle cx="30" cy="30" r="21" fill={PAPER.moss} />
      <path d="M58 20 C 68 10, 78 10, 86 16" {...ROUND} stroke={PAPER.sage} strokeWidth="5" strokeDasharray="1 10" />
      <circle cx="88" cy="42" r="15" fill={PAPER.clay} />
      <circle cx="102" cy="26" r="8" fill={PAPER.moss} />
    </Svg>
  );
}

/** Сострадательное «я»: сердце живёт внутри большого ровного круга — это часть, а не жест. */
export function WarmSelf({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox={BOX}>
      <circle cx="60" cy="32" r="29" fill={PAPER.moss} />
      <path d={HEART_PATH} transform="translate(60 34) scale(.42) translate(-60 -32)" fill={PAPER.amber} />
    </Svg>
  );
}
