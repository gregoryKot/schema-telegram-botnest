// Тесты merge-драйверов репозитория (scripts/merge-json-ratchet.mjs,
// scripts/setup-merge-drivers.mjs --check).
//
// Драйвер — такой же гейт, как остальные, и ломается так же тихо: если он
// перестанет сводить бейслайны, git просто вернётся к текстовому слиянию,
// никто ничего не заметит, а агенты снова начнут руками «выбирать свою
// сторону» и молча ронять чужой прогресс храповика.
//
// Поэтому здесь проверяются ОБА исхода (правило CLAUDE.md про тесты гейтов):
// драйвер сводит там, где текстовое слияние конфликтует, и НЕ сводит там,
// где однозначного ответа нет (отдаёт конфликт человеку, а не выдумывает).
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { spawnSync } from 'child_process';
import { runGate } from './gate-sandbox';
import { importExport } from './pattern-loader';

const REAL_SCRIPTS = join(__dirname, '..', '..', '..', 'scripts');
const RATCHET = 'merge-json-ratchet.mjs';
const RULES = 'merge-json-ratchet-rules.mjs';
const HISTORY = 'merge-json-ratchet-history.mjs';

/** Драйвер с модулями режимов и истории — в `<tmp>/scripts/`, как в репозитории. */
function copyDriver(tmp: string, extra: string[] = []): void {
  mkdirSync(join(tmp, 'scripts'), { recursive: true });
  for (const name of [RATCHET, RULES, HISTORY, ...extra]) {
    copyFileSync(join(REAL_SCRIPTS, name), join(tmp, 'scripts', name));
  }
}

/** Прогон драйвера напрямую на трёх версиях файла — так же, как его зовёт git
 *  (%O предок, %A наша версия и она же выход, %B их версия, %P путь файла —
 *  для сообщений и исключений KEY_MODES). Возвращает код выхода и результат. */
