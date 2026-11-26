// Каталог-цель (kb/catalog.ts): каждая запись справочника в каталоге, written ведёт на запись,
// planned — на полку и главы карты покрытия, needs_source называет книгу. Плюс сторож на фейках.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildConcernGuides } from '../guide/concerns/all';
import { buildTechniqueGuides, practiceNotes } from '../guide/index';
import { GUIDE_SOURCES } from '../guide/sources';
import type { Tr } from '../guide/types';
import {
  catalogProblems,
  catalogSummary,
  KB_CATALOG,
  type CatalogFacts,
  type CatalogKind,
  type CatalogTopic,
} from './catalog';
import { readText, ROOT } from './kbFs.test-helpers';

const tr: Tr = (t) => t;
const MAPS_DIR = 'docs/guide-sources';

/** Метка полки → текст карты; метку карта называет первой строкой «# <метка> — …». */
function coverageMaps(): Map<string, string> {
  const maps = new Map<string, string>();
  for (const name of readdirSync(join(ROOT, MAPS_DIR))) {
    if (!name.endsWith('.md')) continue;
    const text = readText(`${MAPS_DIR}/${name}`);
    const label = /^# (.+?) — /.exec(text)?.[1];
    if (label) maps.set(label, text);
  }
  return maps;
}

const RECORDS: Record<CatalogKind, () => string[]> = {
  concern: () => buildConcernGuides(tr).map((c) => c.id),
  technique: () => buildTechniqueGuides(tr).map((t) => t.id),
  practice: () => practiceNotes(tr).map((p) => p.id),
};

describe('каталог-цель сходится со справочником, полкой и картами', () => {
  const shelf = GUIDE_SOURCES.flatMap((s) => [s.key, ...(s.aliases ?? [])]);
  const maps = coverageMaps();
  for (const kind of Object.keys(KB_CATALOG) as CatalogKind[]) {
    it(kind, () => {
      const facts = { recordIds: RECORDS[kind](), shelf, maps };
      expect(catalogProblems(kind, KB_CATALOG[kind], facts)).toEqual([]);
    });
  }
  it('карты покрытия находятся по метке', () => {
    expect(maps.has('Кембридж')).toBe(true);
    expect(maps.has('Янг')).toBe(true);
  });
});

const FACTS: CatalogFacts = {
  recordIds: ['a'],
  shelf: ['Книга', 'Без карты'],
  maps: new Map([['Книга', '| гл. 3, раздел | о чём |\n| гл. 12 | … |']]),
};
const OK: CatalogTopic[] = [
  { id: 'a', status: 'written' },
  {
    id: 'b',
    title: 'Б',
    status: 'planned',
    source: 'Книга',
    chapters: ['гл. 3'],
  },
  { id: 'c', title: 'В', status: 'planned', source: 'Без карты', chapters: [] },
  { id: 'd', title: 'Г', status: 'needs_source', book: 'Автор «Книга», 2020' },
  { id: 'e', title: 'Д', status: 'out_of_scope', why: 'решение владельца' },
];

describe('catalogProblems — сторож на фейках', () => {
  it('правильный каталог — пусто', () => {
    expect(catalogProblems('concern', OK, FACTS)).toEqual([]);
  });
  it('ловит запись без строки, written без записи и повтор', () => {
    const bad: CatalogTopic[] = [
      { id: 'z', status: 'written' },
      { id: 'z', status: 'written' },
    ];
    const out = catalogProblems('concern', bad, FACTS).join('\n');
    expect(out).toContain('«z» — повтор');
    expect(out).toContain('«z» — written, но записи');
    expect(out).toContain('запись «a» есть в справочнике, строки written нет');
  });
  it('ловит planned мимо полки и карты, главу, которой нет, и запись, уже написанную', () => {
    const bad: CatalogTopic[] = [
      {
        id: 'a',
        title: 'А',
        status: 'planned',
        source: 'Книга',
        chapters: ['гл. 1'],
      },
      { id: 'b', title: 'Б', status: 'planned', source: 'Нет', chapters: [] },
      { id: 'c', title: 'В', status: 'planned', source: 'Книга', chapters: [] },
    ];
    const out = catalogProblems('concern', bad, FACTS).join('\n');
    expect(out).toContain('«a» — запись уже есть');
    expect(out).toContain('«гл. 1» нет в карте');
    expect(out).toContain('метки «Нет» нет на полке');
    expect(out).toContain('«c» — у книги есть карта, а глав (chapters) нет');
  });
  it('«гл. 1» не совпадает с «гл. 12» в карте', () => {
    const t: CatalogTopic = {
      id: 'b',
      title: 'Б',
      status: 'planned',
      source: 'Книга',
      chapters: ['гл. 1'],
    };
    expect(
      catalogProblems('concern', [{ id: 'a', status: 'written' }, t], FACTS),
    ).toHaveLength(1);
  });
  it('ловит needs_source без книги и out_of_scope без причины', () => {
    const bad: CatalogTopic[] = [
      { id: 'a', status: 'written' },
      { id: 'd', title: 'Г', status: 'needs_source', book: ' ' },
      { id: 'e', title: 'Д', status: 'out_of_scope', why: '' },
    ];
    expect(catalogProblems('concern', bad, FACTS)).toHaveLength(2);
  });
});

describe('catalogSummary', () => {
  it('считает темы по статусам', () => {
    const s = catalogSummary({
      concern: OK,
      technique: [],
      practice: OK.slice(0, 1),
    });
    expect(s.concern).toEqual({
      written: 1,
      planned: 2,
      needs_source: 1,
      out_of_scope: 1,
      total: 5,
    });
    expect(s.technique.total).toBe(0);
    expect(s.practice.written).toBe(1);
  });
});
