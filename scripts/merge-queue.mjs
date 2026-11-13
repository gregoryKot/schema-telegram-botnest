#!/usr/bin/env node
// Очередь мержа для бедных (не гейт): ruleset `main` требует ветку со свежим
// main (strict), merge queue недоступна (репозиторий личный), а auto-merge
// отставшую ветку сам не обновляет. Зовётся из .github/workflows/merge-queue.yml.
//
// За прогон — один PR. Очередь — открытые PR в main с auto-merge, не черновики,
// без `do-not-merge`, старые первыми (правила — merge-queue-plan.mjs):
//  - свежий PR с идущими проверками «в работе» — его ждут, остальных не трогают;
//  - иначе первый отставший с зелёным или идущим прогоном обязательных проверок
//    получает update-branch; конфликт (422) — пропуск, следующий по порядку;
//  - красный и без прогона чинит агент.
// Пуш от GITHUB_TOKEN ставит pull_request-прогон CI на одобрение
// (action_required), а прогон ci.yml через dispatch ruleset в зачёт auto-merge
// не берёт (#1104: 20 подтягиваний за день, мержа нет) — очередь одобряет свой прогон.
//
//   GITHUB_TOKEN=… GITHUB_REPOSITORY=owner/repo node scripts/merge-queue.mjs [--dry-run]
// GITHUB_API_URL — база API (тест подставляет свой сервер), MERGE_QUEUE_POLL_MS — шаг ожидания.
import { fileURLToPath } from 'url';
import {
  BOT,
  DEPENDABOT,
  checksState,
  planQueue,
  queuedPulls,
  requiredChecks,
  runsToApprove,
} from './merge-queue-plan.mjs';

const POLLS = 18;
const CI = '.github/workflows/ci.yml';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const repo = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  const api = process.env.GITHUB_API_URL || 'https://api.github.com';
  const pollMs = Number(process.env.MERGE_QUEUE_POLL_MS ?? 5000);
  if (!repo || !token) throw new Error('нужны GITHUB_REPOSITORY и GITHUB_TOKEN');

  const call = async (method, path, body) => {
    const res = await fetch(api + path, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, ok: res.ok, data: text ? JSON.parse(text) : null };
  };
  const get = async (path) => {
    const r = await call('GET', path);
    if (!r.ok) throw new Error(`GET ${path}: HTTP ${r.status}`);
    return r.data;
  };
  const sleep = () => new Promise((done) => setTimeout(done, pollMs));
  const R = `/repos/${repo}`;

  /** Одобряет прогоны очереди на голове; сколько одобрено. */
  const approve = async (sha) => {
    const { workflow_runs: runs } = await get(`${R}/actions/runs?head_sha=${sha}&event=pull_request`);
    const todo = runsToApprove(runs, repo);
    for (const r of todo) {
      const res = await call('POST', `${R}/actions/runs/${r.id}/approve`);
      if (!res.ok) throw new Error(`approve прогона ${r.id}: HTTP ${res.status}`);
    }
    return { ci: runs.some((r) => r.path === CI), approved: todo.length };
  };

  /** `@dependabot recreate`, не чаще раза на голову: true — попросили сейчас. */
  const recreate = async (p) => {
    const { commit } = await get(`${R}/commits/${p.sha}`);
    const since = commit.committer.date;
    const comments = await get(`${R}/issues/${p.number}/comments?since=${since}&per_page=100`);
    const asked = comments.some(
      (c) => c.user.login === BOT && c.body.startsWith('@dependabot recreate') && c.created_at > since,
    );
    if (asked) return false;
    const res = await call('POST', `${R}/issues/${p.number}/comments`, { body: '@dependabot recreate' });
    if (!res.ok) throw new Error(`комментарий в #${p.number}: HTTP ${res.status}`);
    return true;
  };

  const required = requiredChecks(await get(`/repos/${repo}/rules/branches/main`));
  if (!required.length) throw new Error('у ruleset main нет обязательных проверок — нечем судить зелёный');
  const pulls = queuedPulls(await get(`${R}/pulls?state=open&base=main&per_page=100`), repo);
  const prs = [];
  for (const p of pulls) {
    const sha = p.head.sha;
    const { behind_by: behind } = await get(`${R}/compare/main...${sha}?per_page=1`);
    const { check_runs: runs } = await get(`${R}/commits/${sha}/check-runs?per_page=100`);
    const pr = { number: p.number, sha, author: p.user.login, behind, checks: checksState(required, runs) };
    // Свежий PR без прогона: одобрение очереди могло не дойти в прошлый раз.
    if (behind === 0 && pr.checks.state === 'missing' && !dryRun && (await approve(sha)).approved) {
      pr.checks = { state: 'pending', last: 0 };
    }
    console.log(`#${pr.number}: отстаёт на ${behind}, обязательные проверки — ${pr.checks.state}`);
    prs.push(pr);
  }

  const { wait, candidates } = planQueue(prs, Date.now());
  if (wait) return console.log(`#${wait.number} в работе: ветка свежая, ждём его мержа`);
  for (const p of candidates) {
    if (dryRun) return console.log(`dry-run: подтянул бы #${p.number}`);
    const r = await call('PUT', `${R}/pulls/${p.number}/update-branch`, { expected_head_sha: p.sha });
    if (r.status === 422) {
      console.log(`#${p.number}: update-branch отказал (422: конфликт или голова сменилась) — следующий`);
      continue;
    }
    if (!r.ok) {
      // Иной отказ — обычно нет права workflows; бот-PR пересобирает сам бот.
      if (p.author === DEPENDABOT && (await recreate(p))) {
        return console.log(`#${p.number}: update-branch HTTP ${r.status}, попросил бота пересобрать`);
      }
      console.log(`::warning::#${p.number}: update-branch HTTP ${r.status} — следующий`);
      continue;
    }
    let head = p.sha;
    for (let i = 0; i < POLLS && head === p.sha; i++) {
      await sleep();
      head = (await get(`${R}/pulls/${p.number}`)).head.sha;
    }
    if (head === p.sha) throw new Error(`#${p.number}: голова не сменилась после update-branch`);
    let res = { ci: false, approved: 0 };
    for (let i = 0; i < POLLS && !res.ci; i++) {
      await sleep();
      const step = await approve(head);
      res = { ci: step.ci, approved: res.approved + step.approved };
    }
    if (!res.ci) console.log(`::warning::#${p.number}: прогон CI не появился — одобрит следующий прогон очереди`);
    return console.log(
      `#${p.number}: отставал на ${p.behind}, подтянут (${p.sha} → ${head}), одобрено прогонов: ${res.approved}`,
    );
  }
  console.log('Подтягивать некого');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(`::error::merge-queue: ${e.message}`);
    process.exit(1);
  });
}
