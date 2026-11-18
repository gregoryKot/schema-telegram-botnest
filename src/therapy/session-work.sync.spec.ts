// Сверка серверной копии «Что делали» со shared/src/therapy/sessionWork (№4):
// ключи полей, границы и поведение нормализации на одних и тех же входах.
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { runInNewContext } from 'vm';
import * as ts from 'typescript';
import * as server from './session-work';

// shared/ — ESM-пакет, jest бэкенда его не грузит: транспилируем и исполняем,
// относительные импорты каталога подгружаются тем же способом.
function load(path: string): Record<string, any> {
  const js = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const mod = { exports: {} as Record<string, any> };
  const require = (rel: string) => load(join(dirname(path), `${rel}.ts`));
  runInNewContext(js, { module: mod, exports: mod.exports, require });
  return mod.exports;
}
const dir = join(__dirname, '../../shared/src/therapy/sessionWork');
const site = {
  ...load(join(dir, 'fields.ts')),
  ...load(join(dir, 'types.ts')),
};
const siteNormalize = load(join(dir, 'normalize.ts')).normalizeSessionWork;

const keysOf = (defs: [string, string][]) => defs.map(([key]) => key);

describe('session-work ↔ shared/src/therapy/sessionWork', () => {
  it('ключи полей каждого вида совпадают', () => {
    const expected: Record<string, string[]> = {
      custom: keysOf(site.CUSTOM_WORK_FIELDS),
    };
    for (const [id, def] of Object.entries<any>(site.TECHNIQUE_WORK))
      expected[`technique:${id}`] = keysOf(def.fields);
    for (const [id, defs] of Object.entries<any>(site.EXERCISE_WORK_FIELDS))
      expected[`exercise:${id}`] = keysOf(defs);
    expect(server.SESSION_WORK_KEYS).toEqual(expected);
    expect(Object.keys(expected)).toHaveLength(29 + 8 + 1);
  });

  it('границы совпадают', () => {
    for (const name of [
      'WORK_ITEMS_MAX',
      'WORK_VALUE_MAX',
      'WORK_CUSTOM_NAME_MAX',
      'WORK_IDS_MAX',
      'WORK_ID_MAX',
    ] as const)
      expect(server[name]).toBe(site[name]);
    const longest = Math.max(
      ...Object.values(server.SESSION_WORK_KEYS).map((k) => k.length),
    );
    expect(longest).toBeLessThanOrEqual(site.WORK_FIELDS_MAX);
  });

  it('нормализация даёт тот же результат, что на сайте', () => {
    const item = (over: object) => ({
      id: 'a',
      kind: 'technique',
      refId: 'chairwork',
      modeIds: ['m1', 'm1', '', 7, 'x'.repeat(65)],
      schemaIds: Array.from({ length: 20 }, (_, i) => `s${i}`),
      needIds: 'play',
      fields: { theme: '  стыд ', ending: ' ', nope: 'x', roles: 'чужой ключ' },
      ...over,
    });
    const cases: unknown[] = [
      null,
      'строка',
      [item({})],
      [
        item({
          kind: 'custom',
          customName: ` ${'н'.repeat(90)}`,
          fields: { what: 'ж'.repeat(700) },
        }),
      ],
      [item({ kind: 'custom', customName: '  ', fields: null })],
      [
        item({
          kind: 'exercise',
          refId: 'safe',
          fields: { place: 'лес', theme: 'нет' },
        }),
      ],
      [
        item({ refId: 'constructor' }),
        item({ refId: 'safe' }),
        item({ kind: 'song' }),
      ],
      [
        item({ id: '' }),
        item({ id: 5 }),
        null,
        'x',
        item({ refId: undefined }),
      ],
      Array.from({ length: 15 }, (_, i) => item({ id: `i${i}` })),
    ];
    for (const input of cases) {
      const got = server.normalizeSessionWork(input);
      expect(got).toEqual(JSON.parse(JSON.stringify(siteNormalize(input))));
    }
    expect(server.normalizeSessionWork(cases[2])[0]).toEqual({
      id: 'a',
      kind: 'technique',
      refId: 'chairwork',
      modeIds: ['m1'],
      schemaIds: Array.from({ length: 12 }, (_, i) => `s${i}`),
      needIds: [],
      fields: { theme: 'стыд' },
    });
    expect(server.normalizeSessionWork(cases[8])).toHaveLength(12);
  });
});
