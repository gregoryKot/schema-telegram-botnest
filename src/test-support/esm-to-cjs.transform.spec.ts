// Трансформер ESM-пакетов Nest 12 для jest (src/test-support/esm-to-cjs.transform.cjs):
// без него ни один спек, импортирующий '@nestjs/common', не грузится на Node 22.
import { Injectable } from '@nestjs/common';
import { transformSync, type TransformOptions } from '@babel/core';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compileFunction } from 'node:vm';

interface EsmToCjs {
  babelOptions: TransformOptions;
  process: unknown;
  getCacheKey: (source: string, path: string, options: unknown) => string;
  getCacheKeyAsync: (
    source: string,
    path: string,
    options: unknown,
  ) => Promise<string>;
}

const ROOT = join(__dirname, '..', '..');
const TRANSFORMER = join(__dirname, 'esm-to-cjs.transform.cjs');

// eslint-disable-next-line @typescript-eslint/no-require-imports
const transformer = require('./esm-to-cjs.transform.cjs') as EsmToCjs;

// Форма, на которой падал serve-static: свой `const require` из import.meta
// и `import()` — как ValidationPipe грузит class-validator.
const ESM = `
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
export const url = import.meta.url;
export const dir = import.meta.dirname;
export const pathSep = require('path').sep;
export const load = () => import('path');
`;
const FILE = join(sep, 'pkg', 'dist', 'loader.js');

const compile = (options: TransformOptions): string =>
  transformSync(ESM, { ...options, filename: FILE })?.code ?? '';

type Loaded = {
  url: string;
  dir: string;
  pathSep: string;
  load: () => Promise<{ join: unknown }>;
};

function runAsCommonJs(code: string): Loaded {
  const module = { exports: {} as Loaded };
  // Та же обёртка, что у CJS-модуля: exports/require/module, без ESM-синтаксиса.
  const wrapper = compileFunction(code, ['exports', 'require', 'module']);
  wrapper(module.exports, require, module);
  return module.exports;
}

const readJson = <T>(rel: string): T =>
  JSON.parse(readFileSync(join(ROOT, rel), 'utf8')) as T;

interface JestConfig {
  transform: Record<string, string>;
  transformIgnorePatterns: string[];
}

// Первый шаблон со списком `@nestjs/(common|core|…)`. Нет списка — ошибка:
// молчаливо пустой результат прошёл бы сверку с таким же пустым.
const LIST_RE = /@nestjs\/\(([^)]+)\)/;

function packagesIn(patterns: string[], where: string): string[] {
  const hit = patterns.map((p) => LIST_RE.exec(p)).find((m) => m !== null);
  if (!hit) throw new Error(`${where}: нет списка «@nestjs/(a|b|…)»`);
  return hit[1].split('|').sort();
}

/** Четыре места, где перечислены ESM-пакеты Nest: они обязаны совпадать. */
function wiredLists(): Record<string, string[]> {
  const pkg = readJson<{ jest: JestConfig }>('package.json').jest;
  const e2e = readJson<JestConfig>('test/jest-e2e.json');
  const from = (file: string, c: JestConfig): Record<string, string[]> => ({
    [`${file}: transform`]: packagesIn(Object.keys(c.transform), file),
    [`${file}: transformIgnorePatterns`]: packagesIn(
      c.transformIgnorePatterns,
      file,
    ),
  });
  return { ...from('package.json', pkg), ...from('test/jest-e2e.json', e2e) };
}

/** Расхождения всех списков с первым: по строке на каждый расходящийся. */
function mismatches(lists: Record<string, string[]>): string[] {
  const [[refName, ref], ...rest] = Object.entries(lists);
  return rest.flatMap(([name, list]) => {
    const missing = ref.filter((p) => !list.includes(p));
    const extra = list.filter((p) => !ref.includes(p));
    if (!missing.length && !extra.length) return [];
    return [
      `${name} против ${refName}: нет [${missing.join(', ')}], лишнее [${extra.join(', ')}]`,
    ];
  });
}