function mergeJson(
  direction: 'min' | 'max' | 'sum',
  ancestor: unknown,
  ours: unknown,
  theirs: unknown,
  label = 'baseline.json',
): { status: number | null; merged: unknown; stderr: string } {
  const tmp = mkdtempSync(join(tmpdir(), 'ratchet-'));
  try {
    copyDriver(tmp);
    const write = (name: string, value: unknown) => {
      const path = join(tmp, name);
      writeFileSync(
        path,
        typeof value === 'string' ? value : JSON.stringify(value, null, 2),
      );
      return path;
    };
    const o = write('o.json', ancestor);
    const a = write('a.json', ours);
    const b = write('b.json', theirs);
    const res = spawnSync(
      'node',
      [join(tmp, 'scripts', RATCHET), direction, o, a, b, label],
      { cwd: tmp, encoding: 'utf8' },
    );
    let merged: unknown = null;
    try {
      merged = JSON.parse(readFileSync(a, 'utf8'));
    } catch {
      merged = null;
    }
    return { status: res.status, merged, stderr: res.stderr ?? '' };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/** git-репозиторий в песочнице, драйверы в котором ставит НАСТОЯЩИЙ
 *  `setup-merge-drivers.mjs` (тот, что зовёт npm `prepare`): режим, который
 *  `.gitattributes` называет, а установка забыла, тест увидит так же, как
 *  увидел бы агент, — текстовым конфликтом. */
function repoWithRealDrivers(tmp: string) {
  const git = (...args: string[]) =>
    spawnSync('git', args, { cwd: tmp, encoding: 'utf8' });
  git('init', '-q', '.');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'test');
  copyDriver(tmp, ['setup-merge-drivers.mjs', 'merge-drivers-check.mjs']);
  const setup = spawnSync('node', ['scripts/setup-merge-drivers.mjs'], {
    cwd: tmp,
    encoding: 'utf8',
  });
  if (setup.status !== 0)
    throw new Error(`setup-merge-drivers: ${setup.stderr}`);
  return git;
}

describe('merge-json-ratchet: слияние бейслайнов по семантике храповика', () => {
  it('min: обе стороны ужали разные файлы — сохраняются оба ужатия', () => {
    const { status, merged } = mergeJson(
      'min',
      { 'a.ts': 100, 'b.ts': 200 },
      { 'a.ts': 80, 'b.ts': 200 },
      { 'a.ts': 100, 'b.ts': 150 },
    );
    expect(status).toBe(0);
    expect(merged).toEqual({ 'a.ts': 80, 'b.ts': 150 });
  });

  it('min: обе стороны ужали ОДИН файл — берётся меньшее (планка не падает)', () => {
    const { status, merged } = mergeJson(
      'min',
      { 'a.ts': 100 },
      { 'a.ts': 90 },
      { 'a.ts': 70 },
    );
    expect(status).toBe(0);
    expect(merged).toEqual({ 'a.ts': 70 });
  });

  // Инцидент 2026-09-16 (PR #496): ветка отведена от старого main, за это время
  // main принял через `--update` законный рост чужих файлов. Ветка их не
  // трогала — и «всегда min» брал её старые значения, то есть размеры, которых
  // на слитом дереве уже нет. `check-file-size-ratchet.mjs` после такого
  // слияния краснел на файлы, к которым ветка не прикасалась.
  it('min: main поднял ключ через --update, ветка не трогала — остаётся значение main', () => {
    const base = {
      'src/api/api.module.ts': 59,
      'src/auth/merge.service.ts': 306,
      'src/channel/channel-schedule.service.ts': 185,
      'src/own.ts': 200,
    };
    const { status, merged } = mergeJson(
      'min',
      base,
      // ветка: тронула только свой файл, чужие — как были у предка
      { ...base, 'src/own.ts': 180 },
      // main: рост трёх чужих файлов, принятый осознанно через --update
      {
        ...base,
        'src/api/api.module.ts': 62,
        'src/auth/merge.service.ts': 342,
        'src/channel/channel-schedule.service.ts': 213,
      },
    );
    expect(status).toBe(0);
    expect(merged).toEqual({
      'src/api/api.module.ts': 62,
      'src/auth/merge.service.ts': 342,
      'src/channel/channel-schedule.service.ts': 213,
      'src/own.ts': 180,
    });
  });

  // Контроль к предыдущему: «сторона не трогала — берём вторую» не должно
  // превратиться в «берём ту, что больше». Когда ключ двинули ОБЕ стороны,
  // храповик работает как прежде — прогресс обеих сохраняется.
  it('контроль: обе стороны опустили один ключ — берётся минимум из двух', () => {
    const { status, merged } = mergeJson(
      'min',
      { 'src/api/api.module.ts': 59 },
      { 'src/api/api.module.ts': 55 },
      { 'src/api/api.module.ts': 51 },
    );
    expect(status).toBe(0);
    expect(merged).toEqual({ 'src/api/api.module.ts': 51 });
  });

  // Зеркало того же для max: сторона, не трогавшая пол покрытия, не тянет его
  // вниз, а две поднявшие по-прежнему сводятся по лучшему.
  it('max: одна сторона опустила пол осознанно — её значение и остаётся', () => {
    const { status, merged } = mergeJson(
      'max',
      { floors: { 'src/api': 78 } },
      { floors: { 'src/api': 78 } },
      { floors: { 'src/api': 71 } },
    );
    expect(status).toBe(0);
    expect(merged).toEqual({ floors: { 'src/api': 71 } });
  });

  it('max: покрытие сводится по лучшему, включая вложенные полы', () => {
    const { status, merged } = mergeJson(
      'max',
      { lines: 90, floors: { 'src/auth': 80, 'src/api': 70 } },
      { lines: 93.1, floors: { 'src/auth': 85, 'src/api': 70 } },
      { lines: 91, floors: { 'src/auth': 80, 'src/api': 78 } },
    );
    expect(status).toBe(0);
    expect(merged).toEqual({
      lines: 93.1,
      floors: { 'src/auth': 85, 'src/api': 78 },
    });
  });

  it('файл, удалённый одной стороной, исчезает из бейслайна', () => {
    const { status, merged } = mergeJson(
      'min',
      { 'a.ts': 100, 'gone.ts': 50 },
      { 'a.ts': 90, 'gone.ts': 50 },
      { 'a.ts': 100 },
    );
    expect(status).toBe(0);
    expect(merged).toEqual({ 'a.ts': 90 });
  });

  it('новые файлы обеих сторон доезжают оба', () => {
    const { status, merged } = mergeJson(
      'min',
      { 'a.ts': 100 },
      { 'a.ts': 100, 'ours.ts': 40 },
      { 'a.ts': 100, 'theirs.ts': 60 },
    );
    expect(status).toBe(0);
    expect(merged).toEqual({ 'a.ts': 100, 'ours.ts': 40, 'theirs.ts': 60 });
  });

  // Стороны приходят такими, какими их пишет `--update` — то есть уже
  // отсортированными по пути. Драйвер обязан отдать столь же отсортированный
  // файл, иначе следующий `--update` даст шум в диффе на ровном месте.
  it('отсортированный по пути бейслайн остаётся отсортированным', () => {
    const { merged } = mergeJson(
      'min',
      { 'a.ts': 1, 'b.ts': 2, 'c.ts': 3 },
      { 'a.ts': 1, 'aa.ts': 9, 'b.ts': 2, 'c.ts': 3 },
      { 'a.ts': 1, 'b.ts': 2, 'bb.ts': 9, 'c.ts': 3 },
    );
    expect(Object.keys(merged as object)).toEqual([
      'a.ts',
      'aa.ts',
      'b.ts',
      'bb.ts',
      'c.ts',
    ]);
  });

  // `_` и `-` (и регистр) две сортировки ставят по-разному. Реестр
  // raw-sql-live сверяет порядок обычным `.sort()` (code point,
  // check-raw-sql-live.mjs), и драйвер с `localeCompare` ставил `b_c.ts`
  // перед `b-c.ts` — гейт краснел после автослияния.
  it('ключ с `_`: порядок по code point, как сверяет check-raw-sql-live', () => {
    const { status, merged } = mergeJson(
      'min',
      { 'src/a/a.ts': 'x' },
      { 'src/a/a.ts': 'x', 'src/a/b-c.ts': 'наша' },
      { 'src/a/a.ts': 'x', 'src/a/b_c.ts': 'их' },
    );
    expect(status).toBe(0);
    const keys = Object.keys(merged as object);
    expect(keys).toEqual(['src/a/a.ts', 'src/a/b-c.ts', 'src/a/b_c.ts']);
    expect(keys).toEqual([...keys].sort());
  });

  // Контрольный образец: пофайловые `--update` (file-size, robot-phrases, …)
  // пишут `localeCompare`, и такой бейслайн драйвер не переставляет в code
  // point — иначе следующий `--update` дал бы шум в диффе.
  it('бейслайн, отсортированный localeCompare, остаётся в localeCompare', () => {
    const { merged } = mergeJson(
      'min',
      { 'src/a.ts': 1, 'src/c.ts': 3 },
      { 'src/a.ts': 1, 'src/c.ts': 2 },
      { 'src/a.ts': 1, 'src/B.ts': 5, 'src/c.ts': 3 },
    );
    const keys = Object.keys(merged as object);
    expect(keys).toEqual(['src/a.ts', 'src/B.ts', 'src/c.ts']);
    expect(keys).not.toEqual([...keys].sort());
  });

  it('строка (причина в dead-files): сторона, не трогавшая место, уступает', () => {
    const { status, merged } = mergeJson(
      'min',
      { 'src/main.ts': 'старая причина' },
      { 'src/main.ts': 'старая причина' },
      { 'src/main.ts': 'новая причина' },
    );
    expect(status).toBe(0);
    expect(merged).toEqual({ 'src/main.ts': 'новая причина' });
  });

  it('НЕ сводит, когда обе стороны написали разные строки — конфликт человеку', () => {
    const { status, stderr } = mergeJson(
      'min',
      { 'src/main.ts': 'исходная' },
      { 'src/main.ts': 'наша' },
      { 'src/main.ts': 'их' },
    );
    expect(status).toBe(1);
    expect(stderr).toContain('несводимое расхождение');
  });

  it('НЕ сводит битый JSON — конфликт человеку, а не пустой бейслайн', () => {
    const { status, stderr } = mergeJson(
      'min',
      { 'a.ts': 1 },
      '{ это не json',
      { 'a.ts': 2 },
    );
    expect(status).toBe(1);
    expect(stderr).toContain('не разбирается как JSON');
  });
});

// 2026-11-06, шесть параллельных веток: обе дописали по блоку в один файл
// (123→128 и 123→125, слитый файл — 130 строк), обе подняли `webapp:total-js`.
// min ставил одно из двух значений, и CI после слияния краснел «вырос» — рост
// второй стороны терялся. Счётчик складывается: база плюс обе дельты.
describe('merge-json-ratchet sum: счётчик, сдвинутый обеими сторонами, складывается', () => {
  const STATS = 'src/bot/stats-sections.ts';

  it('обе стороны дописали в один файл — база плюс оба прироста', () => {
    const args = [
      { [STATS]: 123, 'b.ts': 40 },
      { [STATS]: 128, 'b.ts': 40 },
      { [STATS]: 125, 'b.ts': 44 },
    ] as const;
    const sum = mergeJson('sum', ...args);
    expect(sum.status).toBe(0);
    expect(sum.merged).toEqual({ [STATS]: 130, 'b.ts': 44 });
    // контроль: прежний режим на том же входе — меньше, чем на слитом дереве
    expect(mergeJson('min', ...args).merged).toEqual({
      [STATS]: 125,
      'b.ts': 44,
    });
  });

  it('одна сторона ужала, другая дописала — дельты складываются со знаком', () => {
    const args = [{ 'a.ts': 200 }, { 'a.ts': 210 }, { 'a.ts': 190 }] as const;
    expect(mergeJson('sum', ...args).merged).toEqual({ 'a.ts': 200 });
    // min отдал бы 190 — на дереве 200, гейт краснел бы на чужом росте
    expect(mergeJson('min', ...args).merged).toEqual({ 'a.ts': 190 });
  });

  it('обе ужали разными починками — сохраняются оба ужатия', () => {
    const args = [{ 'x.tsx': 4 }, { 'x.tsx': 3 }, { 'x.tsx': 2 }] as const;
    expect(mergeJson('sum', ...args).merged).toEqual({ 'x.tsx': 1 });
    // min молча терял ужатие одной стороны: планка 2 при дереве 1
    expect(mergeJson('min', ...args).merged).toEqual({ 'x.tsx': 2 });
  });

  it('обе убрали одно и то же — планка не уходит ниже нуля', () => {
    const { merged } = mergeJson(
      'sum',
      { 'x.tsx': 2 },
      { 'x.tsx': 0 },
      { 'x.tsx': 1 },
    );
    expect(merged).toEqual({ 'x.tsx': 0 });
  });

  it('новый ключ с обеих сторон — один файл, рождённый дважды: max, не сумма', () => {
    const { status, merged } = mergeJson(
      'sum',
      { 'a.ts': 10 },
      { 'a.ts': 10, 'new.ts': 40 },
      { 'a.ts': 10, 'new.ts': 60 },
    );
    expect(status).toBe(0);
    expect(merged).toEqual({ 'a.ts': 10, 'new.ts': 60 });
  });

  it('ключ, удалённый одной стороной, удаляется, даже если другая его растила', () => {
    const { status, merged } = mergeJson(
      'sum',
      { 'a.ts': 10, 'gone.ts': 50 },
      { 'a.ts': 12 },
      { 'a.ts': 15, 'gone.ts': 70 },
    );
    expect(status).toBe(0);
    expect(merged).toEqual({ 'a.ts': 17 });
  });

  it('вложенные счётчики (eslint byRule) складываются по своим ключам', () => {
    const { merged } = mergeJson(
      'sum',
      { total: 5, byRule: { r1: 3, r2: 2 } },
      { total: 4, byRule: { r1: 2, r2: 2 } },
      { total: 6, byRule: { r1: 3, r2: 3 } },
    );
    expect(merged).toEqual({ total: 5, byRule: { r1: 2, r2: 3 } });
  });

  // Самый тяжёлый чанк — максимум по чанкам: сумма дельт приписала бы рост
  // одного чанка другому. Исключение задано явно, по файлу (KEY_MODES в
  // merge-json-ratchet-rules.mjs), а не по виду имени ключа.
  const BUNDLE = 'scripts/bundle-size-baseline.json';
  const bundle = [
    { 'webapp:largest-chunk': 450000, 'webapp:total-js': 3500000 },
    { 'webapp:largest-chunk': 450100, 'webapp:total-js': 3500512 },
    { 'webapp:largest-chunk': 452000, 'webapp:total-js': 3508192 },
  ] as const;

  it('бандл: total-js — сумма дельт, largest-chunk — max', () => {
    const { status, merged } = mergeJson('sum', ...bundle, BUNDLE);
    expect(status).toBe(0);
    expect(merged).toEqual({
      'webapp:largest-chunk': 452000,
      'webapp:total-js': 3508704,
    });
    // контроль: прежний min оставлял total-js одной стороны — на 8 КБ ниже дерева
    expect(mergeJson('min', ...bundle, BUNDLE).merged).toEqual({
      'webapp:largest-chunk': 450100,
      'webapp:total-js': 3500512,
    });
  });

  it('контроль: исключение привязано к файлу — тот же ключ в другом файле суммируется', () => {
    const { merged } = mergeJson(
      'sum',
      ...bundle,
      'scripts/other-baseline.json',
    );
    expect(merged).toEqual({
      'webapp:largest-chunk': 452100,
      'webapp:total-js': 3508704,
    });
  });

  it('НЕ сводит строки-причины и в sum-режиме — конфликт человеку', () => {
    const { status, stderr } = mergeJson(
      'sum',
      { k: 'исходная' },
      { k: 'наша' },
      { k: 'их' },
    );
    expect(status).toBe(1);
    expect(stderr).toContain('несводимое расхождение');
  });
});

describe('KEY_MODES сверен с настоящими бейслайнами и .gitattributes', () => {
  // Два места, обязанные совпадать (правило №4): ключ переименовали в гейте —
  // исключение молча перестаёт работать, и самый тяжёлый чанк начнёт
  // складываться. Файл увели с ratchet-sum — исключение ничего не значит.
  const REPO = join(REAL_SCRIPTS, '..');
  const leaves = (v: unknown, p = ''): Record<string, unknown> =>
    typeof v === 'object' && v !== null && !Array.isArray(v)
      ? Object.assign(
          {},
          ...Object.entries(v).map(([k, x]) => leaves(x, p ? `${p}.${k}` : k)),
        )
      : { [p]: v };

  it('каждое исключение — про sum-файл, живой ключ-число и известный режим', () => {
    const keyModes = JSON.parse(
      importExport(RULES, 'KEY_MODES', '(x) => x'),
    ) as Record<string, Record<string, string>>;
    const modes = JSON.parse(
      importExport(RULES, 'MODES', '(x) => x'),
    ) as string[];
    const attributes = readFileSync(join(REPO, '.gitattributes'), 'utf8');
    expect(Object.keys(keyModes).length).toBeGreaterThan(0);
    for (const [file, keys] of Object.entries(keyModes)) {
      const line = attributes
        .split('\n')
        .find((l) => l.split(/\s+/)[0] === file);
      expect(line?.trim().split(/\s+/)).toEqual([file, 'merge=ratchet-sum']);
      const values = leaves(JSON.parse(readFileSync(join(REPO, file), 'utf8')));
      for (const [key, mode] of Object.entries(keys)) {
        expect(modes).toContain(mode);
        expect(typeof values[key]).toBe('number');
      }
    }
  });
});

describe('merge-json-ratchet: настоящее слияние git', () => {
  /** Репозиторий с двумя «агентами», правящими ОДНУ строку бейслайна.
   *  withDriver=false — контроль: без драйвера это обязано конфликтовать,
   *  иначе тест выше ничего не доказывает. */
  function twoAgentsMerge(withDriver: boolean): {
    status: number | null;
    baseline: string;
  } {
    const tmp = mkdtempSync(join(tmpdir(), 'gitmerge-'));
    try {
      const git = (...args: string[]) =>
        spawnSync('git', args, { cwd: tmp, encoding: 'utf8' });
      git('init', '-q', '.');
      git('config', 'user.email', 'test@example.com');
      git('config', 'user.name', 'test');
      copyDriver(tmp);
      if (withDriver) {
        git(
          'config',
          'merge.ratchet-max.driver',
          `node scripts/merge-json-ratchet.mjs max %O %A %B %P`,
        );
      }
      writeFileSync(
        join(tmp, '.gitattributes'),
        'scripts/cov.json merge=ratchet-max\n',
      );
      const cov = join(tmp, 'scripts', 'cov.json');
      writeFileSync(cov, '{\n  "lines": 90\n}\n');
      git('add', '-A');
      git('commit', '-qm', 'base');
      const base = git('rev-parse', '--abbrev-ref', 'HEAD').stdout.trim();

      git('checkout', '-qb', 'agent-b');
      writeFileSync(cov, '{\n  "lines": 92\n}\n');
      git('commit', '-qam', 'агент B: 90 → 92');

      git('checkout', '-q', base);
      writeFileSync(cov, '{\n  "lines": 91\n}\n');
      git('commit', '-qam', 'агент A: 90 → 91');

      const merge = git('merge', 'agent-b', '-m', 'merge');
      return { status: merge.status, baseline: readFileSync(cov, 'utf8') };
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }

  it('с драйвером конфликта нет и остаётся лучшее значение', () => {
    const { status, baseline } = twoAgentsMerge(true);
    expect(status).toBe(0);
    expect(JSON.parse(baseline)).toEqual({ lines: 92 });
  });

  it('контроль: без драйвера та же пара веток конфликтует', () => {
    const { status, baseline } = twoAgentsMerge(false);
    expect(status).not.toBe(0);
    expect(baseline).toContain('<<<<<<<');
  });

  // Сквозная проверка инцидента 2026-09-16: важно не только, что функция
  // считает верно, но и что git отдаёт драйверу настоящую базу слияния (%O) —
  // ту точку, от которой ветка отведена, а не текущий main. Возьми драйвер
  // предка неверно, и «ветка не трогала» превратится в «трогали обе».
  it('ветка от старого main: рост, принятый в main, переживает слияние', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'stale-branch-'));
    try {
      const git = (...args: string[]) =>
        spawnSync('git', args, { cwd: tmp, encoding: 'utf8' });
      git('init', '-q', '.');
      git('config', 'user.email', 'test@example.com');
      git('config', 'user.name', 'test');
      git(
        'config',
        'merge.ratchet-min.driver',
        'node scripts/merge-json-ratchet.mjs min %O %A %B %P',
      );
      copyDriver(tmp);
      writeFileSync(
        join(tmp, '.gitattributes'),
        'scripts/sizes.json merge=ratchet-min\n',
      );
      const sizes = join(tmp, 'scripts', 'sizes.json');
      const write = (value: Record<string, number>) =>
        writeFileSync(sizes, JSON.stringify(value, null, 2) + '\n');

      write({ 'api.module.ts': 59, 'merge.service.ts': 306, 'own.ts': 200 });
      git('add', '-A');
      git('commit', '-qm', 'база: точка, от которой отведена ветка');
      const main = git('rev-parse', '--abbrev-ref', 'HEAD').stdout.trim();

      git('checkout', '-qb', 'feature');
      write({ 'api.module.ts': 59, 'merge.service.ts': 306, 'own.ts': 180 });
      git('commit', '-qam', 'ветка: ужала свой файл');

      git('checkout', '-q', main);
      write({ 'api.module.ts': 62, 'merge.service.ts': 342, 'own.ts': 200 });
      git('commit', '-qam', 'main: --update после законного роста двух файлов');

      const merge = git('merge', 'feature', '-m', 'merge');
      expect(merge.status).toBe(0);
      expect(JSON.parse(readFileSync(sizes, 'utf8'))).toEqual({
        'api.module.ts': 62,
        'merge.service.ts': 342,
        'own.ts': 180,
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('setup-merge-drivers --check: атрибут без драйвера не проходит', () => {
  const SETUP = 'setup-merge-drivers.mjs';
  const REPO = join(REAL_SCRIPTS, '..');
  const STUBS = {
    'scripts/merge-json-ratchet.mjs': '// заглушка, проверяется наличие',
  };

  /** Настоящие бейслайны репозитория как пустые заглушки: гейт смотрит на
   *  имена файлов, а не на содержимое. Без них песочница была бы пустой, и
   *  тест зеленел бы даже на дыре «бейслайн без атрибута». */
  function realBaselines(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const dir of ['scripts', 'e2e-browser']) {
      for (const f of readdirSync(join(REPO, dir))) {
        if (f.endsWith('-baseline.json')) out[`${dir}/${f}`] = '{}';
      }
    }
    return out;
  }

  it('зеленеет на настоящем .gitattributes репозитория', () => {
    const attributes = readFileSync(join(REPO, '.gitattributes'), 'utf8');
    const baselines = realBaselines();
    // страховка от пустой песочницы: тест обязан видеть реальные бейслайны
    expect(Object.keys(baselines).length).toBeGreaterThan(30);
    const res = runGate(
      SETUP,
      { '.gitattributes': attributes, ...STUBS, ...baselines },
      { args: ['--check'] },
    );
    expect(res.stderr).toBe('');
    expect(res.status).toBe(0);
  });

  it('краснеет на merge=<имя>, которому нет драйвера', () => {
    const res = runGate(
      SETUP,
      { '.gitattributes': 'some/file.json merge=ratchet-median\n', ...STUBS },
      { args: ['--check'] },
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('ratchet-median');
  });

  const ATTR = 'scripts/foo-baseline.json  merge=ratchet-min\n';

  it('краснеет на бейслайне без строки в .gitattributes', () => {
    const res = runGate(
      SETUP,
      {
        '.gitattributes': 'scripts/bar-baseline.json  merge=ratchet-min\n',
        'scripts/foo-baseline.json': '{}',
        'scripts/bar-baseline.json': '{}',
        ...STUBS,
      },
      { args: ['--check'] },
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('scripts/foo-baseline.json');
    expect(res.stderr).not.toContain('scripts/bar-baseline.json');
  });

  it('зеленеет, когда у бейслайна есть строка с драйвером', () => {
    const res = runGate(
      SETUP,
      { '.gitattributes': ATTR, 'scripts/foo-baseline.json': '{}', ...STUBS },
      { args: ['--check'] },
    );
    expect(res.status).toBe(0);
  });

  it('e2e-browser/*-baseline.json учитывается так же, как scripts/', () => {
    const files = {
      'e2e-browser/a11y-baseline.json': '{}',
      ...STUBS,
    };
    const without = runGate(
      SETUP,
      { '.gitattributes': '', ...files },
      {
        args: ['--check'],
      },
    );
    expect(without.status).toBe(1);
    expect(without.stderr).toContain('e2e-browser/a11y-baseline.json');
    const withAttr = runGate(
      SETUP,
      {
        '.gitattributes': 'e2e-browser/a11y-baseline.json merge=ratchet-min\n',
        ...files,
      },
      { args: ['--check'] },
    );
    expect(withAttr.status).toBe(0);
  });

  it('краснеет на протухшей строке: файла бейслайна нет на диске', () => {
    const res = runGate(
      SETUP,
      { '.gitattributes': ATTR, ...STUBS },
      { args: ['--check'] },
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('протухла');
    expect(res.stderr).toContain('scripts/foo-baseline.json');
  });

  it('встроенный merge=text для бейслайна не годится', () => {
    const res = runGate(
      SETUP,
      {
        '.gitattributes': 'scripts/foo-baseline.json  merge=text\n',
        'scripts/foo-baseline.json': '{}',
        ...STUBS,
      },
      { args: ['--check'] },
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('merge=text');
  });

  it('контроль: небейслайновый файл без атрибута гейту не интересен', () => {
    const res = runGate(
      SETUP,
      { '.gitattributes': '', 'scripts/check-foo.mjs': '//', ...STUBS },
      { args: ['--check'] },
    );
    expect(res.status).toBe(0);
  });

  // Встроенный union нужен файлам-журналам только на дозапись
  // (docs/agent/NAV_LOG.md): обе стороны дописали по строке — остаются обе.
  // Для бейслайна он по-прежнему не годится: нужна семантика храповика.
  describe('встроенные драйверы git (union, text, binary)', () => {
    const LOG = 'docs/agent/NAV_LOG.md';
    const check = (attributes: string, files: Record<string, string> = {}) =>
      runGate(
        SETUP,
        { '.gitattributes': attributes, ...STUBS, ...files },
        { args: ['--check'] },
      );

    it.each(['union', 'text', 'binary'])(
      'merge=%s на небейслайновом файле — без замечаний',
      (driver) => {
        const res = check(`${LOG}  merge=${driver}\n`);
        expect(res.stderr).toBe('');
        expect(res.status).toBe(0);
      },
    );

    it('merge=union на небейслайне рядом с настоящим бейслайном — зелёное', () => {
      const res = check(`${ATTR}${LOG}  merge=union\n`, {
        'scripts/foo-baseline.json': '{}',
      });
      expect(res.stderr).toBe('');
      expect(res.status).toBe(0);
    });

    it('контроль: merge=union на бейслайне по-прежнему красное', () => {
      const res = check('scripts/foo-baseline.json  merge=union\n', {
        'scripts/foo-baseline.json': '{}',
      });
      expect(res.status).toBe(1);
      expect(res.stderr).toContain('scripts/foo-baseline.json');
      expect(res.stderr).toContain('merge=union');
      expect(res.stderr).toContain('не драйвер репозитория');
    });

    it('контроль: неизвестное merge=foo на небейслайне по-прежнему красное', () => {
      const res = check(`${LOG}  merge=foo\n`);
      expect(res.status).toBe(1);
      expect(res.stderr).toContain('merge=foo');
      expect(res.stderr).toContain('нет в scripts/setup-merge-drivers.mjs');
    });

    it('контроль: встроенное имя не освобождает от проверки соседней строки', () => {
      const res = check(`${LOG}  merge=union\nsome/file.json  merge=foo\n`);
      expect(res.status).toBe(1);
      expect(res.stderr).toContain('merge=foo');
      expect(res.stderr).not.toContain('merge=union');
    });

    // Git берёт последнюю подходящую строку: маска с union в конце файла
    // молча перебила бы ratchet-min точной строки выше. Что именно накрывает
    // маска, сверка не вычисляет — встроенный драйвер допускается только на
    // точном пути, и это дешевле и надёжнее разбора глобов.
    it.each([
      'scripts/*.json',
      'scripts/*-baseline.json',
      '*.json',
      'e2e-browser/**',
      'docs/**/*.md',
      'docs/?.log',
      'docs/[ab].log',
    ])('контроль: маска %s с merge=union — красное', (mask) => {
      const res = check(`${ATTR}${mask}  merge=union\n`, {
        'scripts/foo-baseline.json': '{}',
      });
      expect(res.status).toBe(1);
      expect(res.stderr).toContain(`.gitattributes: ${mask} merge=union`);
      expect(res.stderr).toContain('только на точном пути');
    });

    it('контроль: маска с ratchet-драйвером остаётся законной (catch-all запрещён отдельно)', () => {
      const res = check('docs/*.json  merge=ratchet-min\n');
      expect(res.stderr).not.toContain('только на точном пути');
    });
  });

  // Сам .gitattributes сводится union: две стороны, переписавшие ОДНУ строку
  // по-разному, оставляют обе, и git молча берёт последнюю.
  it('один путь в двух строках (след union-слияния) — красное', () => {
    const res = runGate(
      SETUP,
      {
        '.gitattributes': `${ATTR}scripts/foo-baseline.json  merge=ratchet-max\n`,
        'scripts/foo-baseline.json': '{}',
        ...STUBS,
      },
      { args: ['--check'] },
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      '.gitattributes: scripts/foo-baseline.json встречается дважды',
    );
  });
});

describe('настоящее .gitattributes сводит само себя (merge=union)', () => {
  // Два PR с новыми гейтами вставляют по строке бейслайна в одно место
  // .gitattributes — до union это был текстовый конфликт по построению,
  // который агенты разрешали руками.
  const REPO = join(REAL_SCRIPTS, '..');
  const ANCHOR =
    'scripts/file-size-baseline.json           merge=ratchet-sum\n';
  const lineFor = (name: string) =>
    `scripts/${name}-baseline.json  merge=ratchet-min\n`;

  function twoNewGates(attributes: string) {
    const tmp = mkdtempSync(join(tmpdir(), 'attrs-union-'));
    try {
      const git = repoWithRealDrivers(tmp);
      const path = join(tmp, '.gitattributes');
      const insert = (line: string) =>
        writeFileSync(path, attributes.replace(ANCHOR, ANCHOR + line));
      writeFileSync(path, attributes);
      git('add', '-A');
      git('commit', '-qm', 'base');
      const base = git('rev-parse', '--abbrev-ref', 'HEAD').stdout.trim();
      git('checkout', '-qb', 'agent-b');
      insert(lineFor('beta'));
      git('commit', '-qam', 'агент B: новый гейт');
      git('checkout', '-q', base);
      insert(lineFor('alpha'));
      git('commit', '-qam', 'агент A: новый гейт');
      const merge = git('merge', 'agent-b', '-m', 'merge');
      return { status: merge.status, text: readFileSync(path, 'utf8') };
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }

  const real = readFileSync(join(REPO, '.gitattributes'), 'utf8');

  it('соседние вставки двух веток сливаются без конфликта, обе строки на месте', () => {
    expect(real).toContain(ANCHOR);
    const { status, text } = twoNewGates(real);
    expect(status).toBe(0);
    expect(text).not.toContain('<<<<<<<');
    expect(text).toContain(lineFor('alpha'));
    expect(text).toContain(lineFor('beta'));
  });

  it('контроль: без строки `.gitattributes merge=union` та же пара веток конфликтует', () => {
    const without = real.replace(/^\.gitattributes\s+merge=union\n/m, '');
    expect(without).not.toBe(real);
    const { status, text } = twoNewGates(without);
    expect(status).not.toBe(0);
    expect(text).toContain('<<<<<<<');
  });
});

describe('настоящее .gitattributes сводит бейслайны, у которых раньше не было атрибута', () => {
  // Сценарий находки аудита 2026-10: color-drift (числовой пофайловый
  // храповик) и реестры-классификации жили без `merge=`, и два PR, тронувших
  // один такой файл, получали текстовый конфликт. Берём НАСТОЯЩИЙ
  // .gitattributes и настоящий драйвер — шов, а не выдуманную пару.
  const REPO = join(REAL_SCRIPTS, '..');
  const COLOR = 'scripts/color-drift-baseline.json';
  const CRON = 'scripts/cron-leader-baseline.json';

  const entry = (reason: string) => ({ status: 'exempt', reason });
  const write = (tmp: string, rel: string, value: unknown) =>
    writeFileSync(join(tmp, rel), JSON.stringify(value, null, 2) + '\n');

  function twoBranches(withAttributes: boolean) {
    const tmp = mkdtempSync(join(tmpdir(), 'real-attrs-'));
    try {
      const git = repoWithRealDrivers(tmp);
      writeFileSync(
        join(tmp, '.gitattributes'),
        withAttributes
          ? readFileSync(join(REPO, '.gitattributes'), 'utf8')
          : '',
      );
      write(tmp, COLOR, { 'a.tsx': 3, 'b.tsx': 3 });
      write(tmp, CRON, {
        'src/a.ts::run': entry('a'),
        'src/z.ts::run': entry('z'),
      });
      git('add', '-A');
      git('commit', '-qm', 'base');
      const base = git('rev-parse', '--abbrev-ref', 'HEAD').stdout.trim();

      git('checkout', '-qb', 'agent-b');
      write(tmp, COLOR, { 'a.tsx': 3, 'b.tsx': 1 });
      write(tmp, CRON, {
        'src/a.ts::run': entry('a'),
        'src/m.ts::run': entry('m'),
        'src/z.ts::run': entry('z'),
      });
      git('commit', '-qam', 'агент B');

      git('checkout', '-q', base);
      write(tmp, COLOR, { 'a.tsx': 2, 'b.tsx': 3 });
      write(tmp, CRON, {
        'src/a.ts::run': entry('a'),
        'src/b.ts::run': entry('b'),
        'src/z.ts::run': entry('z'),
      });
      git('commit', '-qam', 'агент A');

      const merge = git('merge', 'agent-b', '-m', 'merge');
      const read = (rel: string) =>
        existsSync(join(tmp, rel)) ? readFileSync(join(tmp, rel), 'utf8') : '';
      return { status: merge.status, color: read(COLOR), cron: read(CRON) };
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }

  it('с атрибутами: оба ужатия color-drift и обе вставки реестра сохранены', () => {
    const { status, color, cron } = twoBranches(true);
    expect(status).toBe(0);
    expect(JSON.parse(color)).toEqual({ 'a.tsx': 2, 'b.tsx': 1 });
    expect(Object.keys(JSON.parse(cron))).toEqual([
      'src/a.ts::run',
      'src/b.ts::run',
      'src/m.ts::run',
      'src/z.ts::run',
    ]);
  });

  it('контроль: без атрибутов та же пара веток конфликтует', () => {
    const { status, color } = twoBranches(false);
    expect(status).not.toBe(0);
    expect(color).toContain('<<<<<<<');
  });

  // Другая сторона тех же реестров: обе ветки переписали ОДНУ причину —
  // драйвер не выбирает «свою», а отдаёт конфликт человеку. Покрыто выше:
  // «НЕ сводит, когда обе стороны написали разные строки».
});

describe('настоящее .gitattributes: рост двух веток в file-size и бандле складывается', () => {
  // Шов инцидента 2026-11-06 целиком: настоящий .gitattributes, драйверы от
  // настоящей установки, git сам зовёт драйвер с %O %A %B %P.
  const REPO = join(REAL_SCRIPTS, '..');
  const SIZES = 'scripts/file-size-baseline.json';
  const BUNDLE = 'scripts/bundle-size-baseline.json';
  const STATS = 'src/bot/stats-sections.ts';
  const write = (tmp: string, rel: string, value: unknown) =>
    writeFileSync(join(tmp, rel), JSON.stringify(value, null, 2) + '\n');
  const chunks = (largest: number, total: number) => ({
    'webapp:largest-chunk': largest,
    'webapp:total-js': total,
  });

  function twoGrowths(attributes: string) {
    const tmp = mkdtempSync(join(tmpdir(), 'sum-attrs-'));
    try {
      const git = repoWithRealDrivers(tmp);
      writeFileSync(join(tmp, '.gitattributes'), attributes);
      write(tmp, SIZES, { 'src/a.ts': 50, [STATS]: 123 });
      write(tmp, BUNDLE, chunks(450000, 3500000));
      git('add', '-A');
      git('commit', '-qm', 'base');
      const base = git('rev-parse', '--abbrev-ref', 'HEAD').stdout.trim();

      git('checkout', '-qb', 'agent-b');
      write(tmp, SIZES, { 'src/a.ts': 50, [STATS]: 125 });
      write(tmp, BUNDLE, chunks(452000, 3508192));
      git('commit', '-qam', 'агент B: +2 строки, +8 КБ');

      git('checkout', '-q', base);
      write(tmp, SIZES, { 'src/a.ts': 48, [STATS]: 128 });
      write(tmp, BUNDLE, chunks(450100, 3500512));
      git('commit', '-qam', 'агент A: +5 строк, +0,5 КБ');

      const merge = git('merge', 'agent-b', '-m', 'merge');
      const read = (rel: string) =>
        JSON.parse(readFileSync(join(tmp, rel), 'utf8'));
      return { status: merge.status, sizes: read(SIZES), bundle: read(BUNDLE) };
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }

  it('с настоящими атрибутами: база плюс оба прироста, самый тяжёлый чанк — max', () => {
    const res = twoGrowths(readFileSync(join(REPO, '.gitattributes'), 'utf8'));
    expect(res.status).toBe(0);
    expect(res.sizes).toEqual({ 'src/a.ts': 48, [STATS]: 130 });
    expect(res.bundle).toEqual(chunks(452000, 3508704));
  });

  it('контроль: прежний ratchet-min на той же паре веток оставлял меньшее', () => {
    const old = readFileSync(join(REPO, '.gitattributes'), 'utf8').replaceAll(
      'merge=ratchet-sum',
      'merge=ratchet-min',
    );
    const res = twoGrowths(old);
    expect(res.status).toBe(0);
    expect(res.sizes).toEqual({ 'src/a.ts': 48, [STATS]: 125 });
    expect(res.bundle).toEqual(chunks(450100, 3500512));
  });
});

describe('настоящее .gitattributes: журнал на дозапись сводится встроенным union', () => {
  // docs/agent/NAV_LOG.md: каждый PR дописывает строку в хвост, и две ветки от
  // одного main конфликтуют по построению. Встроенный драйвер git не требует
  // установки в .git/config — достаточно строки в .gitattributes. Шов — настоящий
  // .gitattributes репозитория и настоящий git, как у бейслайнов выше.
  const LOG = 'docs/agent/NAV_LOG.md';

  function twoAppends(withAttributes: boolean) {
    const tmp = mkdtempSync(join(tmpdir(), 'union-log-'));
    try {
      const git = (...args: string[]) =>
        spawnSync('git', args, { cwd: tmp, encoding: 'utf8' });
      git('init', '-q', '.');
      git('config', 'user.email', 'test@example.com');
      git('config', 'user.name', 'test');
      mkdirSync(join(tmp, 'docs', 'agent'), { recursive: true });
      writeFileSync(
        join(tmp, '.gitattributes'),
        withAttributes
          ? readFileSync(join(REAL_SCRIPTS, '..', '.gitattributes'), 'utf8')
          : '',
      );
      writeFileSync(join(tmp, LOG), '# Журнал\n- 2026-10-01 старая запись\n');
      git('add', '-A');
      git('commit', '-qm', 'base');
      const base = git('rev-parse', '--abbrev-ref', 'HEAD').stdout.trim();

      git('checkout', '-qb', 'agent-b');
      writeFileSync(
        join(tmp, LOG),
        '# Журнал\n- 2026-10-01 старая запись\n- 2026-10-02 запись агента B\n',
      );
      git('commit', '-qam', 'агент B');

      git('checkout', '-q', base);
      writeFileSync(
        join(tmp, LOG),
        '# Журнал\n- 2026-10-01 старая запись\n- 2026-10-03 запись агента A\n',
      );
      git('commit', '-qam', 'агент A');

      const merge = git('merge', 'agent-b', '-m', 'merge');
      return {
        status: merge.status,
        log: readFileSync(join(tmp, LOG), 'utf8'),
      };
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }

  it('с атрибутом: дописанные строки обеих веток остались, конфликта нет', () => {
    const { status, log } = twoAppends(true);
    expect(status).toBe(0);
    expect(log).toContain('запись агента A');
    expect(log).toContain('запись агента B');
    expect(log).not.toContain('<<<<<<<');
  });

  it('контроль: без атрибута та же пара веток конфликтует', () => {
    const { status, log } = twoAppends(false);
    expect(status).not.toBe(0);
    expect(log).toContain('<<<<<<<');
  });
});

describe('sum: ветка поверх уже влитой squash-ветки не задваивает общую правку', () => {
  // Шов #1123: ветку B отвели от ветки A, A влили в main squash-ом, B сливает
  // main. База слияния для git — точка до A, и правка A приходит с обеих
  // сторон. Настоящий git сам зовёт драйвер и кладёт их коммит в GITHEAD_<sha>.
  const SIZES = 'scripts/file-size-baseline.json';
  const GAME = 'game/src/scenes/GameScene.ts';
  type Sizes = Record<string, number>;

  /** stacked — B отведена от A (иначе от main); extraOnA — A дописали после отвода B. */
  function mergeMainIntoB(opts: { stacked: boolean; extraOnA?: boolean }) {
    const tmp = mkdtempSync(join(tmpdir(), 'squash-stack-'));
    try {
      const git = repoWithRealDrivers(tmp);
      writeFileSync(
        join(tmp, '.gitattributes'),
        `${SIZES} merge=ratchet-sum\n`,
      );
      writeFileSync(join(tmp, 'scripts', 'check-file-size-ratchet.mjs'), '');
      const read = (): Sizes =>
        JSON.parse(readFileSync(join(tmp, SIZES), 'utf8')) as Sizes;
      const edit = (patch: Sizes, message: string) => {
        writeFileSync(
          join(tmp, SIZES),
          JSON.stringify({ ...read(), ...patch }, null, 2) + '\n',
        );
        git('commit', '-qam', message);
      };
      writeFileSync(
        join(tmp, SIZES),
        JSON.stringify({ [GAME]: 1423, 'src/other.ts': 100 }, null, 2) + '\n',
      );
      git('add', '-A');
      git('commit', '-qm', 'база');
      git('branch', '-M', 'main');

      git('checkout', '-qb', 'a');
      edit({ [GAME]: 1247, 'game/src/scenes/death.ts': 120 }, 'A: дробление');
      git('checkout', '-qb', 'b', opts.stacked ? 'a' : 'main');
      edit(
        { [GAME]: opts.stacked ? 1094 : 1300, 'game/src/cabinet.ts': 150 },
        'B',
      );
      if (opts.extraOnA) {
        git('checkout', '-q', 'a');
        edit({ [GAME]: 1240 }, 'A: правка после отвода B');
      }

      git('checkout', '-q', 'main');
      edit({ 'src/other.ts': 110 }, 'main: чужой PR');
      git('merge', '--squash', 'a');
      git('commit', '-qm', 'A (#1)');

      git('checkout', '-q', 'b');
      const merge = git('merge', 'main', '-m', 'merge main');
      return { status: merge.status, sizes: read(), stderr: merge.stderr };
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }

  it('B поверх A: GameScene — значение B, правка A учтена один раз', () => {
    const res = mergeMainIntoB({ stacked: true });
    expect(res.status).toBe(0);
    // без поправки было бы 1094 + 1247 − 1423 = 918, как в #1123
    expect(res.sizes).toEqual({
      [GAME]: 1094,
      'src/other.ts': 110,
      'game/src/scenes/death.ts': 120,
      'game/src/cabinet.ts': 150,
    });
    expect(res.stderr).toContain('влитой squash-ветке');
  });

  it('контроль: B не стоит на A — обычная сумма дельт, как раньше', () => {
    const res = mergeMainIntoB({ stacked: false });
    expect(res.status).toBe(0);
    expect(res.sizes[GAME]).toBe(1300 + 1247 - 1423);
    expect(res.stderr).not.toContain('влитой squash-ветке');
  });

  it('A дописали после отвода B: поправки нет, но подсказка с командой пересчёта', () => {
    const res = mergeMainIntoB({ stacked: true, extraOnA: true });
    expect(res.status).toBe(0);
    expect(res.sizes[GAME]).toBe(1094 + 1240 - 1423);
    expect(res.stderr).toContain(
      `${GAME}: база 1423, наша 1094, их 1240 → 911`,
    );
    expect(res.stderr).toContain(
      'node scripts/check-file-size-ratchet.mjs --update',
    );
  });
});

// Инцидент 2026-08-04: корневой npm-хук `prepare` уронил Docker-сборку Amvera
// — на шаге `RUN npm ci` в образе есть только package*.json, файла скрипта
// нет, node падает с ENOENT, и деплой молча стоит (прод застрял на #255,
// пока #256–#258 были зелёными в CI). Тест закрепляет оба слоя фикса.
describe('prepare выживает в Docker-контексте (инцидент 2026-08-04)', () => {
  it('setup-merge-drivers в каталоге без .git выходит нулём', () => {
    const dir = mkdtempSync(join(tmpdir(), 'prepare-docker-'));
    try {
      mkdirSync(join(dir, 'scripts'));
      // ровно то, что копирует Dockerfile перед `npm ci`
      for (const f of ['setup-merge-drivers.mjs', 'merge-drivers-check.mjs']) {
        copyFileSync(join(REAL_SCRIPTS, f), join(dir, 'scripts', f));
      }
      const res = spawnSync(
        process.execPath,
        ['scripts/setup-merge-drivers.mjs'],
        { cwd: dir, encoding: 'utf8' },
      );
      expect(res.status).toBe(0);
      expect(res.stdout + res.stderr).toContain('пропуска');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('Dockerfile копирует скрипт prepare ДО первого npm ci', () => {
    const dockerfile = readFileSync(
      join(REAL_SCRIPTS, '..', 'Dockerfile'),
      'utf8',
    );
    const copyAt = dockerfile.indexOf('COPY scripts/setup-merge-drivers.mjs');
    const ciAt = dockerfile.indexOf('RUN npm ci');
    expect(copyAt).toBeGreaterThan(-1);
    expect(ciAt).toBeGreaterThan(-1);
    expect(copyAt).toBeLessThan(ciAt);
    // статический импорт setup: файл рядом обязан ехать той же командой COPY,
    // иначе `prepare` в образе падает с ERR_MODULE_NOT_FOUND
    const copyLine = dockerfile.slice(copyAt).split('\n')[0];
    expect(copyLine).toContain('scripts/merge-drivers-check.mjs');
  });
});
