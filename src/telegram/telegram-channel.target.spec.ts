// Telegram как площадка канала: адрес из env, отправка через бота и разбор
// ошибки. Всё телеграм-специфичное проверяется здесь — рассылка и расписание
// про Telegram уже ничего не знают.
import { TelegramError } from 'telegraf';
import { loadRecordedFixture } from '../test-support/recorded-fixture';
import {
  SEND_DEADLINE_MS,
  TelegramChannelTarget,
} from './telegram-channel.target';

const error429 = (retryAfter: number) => {
  const body = JSON.parse(
    loadRecordedFixture('telegram-429-too-many-requests.json'),
  );
  body.parameters.retry_after = retryAfter;
  return new TelegramError(body);
};

/** Пост канала: текст плюс ленивая картинка (нужна только Pinterest). */
const post = (text: string) => ({
  text,
  image: () => Promise.resolve(Buffer.alloc(0)),
});

/** Отправка идёт через callApi — только он принимает signal для отмены. */
function makeBot() {
  const sendMessage = jest.fn().mockResolvedValue(undefined);
  return { bot: { telegram: { callApi: sendMessage } } as any, sendMessage };
}

describe('TelegramChannelTarget', () => {
  const OLD_ENV = process.env.HEALTHY_ADULT_CHANNEL;
  afterEach(() => {
    if (OLD_ENV === undefined) delete process.env.HEALTHY_ADULT_CHANNEL;
    else process.env.HEALTHY_ADULT_CHANNEL = OLD_ENV;
  });

  it('без env площадка выключена — безопасный дефолт, чтобы не спамить канал', () => {
    delete process.env.HEALTHY_ADULT_CHANNEL;
    expect(new TelegramChannelTarget(makeBot().bot).destination()).toBeNull();
  });

  it('пробелы вокруг канала не создают адрес из пустоты', () => {
    process.env.HEALTHY_ADULT_CHANNEL = '   ';
    expect(new TelegramChannelTarget(makeBot().bot).destination()).toBeNull();
  });

  it('адрес берётся из env и чистится от пробелов', () => {
    process.env.HEALTHY_ADULT_CHANNEL = ' @test_channel ';
    expect(new TelegramChannelTarget(makeBot().bot).destination()).toBe(
      '@test_channel',
    );
  });

  it('шлёт текст в канал с уведомлением (без disable_notification)', async () => {
    const { bot, sendMessage } = makeBot();
    await new TelegramChannelTarget(bot).send(post('фраза'), '@test_channel');
    expect(sendMessage).toHaveBeenCalledWith(
      'sendMessage',
      { chat_id: '@test_channel', text: 'фраза' },
      { signal: expect.anything() },
    );
    expect(sendMessage.mock.calls[0][1]?.disable_notification).toBeFalsy();
  });

  it('без бота падает с внятной причиной, а не с undefined', async () => {
    await expect(
      new TelegramChannelTarget(null).send(post('фраза'), '@test_channel'),
    ).rejects.toThrow('BOT_TOKEN');
  });

  it('ошибка API объясняется кодом и подсказкой про права бота', () => {
    const err = {
      response: { error_code: 400, description: 'chat not found' },
    };
    const explained = new TelegramChannelTarget(makeBot().bot).explain(err);
    expect(explained).toContain('400: chat not found');
    expect(explained).toContain('администратор');
  });

  it('сбой сети объясняется кодом транспорта, а не пустой строкой', () => {
    const err = Object.assign(new Error('connect failed'), {
      code: 'ETIMEDOUT',
    });
    expect(new TelegramChannelTarget(makeBot().bot).explain(err)).toContain(
      'ETIMEDOUT',
    );
  });

  describe('повторы при сетевом сбое', () => {
    // Инцидент 2026-08-09: Telegram — единственная площадка, ходившая мимо
    // общего HTTP-слоя, и повторов у неё не было. Связь до api.telegram.org
    // с хостинга моргает: пост падал с ETIMEDOUT, а соседние площадки в те же
    // секунды принимали его. Форма ошибки — как её отдаёт node-fetch в telegraf.
    const connectError = () =>
      Object.assign(
        new Error(
          'request to api.telegram.org failed, reason: connect ETIMEDOUT 149.154.167.220:443',
        ),
        { code: 'ETIMEDOUT', erroredSysCall: 'connect' },
      );
    const callWith = (callApi: jest.Mock) =>
      ({ telegram: { callApi } }) as never;

    it('соединение не установилось — пробуем ещё раз, и пост уходит', async () => {
      const callApi = jest
        .fn()
        .mockRejectedValueOnce(connectError())
        .mockResolvedValueOnce(undefined);

      await new TelegramChannelTarget(callWith(callApi)).send(
        post('фраза'),
        '@ch',
      );

      expect(callApi).toHaveBeenCalledTimes(2);
      expect(callApi.mock.calls[1][1]).toEqual({
        chat_id: '@ch',
        text: 'фраза',
      });
    });

    it('сеть не поднялась — три попытки и внятная причина', async () => {
      const callApi = jest.fn().mockRejectedValue(connectError());

      await expect(
        new TelegramChannelTarget(callWith(callApi)).send(post('фраза'), '@ch'),
      ).rejects.toThrow('connect ETIMEDOUT');
      expect(callApi).toHaveBeenCalledTimes(3);
    });

    it('ответ API не повторяется — пост мог уже выйти', async () => {
      // 400 значит, что запрос дошёл: повтор рискует вторым сообщением.
      const callApi = jest.fn().mockRejectedValue({
        response: { error_code: 400, description: 'chat not found' },
      });

      await expect(
        new TelegramChannelTarget(callWith(callApi)).send(post('фраза'), '@ch'),
      ).rejects.toMatchObject({ response: { error_code: 400 } });
      expect(callApi).toHaveBeenCalledTimes(1);
    });

    // R7 (аудит 2026-11): обрыв после записи запроса — исход неизвестен.
    it('обрыв после отправки (read ECONNRESET) не повторяется', async () => {
      const callApi = jest.fn().mockRejectedValue(
        Object.assign(new Error('request failed, reason: read ECONNRESET'), {
          code: 'ECONNRESET',
          erroredSysCall: 'read',
        }),
      );

      await expect(
        new TelegramChannelTarget(callWith(callApi)).send(post('фраза'), '@ch'),
      ).rejects.toThrow('ECONNRESET');
      expect(callApi).toHaveBeenCalledTimes(1);
    });
  });
});

