// Правила очереди мержа — чистые функции без сети; движок и порядок шагов —
// scripts/merge-queue.mjs, тест — src/test-support/gates/merge-queue.spec.ts.

export const BOT = 'github-actions[bot]';
export const DEPENDABOT = 'dependabot[bot]';
const GREEN = new Set(['success', 'skipped', 'neutral']);
const RED = new Set(['failure', 'timed_out', 'startup_failure']);
// Свежий зелёный PR GitHub мержит за секунды; дольше — что-то держит, очередь идёт дальше.
export const GREEN_GRACE_MS = 10 * 60_000;
// Идущий CI на свежей голове держит очередь, пока не завис: полный круг CI короче.
export const PENDING_GRACE_MS = 45 * 60_000;
// Отменённый прогон — не ответ: проверку надо запустить заново (update-branch ставит новый CI).
const CANCELLED = new Set(['cancelled', 'stale']);

/** Обязательные проверки main из ответа GET /rules/branches/main. */
export function requiredChecks(rules) {
  return rules
    .filter((r) => r.type === 'required_status_checks')
    .flatMap((r) => r.parameters.required_status_checks)
    .map((c) => ({ context: c.context, app: c.integration_id ?? null }));
}

/** PR в очереди: открыт в main, не черновик, auto-merge включён, не из форка, без `do-not-merge`; старые первыми. */
export function queuedPulls(pulls, repo) {
  return pulls
    .filter(
      (p) =>
        !p.draft &&
        p.auto_merge &&
        p.base.ref === 'main' &&
        p.head.repo?.full_name === repo &&
        !p.labels.some((l) => l.name === 'do-not-merge'),
    )
    .sort((a, b) => a.number - b.number);
}

/**
 * Последний прогон каждой обязательной проверки на голове PR: red — хоть одна
 * упала; pending — идёт (`since` — когда начался самый ранний); missing — у
 * какой-то проверки нет прогона; cancelled — прогон отменён (перезапуск);
 * green — все зелёные. `last` — когда завершилась последняя (для green).
 */
export function checksState(required, runs) {
  let pending = false;
  let missing = false;
  let cancelled = false;
  let last = 0;
  let since = Infinity;
  for (const { context, app } of required) {
    const run = runs
      .filter((r) => r.name === context && (app === null || r.app?.id === app))
      .sort((a, b) => b.id - a.id)[0];
    if (!run) missing = true;
    else if (run.status !== 'completed') {
      pending = true;
      since = Math.min(since, Date.parse(run.started_at));
    } else if (RED.has(run.conclusion)) return { state: 'red', last: 0 };
    else if (CANCELLED.has(run.conclusion)) cancelled = true;
    else if (!GREEN.has(run.conclusion)) missing = true;
    else last = Math.max(last, Date.parse(run.completed_at));
  }
  if (pending) return { state: 'pending', last: 0, since };
  return { state: missing ? 'missing' : cancelled ? 'cancelled' : 'green', last };
}

/**
 * Один PR «в полёте»: свежий с идущим CI (чей пуш — не важно, не дольше
 * PENDING_GRACE_MS) или только что позеленевший — его ждут: подтянутый второй
 * сжёг бы круг CI впустую. Кандидаты — отставшие: зелёные по готовности, с
 * идущим прогоном, с отменённым (update-branch перезапускает), без прогона
 * (у конфликта CI не стартует — его сводит движок); красный чинит агент.
 */
export function planQueue(prs, now) {
  const wait = prs.find(
    (p) =>
      p.behind === 0 &&
      ((p.checks.state === 'pending' && now - p.checks.since < PENDING_GRACE_MS) ||
        (p.checks.state === 'green' && now - p.checks.last < GREEN_GRACE_MS)),
  );
  const rank = { green: 0, pending: 1, cancelled: 2, missing: 3 };
  const candidates = prs
    .filter((p) => p.behind > 0 && p.checks.state in rank)
    .sort((a, b) => rank[a.checks.state] - rank[b.checks.state] || a.checks.last - b.checks.last || a.number - b.number);
  // При wait одиночного подтягивания нет (candidates пуст), но отставшие нужны поезду: он садится и в полёте.
  return { wait: wait ?? null, candidates: wait ? [] : candidates, boarders: candidates };
}

/** Прогоны, которые породил пуш очереди (update-branch или сведённый конфликт). */
export const queueRuns = (runs, repo) =>
  runs.filter(
    (r) =>
      r.event === 'pull_request' &&
      r.head_repository?.full_name === repo &&
      r.triggering_actor?.login === BOT,
  );

/** Из них на одобрении: пуш от GITHUB_TOKEN политика «first_time_contributors» держит в action_required. */
export const runsToApprove = (runs, repo) =>
  queueRuns(runs, repo).filter((r) => r.conclusion === 'action_required');
