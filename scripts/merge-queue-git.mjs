// Git-кухня очереди мержа: отдельный worktree клона, слияние по правилам main.
// Драйверы и атрибуты берутся из чекаута main (scriptsDir), а не из дерева PR:
// код ветки с правом записи не исполняется, а её старый `merge=` не решает.
import { execFileSync } from 'child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { driverConfig } from './merge-drivers-check.mjs';

const BOT_NAME = 'github-actions[bot]';
const BOT_EMAIL = '41898282+github-actions[bot]@users.noreply.github.com';
export const WHO = ['-c', `user.name=${BOT_NAME}`, '-c', `user.email=${BOT_EMAIL}`];

export const git = (cwd, ...args) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
export const lines = (out) => out.split('\n').filter(Boolean);
export const failure = (e) => String(e.stderr || e.message).trim().split('\n').pop();
export const remote = (branch) => `refs/remotes/origin/${branch}`;

/** Свежие origin-ссылки веток в клоне. */
export const fetchRefs = (repoDir, ...branches) =>
  git(repoDir, 'fetch', '--quiet', 'origin', ...branches.map((b) => `+refs/heads/${b}:${remote(b)}`));

/** Worktree клона на `at`: `merge(ref, msg)` сводит драйверами main, `drop()` убирает дерево. */
export function workTree(repoDir, scriptsDir, at) {
  const tree = mkdtempSync(join(tmpdir(), 'merge-queue-'));
  const drop = () => {
    try {
      git(repoDir, 'worktree', 'remove', '--force', tree);
    } catch {
      rmSync(tree, { recursive: true, force: true });
    }
  };
  try {
    git(repoDir, 'worktree', 'add', '--quiet', '--detach', tree, at);
    // info/attributes старше .gitattributes ветки: отставшая ветка сводится по правилам main.
    const info = join(git(repoDir, 'rev-parse', '--path-format=absolute', '--git-common-dir'), 'info');
    mkdirSync(info, { recursive: true });
    copyFileSync(join(scriptsDir, '..', '.gitattributes'), join(info, 'attributes'));
  } catch (e) {
    drop();
    throw e;
  }
  const drivers = driverConfig(scriptsDir);
  const merge = (ref, msg, cfg = drivers) =>
    git(tree, ...WHO, ...cfg, 'merge', '--no-ff', '--quiet', '-m', msg, ref);
  return { tree, merge, drop };
}
