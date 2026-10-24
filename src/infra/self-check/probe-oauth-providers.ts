// Вход через Google и VK глазами площадки (инцидент 2026-10-03). Обе поломки
// жили на стороне, которую наш код не видит: в Google Console адрес возврата
// стоял с точкой на конце (~17 дней без входа), а VK молча вырезал точки из
// state (вход через VK не работал с аудита C1). oauthRedirects сверяет
// только наш env с каноническим хостом — что ответит площадка, она не знает.
//
// Проба строит ссылку входа ТЕМ ЖЕ кодом провайдера, что и прод, и смотрит
// первый ответ площадки, не переходя по редиректу (запрос анонимный, входа
// не происходит). Наружу в /health не идёт: доступность внешних хостов с
// Amvera бывает нестабильной (см. google.provider.ts) — сетевой сбой красил
// бы смок прода. Владельцу — DM и /stats, как любая проба.
import type { ConfigService } from '@nestjs/config';
import { buildGoogleAuthUrl } from '../../auth/providers/google-auth-url';
import { VkProvider } from '../../auth/providers/vk.provider';
import { Probe, ProbeResult } from './types';

const TIMEOUT_MS = 8_000;
// Строка той же формы, что настоящий state (JWT с точками): проверяем, что
// наш способ передачи переживает площадку целиком.
const SAMPLE_STATE =
  'eyJhbGciOiJIUzI1NiJ9.eyJzZWxmQ2hlY2siOnRydWV9.c2VsZi1jaGVjaw';

type Env = Record<string, string | undefined>;

function configFrom(env: Env): ConfigService {
  return {
    getOrThrow: (key: string) => {
      const value = env[key]?.trim();
      if (!value) throw new Error(`${key} не задан`);
      return value;
    },
  } as unknown as ConfigService;
}

interface FirstHop {
  status: number;
  location: string | null;
}

async function firstHop(url: string): Promise<FirstHop> {
  const res = await fetch(url, {
    redirect: 'manual',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return { status: res.status, location: res.headers.get('location') };
}

const isRedirect = (status: number) => status >= 300 && status < 400;

/** Имя ошибки из authError Google: protobuf, поле 1 — строка. */
export function googleAuthErrorName(location: string): string | null {
  const raw = new URL(location).searchParams.get('authError');
  if (!raw) return null;
  const buf = Buffer.from(raw, 'base64');
  if (buf[0] !== 0x0a) return null;
  return buf.subarray(2, 2 + buf[1]).toString('utf8');
}

export function judgeGoogle(hop: FirstHop, redirectUri: string): ProbeResult {
  if (!isRedirect(hop.status) || !hop.location) {
    return {
      ok: false,
      detail: `Google ответил HTTP ${hop.status} вместо перехода к выбору аккаунта`,
    };
  }
  if (!hop.location.includes('/signin/oauth/error')) {
    return { ok: true, detail: 'Google принимает запрос входа' };
  }
  const error = googleAuthErrorName(hop.location) ?? 'причина не распознана';
  if (error === 'redirect_uri_mismatch') {
    return {
      ok: false,
      detail:
        `Google не принимает адрес возврата ${redirectUri}: он посимвольно ` +
        'не совпадает с Authorised redirect URIs клиента в Google Cloud Console',
    };
  }
  return { ok: false, detail: `Google отклоняет вход: ${error}` };
}

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

const failed = (e: unknown, who: string): ProbeResult => ({
  ok: false,
  detail: `${who} не ответил: ${(e as Error)?.message?.slice(0, 200) ?? 'ошибка'}`,
});

export function googleOAuthProbe(env: Env = process.env): Probe {
  return {
    id: 'googleOAuth',
    title: 'Вход через Google',
    critical: false,
    reportInHealth: false,
    async run() {
      const clientId = env.GOOGLE_CLIENT_ID?.trim();
      const redirectUri = env.GOOGLE_REDIRECT_URI?.trim();
      if (!clientId || !redirectUri) return { ok: true, detail: 'выключено' };
      try {
        const url = buildGoogleAuthUrl(clientId, redirectUri, 'self-check');
        return judgeGoogle(await firstHop(url), redirectUri);
      } catch (e) {
        return failed(e, 'Google');
      }
    },
  };
}

export function vkOAuthProbe(env: Env = process.env): Probe {
  return {
    id: 'vkOAuth',
    title: 'Вход через VK',
    critical: false,
    reportInHealth: false,
    async run() {
      if (!env.VK_APP_ID?.trim() || !env.VK_REDIRECT_URI?.trim())
        return { ok: true, detail: 'выключено' };
      try {
        const url = new VkProvider(configFrom(env)).buildAuthUrl(SAMPLE_STATE);
        const sent = new URL(url).searchParams.get('state') ?? '';
        return judgeVk(await firstHop(url), sent);
      } catch (e) {
        return failed(e, 'VK ID');
      }
    },
  };
}
