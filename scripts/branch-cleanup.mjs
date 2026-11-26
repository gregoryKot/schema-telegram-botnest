#!/usr/bin/env node
// Чистка веток смерженных PR (не гейт; аудит 2026-10, правило №13). Зовётся
// только вручную из .github/workflows/branch-cleanup.yml: с 2026-11-07
// `delete_branch_on_merge` удаляет ветку при мерже сам, этот скрипт — для
// веток, накопленных до того.
//
// Ветка удаляется, только если работа из неё целиком в main:
//  - это не ветка по умолчанию и из неё нет открытого PR;
//  - из неё есть смерженный PR, и голова ветки совпадает с head.sha этого PR
//    (после мержа в ветку ничего не пушили).
// Остальное (коммиты после мержа, PR закрыт без мержа, PR нет) — в отчёт с
// причиной: там может быть чужая незаконченная работа. Удалённую ветку
// смерженного PR возвращает кнопка Restore branch на странице PR.
//
//   GITHUB_TOKEN=… GITHUB_REPOSITORY=owner/repo node scripts/branch-cleanup.mjs           # только список
//   GITHUB_TOKEN=… GITHUB_REPOSITORY=owner/repo node scripts/branch-cleanup.mjs --apply   # удалить
//
// Перед каждым удалением голова ветки перечитывается: сдвинулась — пропуск.
// GITHUB_API_URL — база API (в Actions задана; тест подставляет свой сервер).
import { fileURLToPath } from 'url';

export const KEEP_REASONS = {
  open: 'открытый PR',
  pushedAfter: 'PR смержен, но в ветке есть коммиты после мержа',
  closed: 'PR закрыт без мержа',
  noPr: 'PR нет',
};

/** План чистки: что удалить и что оставить с причиной. */
export function planCleanup(branches, pulls, repo, defaultBranch) {
  const byRef = new Map();
  for (const p of pulls) {
    if (p.head?.repo?.full_name !== repo) continue; // PR из форка — не наша ветка
    const list = byRef.get(p.head.ref) ?? [];
    list.push(p);
    byRef.set(p.head.ref, list);
  }
  const remove = [];
  const keep = [];
  for (const b of branches) {
    const { name } = b;
    const sha = b.commit.sha;
    if (name === defaultBranch) continue;
    const prs = byRef.get(name) ?? [];
    const same = prs.find((p) => p.merged_at && p.head.sha === sha);
    let reason = null;
    if (prs.some((p) => p.state === 'open')) reason = KEEP_REASONS.open;
    else if (!same) {
      if (prs.some((p) => p.merged_at)) reason = KEEP_REASONS.pushedAfter;
      else reason = prs.length ? KEEP_REASONS.closed : KEEP_REASONS.noPr;
    }
    if (reason) keep.push({ name, reason });
    else remove.push({ name, sha, pr: same.number });
  }
  return { remove, keep };
}

const refPath = (name) => name.split('/').map(encodeURIComponent).join('/');

async function main() {
  const apply = process.argv.includes('--apply');
  // Пауза между удалениями: вторичный лимит GitHub — ~80 изменяющих запросов
  // в минуту, 351 DELETE подряд обрывался бы 403 на середине. Тест ставит 0.
  const delayArg = process.argv.find((a) => a.startsWith('--delay-ms='));
  const delayMs = delayArg
    ? Number(delayArg.slice('--delay-ms='.length))
    : 1000;
  const repo = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  const api = process.env.GITHUB_API_URL || 'https://api.github.com';
  if (!repo || !token)
    throw new Error('нужны GITHUB_REPOSITORY и GITHUB_TOKEN');

  const gh = async (method, path) => {
    const res = await fetch(api + path, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
      },
    });
    if (method === 'GET' && res.status === 404) return null;
    if (!res.ok) throw new Error(`${method} ${path}: HTTP ${res.status}`);
    return res.status === 204 ? null : res.json();
  };
  const all = async (path) => {
    const out = [];
    for (let page = 1; ; page++) {
      const batch = await gh(
        'GET',
        `${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`,
      );
      out.push(...batch);
      if (batch.length < 100) return out;
    }
  };

  const { default_branch: defaultBranch } = await gh('GET', `/repos/${repo}`);
  const branches = await all(`/repos/${repo}/branches`);
  const pulls = await all(`/repos/${repo}/pulls?state=all`);
  const { remove, keep } = planCleanup(branches, pulls, repo, defaultBranch);

  console.log(
    `Веток: ${branches.length}, к удалению: ${remove.length}, оставить: ${keep.length}`,
  );
  for (const r of Object.values(KEEP_REASONS)) {
    const names = keep.filter((k) => k.reason === r).map((k) => k.name);
    if (names.length)
      console.log(`Оставить — ${r} (${names.length}): ${names.join(', ')}`);
  }
  for (const r of remove)
    console.log(`${apply ? 'удаляю' : 'к удалению'}: ${r.name} (PR #${r.pr})`);
  if (!apply) return console.log('Только список. Удаление — с --apply.');

  let deleted = 0;
  for (const r of remove) {
    const now = await gh('GET', `/repos/${repo}/branches/${refPath(r.name)}`);
    if (now?.commit.sha !== r.sha) {
      console.log(
        `пропуск: ${r.name} — ${now ? 'голова сдвинулась' : 'ветки уже нет'}`,
      );
      continue;
    }
    await gh('DELETE', `/repos/${repo}/git/refs/heads/${refPath(r.name)}`);
    deleted++;
    await new Promise((done) => setTimeout(done, delayMs));
  }
  console.log(`Удалено веток: ${deleted} из ${remove.length}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(`::error::branch-cleanup: ${e.message}`);
    process.exit(1);
  });
}
