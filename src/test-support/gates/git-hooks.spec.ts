// Тесты pre-push хука репозитория (scripts/git-hooks/pre-push) и его установки
// (scripts/setup-git-hooks.mjs из npm `prepare`).
//
// Хук ломается тихо: без core.hooksPath и без бита исполнения git его не
// зовёт, а хук, красный «из-за окружения», обходят `--no-verify` (до
// 2026-11-05 он жил только в .git/hooks владельца, собирал webapp без
// VITE_BOT_USERNAME и с #690 был красным везде; пары файлов, различавшихся
// только регистром, #933, ломали кабинет только у владельца).
//
// Оба исхода: зелёную сборку хук пропускает с именем бота, красную блокирует
// с хвостом лога; после установки core.hooksPath стоит, хук исполняемый, а
// настоящий `git push` из git worktree собирает именно worktree.
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { spawnSync } from 'child_process';
import { REAL_SCRIPTS_DIR } from './gate-sandbox';
import { makeFakeNpmBuild } from './fake-npm-build';

const ROOT = join(REAL_SCRIPTS_DIR, '..');
const HOOK_REL = join('scripts', 'git-hooks', 'pre-push');
const SETUP_REL = join('scripts', 'setup-git-hooks.mjs');
const ZERO = '0'.repeat(40);
const SHA = 'a'.repeat(40);
const BOT = 'SchemeHappensBot';

/** Песочница: git-репозиторий с копией хука и скрипта установки. Хук копируется
 *  без бита исполнения — установка обязана его вернуть. */
function makeSandbox(): {
  tmp: string;
  env: NodeJS.ProcessEnv;
  record: string;
} {
  const tmp = mkdtempSync(join(realpathSync(tmpdir()), 'git-hooks-'));
  for (const rel of [HOOK_REL, SETUP_REL]) {
    mkdirSync(join(tmp, rel, '..'), { recursive: true });
    copyFileSync(join(ROOT, rel), join(tmp, rel));
  }
  chmodSync(join(tmp, HOOK_REL), 0o644);
  mkdirSync(join(tmp, 'webapp', 'node_modules'), { recursive: true });
  const record = join(tmp, 'npm-record.txt');
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PATH: `${makeFakeNpmBuild(tmp)}:${process.env.PATH ?? ''}`,
    FAKE_NPM_RECORD: record,
  };
  delete env.VITE_BOT_USERNAME;
  delete env.FAKE_NPM_FAIL;
  return { tmp, env, record };
}

const git = (cwd: string, env: NodeJS.ProcessEnv, ...args: string[]) =>
  spawnSync('git', args, { cwd, env, encoding: 'utf8' });

function initRepo(cwd: string, env: NodeJS.ProcessEnv): void {
  git(cwd, env, 'init', '-q');
  git(cwd, env, 'config', 'user.email', 'test@example.com');
  git(cwd, env, 'config', 'user.name', 'test');
  git(cwd, env, 'config', 'commit.gpgsign', 'false');
}

const runHook = (tmp: string, env: NodeJS.ProcessEnv, input: string) =>
  spawnSync('sh', [join(tmp, HOOK_REL)], {
    cwd: tmp,
    env,
    encoding: 'utf8',
    input,
  });

const recorded = (record: string) =>
  readFileSync(record, 'utf8').trim().split('\n');

