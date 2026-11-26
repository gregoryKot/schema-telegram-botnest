// Реестр таблиц по id (.claude/rules/knowledge-base.md, раздел 3): полные таблицы держат каждый
// id своего вида, ни одна не держит чужого id, частичные объясняют себя, внешние — со сверкой.
import { describe, expect, it } from 'vitest';
import { coverageProblems, entryProblems } from './check';
import { KB_GROUP_IDS, KB_SCAN_IGNORE, KB_TABLES, kbIds } from './tables';
import { exists, readText } from './kbFs.test-helpers';

const label = (i: number) => `${KB_TABLES[i].file} (${KB_TABLES[i].kind})`;

describe('реестр таблиц базы знаний (kb/tables.ts)', () => {
  it.each(KB_TABLES.map((_, i) => [label(i), i]))(
    '%s: запись реестра заполнена',
    (_, i) => {
      expect(entryProblems(KB_TABLES[i], exists)).toEqual([]);
    },
  );

  it.each(KB_TABLES.map((_, i) => [label(i), i]))(
    '%s: полнота и ни одного чужого id',
    (_, i) => {
      const t = KB_TABLES[i];
      expect(coverageProblems(t, kbIds(t.kind), readText)).toEqual([]);
    },
  );

  it('исключения обнаружителя указывают на существующие файлы и объясняют себя', () => {
    const bad = KB_SCAN_IGNORE.filter(
      (x) => !exists(x.file) || x.why.trim().length < 20,
    );
    expect(
      bad,
      'поправь путь или причину в KB_SCAN_IGNORE (kb/tables.ts)',
    ).toEqual([]);
  });

  it('id групп режимов и доменов не совпадают с id режимов и схем', () => {
    const entries = [...kbIds('mode'), ...kbIds('schema')];
    expect(KB_GROUP_IDS.filter((g) => entries.includes(g))).toEqual([]);
  });
});
