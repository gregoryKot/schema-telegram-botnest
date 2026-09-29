// Фильтр покрывающих спеков для Stryker (scripts/stryker/covering-test-files.cjs).
//
// Ночные mutation-волны с 2026-09-21 ни разу не уложились в 60 минут: на
// каждый мутант jest грузил все спеки, импортирующие мутируемый файл, и лишь
// потом пропускал непокрывающие тесты по имени. Фильтр оставляет jest только
// спеки с покрывающими тестами.
//
// Шов здесь двойной, и оба конца проверены живьём, а не моком: Stryker отдаёт
// репортёру пути ПРОЕКТА, а jest в воркере — пути ПЕСОЧНИЦЫ (первый прототип
// на этом и сломался: пересечение пустое, все мутанты «выжили» за секунду);
// jest зовёт `filter` из конфига и верит его ответу — это свойство jest,
// поэтому проверяется настоящим jest, а не вызовом функции.
import { spawnSync } from 'child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { pathToFileURL } from 'url';

interface Plan {
  mutant: { id: string };
  runOptions?: { testFilter?: string[] };
}
interface Reporter {
  onDryRunCompleted(e: {
    result: { tests: { id: string; fileName?: string }[] };
  }): void;
  onMutationTestingPlanReady(e: { mutantPlans: Plan[] }): void;
  wrapUp(): void;
}
interface CoveringTestFiles {
  (testPaths: string[]): Promise<{ filtered: string[] }>;
  MAP_ENV: string;
  ACTIVE_MUTANT_ENV: string;
  buildCoveringFiles(
    tests: { id: string; fileName?: string }[],
    plans: Plan[],
    root?: string,
  ): Record<string, string[]>;
  pickTestPaths(
    paths: string[],
    covering: string[] | undefined,
    root?: string,
  ): string[];
  CoveringTestFilesReporter: new () => Reporter;
}

const ROOT = process.cwd();
const CJS = join(ROOT, 'scripts', 'stryker', 'covering-test-files.cjs');
const PLUGIN = './scripts/stryker/covering-test-files.plugin.mjs';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const filter = require(CJS) as CoveringTestFiles;

const run = (id: string, testFilter?: string[]): Plan => ({
  mutant: { id },
  runOptions: testFilter ? { testFilter } : undefined,
});

describe('covering-test-files: карта мутант → спеки', () => {
  it('берёт спеки покрывающих тестов; одно имя теста в двух спеках — оба', () => {
    const map = filter.buildCoveringFiles(
      [
        { id: 'A ok', fileName: '/proj/src/a.spec.ts' },
        { id: 'B ok', fileName: '/proj/src/b.spec.ts' },
        { id: 'B ok', fileName: '/proj/src/c.spec.ts' },
      ],
      [run('1', ['B ok']), run('2', ['A ok', 'B ok']), run('3')],
      '/proj',
    );
    expect(map).toEqual({
      '1': ['src/b.spec.ts', 'src/c.spec.ts'],
      '2': ['src/a.spec.ts', 'src/b.spec.ts', 'src/c.spec.ts'],
    });
  });

  it('карта из путей проекта сходится со списком из песочницы (баг прототипа)', () => {
    const map = filter.buildCoveringFiles(
      [{ id: 'A ok', fileName: '/proj/src/a.spec.ts' }],
      [run('1', ['A ok'])],
      '/proj',
    );
    const sandbox = '/proj/.stryker-tmp/sandbox-x';
    const related = [`${sandbox}/src/a.spec.ts`, `${sandbox}/src/z.spec.ts`];
    expect(filter.pickTestPaths(related, map['1'], sandbox)).toEqual([
      `${sandbox}/src/a.spec.ts`,
    ]);
  });

  it('нет записи или пересечение пустое — список не трогаем (медленно, но честно)', () => {
    const related = ['/s/src/a.spec.ts', '/s/src/b.spec.ts'];
    expect(filter.pickTestPaths(related, undefined, '/s')).toEqual(related);
    // Контроль: запись есть, но пути не сошлись — не «ноль спеков».
    expect(
      filter.pickTestPaths(related, ['/proj/src/a.spec.ts'], '/s'),
    ).toEqual(related);
  });
});

