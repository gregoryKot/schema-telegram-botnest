// Вход через VK глазами площадки (инцидент 2026-10-03). Поломка жила на
// стороне, которую наш код не видит: VK молча вырезал точки из state (вход
// через VK не работал с аудита C1). oauthRedirects сверяет только наш env с
// каноническим хостом — что ответит площадка, она не знает. (Проба входа через
// Google жила здесь же до 2026-11: вход через Google убран.)
//
// Проба строит ссылку входа ТЕМ ЖЕ кодом провайдера, что и прод, и смотрит
// первый ответ площадки, не переходя по редиректу (запрос анонимный, входа
// не происходит). Наружу в /health не идёт: сетевой сбой до внешнего хоста
// красил бы смок прода. Владельцу — DM и /stats, как любая проба.
import type { ConfigService } from '@nestjs/config';
import { VkProvider } from '../../auth/providers/vk.provider';
import { Probe, ProbeResult } from './types';

const TIMEOUT_MS = 8_000;
// Строка той же формы, что настоящий state (JWT с точками): проверяем, что
// наш способ передачи переживает площадку целиком.
export const SAMPLE_STATE =
  'eyJhbGciOiJIUzI1NiJ9.eyJzZWxmQ2hlY2siOnRydWV9.c2VsZi1jaGVjaw';
type Env = Record<string, string | undefined>;
export function configFrom(env: Env): ConfigService {
  return {
    getOrThrow: (key: string) => {
      const value = env[key]?.trim();
      if (!value) throw new Error(`${key} не задан`);
      return value;
    },
  } as unknown as ConfigService;
}

export interface FirstHop {
  status: number;
  location: string | null;
}
export async function firstHop(url: string): Promise<FirstHop> {
  const res = await fetch(url, {
    redirect: 'manual',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return { status: res.status, location: res.headers.get('location') };
}
export const isRedirect = (status: number) => status >= 300 && status < 400;

export function judgeVk(hop: FirstHop, sentState: string): ProbeResult {
  if (!isRedirect(hop.status) || !hop.location) {
    return {
      ok: false,
      detail:
        `VK ID ответил HTTP ${hop.status} вместо перехода ко входу — ` +
        'VK_APP_ID или адрес возврата (VK_REDIRECT_URI) не совпадают с кабинетом VK ID',
    };
  }
  const back = new URL(hop.location).searchParams.get('redirect_state');
  if (back !== sentState) {
    return {
      ok: false,
      detail:
        `VK ID вернул state изменённым (${sentState.length} → ` +
        `${back?.length ?? 0} символов) — колбэк отклонит каждый вход`,
    };
  }
  return {
    ok: true,
    detail: 'VK ID принимает запрос входа и возвращает state без изменений',
  };
}

export const failed = (e: unknown, who: string): ProbeResult => ({
  ok: false,
  detail: `${who} не ответил: ${(e as Error)?.message?.slice(0, 200) ?? 'ошибка'}`,
});

export function vkOAuthProbe(env: Env = process.env): Probe {
  return {
    id: 'vkOAuth',
    title: 'Вход через VK',
    reportInHealth: false,
    retryOnce: true, // живой authorize VK ID (Probe.retryOnce)
    async run() {
      if (!env.VK_APP_ID?.trim() || !env.VK_REDIRECT_URI?.trim())
        return { ok: true, detail: 'выключено' };
      try {
        // PKCE-verifier любой (в проде — из куки шага 1): обмена кода нет.
        const url = new VkProvider(configFrom(env)).buildAuthUrl(
          SAMPLE_STATE,
          SAMPLE_STATE,
        );
        const sent = new URL(url).searchParams.get('state') ?? '';
        return judgeVk(await firstHop(url), sent);
      } catch (e) {
        return failed(e, 'VK ID');
      }
    },
  };
}
