import type { BriefSection } from '../../../../../shared/src/therapy/conceptBrief/conceptBrief';

// Бенто экрана «Главное»: листы раскладываются по колонкам сами (каждый следующий — в самую короткую колонку),
// а не CSS-колонками: те не рвут лист и не умеют переставлять, поэтому короткий лист «Схемы» оставался один в
// колонке рядом с высоким «Режимы» — пустота во всю высоту соседа (ревью g11 r1). Высота листа — оценка по тексту
// (в условных строках): раскладке нужен порядок величин, а не пиксели.

/** Число колонок по ширине контейнера: три на компьютере, две на планшете, одна на телефоне и до замера. */
export function briefColumnCount(width: number): number {
  if (width >= 980) return 3;
  return width >= 640 ? 2 : 1;
}

const HEAD = 3; // подпись со знаком и поля листа
const PER_LINE = 36; // букв в строке листа

const lines = (text: string, perLine = PER_LINE) =>
  text.split('\n').reduce((n, row) => n + Math.max(1, Math.ceil(row.length / perLine)), 0);

/** Оценка высоты листа в строках текста. */
export function briefWeight(s: BriefSection): number {
  if (s.empty) return HEAD + 1;
  if (s.kind === 'chips') {
    const chars = s.items.reduce((n, it) => n + it.text.length + 5, 0);
    return HEAD + Math.ceil(chars / PER_LINE) * 1.8;
  }
  if (s.kind === 'modes') {
    return HEAD + s.modes.reduce((n, m) => n + 1.2 + lines(m.name, 30) + (m.manifest ? lines(m.manifest) : 0)
      + (m.schemas.length ? lines(m.schemas.join(' · '), 50) * 0.8 : 0), 0);
  }
  return HEAD + lines(s.text);
}

/** Листы по колонкам: порядок сохраняется внутри колонки, следующий лист идёт в самую короткую (при равенстве — левее). */
export function packBrief<T>(items: readonly T[], columns: number, weight: (item: T) => number): T[][] {
  const count = Math.max(1, Math.min(columns, items.length || 1));
  const cols: T[][] = Array.from({ length: count }, () => []);
  const heights = cols.map(() => 0);
  for (const it of items) {
    const i = heights.indexOf(Math.min(...heights));
    cols[i].push(it);
    heights[i] += weight(it);
  }
  return cols;
}
