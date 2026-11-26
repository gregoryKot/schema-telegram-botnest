// Сколько апдейтов ждёт бота в Telegram (getWebhookInfo().pending_update_count)
// — в detail пробы telegramPolling (аудит 2026-10, «Бот и рестарт: остаток»).
// Поллинг лежит — число растёт: видно, сколько людей ждут ответа; после
// деплоя — сколько накопилось за окно рестарта. Проба от числа не краснеет:
// красноту решает состояние поллинга (probe-telegram-polling.ts), число —
// контекст к нему, и сбой этого запроса пробу тоже не красит.
//
// Запрос идёт через клиент Telegraf — тот же шов, что у самого бота: ответ
// площадки разбирает он, своего парсера здесь нет (правило №23).
import { Telegram } from 'telegraf';
import type { Probe, ProbeResult } from './types';

const WEBHOOK_INFO_TIMEOUT_MS = 8_000;
// Типы telegraf ждут AbortSignal из пакета abort-controller; во время
// выполнения node-fetch принимает и штатный (как telegram.send-bounded.ts).
type CallSignal = NonNullable<Parameters<Telegram['callApi']>[2]>['signal'];

export type PendingUpdates = { count: number } | { error: string };

/** Живой getWebhookInfo; сбой — текстом причины, без исключения. */
export async function fetchPendingUpdates(
  token: string,
): Promise<PendingUpdates> {
  const timeout = AbortSignal.timeout(WEBHOOK_INFO_TIMEOUT_MS);
  const signal = timeout as unknown as CallSignal;
  try {
    const telegram = new Telegram(token);
    const info = await telegram.callApi('getWebhookInfo', {}, { signal });
    return { count: info.pending_update_count };
  } catch (e) {
    return { error: (e as Error)?.message?.slice(0, 120) || 'не отвечает' };
  }
}

/** detail пробы + «в очереди Telegram: N» или почему число не узнать. */
export function pendingDetail(detail: string, pending: PendingUpdates): string {
  const tail =
    'count' in pending
      ? `в очереди Telegram: ${pending.count}`
      : `очередь Telegram не узнать: ${pending.error}`;
  return `${detail}; ${tail}`;
}

/** Проба поллинга с числом ждущих апдейтов. Бот выключен — в сеть не ходим. */
export function withPendingUpdates(
  probe: Probe,
  env: NodeJS.ProcessEnv = process.env,
  fetchPending: (
    token: string,
  ) => Promise<PendingUpdates> = fetchPendingUpdates,
): Probe {
  return {
    ...probe,
    async run(): Promise<ProbeResult> {
      const res = await probe.run();
      const token = env.BOT_TOKEN?.trim();
      if (!token) return res;
      const pending = await fetchPending(token);
      return { ...res, detail: pendingDetail(res.detail, pending) };
    },
  };
}
