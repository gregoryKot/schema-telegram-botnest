// Сетевая половина перевыпуска сессии — вынесена из session.ts (правило №10
// CLAUDE.md, файл-храповик: session.ts не имеет права расти сверх бейслайна).
// Чистая сеть, без модульного состояния (accessToken и т.п. остаются в
// session.ts) — attemptRenewOnce() возвращает токен наружу вместо того,
// чтобы дёргать чужой remember(), это и разводит файлы без циклического
// импорта.
import { classifyRefreshFailure } from '../../shared/src/auth/sessionRefresh';
import { BASE } from './utils/apiBase';

type PostAuthResult =
  | { ok: true; token: string; expiresIn: number }
  | { ok: false; status: number | null };

/** Одна попытка обмена — POST на refresh или на sessionExchange хоста.
 *  `status: null` — сетевая ошибка/таймаут (ответа не было вовсе).
 *  classifyRefreshFailure() — единственное место, решающее по этому статусу
 *  «сессия мертва или временная беда» (2026-08-21). */
async function postAuthAttempt(
  path: string,
  body?: unknown,
): Promise<PostAuthResult> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      credentials: 'include', // httpOnly refresh-кука
      headers: {
        'Content-Type': 'application/json',
        'x-requested-with': 'miniapp', // CSRF-заголовок, как у сайта
      },
      body: JSON.stringify(body ?? {}),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { ok: false, status: res.status };
    const data = (await res.json()) as {
      accessToken: string;
      expiresIn: number;
    };
    if (!data?.accessToken) return { ok: false, status: res.status };
    return { ok: true, token: data.accessToken, expiresIn: data.expiresIn };
  } catch {
    return { ok: false, status: null };
  }
}

export type RenewAttempt =
  { ok: true; token: string; expiresIn: number } | { ok: false; dead: boolean };

/** Один цикл «сначала refresh-кука (работает и когда initData протухла),
 *  затем обмен initData/exchange хоста (лечит самый первый вход)». Вызывается
 *  повторно из renewWithRetries при временной беде — сама последовательность
 *  refresh→exchange при этом не меняется. */
export async function attemptRenewOnce(
  exchange: { path: string; body: unknown } | null,
): Promise<RenewAttempt> {
  const refresh = await postAuthAttempt('/api/auth/refresh');
  if (refresh.ok) return refresh;
  const refreshDead = classifyRefreshFailure(refresh.status) === 'dead';

  if (!exchange) return { ok: false, dead: refreshDead };

  const viaExchange = await postAuthAttempt(exchange.path, exchange.body);
  if (viaExchange.ok) return viaExchange;
  const exchangeDead = classifyRefreshFailure(viaExchange.status) === 'dead';
  // Мёртвой сессию считаем, только если ОБА пути дали подтверждённый отказ
  // аутентификации. Если хоть один — временная беда, ретраим цикл целиком, а
  // не показываем «сессия истекла» по живой куке.
  return { ok: false, dead: refreshDead && exchangeDead };
}
