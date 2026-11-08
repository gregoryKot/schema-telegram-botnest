// Число апдейтов, ждущих бота в Telegram, — в detail пробы telegramPolling
// (аудит 2026-10, «Бот и рестарт: остаток»): сколько людей ждут ответа, пока
// поллинг лежит, и сколько накопилось за окно деплоя. Сеть здесь — фейк:
// ответ площадки разбирает клиент Telegraf, своего парсера нет.
import type { Probe } from './types';
import {
  pendingDetail,
  withPendingUpdates,
  type PendingUpdates,
} from './probe-telegram-pending';

const probe = (ok: boolean, detail: string): Probe => ({
  id: 'telegramPolling',
  title: 'Бот принимает сообщения',
  run: () => Promise.resolve({ ok, detail }),
});
const env = { BOT_TOKEN: '1:TEST' };

describe('pendingDetail — форматтер detail', () => {
  it('число из getWebhookInfo — после состояния поллинга', () => {
    expect(pendingDetail('принимает сообщения', { count: 0 })).toBe(
      'принимает сообщения; в очереди Telegram: 0',
    );
  });

  it('сбой запроса — честное «не узнать» с причиной, а не ноль', () => {
    expect(pendingDetail('запускается', { error: 'timeout' })).toBe(
      'запускается; очередь Telegram не узнать: timeout',
    );
  });
});

describe('withPendingUpdates', () => {
  it('поллинг лежит — красная остаётся красной, в detail сколько ждут ответа', async () => {
    const fetchPending = jest.fn(async (): Promise<PendingUpdates> => ({
      count: 37,
    }));
    const res = await withPendingUpdates(
      probe(false, 'бот не принимает сообщения уже 5 мин'),
      env,
      fetchPending,
    ).run();
    expect(res).toEqual({
      ok: false,
      detail: 'бот не принимает сообщения уже 5 мин; в очереди Telegram: 37',
    });
    expect(fetchPending).toHaveBeenCalledWith('1:TEST');
  });

  it('сбой getWebhookInfo не красит зелёную пробу', async () => {
    const res = await withPendingUpdates(
      probe(true, 'принимает сообщения'),
      env,
      async () => ({ error: 'ETIMEDOUT' }),
    ).run();
    expect(res.ok).toBe(true);
    expect(res.detail).toContain('очередь Telegram не узнать: ETIMEDOUT');
  });

  it('бот выключен (нет BOT_TOKEN) — в сеть не ходим, detail как был', async () => {
    const fetchPending = jest.fn();
    const res = await withPendingUpdates(
      probe(true, 'выключено'),
      {},
      fetchPending,
    ).run();
    expect(res).toEqual({ ok: true, detail: 'выключено' });
    expect(fetchPending).not.toHaveBeenCalled();
  });

  it('id и заголовок пробы не меняются — /health и /stats видят ту же пробу', () => {
    const wrapped = withPendingUpdates(probe(true, 'x'), env, jest.fn());
    expect(wrapped.id).toBe('telegramPolling');
    expect(wrapped.title).toBe('Бот принимает сообщения');
  });
});
