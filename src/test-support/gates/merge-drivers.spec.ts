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
  mkdirSync,
  mkdtempSync,
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
});

describe('setup-merge-drivers --check: атрибут без драйвера не проходит', () => {
  const SETUP = 'setup-merge-drivers.mjs';

  it('зеленеет на настоящем .gitattributes репозитория', () => {
    const attributes = readFileSync(
      join(REAL_SCRIPTS, '..', '.gitattributes'),
      'utf8',
    );
    const res = runGate(
      SETUP,
      {
        '.gitattributes': attributes,
        'scripts/merge-json-ratchet.mjs': '// заглушка, проверяется наличие',
        'scripts/merge-miniapp-dist.mjs': '// заглушка, проверяется наличие',
      },
      { args: ['--check'] },
    );
    expect(res.status).toBe(0);
  });

  it('краснеет на merge=<имя>, которому нет драйвера', () => {
    const res = runGate(
      SETUP,
      {
        '.gitattributes': 'some/file.json merge=ratchet-median\n',
        'scripts/merge-json-ratchet.mjs': '// заглушка',
        'scripts/merge-miniapp-dist.mjs': '// заглушка',
      },
      { args: ['--check'] },
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('ratchet-median');
  });
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
