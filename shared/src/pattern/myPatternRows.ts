// Строки списка «Мои схемы»/«Мои режимы» в порядке показа — единая сортировка
// для обоих фронтендов (правила №3 и №11): сначала то, что звучало на неделе,
// затем с заполненной карточкой, затем по алфавиту. Частоты приходят из
// patternsSummary, заполненность — из useMyCards: здесь ничего не пересчитывается.
import { patternMeta, type PatternMeta } from './patternMeta';
import type { MyCardsKind } from './useMyCards';

export interface MyPatternRow {
  id: string;
  freq: number;
  meta: PatternMeta;
}

export function buildMyPatternRows(
  kind: MyCardsKind,
  ids: string[],
  weekFreq: Record<string, number>,
  filledIds: ReadonlySet<string>,
  limit = Infinity,
): MyPatternRow[] {
  return ids
    .map((id) => ({ id, freq: weekFreq[id] ?? 0, meta: patternMeta(kind, id) }))
    .filter((r): r is MyPatternRow => !!r.meta)
    .sort((a, b) => {
      if (b.freq !== a.freq) return b.freq - a.freq;
      const aFilled = filledIds.has(a.id);
      const bFilled = filledIds.has(b.id);
      if (aFilled !== bFilled) return aFilled ? -1 : 1;
      return a.meta.name.localeCompare(b.meta.name, 'ru');
    })
    .slice(0, limit);
}
