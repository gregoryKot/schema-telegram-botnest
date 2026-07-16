import { Logger } from '@nestjs/common';
import { TelegramChannelService } from './telegram.channel.service';
import type { HealthyAdultService } from '../bot/healthy-adult.service';
import type { HealthyAdultGeneratorService } from '../bot/healthy-adult.generator';

function makeBot() {
  const sendMessage = jest.fn().mockResolvedValue(undefined);
  return { bot: { telegram: { sendMessage } } as any, sendMessage };
}

function makePhrases(pool: string | null = 'фраза из пула') {
  const recordPost = jest.fn().mockResolvedValue(undefined);
  const svc = {
    recentPostTexts: jest.fn().mockResolvedValue([]),
    pickFromPool: jest.fn().mockResolvedValue(pool),
    recordPost,
  } as unknown as HealthyAdultService;
  return { svc, recordPost };
}

function makeGen(text: string | null) {
  return {
    generate: jest.fn().mockResolvedValue(text),
  } as unknown as HealthyAdultGeneratorService;
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
    const { svc } = makePhrases();
    const res = await new TelegramChannelService(bot, svc, makeGen('x')).post();
    expect(sendMessage).not.toHaveBeenCalled();
    expect(res.ok).toBe(false);
    expect(res.message).toContain('HEALTHY_ADULT_CHANNEL');
  });

  it('постит сгенерированное сообщение (источник ai) и логирует пост', async () => {
    process.env.HEALTHY_ADULT_CHANNEL = '@test_channel';
    const { bot, sendMessage } = makeBot();
    const { svc, recordPost } = makePhrases();
    const res = await new TelegramChannelService(
      bot,
      svc,
      makeGen('свежее от ИИ'),
    ).post();
    expect(sendMessage).toHaveBeenCalledWith('@test_channel', 'свежее от ИИ');
    expect(recordPost).toHaveBeenCalledWith('свежее от ИИ', 'ai');
    expect(res.ok).toBe(true);
  });

  it('падает на фолбэк-пул, если генерация вернула null', async () => {
    process.env.HEALTHY_ADULT_CHANNEL = '@test_channel';
    const { bot, sendMessage } = makeBot();
    const { svc, recordPost } = makePhrases('фраза из пула');
    const res = await new TelegramChannelService(
      bot,
      svc,
      makeGen(null),
    ).post();
    expect(sendMessage).toHaveBeenCalledWith('@test_channel', 'фраза из пула');
    expect(recordPost).toHaveBeenCalledWith('фраза из пула', 'pool');
    expect(res.ok).toBe(true);
  });

  it('сообщает, если ни генерации, ни фраз нет', async () => {
    process.env.HEALTHY_ADULT_CHANNEL = '@test_channel';
    const { bot, sendMessage } = makeBot();
    const { svc } = makePhrases(null);
    const res = await new TelegramChannelService(
      bot,
      svc,
      makeGen(null),
    ).post();
    expect(sendMessage).not.toHaveBeenCalled();
    expect(res.ok).toBe(false);
  });

  it('постит с уведомлением (без disable_notification)', async () => {
    process.env.HEALTHY_ADULT_CHANNEL = '@test_channel';
    const { bot, sendMessage } = makeBot();
    const { svc } = makePhrases();
    await new TelegramChannelService(bot, svc, makeGen('текст')).post();
    const opts = sendMessage.mock.calls[0][2];
    expect(opts?.disable_notification).toBeFalsy();
  });

  it('не пробрасывает ошибку отправки, возвращает диагностику про права', async () => {
    process.env.HEALTHY_ADULT_CHANNEL = '@test_channel';
    const { bot, sendMessage } = makeBot();
    const { svc } = makePhrases();
    sendMessage.mockRejectedValueOnce(new Error('chat not found'));
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const res = await new TelegramChannelService(
      bot,
      svc,
      makeGen('текст'),
    ).post();
    expect(res.ok).toBe(false);
    expect(res.message).toContain('chat not found');
    expect(res.message).toContain('администратор');
  });
});