// R7 (аудит 2026-11): у telegraf таймаут ответа 500 с — зависший пост
// переживал тик расписания (5 мин), и следующий тик публиковал слот ещё раз.
describe('TelegramChannelTarget — срок отправки', () => {
  afterEach(() => jest.useRealTimers());

  /** Запрос, на который Telegram не отвечает: висит, пока его не отменят. */
  const hangingCall = () =>
    jest.fn(
      (_m: string, _p: unknown, opts: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          opts.signal.addEventListener('abort', () =>
            reject(
              Object.assign(new Error('The user aborted a request.'), {
                name: 'AbortError',
                type: 'aborted',
              }),
            ),
          );
        }),
    );

  it('ответа нет — запрос отменяется по своему таймауту и НЕ повторяется', async () => {
    jest.useFakeTimers();
    const callApi = hangingCall();
    const sent = new TelegramChannelTarget({
      telegram: { callApi },
    } as never)
      .send(post('фраза'), '@ch')
      .catch((e: unknown) => e);

    await jest.advanceTimersByTimeAsync(15_000);

    expect(await sent).toMatchObject({ name: 'AbortError' });
    expect(callApi).toHaveBeenCalledTimes(1);
  });

  it('весь send — с 429 и сетевыми повторами — укладывается в срок меньше тика', async () => {
    jest.useFakeTimers();
    // Худший случай: каждая попытка сначала ждёт 429, потом не соединяется.
    const connectRefused = Object.assign(new Error('connect ECONNREFUSED'), {
      code: 'ECONNREFUSED',
      erroredSysCall: 'connect',
    });
    let calls = 0;
    const callApi = jest.fn(() => {
      calls++;
      return Promise.reject(calls % 2 === 1 ? error429(25) : connectRefused);
    });
    let settled = false;
    void new TelegramChannelTarget({ telegram: { callApi } } as never)
      .send(post('фраза'), '@ch')
      .catch(() => undefined)
      .finally(() => {
        settled = true;
      });

    await jest.advanceTimersByTimeAsync(SEND_DEADLINE_MS);

    expect(settled).toBe(true);
    // Тик расписания канала — 5 минут.
    expect(SEND_DEADLINE_MS).toBeLessThan(5 * 60_000);
  });
});

// Аудит 2026-10 (#812): пост канала шёл мимо PacedSender и на 429 падал сразу.
describe('TelegramChannelTarget — ответ 429', () => {
  afterEach(() => jest.useRealTimers());

  it('ждёт названный срок и публикует со второй попытки', async () => {
    jest.useFakeTimers();
    const { bot, sendMessage } = makeBot();
    sendMessage.mockRejectedValueOnce(error429(5));
    const sent = new TelegramChannelTarget(bot).send(post('фраза'), '@ch');
    await jest.advanceTimersByTimeAsync(5000);
    await expect(sent).resolves.toBeUndefined();
    expect(sendMessage).toHaveBeenCalledTimes(2);
  });

  it('срок дольше бюджета — не ждёт, причина 429 доходит до алерта', async () => {
    const { bot, sendMessage } = makeBot();
    sendMessage.mockRejectedValue(error429(120));
    const target = new TelegramChannelTarget(bot);
    const err = await target.send(post('фраза'), '@ch').catch((e) => e);
    // 429 — ответ API, а не сеть: сетевых повторов тоже нет (риск дубля поста)
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(target.explain(err)).toContain('429: Too Many Requests');
  });
});
