// Разбор ответа Telegram 429 (аудит 2026-10: retry_after не читался нигде).
// Ошибка строится настоящим TelegramError из telegraf по записанному ответу
// (правило №23), а шовный блок ниже отдаёт тот же ответ локальным сервером
// настоящему Telegraf: проверяется путь «telegraf разобрал тело → мы прочли
// срок», а не наша догадка о том, куда telegraf его кладёт (правило №14).
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { Logger } from '@nestjs/common';
import { Telegraf, TelegramError } from 'telegraf';
import { loadRecordedFixture } from '../test-support/recorded-fixture';
import { isRateLimited, retryAfterMs } from './telegram-rate-limit';
import { sendBounded } from './telegram.send-bounded';
import { runProcessQueue } from './telegram.schedule-queue';
import { classifySendFailure } from './telegram-error';

const FIXTURE = 'telegram-429-too-many-requests.json';
const body429 = () => loadRecordedFixture(FIXTURE);
const error429 = () => new TelegramError(JSON.parse(body429()));

describe('retryAfterMs / isRateLimited на записанном ответе 429', () => {
  it('срок берётся из parameters.retry_after, в миллисекундах', () => {
    const err = error429();
    expect(isRateLimited(err)).toBe(true);
    expect(retryAfterMs(err)).toBe(5000);
  });

  it('контроль: 400 «chat not found» — не 429 и не срок', () => {
    const err = new TelegramError({
      error_code: 400,
      description: 'Bad Request: chat not found',
    });
    expect(isRateLimited(err)).toBe(false);
    expect(retryAfterMs(err)).toBeNull();
  });

  it('429 без parameters: лимит есть, срока нет — ждать наугад нельзя', () => {
    const err = new TelegramError({
      error_code: 429,
      description: 'Too Many Requests',
    });
    expect(isRateLimited(err)).toBe(true);
    expect(retryAfterMs(err)).toBeNull();
  });

  it('мусор в retry_after (строка, ноль, минус) — срока нет', () => {
    for (const retry_after of ['5', 0, -3, Number.NaN]) {
      const err = {
        response: { error_code: 429, parameters: { retry_after } },
      };
      expect(retryAfterMs(err)).toBeNull();
    }
  });

  it('транспортная ошибка и не-объект — не 429', () => {
    const reset = Object.assign(new Error('socket hang up'), {
      code: 'ECONNRESET',
    });
    for (const err of [reset, null, undefined, 'строка', 429]) {
      expect(isRateLimited(err)).toBe(false);
      expect(retryAfterMs(err)).toBeNull();
    }
  });

  it('classifySendFailure не трогаем: 429 — transient, человека не метим', () => {
    expect(classifySendFailure(error429())).toBe('transient');
  });
});

describe('шов: настоящий Telegraf получает 429 от сервера', () => {
  let server: Server;
  let bot: Telegraf;
  // Сколько ближайших sendMessage ответить 429; дальше — ok.
  let limitedLeft = 0;
  let hits = 0;

  beforeAll(async () => {
    server = createServer((req, res) => {
      if ((req.url ?? '').endsWith('/sendMessage')) hits++;
      req.resume();
      req.on('end', () => {
        res.setHeader('content-type', 'application/json');
        if (limitedLeft > 0) {
          limitedLeft--;
          res.statusCode = 429;
          return res.end(body429());
        }
        res.end(JSON.stringify({ ok: true, result: { message_id: 1 } }));
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
    limitedLeft = 0;
  });

  it('sendBounded отдаёт ошибку, из которой читается срок', async () => {
    limitedLeft = 1;
    const err = await sendBounded(bot, 1, 'т', {}).catch((e: unknown) => e);
    expect(retryAfterMs(err)).toBe(5000);
  });

  it('очередь: ждёт ровно retry_after, повторяет, помечает отправленным', async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    limitedLeft = 1;
    const row = {
      id: 1,
      userId: 42n,
      type: 'summary',
      payload: { text: 'напоминание' },
      sendAt: new Date(),
    };
    const markSent = jest.fn().mockResolvedValue(undefined);
    const waits: number[] = [];
    const track = jest.fn().mockResolvedValue(undefined);
    await runProcessQueue({
      bot,
      logger: new Logger('test'),
      notificationService: {
        getDue: jest.fn().mockResolvedValue([row]),
        markSent,
      } as never,
      accountService: {
        getSendSettingsFor: jest
          .fn()
          .mockResolvedValue(
            new Map([
              ['42', { tz: 'UTC', start: 0, end: 0, form: 'ty', chatId: 42n }],
            ]),
          ),
      } as never,
      pace: { sleep: (ms) => (waits.push(ms), Promise.resolve()) },
      track,
    });
    expect(hits).toBe(2);
    expect(waits).toEqual([5000]);
    expect(markSent).toHaveBeenCalledWith(1);
    expect(track).toHaveBeenCalledWith({
      sent: 1,
      transient: 0,
      waited: 1,
      deferred: 0,
    });
    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    jest.restoreAllMocks();
  });
});
