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
  const REPLY_MS = 1000;
  const TIMEOUT_MS = 150;
  let server: Server;
  let hits = 0;
  let bot: Telegraf;

  beforeAll(async () => {
    server = createServer((req, res) => {
      if ((req.url ?? '').endsWith('/sendMessage')) hits++;
      req.resume();
      req.on('end', () => {
        setTimeout(() => {
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ ok: true, result: { message_id: 1 } }));
        }, REPLY_MS);
      });
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
  });

  it('отмена по таймауту: запрос у сервера уже есть, ошибка — неизвестный исход', async () => {
    const err = await sendBounded(bot, 1, 'т', {}, TIMEOUT_MS).catch(
      (e: unknown) => e,
    );
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
    };

    await runProcessQueue(deps);
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
