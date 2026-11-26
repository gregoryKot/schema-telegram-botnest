#!/usr/bin/env node
// Выбор коммита main для суточной выкатки на прод (.github/workflows/release.yml).
// Прод собирается из ветки production; сюда приходит вопрос «до какого коммита
// main её довести». Не гейт: печатает решение строками `ключ=значение`.
//
//   node scripts/release-pick.mjs                 # живой GitHub API (GITHUB_TOKEN, GITHUB_REPOSITORY)
//   node scripts/release-pick.mjs --input=f.json  # образец: {commits, runs, deployed}
//   … --sha=<коммит main>                         # срочная выкатка или откат на этот коммит
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

/** Трейлер коммита ветки production: какой коммит main в нём лежит. */
export const MAIN_TRAILER = 'Main-Commit';

export function deployedFromMessage(message) {
  const m = new RegExp(`^${MAIN_TRAILER}: ([0-9a-f]{40})$`, 'm').exec(
    message ?? '',
  );
  return m ? m[1] : null;
}

/**
 * commits — sha коммитов main, новые первыми; runs — прогоны CI на push в main,
 * новые первыми ({sha, status, conclusion}); deployed — sha main на проде или null.
 * Берётся самый новый зелёный коммит новее выкаченного. `mainRed` — последний
 * ЗАВЕРШЁННЫЙ прогон красный: идущий прогон свежего мержа сигналом не считается.
 * Коммит без прогона в окне (100 последних) считается идущим и не выкатывается.
 */
export function pickRelease({ commits, runs, deployed, forced, hold, manual }) {
  // Откат (--sha) ставит замок: расписание не вернёт на прод то, с чего ушли.
  // Снимает замок ручной запуск без sha — после починки main.
  if (!forced && hold && !manual) {
    return { action: 'none', reason: 'прод держит откат — снимет ручной запуск без sha', mainRed: false };
  }
  if (forced) {
    if (!commits.includes(forced)) {
      return { action: 'error', reason: `коммита ${forced} нет среди последних ${commits.length} коммитов main` };
    }
    return forced === deployed
      ? { action: 'none', reason: 'этот коммит уже на проде', mainRed: false }
      : { action: 'release', sha: forced, hold: true, mainRed: false };
  }

  const verdict = new Map();
  for (const run of runs) {
    if (!verdict.has(run.sha)) {
      verdict.set(run.sha, run.status === 'completed' ? run.conclusion : 'pending');
    }
  }

  const fresh = [];
  for (const sha of commits) {
    if (sha === deployed) break;
    fresh.push(sha);
  }
  const lastDone = fresh.find((sha) => (verdict.get(sha) ?? 'pending') !== 'pending');
  const mainRed = lastDone !== undefined && verdict.get(lastDone) !== 'success';

  if (fresh.length === 0) {
    return { action: 'none', reason: 'на проде уже последний коммит main', mainRed };
  }
  const green = fresh.find((sha) => verdict.get(sha) === 'success');
  if (!green) {
    return { action: 'none', reason: `среди ${fresh.length} новых коммитов main нет зелёного`, mainRed };
  }
  return { action: 'release', sha: green, skipped: fresh.indexOf(green), mainRed };
}

async function api(path) {
  const res = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}${path}`, {
    headers: {
      authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      accept: 'application/vnd.github+json',
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub API ${path}: ${res.status}`);
  return res.json();
}

async function loadLive() {
  const [commits, runs, tip] = await Promise.all([
    api('/commits?sha=main&per_page=100'),
    api('/actions/workflows/ci.yml/runs?branch=main&event=push&per_page=100'),
    api('/commits/production'),
  ]);
  return {
    commits: commits.map((c) => c.sha),
    runs: runs.workflow_runs.map((r) => ({ sha: r.head_sha, status: r.status, conclusion: r.conclusion })),
    deployed: deployedFromMessage(tip?.commit?.message),
    hold: /^Release-Hold: true$/m.test(tip?.commit?.message ?? ''),
  };
}

async function main() {
  const arg = (name) =>
    process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) || undefined;
  const input = arg('input');
  const data = input ? JSON.parse(readFileSync(input, 'utf8')) : await loadLive();
  const decision = pickRelease({
    ...data,
    forced: arg('sha'),
    manual: process.argv.includes('--manual'),
  });
  for (const [key, value] of Object.entries(decision)) console.log(`${key}=${value}`);
  if (decision.action === 'error') process.exit(1);
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
