// Каталог-цель справочника (.claude/rules/knowledge-base.md, раздел 7): какие темы справочник
// схема-терапии должен покрывать по литературе, и чем закрыта каждая. Сверка — kb/catalog.test.ts.
import { CONCERN_CATALOG } from './catalogConcerns';
import { PRACTICE_CATALOG } from './catalogPractice';
import { TECHNIQUE_CATALOG } from './catalogTechniques';

/** Открытые виды справочника: их полноту держит каталог, а не закрытый список. */
export type CatalogKind = 'concern' | 'technique' | 'practice';

export type CatalogStatus =
  'written' | 'planned' | 'needs_source' | 'out_of_scope';

/** Строка каталога. Для written id темы = id записи справочника. */
export type CatalogTopic =
  | { id: string; status: 'written' }
  | {
      id: string;
      title: string;
      status: 'planned';
      /** Метка книги с полки guide/sources.ts. */
      source: string;
      /** «гл. N» — каждая есть в карте docs/guide-sources/<метка>.md; карты нет — пусто. */
      chapters: readonly string[];
      note?: string;
    }
  | { id: string; title: string; status: 'needs_source'; book: string }
  | { id: string; title: string; status: 'out_of_scope'; why: string };

export const KB_CATALOG: Readonly<
  Record<CatalogKind, readonly CatalogTopic[]>
> = {
  concern: CONCERN_CATALOG,
  technique: TECHNIQUE_CATALOG,
  practice: PRACTICE_CATALOG,
};

export const CATALOG_KIND_LABEL: Record<CatalogKind, string> = {
  concern: 'Запросы и расстройства',
  technique: 'Техники',
  practice: 'Для терапевта',
};

/** Что сверить в каталоге одного вида: записи справочника, полка, карты покрытия. */
export interface CatalogFacts {
  /** id записей справочника этого вида. */
  recordIds: readonly string[];
  /** Метки полки (key и aliases). */
  shelf: readonly string[];
  /** Метка → текст карты покрытия; книги без карты здесь нет. */
  maps: ReadonlyMap<string, string>;
}

const chapterInMap = (map: string, chapter: string) =>
  new RegExp(`\\|\\s*${chapter.replace(/\./g, '\\.')}(?![\\d.])`).test(map);

/** Нарушения каталога одного вида; пустой массив — каталог сходится. */
export function catalogProblems(
  kind: CatalogKind,
  topics: readonly CatalogTopic[],
  facts: CatalogFacts,
): string[] {
  const out: string[] = [];
  const at = (t: CatalogTopic) => `каталог ${kind}: «${t.id}»`;
  const seen = new Set<string>();
  const writtenIds = new Set<string>();
  for (const t of topics) {
    if (seen.has(t.id)) out.push(`${at(t)} — повтор`);
    seen.add(t.id);
    if (t.status !== 'written' && !t.title.trim())
      out.push(`${at(t)} — нет названия`);
    if (t.status === 'written') {
      writtenIds.add(t.id);
      if (!facts.recordIds.includes(t.id))
        out.push(`${at(t)} — written, но записи с таким id в справочнике нет`);
    } else if (facts.recordIds.includes(t.id)) {
      out.push(`${at(t)} — запись уже есть: статус written`);
    }
    if (t.status === 'planned') {
      if (!facts.shelf.includes(t.source))
        out.push(
          `${at(t)} — метки «${t.source}» нет на полке guide/sources.ts`,
        );
      const map = facts.maps.get(t.source);
      if (map && t.chapters.length === 0)
        out.push(`${at(t)} — у книги есть карта, а глав (chapters) нет`);
      for (const ch of map ? t.chapters : [])
        if (!chapterInMap(map!, ch))
          out.push(
            `${at(t)} — «${ch}» нет в карте docs/guide-sources/ книги «${t.source}»`,
          );
    }
    if (t.status === 'needs_source' && !t.book.trim())
      out.push(`${at(t)} — needs_source без книги, которая нужна`);
    if (t.status === 'out_of_scope' && !t.why.trim())
      out.push(`${at(t)} — out_of_scope без причины (решения владельца)`);
  }
  for (const id of facts.recordIds)
    if (!writtenIds.has(id))
      out.push(
        `каталог ${kind}: запись «${id}» есть в справочнике, строки written нет`,
      );
  return out;
}

export type CatalogSummary = Record<CatalogStatus, number> & { total: number };

/** Сводка покрытия по видам: сколько тем в каждом статусе. */
export function catalogSummary(
  catalog: Readonly<Record<CatalogKind, readonly CatalogTopic[]>> = KB_CATALOG,
): Record<CatalogKind, CatalogSummary> {
  const one = (topics: readonly CatalogTopic[]): CatalogSummary => {
    const s: CatalogSummary = {
      written: 0,
      planned: 0,
      needs_source: 0,
      out_of_scope: 0,
      total: topics.length,
    };
    for (const t of topics) s[t.status] += 1;
    return s;
  };
  return {
    concern: one(catalog.concern),
    technique: one(catalog.technique),
    practice: one(catalog.practice),
  };
}
