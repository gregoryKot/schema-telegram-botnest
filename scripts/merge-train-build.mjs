// Ветка-поезд: свежий main + головы пассажиров, сведённые драйверами main.
// Код пассажиров здесь не исполняется: бейслайны пересчитывает джоба без права
// записи, сюда приходит только её патч (`applyBaselines`).
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { WHO, failure, fetchRefs, git, lines, remote, workTree } from './merge-queue-git.mjs';
import { RECOMPUTED, flatCounts } from './merge-train-plan.mjs';

/**
 * Сводит пассажиров по очереди на свежий main. Итог: `head` — коммит поезда
 * (null — вошло меньше двух), `cars` — вошедшие, `skipped` — [{ number, why }]:
 * голова сменилась, правит workflow (бот такое запушить не вправе) или конфликт.
 */
export function buildTrain({ repoDir, scriptsDir, cars }) {
  const skipped = [];
  const boarded = [];
  let wt;
  try {
    fetchRefs(repoDir, 'main', ...cars.map((c) => c.branch));
    const main = remote('main');
    wt = workTree(repoDir, scriptsDir, main);
    for (const c of cars) {
      const skip = (why) => skipped.push({ number: c.number, why });
      if (git(repoDir, 'rev-parse', remote(c.branch)) !== c.sha) skip('голова сменилась');
      else if (git(repoDir, 'diff', '--name-only', `${main}...${c.sha}`, '--', '.github/workflows')) skip('правит workflow');
      else {
        try {
          wt.merge(c.sha, `Поезд: #${c.number}`);
          boarded.push(c);
        } catch {
          const files = lines(git(wt.tree, 'diff', '--name-only', '--diff-filter=U'));
          git(wt.tree, 'reset', '--quiet', '--hard', 'HEAD');
          skip(`конфликт: ${files.join(', ') || 'слияние упало'}`);
        }
      }
    }
    const head = boarded.length >= 2 ? git(wt.tree, 'rev-parse', 'HEAD') : null;
    return { head, cars: boarded, skipped };
  } catch (e) {
    return { head: null, cars: [], skipped, reason: failure(e) };
  } finally {
    wt?.drop();
  }
}

export const pushTrain = (repoDir, head, branch) =>
  git(repoDir, 'push', '--quiet', 'origin', `${head}:refs/heads/${branch}`);

/**
 * Патч пересчитанных бейслайнов (вывод `git diff` из джобы без записи) — в
 * ветку поезда. Патч — данные: применяется только к RECOMPUTED, итог обязан
 * остаться плоским JSON счётчиков. `head` — новая голова или null (`reason`).
 */
export function applyBaselines({ repoDir, scriptsDir, branch, sha, patch }) {
  const dir = mkdtempSync(join(tmpdir(), 'merge-train-patch-'));
  let wt;
  try {
    fetchRefs(repoDir, branch);
    if (git(repoDir, 'rev-parse', remote(branch)) !== sha) return { head: null, reason: 'голова поезда сменилась' };
    wt = workTree(repoDir, scriptsDir, sha);
    const file = join(dir, 'baselines.patch');
    writeFileSync(file, patch);
    git(wt.tree, 'apply', ...RECOMPUTED.map((p) => `--include=${p}`), file);
    const changed = lines(git(wt.tree, 'diff', '--name-only'));
    if (!changed.length) return { head: null, reason: 'патч ничего не меняет' };
    const alien = changed.filter((p) => !RECOMPUTED.includes(p) || !flatCounts(readFileSync(join(wt.tree, p), 'utf8')));
    if (alien.length) return { head: null, reason: `патч портит ${alien.join(', ')}` };
    git(wt.tree, 'add', '--', ...changed);
    git(wt.tree, ...WHO, 'commit', '--quiet', '-m', 'Поезд: бейслайны пересчитаны на сведённом дереве');
    git(wt.tree, 'push', '--quiet', 'origin', `HEAD:refs/heads/${branch}`);
    return { head: git(wt.tree, 'rev-parse', 'HEAD') };
  } catch (e) {
    return { head: null, reason: failure(e) };
  } finally {
    wt?.drop();
    rmSync(dir, { recursive: true, force: true });
  }
}
