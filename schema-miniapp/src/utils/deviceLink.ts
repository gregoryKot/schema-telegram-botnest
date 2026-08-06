// Привязка мини-аппа к уже существующему аккаунту (device authorization grant,
// RFC 8628) — клиентская половина. Серверная — src/auth/device-link.service.ts.
//
// Почему через браузер, а не прямо здесь: Google запрещает OAuth во встроенных
// вебвью, а у MAX нет входа для сайтов вовсе. Значит вход происходит в одном
// окне, а сессия нужна в другом; мостом служит код.
import { BASE } from './apiBase';
import { authedFetch } from '../apiClient';
import { adoptSession } from '../session';
import { getHost } from '../../../shared/src/host';

export interface LinkStart {
  deviceCode: string;
  userCode: string;
  expiresIn: number;
  interval: number;
}

export type LinkOutcome = 'linked' | 'expired';

/** Адрес страницы подтверждения — её открывает браузер, а не мини-апп. */
export function linkUrl(userCode: string): string {
  return `${BASE || window.location.origin}/link?code=${encodeURIComponent(userCode)}`;
}

export async function startLink(provider: string): Promise<LinkStart> {
  const res = await authedFetch('/api/auth/device-link/start', {
    method: 'POST',
    body: JSON.stringify({ provider }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return (await res.json()) as LinkStart;
}

/** Открывает системный браузер на странице подтверждения. */
export function openLinkPage(userCode: string): void {
  getHost().openLink(linkUrl(userCode));
}

interface PollDeps {
  /** Пауза между опросами — подменяется в тестах, чтобы не ждать по-настоящему. */
  wait?: (ms: number) => Promise<void>;
  now?: () => number;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Опрашивает сервер, пока человек подтверждает в браузере. Возвращает
 * 'linked' (сессия уже принята) или 'expired' (код протух — начинать заново).
 *
 * Опрос идёт БЕЗ авторизации: к моменту подтверждения аккаунт мессенджера уже
 * слит с целевым, и его токен ничего не доказывает. Доказательством служит сам
 * длинный код — так же устроен token endpoint в RFC.
 */
export async function pollLink(
  start: LinkStart,
  deps: PollDeps = {},
): Promise<LinkOutcome> {
  const wait = deps.wait ?? sleep;
  const now = deps.now ?? Date.now;
  const deadline = now() + start.expiresIn * 1000;

  while (now() < deadline) {
    const res = await fetch(`${BASE}/api/auth/device-link/poll`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'x-requested-with': 'miniapp',
      },
      body: JSON.stringify({ deviceCode: start.deviceCode }),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        status: string;
        accessToken?: string;
        expiresIn?: number;
      };
      if (data.status === 'linked' && data.accessToken && data.expiresIn) {
        adoptSession(data.accessToken, data.expiresIn);
        return 'linked';
      }
      if (data.status === 'expired') return 'expired';
    }
    await wait(start.interval * 1000);
  }
  return 'expired';
}
