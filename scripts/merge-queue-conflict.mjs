// Конфликт PR с main в очереди мержа: GitHub merge-драйверы не применяет, и PR
// с конфликтом только в бейслайнах или бэклоге стоял `dirty`, пока не заметят.
// Здесь main вливается в ветку PR git-ом с драйверами из .gitattributes;
// что драйверы не свели — комментарий автору (раз, по метке). Тест —
// src/test-support/gates/merge-queue-conflict.spec.ts.
import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

export const CONFLICT_LABEL = 'merge-conflict';
const BOT_NAME = 'github-actions[bot]';
const BOT_EMAIL = '41898282+github-actions[bot]@users.noreply.github.com';
// Имена — как в scripts/setup-merge-drivers.mjs; скрипт берётся из чекаута
// main (scriptsDir), а не из дерева PR: код ветки с правом записи не исполняется.
const MODES = ['min', 'max', 'sum'];

export function conflictComment(files) {
  const list = files.map((f) => `\`${f}\``).join(', ');
  return (
    `Очередь мержа: конфликт с \`main\` в ${list} — нужен автор. ` +
    'Сведи локально: `git fetch origin main && git merge origin/main`, затем пуш. ' +
    `Метку \`${CONFLICT_LABEL}\` очередь снимет сама.`
  );
}

/**
 * Вливает origin/main в голову PR в отдельном worktree клона `repoDir`.
 * Итог: pushed (ветка обновлена, `head`), clean (без `pushClean`: конфликта нет и для GitHub),
 * manual (`files` — что не свелось), stale (голова уже другая), failed (`reason`).
 */
export function mergeMain({ repoDir, scriptsDir, branch, sha, pushClean, dryRun }) {
  const git = (cwd, ...args) =>
    execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const tree = mkdtempSync(join(tmpdir(), 'merge-queue-'));
  try {
    git(repoDir, 'fetch', '--quiet', 'origin', '+refs/heads/main:refs/remotes/origin/main', `+refs/heads/${branch}:refs/remotes/origin/${branch}`);
    if (git(repoDir, 'rev-parse', `refs/remotes/origin/${branch}`) !== sha) return { status: 'stale' };
    git(repoDir, 'worktree', 'add', '--quiet', '--detach', tree, sha);
    // Атрибуты main — запасные: ветка, отставшая от новой строки .gitattributes, сводится по ней же.
    const drivers = MODES.flatMap((m) => [
      '-c',
      `merge.ratchet-${m}.driver=node ${join(scriptsDir, 'merge-json-ratchet.mjs')} ${m} %O %A %B %P`,
    ]).concat('-c', `core.attributesFile=${join(scriptsDir, '..', '.gitattributes')}`);
    const who = ['-c', `user.name=${BOT_NAME}`, '-c', `user.email=${BOT_EMAIL}`];
    const merge = (cfg) =>
      git(tree, ...who, ...cfg, 'merge', '--no-ff', '--quiet', '-m', `Merge branch 'main' into ${branch}`, 'refs/remotes/origin/main');
    if (!pushClean) {
      // Как видит GitHub: без драйверов (и без встроенного union). Свелось — конфликта нет, пуш не нужен.
      try {
        merge(['-c', 'merge.union.driver=false']);
        return { status: 'clean' };
      } catch {
        git(tree, 'reset', '--quiet', '--hard', sha);
      }
    }
    try {
      merge(drivers);
    } catch {
      const files = git(tree, 'diff', '--name-only', '--diff-filter=U').split('\n').filter(Boolean);
      return files.length ? { status: 'manual', files } : { status: 'failed', reason: 'merge упал без конфликтов' };
    }
    const head = git(tree, 'rev-parse', 'HEAD');
    if (!dryRun) git(tree, 'push', '--quiet', `--force-with-lease=refs/heads/${branch}:${sha}`, 'origin', `HEAD:refs/heads/${branch}`);
    return { status: 'pushed', head };
  } catch (e) {
    return { status: 'failed', reason: String(e.stderr || e.message).trim().split('\n').pop() };
  } finally {
    try {
      git(repoDir, 'worktree', 'remove', '--force', tree);
    } catch {
      rmSync(tree, { recursive: true, force: true });
    }
  }
}

/**
 * Шаг очереди: сводит конфликт PR с main. true — ветка обновлена, очередь на
 * этот прогон занята; false — следующий (не свелось: комментарий и метка, раз).
 */
export async function resolveConflict(p, { repoDir, scriptsDir, pushClean, dryRun, call, R, settle }) {
  if (!repoDir) return false;
  const r = mergeMain({ repoDir, scriptsDir, branch: p.branch, sha: p.sha, pushClean, dryRun });
  if (r.status === 'pushed') {
    if (dryRun) console.log(`dry-run: свёл бы конфликт #${p.number}`);
    else await settle(p, r.head, 'main влит очередью');
    return true;
  }
  if (r.status === 'failed') console.log(`::warning::#${p.number}: слияние с main не удалось (${r.reason}) — следующий`);
  if (r.status !== 'manual') return false;
  console.log(`#${p.number}: конфликт в ${r.files.join(', ')} — нужен автор`);
  if (p.flagged || dryRun) return false;
  const posts = [['comments', { body: conflictComment(r.files) }], ['labels', { labels: [CONFLICT_LABEL] }]];
  for (const [path, body] of posts) {
    const res = await call('POST', `${R}/issues/${p.number}/${path}`, body);
    if (!res.ok) console.log(`::warning::#${p.number}: ${path} HTTP ${res.status}`);
  }
  return false;
}
