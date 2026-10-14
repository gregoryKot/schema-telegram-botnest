import { Probe, ProbeResult } from './types';
import { telegramProbe } from './probe-telegram';
import { pollingStatus } from './polling-status';

/** Сколько поллингу дают подняться после старта (или вернуться после 409). */
export const POLLING_GRACE_MS = 120_000;

/**
 * Бот реально принимает апдейты, а не только отвечает на getMe
 * (`telegramProbe`). Инцидент-класс backend#12: 409 на getUpdates убивал
 * поллинг молча — Nest жив, /health зелёный, уведомления уходят, а на /start и
 * кнопки бот не отвечает до следующего деплоя.
 *
 * Не поднялся за 2 минуты — авария. Нет BOT_TOKEN — бот выключен осознанно,
 * не авария (как в `telegramProbe`).
 */
export function telegramPollingProbe(
  env: NodeJS.ProcessEnv = process.env,
  now: () => number = Date.now,
): Probe {
  return {
    id: 'telegramPolling',
    title: 'Бот принимает сообщения',
    critical: false,
    run: () => Promise.resolve(evaluate()),
  };

  function evaluate(): ProbeResult {
    if (!env.BOT_TOKEN?.trim()) return { ok: true, detail: 'выключено' };
    const { state, since, lastError } = pollingStatus.get();
    if (state === 'running') {
      return { ok: true, detail: 'принимает сообщения' };
    }
    if (state === 'stopped') {
      return { ok: true, detail: 'остановлен при выключении' };
    }
    const waitedMs = now() - since;
    if (waitedMs < POLLING_GRACE_MS) {
      return { ok: true, detail: 'запускается' };
    }
    const minutes = Math.floor(waitedMs / 60_000);
    const why =
      state === 'idle'
        ? 'бот так и не запускался'
        : `последняя ошибка: ${lastError ?? 'неизвестна'}`;
    return {
      ok: false,
      detail: `бот не принимает сообщения уже ${minutes} мин, ${why}`.slice(
        0,
        300,
      ),
    };
  }
}

/** Обе пробы бота: отвечает API (getMe) и принимает сообщения (getUpdates). */
export function telegramProbes(): Probe[] {
  return [telegramProbe(), telegramPollingProbe()];
}
