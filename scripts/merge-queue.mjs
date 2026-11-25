#!/usr/bin/env node
// Очередь мержа для бедных (не гейт): ruleset `main` требует ветку со свежим
// main (strict), merge queue недоступна (репозиторий личный), а auto-merge
// отставшую ветку сам не обновляет. Зовётся из .github/workflows/merge-queue.yml.
//
// За прогон — один PR. Очередь — открытые PR в main с auto-merge, не черновики,
// без `do-not-merge`, старые первыми (правила — merge-queue-plan.mjs):
//  - свежий PR с идущим CI (чей пуш — не важно) «в полёте»: его ждут, одиночно не подтягивают, поезд садится и так;
//  - отменённые обязательные проверки — как отставание: update-branch перезапускает CI;
//  - иначе первый отставший (зелёные по готовности, затем с идущим прогоном)
//    получает update-branch; конфликт сводит merge-queue-conflict.mjs, не свёл —
//    комментарий автору и метка, следующий по порядку; красный чинит агент;
//  - отставших зелёных ≥2 и MERGE_TRAIN=on — они едут поездом (merge-train.mjs).
// Пуш от GITHUB_TOKEN ставит pull_request-прогон CI на одобрение
// (action_required), а прогон ci.yml через dispatch ruleset в зачёт auto-merge
// не берёт (#1104: 20 подтягиваний за день, мержа нет) — очередь одобряет свой прогон.
//
//   GITHUB_TOKEN=… GITHUB_REPOSITORY=owner/repo node scripts/merge-queue.mjs [--dry-run]
// GITHUB_API_URL — база API (тест подставляет свой сервер), MERGE_QUEUE_POLL_MS — шаг ожидания,
// MERGE_QUEUE_GIT_DIR — полный клон с правом пуша; без него конфликт — просто пропуск.
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { client } from './merge-queue-api.mjs';
import { CONFLICT_LABEL, resolveConflict } from './merge-queue-conflict.mjs';
import { DEPENDABOT, checksState, planQueue, queuedPulls, requiredChecks } from './merge-queue-plan.mjs';
import { queueSteps } from './merge-queue-steps.mjs';
import { trainEngine } from './merge-train.mjs';
import { NO_TRAIN, isTrain } from './merge-train-plan.mjs';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const repo = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  const api = process.env.GITHUB_API_URL || 'https://api.github.com';
  const pollMs = Number(process.env.MERGE_QUEUE_POLL_MS ?? 5000);
  const repoDir = process.env.MERGE_QUEUE_GIT_DIR;
  if (!repo || !token) throw new Error('нужны GITHUB_REPOSITORY и GITHUB_TOKEN');

  const { call, get } = client(api, token);
  const R = `/repos/${repo}`;
  const scriptsDir = dirname(fileURLToPath(import.meta.url));
  const { approve, recreate, settle, newHead } = queueSteps({ call, get, R, repo, pollMs });
  const trains = trainEngine({ call, get, R, on: process.env.MERGE_TRAIN === 'on', dryRun, repoDir, scriptsDir });

  const required = requiredChecks(await get(`/repos/${repo}/rules/branches/main`));
  if (!required.length) throw new Error('у ruleset main нет обязательных проверок — нечем судить зелёный');
  const open = await get(`${R}/pulls?state=open&base=main&per_page=100`);
  const pulls = queuedPulls(trains.riders(open), repo);
  const prs = [];
  for (const p of pulls) {
    const sha = p.head.sha;
    const { behind_by: behind } = await get(`${R}/compare/main...${sha}?per_page=1`);
    const { check_runs: runs } = await get(`${R}/commits/${sha}/check-runs?per_page=100`);
    const flagged = p.labels.some((l) => l.name === CONFLICT_LABEL);
    const pr = { number: p.number, sha, branch: p.head.ref, flagged, author: p.user.login, behind, checks: checksState(required, runs) };
    // Поля поезда: состав читается из тела PR-поезда, виновного ищут по его прогонам.
    Object.assign(pr, { node: p.node_id, title: p.title, auto: !p.kept, noTrain: p.labels.some((l) => l.name === NO_TRAIN) });
    if (isTrain(p)) Object.assign(pr, { train: true, body: p.body, created: Date.parse(p.created_at), runs });
    // Автор свёл конфликт сам — метка больше не правда.
    if (flagged && behind === 0 && !dryRun) await call('DELETE', `${R}/issues/${p.number}/labels/${CONFLICT_LABEL}`);
    // Свежий PR без прогона: одобрение очереди могло не дойти в прошлый раз.
    if (behind === 0 && pr.checks.state === 'missing' && !dryRun && (await approve(sha)).approved) {
      pr.checks = { state: 'pending', last: 0, since: Date.now() };
    }
    if (behind === 0 && pr.checks.state === 'cancelled') {
      console.log(`::warning::#${p.number}: проверки отменены на свежей голове — перезапустить может только автор`);
    }
    console.log(`#${pr.number}: отстаёт на ${behind}, обязательные проверки — ${pr.checks.state}`);
    prs.push(pr);
  }

  const resolve = (p, pushClean) => resolveConflict(p, { repoDir, scriptsDir, pushClean, dryRun, call, R, settle });

  const ride = await trains.drive(prs, open);
  if (ride === 'done') return;
  const { wait, candidates, boarders } = planQueue(prs.filter((p) => !!p.train === (ride === 'ride')), Date.now());
  if (ride !== 'walk' && (await trains.board(boarders))) return;
  if (wait) return console.log(`#${wait.number} в полёте: ветка свежая, ждём его мержа`);
  for (const p of candidates) {
    // Без прогона: у конфликта с main CI не стартует; иное «без прогона» чинит агент.
    if (p.checks.state === 'missing') {
      if (await resolve(p, false)) return;
      console.log(`#${p.number}: без прогона и без конфликта — пропуск, чинит автор`);
      continue;
    }
    if (dryRun) return console.log(`dry-run: подтянул бы #${p.number}`);
    const r = await call('PUT', `${R}/pulls/${p.number}/update-branch`, { expected_head_sha: p.sha });
    if (r.status === 422) {
      console.log(`#${p.number}: update-branch отказал (422: конфликт или голова сменилась)`);
      if (await resolve(p, true)) return;
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
    const head = await newHead(p);
    if (head === p.sha) throw new Error(`#${p.number}: голова не сменилась после update-branch`);
    return settle(p, head, 'подтянут');
  }
  console.log('Подтягивать некого');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(`::error::merge-queue: ${e.message}`);
    process.exit(1);
  });
}
