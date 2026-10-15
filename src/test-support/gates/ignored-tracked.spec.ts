// Тест гейта check-ignored-tracked.mjs: отслеживаемый файл, который
// запрещает .gitignore. 466 файлов test/.jest-cache (кэш ts-jest, #243)
// жили в индексе месяцами: правило `.jest-cache/` пришло позже файлов
// (#624), а .gitignore отслеживаемое не снимает.
//
// Шов здесь — настоящий git на настоящем индексе, гейт запускается так же,
// как в CI. Проверяет ОБА исхода и контрольные образцы (правило №15 п.2):
// гейт не шире, чем нужно, и не зависит от игнор-настроек машины.
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { spawnSync } from 'child_process';
import { join } from 'path';
import { cleanupTmp, runGate } from './gate-sandbox';

const OK = '✓ отслеживаемых файлов под .gitignore: ни одного';
const CACHE = 'test/.jest-cache/a.map';

// Глобальный игнор разработчика не должен влиять на то, что попало в индекс
// при подготовке фикстуры.
const CLEAN_GIT = {
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null',
};

function git(cwd: string, ...args: string[]): void {
  const res = spawnSync('git', args, {
    cwd,
    env: { ...process.env, ...CLEAN_GIT },
    encoding: 'utf8',
  });
  if (res.status !== 0) throw new Error(`git ${args.join(' ')}: ${res.stderr}`);
}

/** Репозиторий в песочнице: `staged` попадает в индекс даже под игнором. */
const stage =
  (...staged: string[]) =>
  (tmp: string): void => {
    git(tmp, 'init', '-q');
    if (staged.length) git(tmp, 'add', '-f', '--', ...staged);
  };

describe('check-ignored-tracked.mjs', () => {
  const files = {
    '.gitignore': '.jest-cache/\n',
    [CACHE]: '{}',
    'src/app.ts': 'export const a = 1;\n',
  };

  it('игнорируемый файл в индексе (git add -f) — exit 1, путь в выводе', () => {
    const res = runGate('check-ignored-tracked.mjs', files, {
      setup: stage(CACHE, 'src/app.ts'),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(CACHE);
    expect(res.stderr).toContain('git rm -r --cached');
    expect(res.stderr).not.toContain('src/app.ts');
  });

  it('тот же каталог на диске, но не в индексе (после git rm --cached) — exit 0', () => {
    const res = runGate('check-ignored-tracked.mjs', files, {
      setup: stage('src/app.ts'),
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain(OK);
  });

  it('отслеживаемый файл, который .gitignore не трогает, — exit 0', () => {
    const res = runGate('check-ignored-tracked.mjs', files, {
      setup: stage('src/app.ts', '.gitignore'),
    });
    expect(res.status).toBe(0);
  });

  it('отрицание `!путь` в .gitignore разрешает файл, соседний по маске — нет', () => {
    const res = runGate(
      'check-ignored-tracked.mjs',
      {
        '.gitignore': '*.map\n!keep/x.map\n',
        'keep/x.map': '{}',
        'keep/y.map': '{}',
      },
      { setup: stage('keep/x.map', 'keep/y.map') },
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('keep/y.map');
    expect(res.stderr).not.toContain('keep/x.map');
  });

  it('вложенный .gitignore в подкаталоге тоже действует', () => {
    const res = runGate(
      'check-ignored-tracked.mjs',
      { 'sub/.gitignore': 'secret.txt\n', 'sub/secret.txt': 'x' },
      { setup: stage('sub/secret.txt') },
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('sub/secret.txt');
  });

  it('глобальный core.excludesFile машины не делает законный файл нарушением', () => {
    const dir = mkdtempSync(join(realpathSync(tmpdir()), 'global-ignore-'));
    const ignoreFile = join(dir, 'ignore');
    writeFileSync(ignoreFile, 'src/app.ts\n');
    const env = {
      PATH: process.env.PATH ?? '',
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_CONFIG_SYSTEM: '/dev/null',
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'core.excludesFile',
      GIT_CONFIG_VALUE_0: ignoreFile,
    };
    try {
      let tmpRepo = '';
      const res = runGate('check-ignored-tracked.mjs', files, {
        env,
        keepTmp: true,
        setup: (tmp) => {
          tmpRepo = tmp;
          stage('src/app.ts')(tmp);
        },
      });
      // Контроль: с --exclude-standard тот же индекс выглядел бы нарушением,
      // то есть образец действительно различает два варианта git-вызова.
      const standard = spawnSync(
        'git',
        ['ls-files', '-ci', '--exclude-standard'],
        { cwd: tmpRepo, env, encoding: 'utf8' },
      );
      cleanupTmp(tmpRepo);
      expect(standard.stdout.trim()).toBe('src/app.ts');
      expect(res.status).toBe(0);
      expect(res.stdout).toContain(OK);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('длинный список обрезается, общее число названо', () => {
    const many: Record<string, string> = { '.gitignore': '.jest-cache/\n' };
    const paths: string[] = [];
    for (let i = 0; i < 25; i++) {
      const p = `c/.jest-cache/f${i}`;
      many[p] = '{}';
      paths.push(p);
    }
    const res = runGate('check-ignored-tracked.mjs', many, {
      setup: stage(...paths),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('25 отслеживаемых');
    expect(res.stderr).toContain('и ещё 5');
  });
});
