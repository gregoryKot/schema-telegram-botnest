import { Logger } from '@nestjs/common';
import { TelegramChannelService } from './telegram.channel.service';
import { HEALTHY_ADULT_PHRASES } from '../bot/healthy-adult.data';

function makeBot() {
  const sendMessage = jest.fn().mockResolvedValue(undefined);
  return { bot: { telegram: { sendMessage } } as any, sendMessage };
}

describe('TelegramChannelService', () => {
  const OLD_ENV = process.env.HEALTHY_ADULT_CHANNEL;
  afterEach(() => {
    if (OLD_ENV === undefined) delete process.env.HEALTHY_ADULT_CHANNEL;
    else process.env.HEALTHY_ADULT_CHANNEL = OLD_ENV;
    jest.restoreAllMocks();
  });

  it('не постит, если канал не задан в env', async () => {
    delete process.env.HEALTHY_ADULT_CHANNEL;
    const { bot, sendMessage } = makeBot();
    await new TelegramChannelService(bot).post(0);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('не падает, если бот не инициализирован', async () => {
    process.env.HEALTHY_ADULT_CHANNEL = '@test_channel';
    await expect(
      new TelegramChannelService(null).post(0),
    ).resolves.toBeUndefined();
  });

  it('постит фразу из пула в заданный канал', async () => {
    process.env.HEALTHY_ADULT_CHANNEL = '@test_channel';
    const { bot, sendMessage } = makeBot();
    await new TelegramChannelService(bot).post(0);
    expect(sendMessage).toHaveBeenCalledTimes(1);
    const [channel, text] = sendMessage.mock.calls[0];
    expect(channel).toBe('@test_channel');
    expect(HEALTHY_ADULT_PHRASES).toContain(text);
  });

  it('глотает ошибку отправки, не пробрасывает наружу', async () => {
    process.env.HEALTHY_ADULT_CHANNEL = '@test_channel';
    const { bot, sendMessage } = makeBot();
    sendMessage.mockRejectedValueOnce(new Error('chat not found'));
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    await expect(
      new TelegramChannelService(bot).post(1),
    ).resolves.toBeUndefined();
  });
});
