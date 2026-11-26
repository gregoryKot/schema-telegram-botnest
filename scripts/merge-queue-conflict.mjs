// Конфликт PR с main в очереди мержа: GitHub merge-драйверы не применяет, и PR
// с конфликтом только в бейслайнах или бэклоге стоял `dirty`, пока не заметят.
// Здесь main вливается в ветку PR git-ом с драйверами из .gitattributes;
// что драйверы не свели — комментарий автору (раз, по метке). Тест —
// src/test-support/gates/merge-queue.spec.ts.
// Не проверено на живом GitHub: что `git push` от GITHUB_TOKEN порождает
// pull_request-прогон на одобрение, как update-branch (строка в docs/BACKLOG.md).
import { failure, fetchRefs, git, lines, remote, workTree } from './merge-queue-git.mjs';

export const CONFLICT_LABEL = 'merge-conflict';

export function conflictComment(files) {
  const list = files.map((f) => `\`${f}\``).join(', ');
  return (
    `Очередь мержа: конфликт с \`main\` в ${list} (или правка workflow, которую бот влить не вправе) — нужен автор. ` +
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
  let wt;
  try {
    fetchRefs(repoDir, 'main', branch);
    if (git(repoDir, 'rev-parse', remote(branch)) !== sha) return { status: 'stale' };
    wt = workTree(repoDir, scriptsDir, sha);
    const { tree } = wt;
    const merge = (cfg) => wt.merge(remote('main'), `Merge branch 'main' into ${branch}`, cfg);
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
      merge();
    } catch {
      const files = lines(git(tree, 'diff', '--name-only', '--diff-filter=U'));
      return files.length ? { status: 'manual', files } : { status: 'failed', reason: 'merge упал без конфликтов' };
    }
    const head = git(tree, 'rev-parse', 'HEAD');
    // Правку workflow из main GITHUB_TOKEN запушить не вправе — вливает автор.
    const flows = lines(git(tree, 'diff', '--name-only', sha, head, '--', '.github/workflows'));
    if (flows.length) return { status: 'manual', files: flows };
    if (!dryRun) git(tree, 'push', '--quiet', `--force-with-lease=refs/heads/${branch}:${sha}`, 'origin', `HEAD:refs/heads/${branch}`);
    return { status: 'pushed', head };
  } catch (e) {
    return { status: 'failed', reason: failure(e) };
  } finally {
    wt?.drop();
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