describe('esm-to-cjs.transform', () => {
  it('ESM с import.meta, своим require и import() исполняется как CommonJS', async () => {
    const code = compile(transformer.babelOptions);
    expect(code).not.toMatch(/import\.meta|\bimport\(|^\s*(import|export)\s/m);

    const m = runAsCommonJs(code);
    expect(m.url).toBe(pathToFileURL(FILE).href);
    expect(m.dir).toBe(join(sep, 'pkg', 'dist'));
    expect(m.pathSep).toBe(sep);
    expect(typeof (await m.load()).join).toBe('function');
  });

  it('КОНТРОЛЬ: без своих плагинов import.meta и import() остаются в выводе', () => {
    const bare = compile({
      ...transformer.babelOptions,
      plugins: ['@babel/plugin-transform-modules-commonjs'],
    });
    expect(bare).toMatch(/import\.meta/);
    expect(bare).toMatch(/\bimport\('path'\)/);
  });

  it('@nestjs/common — только ESM и через трансформер грузится в jest', () => {
    const pkg = require.resolve('@nestjs/common/package.json');
    const { type } = JSON.parse(readFileSync(pkg, 'utf8')) as { type: string };
    expect(type).toBe('module');
    expect(typeof Injectable).toBe('function');
    expect(typeof transformer.process).toBe('function');
  });

  // Прод (`node dist/main`, Docker node:22-slim) грузит те же пакеты без
  // трансформера — через require(esm) самого Node 22.12+. Вне jest.
  it('все @nestjs/* из dependencies грузятся голым Node через require()', () => {
    const { dependencies } = readJson<{ dependencies: Record<string, string> }>(
      'package.json',
    );
    const names = Object.keys(dependencies).filter((n) =>
      n.startsWith('@nestjs/'),
    );
    expect(names).toEqual(
      expect.arrayContaining(['@nestjs/common', '@nestjs/core']),
    );

    const run = spawnSync(
      process.execPath,
      ['-e', names.map((n) => `require(${JSON.stringify(n)});`).join('')],
      { cwd: ROOT, encoding: 'utf8' },
    );
    expect({ status: run.status, stderr: run.stderr }).toMatchObject({
      status: 0,
    });
  }, 30_000);

  describe('список пакетов в jest-конфигах', () => {
    it('@nestjs/(…) один во всех четырёх местах: transform и transformIgnorePatterns в package.json и test/jest-e2e.json', () => {
      const lists = wiredLists();
      expect(Object.keys(lists)).toHaveLength(4);
      expect(Object.values(lists)[0]).toEqual(
        expect.arrayContaining(['common', 'core']),
      );
      expect(mismatches(lists)).toEqual([]);
    });

    it('КОНТРОЛЬ: пропавший или лишний пакет в одном из мест ловится', () => {
      const ok = ['common', 'core', 'testing'];
      const four = { a: ok, b: ok, c: ok, d: ok };
      expect(mismatches(four)).toEqual([]);

      expect(mismatches({ ...four, d: ['common', 'core'] })).toEqual([
        'd против a: нет [testing], лишнее []',
      ]);
      expect(mismatches({ ...four, b: [...ok, 'throttler'] })).toEqual([
        'b против a: нет [], лишнее [throttler]',
      ]);
    });

    it('КОНТРОЛЬ: место без списка — ошибка, а не пустой список', () => {
      expect(() => packagesIn(['^.+\\.(t|j)s$'], 'где-то')).toThrow(/где-то/);
    });
  });

  describe('ключ кэша', () => {
    const SOURCE = 'export const a = 1;';
    const FILE = join(ROOT, 'node_modules', '@nestjs', 'common', 'index.js');
    // То, что jest отдаёт трансформеру; babel-jest берёт отсюда cwd/rootDir.
    const jestOptions = {
      config: { cwd: ROOT, rootDir: join(ROOT, 'src') },
      configString: '{}',
      instrument: false,
    };
    const fileSalt = createHash('sha1')
      .update(readFileSync(TRANSFORMER))
      .digest('hex');

    /** Тот же файл трансформера, но `readFileSync(__filename)` отдаёт `content`. */
    function loadReading(content: string): EsmToCjs {
      const module = { exports: {} as EsmToCjs };
      const wrapper = compileFunction(readFileSync(TRANSFORMER, 'utf8'), [
        'exports',
        'require',
        'module',
        '__filename',
      ]);
      const fakeRequire = (id: string): unknown =>
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        id === 'node:fs' ? { readFileSync: () => content } : require(id);
      wrapper(module.exports, fakeRequire, module, TRANSFORMER);
      return module.exports;
    }

    it('в ключе — sha1 файла трансформера, sync и async', async () => {
      expect(transformer.getCacheKey(SOURCE, FILE, jestOptions)).toMatch(
        new RegExp(`:${fileSalt}$`),
      );
      expect(
        await transformer.getCacheKeyAsync(SOURCE, FILE, jestOptions),
      ).toMatch(new RegExp(`:${fileSalt}$`));
    });

    it('правка файла трансформера меняет ключ (иначе кэш отдаёт старый перевод)', () => {
      const original = readFileSync(TRANSFORMER, 'utf8');
      const same = loadReading(original).getCacheKey(SOURCE, FILE, jestOptions);
      const edited = loadReading(`${original}\n// правка`).getCacheKey(
        SOURCE,
        FILE,
        jestOptions,
      );
      expect(same).toBe(transformer.getCacheKey(SOURCE, FILE, jestOptions));
      expect(edited).not.toBe(same);
    });
  });
});