describe('pre-push хук: сборка webapp перед пушем', () => {
  let tmp = '';
  let env: NodeJS.ProcessEnv = {};
  let record = '';
  beforeEach(() => {
    ({ tmp, env, record } = makeSandbox());
    initRepo(tmp, env);
  });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  const update = `refs/heads/x ${SHA} refs/heads/x ${ZERO}\n`;

  it('без переменной в окружении сборка получает VITE_BOT_USERNAME и идёт в webapp пушимого дерева', () => {
    const res = runHook(tmp, env, update);
    expect(res.status).toBe(0);
    expect(recorded(record)).toEqual([
      `run build --prefix ${join(tmp, 'webapp')}`,
      `VITE_BOT_USERNAME=${BOT}`,
    ]);
    expect(res.stdout).toContain('✅');
  });

  it('чужое значение переменной в окружении не подменяет имя бота', () => {
    const res = runHook(
      tmp,
      { ...env, VITE_BOT_USERNAME: 'SchemaLabBot' },
      update,
    );
    expect(res.status).toBe(0);
    expect(recorded(record)[1]).toBe(`VITE_BOT_USERNAME=${BOT}`);
  });

  it('красная сборка блокирует пуш: ненулевой выход и хвост лога с ошибкой', () => {
    const res = runHook(tmp, { ...env, FAKE_NPM_FAIL: '1' }, update);
    expect(res.status).toBe(1);
    expect(res.stdout).toContain('ОШИБКА-ОБРАЗЕЦ: error TS2307');
    expect(res.stdout).toContain('строка лога сборки 39');
    // хвост — не весь лог: первые строки сборки в вывод не попадают
    expect(res.stdout).not.toContain('строка лога сборки 0');
    expect(res.stdout).toContain('пуш заблокирован');
  });

  it('пуш, который только удаляет ветку, сборку не запускает', () => {
    const res = runHook(tmp, env, `(delete) ${ZERO} refs/heads/old ${SHA}\n`);
    expect(res.status).toBe(0);
    expect(existsSync(record)).toBe(false);
  });

  it('без webapp/node_modules — красный с подсказкой npm ci, а не падение сборки', () => {
    rmSync(join(tmp, 'webapp', 'node_modules'), { recursive: true });
    const res = runHook(tmp, env, update);
    expect(res.status).toBe(1);
    expect(res.stdout).toContain('npm ci --prefix webapp');
    expect(existsSync(record)).toBe(false);
  });
});

describe('setup-git-hooks: установка из prepare', () => {
  let tmp = '';
  let env: NodeJS.ProcessEnv = {};
  let record = '';
  beforeEach(() => {
    ({ tmp, env, record } = makeSandbox());
    initRepo(tmp, env);
  });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  const setup = (cwd: string) =>
    spawnSync(process.execPath, [join(tmp, SETUP_REL)], {
      cwd,
      env,
      encoding: 'utf8',
    });

  it('ставит core.hooksPath на каталог хуков и бит исполнения хуку; повторный запуск безвреден', () => {
    expect(statSync(join(tmp, HOOK_REL)).mode & 0o111).toBe(0);
    for (let i = 0; i < 2; i += 1) {
      const res = setup(tmp);
      expect(res.status).toBe(0);
      expect(res.stdout).toContain('core.hooksPath = scripts/git-hooks');
    }
    expect(git(tmp, env, 'config', 'core.hooksPath').stdout.trim()).toBe(
      'scripts/git-hooks',
    );
    expect(statSync(join(tmp, HOOK_REL)).mode & 0o111).not.toBe(0);
  });

  it('прежний .git/hooks/pre-push замечает и называет по пути — и из главного дерева, и из worktree', () => {
    const legacy = join(tmp, '.git', 'hooks', 'pre-push');
    writeFileSync(legacy, '#!/bin/sh\nexit 0\n');
    expect(setup(tmp).stdout).toContain(
      `Прежний ${legacy} git больше не вызывает`,
    );
    git(tmp, env, 'add', '-A');
    git(tmp, env, 'commit', '-qm', 'база');
    const wt = join(tmp, 'wt-legacy');
    expect(
      git(tmp, env, 'worktree', 'add', '-q', wt, '-b', 'legacy').status,
    ).toBe(0);
    copyFileSync(join(ROOT, SETUP_REL), join(wt, SETUP_REL));
    const fromWt = spawnSync(process.execPath, [join(wt, SETUP_REL)], {
      cwd: wt,
      env,
      encoding: 'utf8',
    });
    expect(fromWt.stdout).toContain(`Прежний ${legacy} git больше не вызывает`);
  });

  it('настоящий git push из git worktree идёт через хук и собирает webapp самого worktree', () => {
    const remote = join(tmp, 'remote.git');
    git(tmp, env, 'init', '-q', '--bare', remote);
    // worktree получает хук с тем mode, что в коммите: без +x git его молча
    // игнорирует (проверено: «hook was ignored because it's not set as executable»)
    chmodSync(join(tmp, HOOK_REL), 0o755);
    git(tmp, env, 'add', '-A');
    git(tmp, env, 'commit', '-qm', 'база');
    git(tmp, env, 'remote', 'add', 'origin', remote);
    expect(setup(tmp).status).toBe(0);

    const wt = join(tmp, 'wt');
    expect(
      git(tmp, env, 'worktree', 'add', '-q', wt, '-b', 'feature').status,
    ).toBe(0);
    mkdirSync(join(wt, 'webapp', 'node_modules'), { recursive: true });

    const push = git(wt, env, 'push', '-q', 'origin', 'feature');
    expect(push.status).toBe(0);
    expect(push.stdout + push.stderr).toContain('✅');
    expect(recorded(record)[0]).toBe(
      `run build --prefix ${join(wt, 'webapp')}`,
    );

    // контроль: красная сборка не пускает ветку на сервер
    rmSync(record);
    git(wt, env, 'checkout', '-qb', 'broken');
    const blocked = git(
      wt,
      { ...env, FAKE_NPM_FAIL: '1' },
      'push',
      '-q',
      'origin',
      'broken',
    );
    expect(blocked.status).not.toBe(0);
    expect(blocked.stdout + blocked.stderr).toContain('ОШИБКА-ОБРАЗЕЦ');
    expect(
      git(
        tmp,
        env,
        'ls-remote',
        origin(remote),
        'refs/heads/broken',
      ).stdout.trim(),
    ).toBe('');

    // удаление ветки на сервере сборку не запускает
    rmSync(record);
    expect(
      git(wt, env, 'push', '-q', 'origin', '--delete', 'feature').status,
    ).toBe(0);
    expect(existsSync(record)).toBe(false);
  });
});

