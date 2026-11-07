// Telegram как площадка канала: адрес из env, отправка через бота и разбор
// ошибки. Всё телеграм-специфичное проверяется здесь — рассылка и расписание
// про Telegram уже ничего не знают.
import { TelegramError } from 'telegraf';
import { loadRecordedFixture } from '../test-support/recorded-fixture';
import { TelegramChannelTarget } from './telegram-channel.target';

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

function makeBot() {
  const sendMessage = jest.fn().mockResolvedValue(undefined);
  return { bot: { telegram: { sendMessage } } as any, sendMessage };
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
    expect(sendMessage).toHaveBeenCalledWith('@test_channel', 'фраза');
    expect(sendMessage.mock.calls[0][2]?.disable_notification).toBeFalsy();
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
    // секунды принимали его.
    const netError = () =>
      Object.assign(new Error('request to api.telegram.org failed'), {
        code: 'ETIMEDOUT',
      });

    const post = {
      text: 'фраза',
      image: () => Promise.resolve(Buffer.from('')),
    };

    it('таймаут — пробуем ещё раз, и пост уходит', async () => {
      const sendMessage = jest
        .fn()
        .mockRejectedValueOnce(netError())
        .mockResolvedValueOnce(undefined);
      const bot = { telegram: { sendMessage } } as never;

      await new TelegramChannelTarget(bot).send(post, '@ch');

      expect(sendMessage).toHaveBeenCalledTimes(2);
      expect(sendMessage).toHaveBeenLastCalledWith('@ch', 'фраза');
    });

    it('сеть не поднялась — три попытки и внятная причина', async () => {
      const sendMessage = jest.fn().mockRejectedValue(netError());
      const bot = { telegram: { sendMessage } } as never;

      await expect(
        new TelegramChannelTarget(bot).send(post, '@ch'),
      ).rejects.toThrow('failed');
      expect(sendMessage).toHaveBeenCalledTimes(3);
    });

    it('ответ API не повторяется — пост мог уже выйти', async () => {
      // 400 значит, что запрос дошёл: повтор рискует вторым сообщением.
      const sendMessage = jest.fn().mockRejectedValue({
        response: { error_code: 400, description: 'chat not found' },
      });
      const bot = { telegram: { sendMessage } } as never;

      await expect(
        new TelegramChannelTarget(bot).send(post, '@ch'),
      ).rejects.toMatchObject({ response: { error_code: 400 } });
      expect(sendMessage).toHaveBeenCalledTimes(1);
    });
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
