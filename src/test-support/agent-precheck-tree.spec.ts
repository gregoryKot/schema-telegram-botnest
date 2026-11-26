// scripts/agent/precheck-tree.mjs — «чистое дерево, как в CI»: worktree на HEAD
// плюс ровно то, что попадёт в коммит. Потерянный застейдженный файл или
// просочившийся игнорируемый — тот самый «зелёно локально, красно в CI»
// (2026-10-21: журнал хука в .claude/state/ прятал ошибку карты кода).
// Основной спек инструмента — agent-precheck.spec.ts.
import { spawnSync } from 'child_process';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { dirname, join, resolve } from 'path';
import { pathToFileURL } from 'url';

const TREE = join(
  resolve(__dirname, '..', '..'),
  'scripts',
  'agent',
  'precheck-tree.mjs',
);

/** Выполняет выражение в ESM-подпроцессе с модулем `mod` и возвращает его JSON. */
function evalModule<T>(file: string, expr: string): T {
  const code =
    `import * as mod from ${JSON.stringify(pathToFileURL(file).href)};\n` +
    `process.stdout.write(JSON.stringify(${expr}));`;
  const res = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
    encoding: 'utf8',
  });
  if (res.status !== 0) throw new Error(`${file}: ${res.stderr}`);
  return JSON.parse(res.stdout) as T;
}

describe('чистое дерево (precheck-tree.mjs) на временном репозитории', () => {
  let tmp: string;
  let repo: string;
  let tree: string;

  const git = (cwd: string, ...args: string[]) => {
    const res = spawnSync(
      'git',
      [
        '-c',
        'user.name=t',
        '-c',
        'user.email=t@example.com',
        '-c',
        'commit.gpgsign=false',
        ...args,
      ],
      { cwd, encoding: 'utf8' },
    );
    if (res.status !== 0)
      throw new Error(`git ${args.join(' ')}: ${res.stderr}`);
    return res.stdout;
  };
  const write = (root: string, rel: string, text: string) => {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), text);
  };

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'precheck-spec-'));
    repo = join(tmp, 'repo');
    tree = join(tmp, 'tree');
    mkdirSync(repo);
    git(repo, 'init', '-q');
    // `node_modules/` с косой чертой НЕ покрывает ссылку: порядок «стейдж, потом ссылка» держит её вне индекса.
    write(repo, '.gitignore', 'node_modules/\nignored.log\n');
    for (const f of [
      'keep.txt',
      'edit.txt',
      'gone.txt',
      'staged-edit.txt',
      'staged-gone.txt',
    ]) {
      write(repo, f, `${f} v1\n`);
    }
    git(repo, 'add', '-A');
    git(repo, 'commit', '-q', '-m', 'init');
  });
  afterEach(() => {
    spawnSync('git', ['worktree', 'prune'], { cwd: repo });
    rmSync(tmp, { recursive: true, force: true });
  });

  it('переносит правки, застейдженное, новое и удаления; игнорируемое не просачивается', () => {
    write(repo, 'edit.txt', 'edit v2\n');
    write(repo, 'staged-edit.txt', 'staged v2\n');
    git(repo, 'add', 'staged-edit.txt');
    write(repo, 'staged-new.txt', 'staged new\n');
    git(repo, 'add', 'staged-new.txt');
    write(repo, 'untracked.txt', 'untracked\n');
    write(repo, 'dir/sub/nested.txt', 'nested\n');
    write(repo, 'ignored.log', 'шум\n');
    write(repo, 'node_modules/pkg/index.js', 'x\n');
    rmSync(join(repo, 'gone.txt'));
    git(repo, 'rm', '-q', 'staged-gone.txt');
    const headBefore = git(repo, 'rev-parse', 'HEAD');
    const statusBefore = git(repo, 'status', '--porcelain');

    const count = evalModule<number>(
      TREE,
      `mod.createCleanTree(${JSON.stringify(repo)}, ${JSON.stringify(tree)})`,
    );
    const read = (rel: string) => readFileSync(join(tree, rel), 'utf8');

    expect(count).toBe(7);
    expect(read('keep.txt')).toBe('keep.txt v1\n');
    expect(read('edit.txt')).toBe('edit v2\n');
    expect(read('staged-edit.txt')).toBe('staged v2\n');
    expect(read('staged-new.txt')).toBe('staged new\n');
    expect(read('untracked.txt')).toBe('untracked\n');
    expect(read('dir/sub/nested.txt')).toBe('nested\n');
    for (const gone of ['gone.txt', 'staged-gone.txt', 'ignored.log']) {
      expect(existsSync(join(tree, gone))).toBe(false);
    }

    // Гейты на `git ls-files` видят ровно то, что попадёт в коммит.
    const tracked = git(tree, 'ls-files').split('\n').filter(Boolean);
    expect(tracked).toEqual([
      '.gitignore',
      'dir/sub/nested.txt',
      'edit.txt',
      'keep.txt',
      'staged-edit.txt',
      'staged-new.txt',
      'untracked.txt',
    ]);
    expect(git(tree, 'rev-parse', 'HEAD')).toBe(headBefore);

    // node_modules — ссылкой на корневой, и в индекс она не попала.
    expect(lstatSync(join(tree, 'node_modules')).isSymbolicLink()).toBe(true);
    expect(tracked.some((f) => f.startsWith('node_modules'))).toBe(false);

    // Рабочее дерево автора не тронуто.
    expect(git(repo, 'status', '--porcelain')).toBe(statusBefore);
  });

  it('removeTree убирает дерево и запись о нём; без зависимостей ссылки нет', () => {
    evalModule<number>(
      TREE,
      `mod.createCleanTree(${JSON.stringify(repo)}, ${JSON.stringify(tree)})`,
    );
    expect(existsSync(join(tree, 'node_modules'))).toBe(false);
    expect(git(repo, 'worktree', 'list').trim().split('\n')).toHaveLength(2);

    evalModule<null>(
      TREE,
      `(mod.removeTree(${JSON.stringify(repo)}, ${JSON.stringify(tree)}), null)`,
    );
    expect(existsSync(tree)).toBe(false);
    expect(git(repo, 'worktree', 'list').trim().split('\n')).toHaveLength(1);
  });
});
