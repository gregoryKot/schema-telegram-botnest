import { Probe } from './types';

const GET_ME_TIMEOUT_MS = 8_000;

interface GetMeResponse {
  ok?: boolean;
  result?: { username?: string; id?: number };
}

/**
 * Бот отвечает на getMe (тот же вызов, что делает провайдер бота при
 * старте — src/telegram/telegram.providers.ts). Не настроен — не авария:
 * возможность может быть осознанно выключена (см. capability-report.ts).
 */
export function telegramProbe(env: NodeJS.ProcessEnv = process.env): Probe {
  return {
    id: 'telegram',
    title: 'Бот Telegram',
    critical: false,
    async run() {
      const token = env.BOT_TOKEN?.trim();
      if (!token) return { ok: true, detail: 'выключено' };
      try {
        const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
          signal: AbortSignal.timeout(GET_ME_TIMEOUT_MS),
        });
        // Битый JSON — тоже сбой пробы, не «выключено»: падает в общий catch
        // ниже вместо .catch(() => null), который прячет ошибку молча
        // (гейт check-silent-catch.mjs).
        const body = res.ok ? ((await res.json()) as GetMeResponse) : null;
        if (res.ok && body?.ok) {
          return {
            ok: true,
            detail: `отвечает (@${body.result?.username ?? 'бот'})`,
          };
        }
        return {
          ok: false,
          detail: `Telegram API ответил ошибкой (HTTP ${res.status})`,
        };
      } catch (e) {
        return {
          ok: false,
          detail: (e as Error)?.message?.slice(0, 200) ?? 'не отвечает',
        };
      }
    },
  };
}
