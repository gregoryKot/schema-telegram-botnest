// Чистое дерево для scripts/agent/precheck.mjs: worktree на HEAD, поверх него
// ровно то, что попадёт в коммит. Всё синхронное — спек гоняет эти функции на
// временном репозитории (src/test-support/agent-precheck.spec.ts).
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  lstatSync,
  mkdirSync,
  readlinkSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { dirname, join } from 'node:path';

function git(cwd, args) {
  const res = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
  if (res.status !== 0) {
    throw new Error(`git ${args.join(' ')}: ${(res.stderr || res.error || '').toString().trim()}`);
  }
  return res.stdout;
}

const nulList = (text) => text.split('\0').filter(Boolean);

/**
 * Пути, чьё содержимое в рабочем дереве отличается от HEAD: изменённые,
 * добавленные и удалённые отслеживаемые (и в индексе, и мимо него — `git diff
 * HEAD` видит обе половины) плюс неотслеживаемые, не попавшие под .gitignore.
 * Только `ls-files -m -o` потерял бы файл, который уже сделали `git add`:
 * он совпадает с индексом и не «изменён», и не «неотслеживаемый».
 */
export function changedPaths(root) {
  const tracked = nulList(git(root, ['diff', '--name-only', '--no-renames', '-z', 'HEAD']));
  const untracked = nulList(git(root, ['ls-files', '-o', '--exclude-standard', '-z']));
  return [...new Set([...tracked, ...untracked])].sort();
}

/** Переносит каждый путь из рабочего дерева в `tree`; исчезнувший — удаляет. */
export function mirrorPaths(root, tree, paths) {
  for (const rel of paths) {
    const src = join(root, rel);
    const dst = join(tree, rel);
    let stat = null;
    try {
      stat = lstatSync(src);
    } catch {
      // Файла нет в рабочем дереве — в коммит он попадёт удалением.
    }
    rmSync(dst, { recursive: true, force: true });
    if (!stat || stat.isDirectory()) continue;
    mkdirSync(dirname(dst), { recursive: true });
    if (stat.isSymbolicLink()) symlinkSync(readlinkSync(src), dst);
    else copyFileSync(src, dst);
  }
}

/**
 * Создаёт в `tree` отсоединённый worktree на HEAD, переносит правки рабочего
 * дерева и стейджит их (`git add -A`, только индекс: гейты на `git ls-files`
 * должны видеть новые файлы). Игнорируемое (node_modules, dist, .claude/state)
 * не переносится — как в CI. Корневой node_modules подключается ссылкой уже
 * после стейджа, чтобы не попасть в индекс. Возвращает число перенесённых путей.
 */
export function createCleanTree(root, tree) {
  git(root, ['worktree', 'add', '--detach', '--quiet', tree, 'HEAD']);
  const paths = changedPaths(root);
  mirrorPaths(root, tree, paths);
  git(tree, ['add', '-A']);
  try {
    lstatSync(join(root, 'node_modules'));
    symlinkSync(join(root, 'node_modules'), join(tree, 'node_modules'), 'dir');
  } catch {
    // Нет установленных зависимостей — гейтам, которым они нужны, и так красно.
  }
  return paths.length;
}

/** Убирает worktree; ошибки глотает — вызывается и при сбое, и по сигналу. */
export function removeTree(root, tree) {
  spawnSync('git', ['worktree', 'remove', '--force', tree], { cwd: root });
  rmSync(tree, { recursive: true, force: true });
  spawnSync('git', ['worktree', 'prune'], { cwd: root });
}
