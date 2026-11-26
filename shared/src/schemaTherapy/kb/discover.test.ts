// Обнаружитель таблиц (.claude/rules/knowledge-base.md, раздел 3): файл, где встречаются четыре и
// больше разных id одного вида, обязан быть в реестре KB_TABLES с этим видом или в KB_SCAN_IGNORE.
import { describe, expect, it } from 'vitest';
import { discover, type KbKind } from './check';
import { KB_SCAN_IGNORE, KB_SOURCES, KB_TABLES, kbIds } from './tables';
import { codeFiles, readText } from './kbFs.test-helpers';

const TREES = ['shared/src', 'webapp/src', 'src'];
const KINDS: KbKind[] = ['mode', 'schema', 'technique', 'need'];
const THRESHOLD = 4;

const covers = (entry: string, file: string) =>
  entry.endsWith('/') ? file.startsWith(entry) : file === entry;

describe('обнаружитель таблиц по id', () => {
  const ids = Object.fromEntries(KINDS.map((k) => [k, kbIds(k)])) as Record<
    KbKind,
    readonly string[]
  >;
  const files = TREES.flatMap(codeFiles).filter(
    (f) =>
      !KB_SOURCES.some((s) => covers(s, f)) &&
      !f.includes('/schemaTherapy/kb/'),
  );

  it('находит файлы во всех трёх деревьях', () => {
    for (const tree of TREES)
      expect(
        files.some((f) => f.startsWith(`${tree}/`)),
        tree,
      ).toBe(true);
  });

  it('каждая найденная таблица — в реестре или в исключениях с причиной', () => {
    const problems: string[] = [];
    for (const file of files) {
      const text = readText(file);
      for (const kind of KINDS) {
        const n = discover(text, ids[kind]);
        if (n < THRESHOLD) continue;
        const listed = KB_TABLES.some(
          (t) => t.file === file && t.kind === kind,
        );
        const ignored = KB_SCAN_IGNORE.some((x) => covers(x.file, file));
        if (!listed && !ignored)
          problems.push(
            `${file}: ${n} id вида ${kind} — внеси файл в KB_TABLES (kb/tables*.ts) или в KB_SCAN_IGNORE с причиной`,
          );
      }
    }
    expect(problems).toEqual([]);
  });
});
