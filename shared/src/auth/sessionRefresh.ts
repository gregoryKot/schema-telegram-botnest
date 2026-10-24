// Общая для webapp и schema-miniapp логика вокруг обновления сессии (правило
// №3 CLAUDE.md). Родилось из диагностики жалобы «постоянно нужно логиниться
// заново» (2026-08-21): временная ошибка refresh-эндпоинта (сеть, таймаут,
// 5xx, 429) трактовалась ТАК ЖЕ, как невалидный refresh-токен — и живая
// 30-дневная refresh-кука не спасала: один сбой инфраструктуры (например,
// 502 во время деплоя) выкидывал на экран входа. Здесь — чистая
// классификация и цикл ретраев, без React и без fetch, чтобы у обоих
// фронтендов было ровно одно место, где решается «сессия правда умерла или
// просто не достучались».

/**
 * Исход попытки обновить сессию. `dead` — сервер ЯВНО отказал в
 * аутентификации (401/403 от refresh-эндпоинта): refresh-токен невалиден
 * или отозван, восстановить сессию этим путём нельзя. `transient` — сеть,
 * таймаут, 5xx, 429 и всё прочее: сессия жива, просто не достучались.
 */
export type RefreshFailureKind = 'dead' | 'transient';

/**
 * `status` — HTTP-код ответа refresh-эндпоинта; `null` — сетевая
 * ошибка/таймаут (ответа не было вовсе, fetch выбросил раньше, чем пришёл
 * статус). ТОЛЬКО 401/403 значат «сессия мертва» — любой другой код (429,
 * 5xx) и сетевой обрыв — временная беда, повод ретраить, а не разлогинивать.
 */
export function classifyRefreshFailure(
  status: number | null,
): RefreshFailureKind {
  return status === 401 || status === 403 ? 'dead' : 'transient';
}

/**
 * Бэкофф ретраев refresh: 2 повтора (3 попытки суммарно, ~2с в сумме) — этого
 * достаточно, чтобы пережить один блип 5xx/сети, не задерживая надолго
 * первый экран.
 */
export const REFRESH_RETRY_DELAYS_MS = [500, 1500];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Итог одной попытки внутри цикла ретраев (см. {@link renewWithRetries}).
 *  Дженерик у renewWithRetries сохраняет конкретный тип успеха (токен,
 *  expiresIn и т.п.) — оба фронтенда несут в успехе разные данные. */
export type RenewAttemptResult = { ok: true } | { ok: false; dead: boolean };

/**
 * Гоняет `attempt()` до успеха, до подтверждённо мёртвой сессии (`dead:
 * true` — ретраить бессмысленно, сервер уже ответил окончательным отказом)
 * или до исчерпания бэкоффа. Общий цикл для `webapp/auth/AuthProvider` и
 * `schema-miniapp/session` — кодовые базы отличаются только тем, ЧТО
 * происходит внутри `attempt()` (какие эндпоинты бьёт), не циклом ретраев.
 */
export async function renewWithRetries<T extends RenewAttemptResult>(
  attempt: () => Promise<T>,
  delays: number[] = REFRESH_RETRY_DELAYS_MS,
): Promise<T> {
  for (let i = 0; ; i++) {
    const result = await attempt();
    if (result.ok) return result;
    if (result.dead || i >= delays.length) return result;
    await sleep(delays[i]);
  }
}

/**
 * Бэкофф для фонового ретрай-таймера (пункт 3 диагностики): проактивная
 * цепочка обновления сессии не должна обрываться навсегда после одной
 * временной осечки — следующая попытка планируется тоже, просто медленнее,
 * чтобы не долбить сервер, пока сеть реально недоступна. Растёт и упирается
 * в потолок в 5 минут.
 */
export const RETRY_TIMER_DELAYS_MS = [30_000, 60_000, 120_000, 300_000];

/** `attempt` — номер по счёту неудачной попытки (0 — первая). */
export function nextRetryTimerDelayMs(attempt: number): number {
  const i = Math.min(Math.max(attempt, 0), RETRY_TIMER_DELAYS_MS.length - 1);
  return RETRY_TIMER_DELAYS_MS[i];
}
