import { Logger } from '@nestjs/common';
import { TelegramChannelService } from './telegram.channel.service';
import { HEALTHY_ADULT_PHRASES } from '../bot/healthy-adult.data';
import type { HealthyAdultService } from '../bot/healthy-adult.service';

function makeBot() {
  const sendMessage = jest.fn().mockResolvedValue(undefined);
  return { bot: { telegram: { sendMessage } } as any, sendMessage };
}

/** Фейковый сервис фраз: по умолчанию отдаёт весь встроенный пул. */
function makePhrases(texts: string[] = [...HEALTHY_ADULT_PHRASES]) {
  return {
    enabledTexts: jest.fn().mockResolvedValue(texts),
  } as unknown as HealthyAdultService;
}

describe('TelegramChannelService', () => {
  const OLD_ENV = process.env.HEALTHY_ADULT_CHANNEL;
  afterEach(() => {
    if (OLD_ENV === undefined) delete process.env.HEALTHY_ADULT_CHANNEL;
    else process.env.HEALTHY_ADULT_CHANNEL = OLD_ENV;
    jest.restoreAllMocks();
  });

  it('не постит и сообщает, что фича выключена, если канал не задан', async () => {
    delete process.env.HEALTHY_ADULT_CHANNEL;
    const { bot, sendMessage } = makeBot();
    const res = await new TelegramChannelService(bot, makePhrases()).post(0);
    expect(sendMessage).not.toHaveBeenCalled();
    expect(res.ok).toBe(false);
    expect(res.message).toContain('HEALTHY_ADULT_CHANNEL');
  });

  it('не падает и сообщает об отсутствии бота', async () => {
    process.env.HEALTHY_ADULT_CHANNEL = '@test_channel';
    const res = await new TelegramChannelService(null, makePhrases()).post(0);
    expect(res.ok).toBe(false);
    expect(res.message).toContain('Бот');
  });

  it('сообщает, если активных фраз нет', async () => {
    process.env.HEALTHY_ADULT_CHANNEL = '@test_channel';
    const { bot, sendMessage } = makeBot();
    const res = await new TelegramChannelService(bot, makePhrases([])).post(0);
    expect(sendMessage).not.toHaveBeenCalled();
    expect(res.ok).toBe(false);
    expect(res.message).toContain('фраз');
  });

  it('постит фразу из активного пула в заданный канал и возвращает ok', async () => {
    process.env.HEALTHY_ADULT_CHANNEL = '@test_channel';
    const { bot, sendMessage } = makeBot();
    const pool = ['фраза раз', 'фраза два'];
    const res = await new TelegramChannelService(bot, makePhrases(pool)).post(
      0,
    );
    expect(sendMessage).toHaveBeenCalledTimes(1);
    const [channel, text] = sendMessage.mock.calls[0];
    expect(channel).toBe('@test_channel');
    expect(pool).toContain(text);
    expect(res.ok).toBe(true);
  });

  it('постит с уведомлением (без disable_notification)', async () => {
    process.env.HEALTHY_ADULT_CHANNEL = '@test_channel';
    const { bot, sendMessage } = makeBot();
    await new TelegramChannelService(bot, makePhrases()).post(0);
    const opts = sendMessage.mock.calls[0][2];
    expect(opts?.disable_notification).toBeFalsy();
  });

  it('не пробрасывает ошибку отправки, возвращает диагностику с подсказкой про права', async () => {
    process.env.HEALTHY_ADULT_CHANNEL = '@test_channel';
    const { bot, sendMessage } = makeBot();
    sendMessage.mockRejectedValueOnce(new Error('chat not found'));
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const res = await new TelegramChannelService(bot, makePhrases()).post(1);
    expect(res.ok).toBe(false);
    expect(res.message).toContain('chat not found');
    expect(res.message).toContain('администратор');
  });
});
