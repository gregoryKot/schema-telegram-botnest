import { Logger } from '@nestjs/common';
import { TelegramChannelService } from './telegram.channel.service';
import type { HealthyAdultService } from '../bot/healthy-adult.service';

function makeBot() {
  const sendMessage = jest.fn().mockResolvedValue(undefined);
  return { bot: { telegram: { sendMessage } } as any, sendMessage };
}

function makePhrases(pool: string | null = 'фраза из пула', unused = 30) {
  const recordPost = jest.fn().mockResolvedValue(undefined);
  const svc = {
    recentPostTexts: jest.fn().mockResolvedValue([]),
    pickFromPool: jest.fn().mockResolvedValue(pool),
    recordPost,
    lastPostAt: jest.fn().mockResolvedValue(null),
    poolStatus: jest
      .fn()
      .mockResolvedValue({ enabled: 40, unused, daysLeft: unused / 2 }),
  } as unknown as HealthyAdultService;
  return { svc, recordPost };
}

// Момент по МСК → UTC (МСК = UTC+3).
const msk = (hour: number, minute = 0): Date =>
  new Date(Date.UTC(2026, 6, 20, hour - 3, minute));

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
    const res = await new TelegramChannelService(bot, svc).post();
    expect(sendMessage).not.toHaveBeenCalled();
    expect(res.ok).toBe(false);
    expect(res.message).toContain('HEALTHY_ADULT_CHANNEL');
  });

  it('публикует фразу из пула и записывает пост', async () => {
    process.env.HEALTHY_ADULT_CHANNEL = '@test_channel';
    const { bot, sendMessage } = makeBot();
    const { svc, recordPost } = makePhrases('фраза из пула');
    const res = await new TelegramChannelService(bot, svc).post();
    expect(sendMessage).toHaveBeenCalledWith('@test_channel', 'фраза из пула');
    expect(recordPost).toHaveBeenCalledWith('фраза из пула', 'pool');
    expect(res.ok).toBe(true);
  });

  it('отдаёт недавние посты в pickFromPool — чтобы не повторяться подряд', async () => {
    process.env.HEALTHY_ADULT_CHANNEL = '@test_channel';
    const { bot } = makeBot();
    const { svc } = makePhrases();
    (svc.recentPostTexts as jest.Mock).mockResolvedValue(['вчерашнее']);
    await new TelegramChannelService(bot, svc).post();
    expect(svc.pickFromPool).toHaveBeenCalledWith(['вчерашнее']);
  });

  it('сообщает про админку, если активных фраз не осталось', async () => {
    process.env.HEALTHY_ADULT_CHANNEL = '@test_channel';
    const { bot, sendMessage } = makeBot();
    const { svc } = makePhrases(null);
    const res = await new TelegramChannelService(bot, svc).post();
    expect(sendMessage).not.toHaveBeenCalled();
    expect(res.ok).toBe(false);
    expect(res.message).toContain('админке');
  });

  it('постит с уведомлением (без disable_notification)', async () => {
    process.env.HEALTHY_ADULT_CHANNEL = '@test_channel';
    const { bot, sendMessage } = makeBot();
    const { svc } = makePhrases();
    await new TelegramChannelService(bot, svc).post();
    const opts = sendMessage.mock.calls[0][2];
    expect(opts?.disable_notification).toBeFalsy();
  });

  it('сбой проверки остатка не отменяет уже отправленный пост', async () => {
    process.env.HEALTHY_ADULT_CHANNEL = '@test_channel';
    const { bot, sendMessage } = makeBot();
    const { svc } = makePhrases();
    (svc.poolStatus as jest.Mock).mockRejectedValue(new Error('db down'));
    const res = await new TelegramChannelService(bot, svc).post();
    expect(sendMessage).toHaveBeenCalled();
    expect(res.ok).toBe(true);
  });

  it('не пробрасывает ошибку отправки, возвращает диагностику про права', async () => {
    process.env.HEALTHY_ADULT_CHANNEL = '@test_channel';
    const { bot, sendMessage } = makeBot();
    const { svc } = makePhrases();
    sendMessage.mockRejectedValueOnce(new Error('chat not found'));
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const res = await new TelegramChannelService(bot, svc).post();
    expect(res.ok).toBe(false);
    expect(res.message).toContain('chat not found');
    expect(res.message).toContain('администратор');
  });

  describe('maybePost — тик расписания с jitter', () => {
    it('вне окна (день) — тик молчит', async () => {
      process.env.HEALTHY_ADULT_CHANNEL = '@test_channel';
      const { bot, sendMessage } = makeBot();
      const { svc } = makePhrases();
      await new TelegramChannelService(bot, svc).maybePost(msk(13, 0));
      expect(sendMessage).not.toHaveBeenCalled();
    });

    it('в конце утреннего окна публикует, если сегодня ещё не постили', async () => {
      process.env.HEALTHY_ADULT_CHANNEL = '@test_channel';
      const { bot, sendMessage } = makeBot();
      const { svc, recordPost } = makePhrases();
      // 10:55 МСК — offset 115 ≥ любой planned (<116), lastPostAt=null.
      await new TelegramChannelService(bot, svc).maybePost(msk(10, 55));
      expect(sendMessage).toHaveBeenCalledWith('@test_channel', 'фраза из пула');
      expect(recordPost).toHaveBeenCalled();
    });

    it('не постит второй раз в тот же слот (lastPostAt в окне)', async () => {
      process.env.HEALTHY_ADULT_CHANNEL = '@test_channel';
      const { bot, sendMessage } = makeBot();
      const { svc } = makePhrases();
      (svc.lastPostAt as jest.Mock).mockResolvedValue(msk(10, 0)); // уже постили утром
      await new TelegramChannelService(bot, svc).maybePost(msk(10, 55));
      expect(sendMessage).not.toHaveBeenCalled();
    });

    it('сбой чтения последнего поста не роняет тик', async () => {
      process.env.HEALTHY_ADULT_CHANNEL = '@test_channel';
      const { bot } = makeBot();
      const { svc } = makePhrases();
      (svc.lastPostAt as jest.Mock).mockRejectedValue(new Error('db down'));
      jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      await expect(
        new TelegramChannelService(bot, svc).maybePost(msk(10, 55)),
      ).resolves.toBeUndefined();
    });
  });
});
