// Тесты merge-драйверов репозитория (scripts/merge-json-ratchet.mjs,
// scripts/merge-miniapp-dist.mjs, scripts/setup-merge-drivers.mjs --check).
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
import { dirname, join } from 'path';
import { spawnSync } from 'child_process';
import { runGate } from './gate-sandbox';

const REAL_SCRIPTS = join(__dirname, '..', '..', '..', 'scripts');
const RATCHET = 'merge-json-ratchet.mjs';

/** Прогон драйвера напрямую на трёх версиях файла — так же, как его зовёт git
 *  (%O предок, %A наша версия и она же выход, %B их версия, %P имя для
 *  сообщений). Возвращает код выхода и слитый результат. */
function mergeJson(
  direction: 'min' | 'max',
  ancestor: unknown,
  ours: unknown,
  theirs: unknown,
): { status: number | null; merged: unknown; stderr: string } {
  const tmp = mkdtempSync(join(tmpdir(), 'ratchet-'));
  try {
    mkdirSync(join(tmp, 'scripts'), { recursive: true });
    copyFileSync(join(REAL_SCRIPTS, RATCHET), join(tmp, 'scripts', RATCHET));
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
      [join(tmp, 'scripts', RATCHET), direction, o, a, b, 'baseline.json'],
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
      mkdirSync(join(tmp, 'scripts'), { recursive: true });
      copyFileSync(join(REAL_SCRIPTS, RATCHET), join(tmp, 'scripts', RATCHET));
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
      mkdirSync(join(tmp, 'scripts'), { recursive: true });
      copyFileSync(join(REAL_SCRIPTS, RATCHET), join(tmp, 'scripts', RATCHET));
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
    'scripts/merge-miniapp-dist.mjs': '// заглушка, проверяется наличие',
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
      mkdirSync(join(tmp, 'scripts'), { recursive: true });
      copyFileSync(join(REAL_SCRIPTS, RATCHET), join(tmp, 'scripts', RATCHET));
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

describe('merge-miniapp-dist: драйвер гасит конфликт, собирает post-merge', () => {
  const DIST_DRIVER = 'merge-miniapp-dist.mjs';

  // Драйвер намеренно НЕ собирает: git зовёт его, пока слитый исходник ещё не
  // дописан в рабочее дерево, и сборка взяла бы чужую половину. Проверено
  // вживую — в прекэше sw.js оказывалась revision бандла одной стороны при
  // самом бандле от другой. Его работа — не оставить маркеры внутри бандла.
  it('оставляет «нашу» версию нетронутой и не роняет слияние', () => {
    const res = runGate(
      DIST_DRIVER,
      {
        'schema-miniapp/src/App.tsx': 'export const App = () => null;\n',
        'out.tmp': 'наша версия бандла',
        'keep/out.tmp': 'наша версия бандла',
      },
      { args: ['out.tmp', 'schema-miniapp/dist/sw.js'], keepTmp: true },
    );
    try {
      expect(res.status).toBe(0);
      expect(readFileSync(join(res.tmp, 'out.tmp'), 'utf8')).toBe(
        'наша версия бандла',
      );
      expect(res.stderr).toContain('не сводится построчно');
    } finally {
      rmSync(res.tmp, { recursive: true, force: true });
    }
  });

  /** Репозиторий, где только что прошло слияние: `--after-merge` смотрит на
   *  `HEAD@{1}`, поэтому голого `git init` мало — нужна настоящая история. */
  function repoAfterMerge(touchMiniapp: boolean): {
    status: number | null;
    stderr: string;
  } {
    const tmp = mkdtempSync(join(tmpdir(), 'aftermerge-'));
    try {
      const git = (...args: string[]) =>
        spawnSync('git', args, { cwd: tmp, encoding: 'utf8' });
      git('init', '-q', '.');
      git('config', 'user.email', 'test@example.com');
      git('config', 'user.name', 'test');
      mkdirSync(join(tmp, 'scripts'), { recursive: true });
      copyFileSync(
        join(REAL_SCRIPTS, DIST_DRIVER),
        join(tmp, 'scripts', DIST_DRIVER),
      );
      writeFileSync(join(tmp, 'readme.md'), 'база\n');
      git('add', '-A');
      git('commit', '-qm', 'base');
      const base = git('rev-parse', '--abbrev-ref', 'HEAD').stdout.trim();

      git('checkout', '-qb', 'other');
      const side = touchMiniapp ? 'schema-miniapp/src/App.tsx' : 'readme.md';
      mkdirSync(dirname(join(tmp, side)), { recursive: true });
      writeFileSync(join(tmp, side), 'правка второй стороны\n');
      git('add', '-A');
      git('commit', '-qm', 'вторая сторона');

      git('checkout', '-q', base);
      writeFileSync(join(tmp, 'other.md'), 'наша правка\n');
      git('add', '-A');
      git('commit', '-qm', 'наша сторона');
      git('merge', 'other', '-m', 'merge');

      const res = spawnSync(
        'node',
        [join(tmp, 'scripts', DIST_DRIVER), '--after-merge'],
        { cwd: tmp, encoding: 'utf8' },
      );
      return { status: res.status, stderr: res.stderr ?? '' };
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }

  // Хук зовётся после КАЖДОГО слияния. Если он полезет собирать мини-апп на
  // слиянии, которое его не трогало, каждый merge подорожает на минуту — такой
  // хук отключат через неделю.
  it('слияние не трогало мини-апп — молчит и не собирает', () => {
    const res = repoAfterMerge(false);
    expect(res.status).toBe(0);
    expect(res.stderr).toBe('');
  });

  it('трогало, но зависимостей нет — предупреждает и НЕ роняет слияние', () => {
    const res = repoAfterMerge(true);
    expect(res.status).toBe(0);
    expect(res.stderr).toContain('зависимости мини-аппа');
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