describe('covering-test-files: репортёр Stryker → фильтр jest', () => {
  let dir: string;
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'covering-'));
    for (const k of [filter.MAP_ENV, filter.ACTIVE_MUTANT_ENV])
      saved[k] = process.env[k];
    process.env[filter.MAP_ENV] = join(dir, 'map.json');
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });
  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    jest.restoreAllMocks();
    rmSync(dir, { recursive: true, force: true });
  });

  it('план готов → карта на диске → фильтр режет список активного мутанта', async () => {
    const reporter = new filter.CoveringTestFilesReporter();
    reporter.onDryRunCompleted({
      result: {
        tests: [{ id: 'A ok', fileName: join(ROOT, 'src/a.spec.ts') }],
      },
    });
    reporter.onMutationTestingPlanReady({ mutantPlans: [run('5', ['A ok'])] });
    const related = [join(ROOT, 'src/a.spec.ts'), join(ROOT, 'src/b.spec.ts')];

    // Пробный прогон: мутант не активен — все связанные спеки.
    delete process.env[filter.ACTIVE_MUTANT_ENV];
    expect((await filter(related)).filtered).toEqual(related);

    process.env[filter.ACTIVE_MUTANT_ENV] = '5';
    expect((await filter(related)).filtered).toEqual([
      join(ROOT, 'src/a.spec.ts'),
    ]);

    reporter.wrapUp();
    expect(existsSync(join(dir, 'map.json'))).toBe(false);
    // Карты нет — как до фильтра.
    expect((await filter(related)).filtered).toEqual(related);
  });

  it('настоящий jest берёт filter из конфига Stryker и отдаёт только покрывающий спек', () => {
    const stryker = JSON.parse(
      readFileSync(join(ROOT, 'stryker.golden-payments.config.json'), 'utf8'),
    ) as { jest: { config: Record<string, unknown> } };
    const pkg = JSON.parse(
      readFileSync(join(ROOT, 'package.json'), 'utf8'),
    ) as {
      jest: Record<string, unknown>;
    };
    const config = JSON.stringify({ ...pkg.jest, ...stryker.jest.config });
    writeFileSync(
      join(dir, 'map.json'),
      JSON.stringify({ '7': ['src/booking/slot.service.spec.ts'] }),
    );
    const listTests = (env: Record<string, string>) =>
      spawnSync(
        'node',
        [
          join(ROOT, 'node_modules/jest/bin/jest.js'),
          ...['--config', config, '--listTests'],
          ...['--findRelatedTests', 'src/booking/slot.service.ts'],
        ],
        { cwd: ROOT, encoding: 'utf8', env: { ...process.env, ...env } },
      )
        .stdout.trim()
        .split('\n')
        .map((p) => p.replace(`${ROOT}/`, ''));

    delete process.env[filter.ACTIVE_MUTANT_ENV];
    const all = listTests({});
    expect(all.length).toBeGreaterThan(1);
    expect(all).toContain('src/booking/slot.service.spec.ts');
    expect(listTests({ [filter.ACTIVE_MUTANT_ENV]: '7' })).toEqual([
      'src/booking/slot.service.spec.ts',
    ]);
  });
});

describe('covering-test-files: подключение', () => {
  it('плагин грузится настоящим @stryker-mutator/api и задаёт путь к карте', () => {
    const env = { ...process.env };
    delete env[filter.MAP_ENV];
    const res = spawnSync(
      'node',
      [
        '--input-type=module',
        '-e',
        `const m = await import('${pathToFileURL(join(ROOT, PLUGIN)).href}');
         console.log(JSON.stringify({
           plugins: m.strykerPlugins.map((p) => [p.kind, p.name]),
           map: process.env.${filter.MAP_ENV},
         }));`,
      ],
      { cwd: ROOT, encoding: 'utf8', env },
    );
    expect(res.stderr).toBe('');
    const out = JSON.parse(res.stdout) as { plugins: string[][]; map: string };
    expect(out.plugins).toEqual([['Reporter', 'covering-test-files']]);
    // Путь задан ДО форка воркеров — иначе фильтру в воркере нечего читать.
    expect(out.map).toMatch(/stryker-covering-test-files-\d+\.json$/);
  });

  // Новая волна без фильтра снова грузила бы все связанные спеки на каждый
  // мутант — и молча упёрлась бы в таймаут. Каждый конфиг с jest-раннером
  // обязан подключать и плагин, и фильтр.
  it('каждый конфиг Stryker с jest-раннером подключает плагин, репортёр и filter', () => {
    const configs = readdirSync(ROOT).filter((f) =>
      /^stryker.*\.config\.json$/.test(f),
    );
    const jestConfigs = configs.filter(
      (f) =>
        (
          JSON.parse(readFileSync(join(ROOT, f), 'utf8')) as {
            testRunner: string;
          }
        ).testRunner === 'jest',
    );
    // Контроль, что сверка вообще что-то проверяет.
    expect(jestConfigs).toEqual(
      expect.arrayContaining([
        'stryker.golden-auth.config.json',
        'stryker.golden-payments.config.json',
      ]),
    );
    for (const f of jestConfigs) {
      const c = JSON.parse(readFileSync(join(ROOT, f), 'utf8')) as {
        appendPlugins?: string[];
        reporters?: string[];
        jest?: { config?: { filter?: string } };
      };
      expect({ f, plugins: c.appendPlugins }).toEqual({ f, plugins: [PLUGIN] });
      expect({
        f,
        reporter: c.reporters?.includes('covering-test-files'),
      }).toEqual({ f, reporter: true });
      expect({ f, filter: c.jest?.config?.filter }).toEqual({
        f,
        filter: '<rootDir>/../scripts/stryker/covering-test-files.cjs',
      });
    }
  });
});
