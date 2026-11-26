// Отправка с отменой и разбор исхода «неизвестно» (аудит 2026-10, r2-3#3).
// Шов: форма ошибки при отмене — свойство node-fetch 2.7 внутри telegraf 4.16,
// а не нашего кода, поэтому второй блок гоняет НАСТОЯЩИЙ Telegraf против
// локального http-сервера, который отвечает медленнее нашего таймаута
// (правило №14), и сквозь него — настоящую очередь.
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { Logger } from '@nestjs/common';
import { Telegraf } from 'telegraf';
import { runProcessQueue } from './telegram.schedule-queue';
import { RejectCounter } from './telegram.schedule-queue.rejects';
import { isUnknownOutcome, sendBounded } from './telegram.send-bounded';

describe('isUnknownOutcome', () => {
  it.each([
    ['AbortError', Object.assign(new Error('x'), { name: 'AbortError' })],
    ['type aborted', { type: 'aborted' }],
    ['type request-timeout', { type: 'request-timeout' }],
    ['ECONNRESET', { code: 'ECONNRESET' }],
    ['EPIPE', { code: 'EPIPE' }],
  ])('%s — запрос мог дойти: неизвестный исход', (_n, err) => {
    expect(isUnknownOutcome(err)).toBe(true);
  });

  it.each([
    ['400', { response: { error_code: 400, description: 'bad' } }],
    ['403', { response: { error_code: 403 } }],
    ['429', { response: { error_code: 429 } }],
    ['502', { response: { error_code: 502 } }],
    ['ENOTFOUND', { code: 'ENOTFOUND' }],
    ['EAI_AGAIN', { code: 'EAI_AGAIN' }],
    ['ECONNREFUSED', { code: 'ECONNREFUSED' }],
    ['ETIMEDOUT', { code: 'ETIMEDOUT' }],
    ['ENETUNREACH', { code: 'ENETUNREACH' }],
    ['обычная Error', new Error('network blip')],
    ['строка', 'boom'],
    ['null', null],
  ])('%s — до Telegram не дошло либо он ответил: повторяем', (_n, err) => {
    expect(isUnknownOutcome(err)).toBe(false);
  });
});

describe('sendBounded: таймер', () => {
  afterEach(() => jest.useRealTimers());

  it('после успешной отправки таймер очищен', async () => {
    jest.useFakeTimers();
    const callApi = jest.fn().mockResolvedValue({ message_id: 1 });
    const bot: any = { telegram: { callApi } };
    await sendBounded(bot, 7, 'текст', { disable_notification: true });
    expect(jest.getTimerCount()).toBe(0);
    expect(callApi).toHaveBeenCalledWith(
      'sendMessage',
      { chat_id: 7, text: 'текст', disable_notification: true },
      { signal: expect.any(AbortSignal) },
    );
  });

  it('после сбоя таймер очищен, ошибка наружу', async () => {
    jest.useFakeTimers();
    const bot: any = {
      telegram: { callApi: jest.fn().mockRejectedValue(new Error('boom')) },
    };
    await expect(sendBounded(bot, 7, 'т', {})).rejects.toThrow('boom');
    expect(jest.getTimerCount()).toBe(0);
  });
});

describe('шов: настоящий Telegraf против медленного Bot API', () => {
  // Сервер не отвечает вовсе, а время отмены двигает тест — и только после
  // того, как запрос дошёл до сервера: под нагрузкой воркеров jest реальные
  // 150 мс истекали раньше, чем запрос доезжал (hits=0).
  const TIMEOUT_MS = 150;
  // Дедлайн тестов и хуков файла — страховка: ждём событий, а не времени.
  jest.setTimeout(30_000);
  let server: Server;
  let hits = 0;
  let arrived: () => void = () => undefined;
  let bot: Telegraf;

  /** Промис, который резолвится, когда сервер получил sendMessage. */
  const nextArrival = () => new Promise<void>((r) => (arrived = r));

  beforeAll(async () => {
    server = createServer((req, res) => {
      req.resume();
      if (!(req.url ?? '').endsWith('/sendMessage')) {
        res.statusCode = 404;
        res.end();
        return;
      }
      hits++;
      arrived();
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const { port } = server.address() as AddressInfo;
    bot = new Telegraf('123:abc', {
      telegram: { apiRoot: `http://127.0.0.1:${port}` },
    });
  });

  afterAll(async () => {
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
  });

  beforeEach(() => {
    hits = 0;
    // Подделан только таймер отмены (setTimeout): сеть, setImmediate и
    // nextTick идут по-настоящему, иначе http-обмен встанет.
    jest.useFakeTimers({
      doNotFake: [
        'Date',
        'hrtime',
        'nextTick',
        'performance',
        'queueMicrotask',
        'setImmediate',
        'clearImmediate',
        'setInterval',
        'clearInterval',
      ],
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  /** Дождаться запроса у сервера и только тогда сработать отмене. */
  async function abortAfterArrival(arrival: Promise<void>): Promise<void> {
    await arrival;
    jest.advanceTimersByTime(TIMEOUT_MS);
  }

  it('отмена по таймауту: запрос у сервера уже есть, ошибка — неизвестный исход', async () => {
    const arrival = nextArrival();
    const pending = sendBounded(bot, 1, 'т', {}, TIMEOUT_MS).catch(
      (e: unknown) => e,
    );
    await abortAfterArrival(arrival);
    const err = await pending;
    expect(isUnknownOutcome(err)).toBe(true);
    expect(hits).toBe(1);
  });

  it('очередь: строка помечена, второй прогон не стучится на сервер', async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const row = {
      id: 500,
      userId: 42n,
      type: 'summary',
      payload: { text: 'напоминание' },
      sendAt: new Date(),
    };
    const sent = new Set<number>();
    const notificationService: any = {
      getDue: jest.fn(() => Promise.resolve(sent.has(row.id) ? [] : [row])),
      claim: jest.fn().mockResolvedValue(true),
      releaseClaim: jest.fn().mockResolvedValue(undefined),
      markSent: jest.fn((id: number) => {
        sent.add(id);
        return Promise.resolve();
      }),
    };
    const accountService: any = {
      getSendSettingsFor: jest
        .fn()
        .mockResolvedValue(
          new Map([
            ['42', { tz: 'UTC', start: 0, end: 0, form: 'ty', chatId: 42n }],
          ]),
        ),
      markUserBlocked: jest.fn(),
    };
    const deps = {
      bot,
      accountService,
      notificationService,
      logger: new Logger('seam'),
      sendTimeoutMs: TIMEOUT_MS,
      rejects: new RejectCounter(),
    };

    const arrival = nextArrival();
    const first = runProcessQueue(deps);
    await abortAfterArrival(arrival);
    await first;
    await runProcessQueue(deps);

    expect(notificationService.markSent).toHaveBeenCalledWith(500);
    expect(accountService.markUserBlocked).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    expect(String(warn.mock.calls[0][0])).toContain(
      'исход отправки неизвестен',
    );
    expect(hits).toBe(1);
  });
});
