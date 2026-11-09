// Бумажная аппликация — картинки единого стиля сайта (референс владельца
// 2026-11-04, docs/design/PAPER_2026-11.md). Встроенный SVG, цвета только из
// токенов: внешних файлов нет (CSP 'self'), размытия нет (check-render-poison).
// Декор: aria-hidden, смысл несёт текст рядом. Размер задаёт класс
// .pp-art--hero / --square / --row / --empty / --nav / --scene (styles/paper.css).
// Варианты мотива вместо нового знака: Strokes values / even, Pebbles filled — данные
// только реальные, пустое место — пустой тон бумаги (PAPER.hollow), а не выдуманная фигура.
// Мотив → смысл: Strokes — трекер и потребности; Ribbon — «Что случилось»;
// Pebbles — дневник; Cup — пусто и отдых; Breath — дыхание и «здесь и сейчас»;
// Sheets — записи и «Мой путь»; Layers — схемы и паттерны.
import { NEED_DATA_PAPER, PAPER, pebblesLaid, type ArtProps } from './paper';
import { PaperSvg as Svg } from './PaperSvg';

export interface StrokeMark { id: string; dense: boolean }
const STROKE_PAPER = [PAPER.moss, PAPER.sage, PAPER.brown, PAPER.clay, PAPER.sage];
const STROKE_TILT = [-6, 3, -2, 5, -4];
/** Полоска по оценке 0–10: от кружка (16) до полной (84), низ всех полосок на одной линии; без оценки — 72. */
const STROKE_FOOT = 92;
const strokeHeight = (v: number | null) => (v == null ? 72 : 16 + Math.round((Math.min(10, Math.max(0, v)) / 10) * 68));

/**
 * Пять полосок цветной бумаги. `marks` — по одной на потребность: плотная или бледная. `values` —
 * оценки дня в порядке NEED_ORDER (0–10, null — не оценена): высота по оценке, цвет — цвет данных своей
 * потребности (NEED_DATA_PAPER, он же в `color`); пустое место — бледный тон своей потребности с кромкой
 * цветом бумаги (одно правило `.pp-strokes-values`, paper.css). `even` — ровный день, без наклона.
 */
export function Strokes({ marks, values, even, size }: ArtProps & { marks?: StrokeMark[]; values?: readonly (number | null)[]; even?: boolean }) {
  const tilt = (i: number, y: number) => (even ? undefined : `rotate(${STROKE_TILT[i]} ${16 + i * 22} ${y})`);
  if (values) {
    return (
      <Svg size={size} viewBox="0 0 120 100">
        <g className="pp-strokes-values">
          {values.slice(0, 5).map((v, i) => (
            <rect
              key={i} data-rated={v == null ? 'no' : 'yes'} data-value={v ?? undefined} color={NEED_DATA_PAPER[i]}
              x={8 + i * 22} y={STROKE_FOOT - strokeHeight(v)} width="16" height={strokeHeight(v)} rx="8"
              fill={v == null ? PAPER.hollow : NEED_DATA_PAPER[i]} transform={tilt(i, STROKE_FOOT)}
            />
          ))}
        </g>
      </Svg>
    );
  }
  const list = marks ?? STROKE_PAPER.map((_, i) => ({ id: String(i), dense: true }));
  return (
    <Svg size={size} viewBox="0 0 120 100">
      {list.slice(0, 5).map((m, i) => (
        <rect
          key={m.id} data-need={m.id} data-rated={m.dense ? 'yes' : 'no'}
          x={8 + i * 22} y={m.dense ? 8 : 16} width="16" height={m.dense ? 84 : 72} rx="8"
          fill={STROKE_PAPER[i]} fillOpacity={m.dense ? 1 : 0.5}
          transform={tilt(i, 50)}
        />
      ))}
    </Svg>
  );
}

/** Завиток ленты — момент, который зацепил и закрутился. */
export function Ribbon({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <path d="M8 46 C 18 18, 54 10, 66 30 C 76 48, 44 60, 36 42 C 28 24, 66 6, 112 26"
        fill="none" stroke={PAPER.clay} strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const PEBBLES = [
  { cx: 24, cy: 36, fill: PAPER.moss },
  { cx: 60, cy: 34, fill: PAPER.brown },
  { cx: 96, cy: 30, fill: PAPER.clay },
] as const;

/** Три камешка — мысль, схема, спасибо. `filled` — сколько уже легло (благодарность по одной, pebblesLaid):
 *  остальные — гнёзда своего цвета (`color`, правило [data-laid="no"] в paper.css); без `filled` легли все три. */
export function Pebbles({ size, filled }: ArtProps & { filled?: number }) {
  const n = filled === undefined ? PEBBLES.length : pebblesLaid(filled);
  return (
    <Svg size={size} viewBox="0 0 120 64">
      {PEBBLES.map((p, i) => (
        <ellipse
          key={p.cx} cx={p.cx} cy={p.cy} rx="20" ry="13" transform={`rotate(-18 ${p.cx} ${p.cy})`} color={p.fill}
          fill={i < n ? p.fill : PAPER.hollow} data-laid={filled === undefined ? undefined : i < n ? 'yes' : 'no'}
        />
      ))}
    </Svg>
  );
}

/** Чашка с паром — ничего не записано, и это нормально. */
export function Cup({ size = 'empty' }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 56 48">
      <path d="M10 22 H38 V32 A10 10 0 0 1 28 42 H20 A10 10 0 0 1 10 32 Z" fill="var(--paper-sunk)" stroke="var(--line-strong)" strokeWidth="1.5" />
      <path d="M38 26 H42 A5 5 0 0 1 42 36 H38" fill="none" stroke="var(--line-strong)" strokeWidth="1.5" />
      <path d="M19 16 C19 12 22 12 22 8 M27 16 C27 12 30 12 30 8" fill="none" stroke={PAPER.slate} strokeOpacity=".6" strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}

/** Дыхание — две дуги, вдох и выдох. */
export function Breath({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <path d="M14 54 A46 46 0 0 1 106 54" fill="none" stroke={PAPER.sage} strokeWidth="12" strokeLinecap="round" />
      <path d="M34 54 A26 26 0 0 1 86 54" fill="none" stroke={PAPER.moss} strokeWidth="12" strokeLinecap="round" />
      <circle cx="60" cy="54" r="7" fill={PAPER.clay} />
    </Svg>
  );
}

/** Три листа бумаги веером — записи, то, что уже собрано. */
export function Sheets({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <rect x="22" y="10" width="40" height="50" rx="6" transform="rotate(-12 42 35)" fill={PAPER.sage} />
      <rect x="40" y="6" width="40" height="52" rx="6" transform="rotate(-4 60 32)" fill={PAPER.brown} />
      <rect x="58" y="8" width="40" height="52" rx="6" transform="rotate(6 78 34)" fill={PAPER.clay} />
    </Svg>
  );
}

/** Слои — схема под схемой, паттерны родом из детства. */
export function Layers({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <rect x="10" y="40" width="100" height="16" rx="8" fill={PAPER.sage} />
      <rect x="22" y="24" width="76" height="16" rx="8" fill={PAPER.moss} />
      <rect x="36" y="8" width="48" height="16" rx="8" fill={PAPER.clay} />
    </Svg>
  );
}
