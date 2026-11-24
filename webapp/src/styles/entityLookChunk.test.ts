// Состав стартового чанка entity-look (docs/architecture/frontends.md, «Подводные камни» п. 4):
// группа забирает рантайм-зависимости своих модулей, поэтому у них нет рантайм-импортов за её пределами.
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import viteConfig from '../../vite.config.ts';

const THEME = resolve(__dirname, '../../../shared/src/theme');
const GROUP = ['entityLook', 'entityLookMaps', 'entityHue', 'signKeys', 'techniqueSignKeys', 'pathSignKeys'];

type Group = { name: string; test: RegExp; priority?: number };
type ConfigShape = { build: { rolldownOptions: { output: { codeSplitting: { groups: Group[] } } } } };

// Группа, которая заберёт модуль: подходящая с наибольшим priority, при равенстве — первая (как в rolldown).
function chunkOf(id: string): string | null {
  const hits = (viteConfig as unknown as ConfigShape).build.rolldownOptions.output.codeSplitting.groups.filter((g) =>
    g.test.test(id),
  );
  if (hits.length === 0) return null;
  return hits.reduce((best, g) => ((g.priority ?? 0) > (best.priority ?? 0) ? g : best)).name;
}

// Источники рантайм-импортов: `import type`/`export type` и списки из одних `type X` не в счёт.
function runtimeImports(source: string): string[] {
  const out: string[] = [];
  const stmt = /^(?:import|export)\s+([\s\S]*?)\s*from\s+['"]([^'"]+)['"]|^import\s+['"]([^'"]+)['"]/gm;
  for (const m of source.matchAll(stmt)) {
    if (m[3]) {
      out.push(m[3]);
      continue;
    }
    const clause = m[1];
    if (/^type\b/.test(clause)) continue;
    const named = /^\{([\s\S]*)\}$/.exec(clause);
    const specs = named?.[1].split(',').map((s) => s.trim()).filter(Boolean) ?? [];
    if (named && specs.every((s) => /^type\s/.test(s))) continue;
    out.push(m[2]);
  }
  for (const m of source.matchAll(/\bimport\(\s*['"]([^'"]+)['"]/g)) out.push(m[1]);
  return out;
}

describe('чанк entity-look', () => {
  it('модули группы импортируют в рантайме только друг друга', () => {
    const outside = GROUP.flatMap((name) =>
      runtimeImports(readFileSync(join(THEME, `${name}.ts`), 'utf8'))
        .filter((spec) => !GROUP.some((g) => spec === `./${g}` || spec === `./${g}.ts`))
        .map((spec) => `${name}.ts → ${spec}`),
    );
    expect(outside).toEqual([]);
  });

  it('все четыре модуля попадают в entity-look по конфигу сборки', () => {
    for (const name of GROUP) expect(chunkOf(join(THEME, `${name}.ts`))).toBe('entity-look');
  });

  it('react и scheduler уходят в vendor-react, а не в группу данных схем', () => {
    expect(chunkOf('/w/webapp/node_modules/react/index.js')).toBe('vendor-react');
    expect(chunkOf('/w/webapp/node_modules/scheduler/index.js')).toBe('vendor-react');
    expect(chunkOf('/w/webapp/node_modules/react-dom/client.js')).toBe('vendor-react');
    expect(chunkOf('/w/shared/src/needs/needData.ts')).toBe('schema-data');
  });

  it('runtimeImports отличает рантайм-импорт от импорта типов', () => {
    const src = [
      "import type { A } from './a';",
      "import { type B, type C } from './b';",
      "import { D, type E } from './d';",
      "export type { F } from './f';",
      "export { G } from './g';",
      "import {\n  H,\n} from './h';",
      "import './side';",
    ].join('\n');
    expect(runtimeImports(src)).toEqual(['./d', './g', './h', './side']);
  });
});
