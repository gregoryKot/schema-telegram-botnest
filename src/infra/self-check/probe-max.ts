// Бот MAX отвечает на /me тем токеном, которым подписан вход в кабинет внутри
// MAX (src/auth/max-init-data.ts). Неверный токен даёт массовые 401 при входе,
// а в аудит-логе они выглядят как `suspicious_initdata` — как атака, а не
// мисконфиг (docs/RUNBOOKS.md, «MAX — канал и вход в мини-апп»). До пробы живой
// сигнал был только у публикации в канал.
//
// Смотрим только HTTP-статус, тело не разбираем: записанного ответа /me нет,
// а сочинять его нельзя (правило №23). Запрос идёт через диспетчер с корнем
// MAX (src/channel/targets/max-ca.ts) — тот же путь, что у публикации.
// В /health не идёт, как вход Google/VK: внешняя площадка со своим корнем
// доверия, сбой связи или сертификата держал бы смок прода красным.
import { fetch as undiciFetch } from 'undici';
import { maxDispatcher } from '../../channel/targets/max-ca';
import { Probe, ProbeResult } from './types';

const ME_URL = 'https://platform-api2.max.ru/me';
const TIMEOUT_MS = 8_000;
/** Как у входа (src/auth/providers/max.provider.ts): явный сильнее канального. */
export const MAX_TOKEN_ENVS = ['MAX_BOT_TOKEN', 'HEALTHY_ADULT_MAX_TOKEN'];

type Env = Record<string, string | undefined>;
export type MaxFetch = (
  url: string,
  init: { headers: Record<string, string>; signal: AbortSignal },
) => Promise<{ status: number }>;

const defaultFetch: MaxFetch = (url, init) => {
  const dispatcher = maxDispatcher();
  return dispatcher
    ? undiciFetch(url, { ...init, dispatcher })
    : fetch(url, init);
};

/** Вердикт по статусу ответа /me. Чистая функция. */
export function judgeMaxMe(status: number, envName: string): ProbeResult {
  if (status >= 200 && status < 300)
    return { ok: true, detail: `бот MAX отвечает (токен из ${envName})` };
  if (status === 401 || status === 403) {
    return {
      ok: false,
      detail:
        `MAX не принял токен из ${envName} (HTTP ${status}): вход в кабинет ` +
        'внутри MAX отвечает 401 всем — сверить токен с ботом мини-приложения',
    };
  }
  return { ok: false, detail: `MAX ответил HTTP ${status} на /me` };
}

function tokenFrom(env: Env): { envName: string; token: string } | null {
  for (const envName of MAX_TOKEN_ENVS) {
    const token = env[envName]?.trim();
    if (token) return { envName, token };
  }
  return null;
}

function failure(e: unknown): ProbeResult {
  const err = e as { name?: string; message?: string } | null;
  const why =
    err?.name === 'TimeoutError'
      ? `таймаут ${TIMEOUT_MS / 1000} с`
      : (err?.message?.slice(0, 200) ?? 'ошибка');
  return { ok: false, detail: `MAX не ответил: ${why}` };
}

export function maxProbe(
  env: Env = process.env,
  fetchFn: MaxFetch = defaultFetch,
): Probe {
  return {
    id: 'max',
    title: 'Бот MAX',
    reportInHealth: false,
    retryOnce: true, // живой запрос к platform-api2.max.ru (Probe.retryOnce)
    async run() {
      const found = tokenFrom(env);
      if (!found) return { ok: true, detail: 'не настроено' };
      try {
        const res = await fetchFn(ME_URL, {
          headers: { authorization: found.token },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        return judgeMaxMe(res.status, found.envName);
      } catch (e) {
        return failure(e);
      }
    },
  };
}
