// Правила очереди мержа — чистые функции без сети; движок и порядок шагов —
// scripts/merge-queue.mjs, тест — src/test-support/gates/merge-queue.spec.ts.

export const BOT = 'github-actions[bot]';
export const DEPENDABOT = 'dependabot[bot]';
const GREEN = new Set(['success', 'skipped', 'neutral']);
const RED = new Set(['failure', 'timed_out', 'startup_failure']);
// Свежий зелёный PR GitHub мержит за секунды; дольше — его что-то держит,
// и очередь идёт дальше, а не ждёт вечно.
export const GREEN_GRACE_MS = 10 * 60_000;

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
 * упала; pending — идёт; missing — нет прогона или он отменён; green — все
 * зелёные. `last` — когда завершилась последняя (для green).
 */
export function checksState(required, runs) {
  let pending = false;
  let missing = false;
  let last = 0;
  for (const { context, app } of required) {
    const run = runs
      .filter((r) => r.name === context && (app === null || r.app?.id === app))
      .sort((a, b) => b.id - a.id)[0];
    if (!run) missing = true;
    else if (run.status !== 'completed') pending = true;
    else if (RED.has(run.conclusion)) return { state: 'red', last: 0 };
    else if (!GREEN.has(run.conclusion)) missing = true;
    else last = Math.max(last, Date.parse(run.completed_at));
  }
  if (pending) return { state: 'pending', last: 0 };
  return { state: missing ? 'missing' : 'green', last };
}

/**
 * Один PR за раз: свежий PR с идущими (или только что позеленевшими)
 * проверками — «в работе», его ждут. Иначе кандидаты — отставшие с зелёным
 * или идущим прогоном, по порядку; красный и без прогона чинит агент.
 */
export function planQueue(prs, now) {
  const wait = prs.find(
    (p) =>
      p.behind === 0 &&
      (p.checks.state === 'pending' ||
        (p.checks.state === 'green' && now - p.checks.last < GREEN_GRACE_MS)),
  );
  if (wait) return { wait, candidates: [] };
  const candidates = prs.filter(
    (p) =>
      p.behind > 0 &&
      (p.checks.state === 'green' || p.checks.state === 'pending'),
  );
  return { wait: null, candidates };
}

/**
 * Прогоны, которые породил update-branch очереди: пуш от GITHUB_TOKEN политика
 * «first_time_contributors» ставит на одобрение. Форк и чужой автор — не трогаем.
 */
export function runsToApprove(runs, repo) {
  return runs.filter(
    (r) =>
      r.event === 'pull_request' &&
      r.conclusion === 'action_required' &&
      r.head_repository?.full_name === repo &&
      r.triggering_actor?.login === BOT,
  );
}
