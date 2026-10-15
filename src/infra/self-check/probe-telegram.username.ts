// Сверка BOT_USERNAME с тем, чей токен (аудит 2026-10, infra#18): ссылки-приглашения
// строятся из имени, а не из токена, и расхождение вело бы людей в другого бота.
import type { ProbeResult } from './types';

const normalize = (v: string | undefined): string =>
  (v ?? '').trim().replace(/^@/, '').toLowerCase();

/**
 * Ответ пробы на успешный getMe. Режим переезда (BOT_REDIRECT_USERNAME) имя
 * нарочно не сверяет: там BOT_USERNAME может быть чужим.
 */
export function botAnswer(
  env: NodeJS.ProcessEnv,
  actual: string | undefined,
): ProbeResult {
  const ok = { ok: true, detail: `отвечает (@${actual ?? 'бот'})` };
  if (env.BOT_REDIRECT_USERNAME?.trim() || !actual) return ok;
  const configured = normalize(env.BOT_USERNAME);
  if (!configured) {
    return { ok: false, detail: `BOT_USERNAME не задан (бот @${actual})` };
  }
  if (configured === normalize(actual)) return ok;
  return {
    ok: false,
    detail:
      `BOT_USERNAME=${env.BOT_USERNAME?.trim()}, а токен от @${actual} — ` +
      'ссылки-приглашения ведут не в того бота',
  };
}
