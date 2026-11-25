// Ни в одном строковом массиве записи справочника нет повторяющегося пункта (двойное подключение продолжения при слиянии).
import { describe, it, expect } from 'vitest';
import {
  buildConcernGuides,
  buildModeGuides,
  buildPhaseGuides,
  buildSchemaGuides,
  buildTechniqueGuides,
  practiceNotes,
} from './index';
import type { Tr } from './types';

const ty: Tr = (t) => t;
const vy: Tr = (_t, v) => v;

function findDuplicates(value: unknown, path: string, out: string[]): void {
  if (Array.isArray(value)) {
    if (value.length > 0 && value.every((v) => typeof v === 'string')) {
      const seen = new Set<string>();
      const dup = new Set<string>();
      for (const v of value) (seen.has(v) ? dup : seen).add(v);
      if (dup.size)
        out.push(`${path}: ${dup.size} повторов из ${value.length}`);
    }
    value.forEach((v, i) => findDuplicates(v, `${path}[${i}]`, out));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value))
      findDuplicates(v, `${path}.${k}`, out);
  }
}

function entryKey(e: unknown, i: number): string {
  const r = e as Record<string, string | undefined>;
  return r.id ?? r.modeId ?? r.schemaId ?? r.title ?? String(i);
}

describe.each([
  ['ты', ty],
  ['вы', vy],
])('справочник без задвоенных пунктов, форма «%s»', (_n, tr) => {
  const sections: [string, unknown[]][] = [
    ['mode', buildModeGuides(tr)],
    ['schema', buildSchemaGuides(tr)],
    ['technique', buildTechniqueGuides(tr)],
    ['concern', buildConcernGuides(tr)],
    ['practice', practiceNotes(tr)],
    ['phase', buildPhaseGuides(tr)],
  ];
  it.each(sections)('%s', (name, entries) => {
    const out: string[] = [];
    entries.forEach((e, i) =>
      findDuplicates(e, `${name}:${entryKey(e, i)}`, out),
    );
    expect(out).toEqual([]);
  });
});