const origin = (remote: string) => remote;

describe('хук в репозитории', () => {
  it('закоммичен с битом исполнения (100755): worktree берёт mode из коммита, без +x git хук молча пропускает', () => {
    const entry = spawnSync('git', ['ls-files', '-s', '--', HOOK_REL], {
      cwd: ROOT,
      encoding: 'utf8',
    }).stdout.trim();
    expect(entry).toMatch(/^100755 /);
  });
});

// Инцидент 2026-08-04: скрипт `prepare` без файла в образе уронил `npm ci`
// в Docker-сборке Amvera, и деплой молча стоял. Второй скрипт `prepare`
// живёт по тем же правилам: копируется до `npm ci` и без git выходит нулём.
describe('setup-git-hooks выживает в Docker-контексте', () => {
  it('в каталоге без .git выходит нулём и ничего не ставит', () => {
    const dir = mkdtempSync(join(realpathSync(tmpdir()), 'prepare-docker-'));
    try {
      mkdirSync(join(dir, 'scripts'));
      copyFileSync(join(ROOT, SETUP_REL), join(dir, SETUP_REL));
      const res = spawnSync(process.execPath, [SETUP_REL], {
        cwd: dir,
        encoding: 'utf8',
      });
      expect(res.status).toBe(0);
      expect(res.stdout + res.stderr).toContain('пропуска');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('Dockerfile копирует setup-git-hooks.mjs ДО первого npm ci', () => {
    const dockerfile = readFileSync(join(ROOT, 'Dockerfile'), 'utf8');
    const copyAt = dockerfile.indexOf('scripts/setup-git-hooks.mjs');
    const ciAt = dockerfile.indexOf('RUN npm ci');
    expect(copyAt).toBeGreaterThan(-1);
    expect(copyAt).toBeLessThan(ciAt);
    expect(
      dockerfile.slice(dockerfile.lastIndexOf('\n', copyAt) + 1, copyAt),
    ).toMatch(/^COPY /);
  });

  it('package.json зовёт установку хуков из prepare', () => {
    const pkg = JSON.parse(
      readFileSync(join(ROOT, 'package.json'), 'utf8'),
    ) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts.prepare).toContain('node scripts/setup-git-hooks.mjs');
  });
});
