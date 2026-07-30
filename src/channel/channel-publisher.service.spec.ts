// Рассылка одной фразы по нескольким площадкам. Главное, что здесь защищено:
// фраза берётся из пула ОДИН раз на все площадки, а факт публикации пишется
// одной записью — иначе LRU-пул выгорал бы кратно числу площадок, а
// расписание считало бы «последний пост» по чужой строке.
import { Logger } from '@nestjs/common';
import { ChannelPublisherService } from './channel-publisher.service';
import type { ChannelTarget } from './channel-target';
import type { HealthyAdultService } from '../bot/healthy-adult.service';

function makeTarget(platform: string, destination: string | null) {
  const send = jest.fn().mockResolvedValue(undefined);
  const target: ChannelTarget = {
    platform,
    title: platform,
    envKey: `ENV_${platform.toUpperCase()}`,
    destination: () => destination,
    send,
    explain: (err) => `причина: ${(err as Error)?.message}`,
  };
  return { target, send };
}

function makePhrases(pool: string | null = 'фраза из пула', unused = 30) {
  const recordPost = jest.fn().mockResolvedValue(undefined);
  const svc = {
    recentPostTexts: jest.fn().mockResolvedValue([]),
    pickFromPool: jest.fn().mockResolvedValue(pool),
    recordPost,
    poolStatus: jest
      .fn()
      .mockResolvedValue({ enabled: 40, unused, daysLeft: unused / 2 }),
  } as unknown as HealthyAdultService;
  return { svc, recordPost };
}

describe('ChannelPublisherService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('шлёт одну и ту же фразу на все включённые площадки', async () => {
    const a = makeTarget('telegram', '@ch');
    const b = makeTarget('vk', 'club1');
    const { svc } = makePhrases('одна фраза');
    const res = await new ChannelPublisherService(
      [a.target, b.target],
      svc,
    ).publish();

    expect(a.send).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'одна фраза' }),
      '@ch',
    );
    expect(b.send).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'одна фраза' }),
      'club1',
    );
    // Картинка одна на публикацию: обе площадки получили один и тот же пост.
    expect(a.send.mock.calls[0][0]).toBe(b.send.mock.calls[0][0]);
    expect(svc.pickFromPool).toHaveBeenCalledTimes(1);
    expect(res.ok).toBe(true);
    expect(res.delivered.map((d) => d.platform)).toEqual(['telegram', 'vk']);
  });

  it('пишет один пост на публикацию, а не по посту на площадку', async () => {
    const a = makeTarget('telegram', '@ch');
    const b = makeTarget('vk', 'club1');
    const { svc, recordPost } = makePhrases('одна фраза');
    await new ChannelPublisherService([a.target, b.target], svc).publish();
    expect(recordPost).toHaveBeenCalledTimes(1);
    expect(recordPost).toHaveBeenCalledWith('одна фраза', 'pool');
  });

  it('площадка без env пропускается молча', async () => {
    const on = makeTarget('telegram', '@ch');
    const off = makeTarget('vk', null);
    const { svc } = makePhrases();
    const res = await new ChannelPublisherService(
      [on.target, off.target],
      svc,
    ).publish();

    expect(on.send).toHaveBeenCalled();
    expect(off.send).not.toHaveBeenCalled();
    expect(res.ok).toBe(true);
    expect(res.failed).toEqual([]);
  });

  it('без единой настроенной площадки не трогает пул и подсказывает env', async () => {
    const off = makeTarget('telegram', null);
    const { svc } = makePhrases();
    const res = await new ChannelPublisherService([off.target], svc).publish();

    expect(svc.pickFromPool).not.toHaveBeenCalled();
    expect(res.posted).toBe(false);
    expect(res.message).toContain('ENV_TELEGRAM');
  });

  it('пустой пул — ничего не отправляется', async () => {
    const a = makeTarget('telegram', '@ch');
    const { svc, recordPost } = makePhrases(null);
    const res = await new ChannelPublisherService([a.target], svc).publish();

    expect(a.send).not.toHaveBeenCalled();
    expect(recordPost).not.toHaveBeenCalled();
    expect(res.message).toContain('админке');
  });

  it('отдаёт недавние посты в pickFromPool — чтобы не повторяться подряд', async () => {
    const a = makeTarget('telegram', '@ch');
    const { svc } = makePhrases();
    (svc.recentPostTexts as jest.Mock).mockResolvedValue(['вчерашнее']);
    await new ChannelPublisherService([a.target], svc).publish();
    expect(svc.pickFromPool).toHaveBeenCalledWith(['вчерашнее']);
  });

  describe('частичный успех', () => {
    const partial = async () => {
      const ok = makeTarget('telegram', '@ch');
      const bad = makeTarget('vk', 'club1');
      bad.send.mockRejectedValue(new Error('нет доступа'));
      jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const { svc, recordPost } = makePhrases();
      const res = await new ChannelPublisherService(
        [ok.target, bad.target],
        svc,
      ).publish();
      return { res, recordPost };
    };

    it('считается состоявшимся постом (слот закрыт), но не зелёным', async () => {
      const { res } = await partial();
      expect(res.posted).toBe(true);
      expect(res.ok).toBe(false);
      expect(res.failed).toEqual([
        expect.objectContaining({
          platform: 'vk',
          reason: 'причина: нет доступа',
        }),
      ]);
    });

    it('пост записан один раз — упавшая площадка не отменяет вышедший', async () => {
      const { recordPost } = await partial();
      expect(recordPost).toHaveBeenCalledTimes(1);
    });
  });

  it('полный провал не записывает пост — тик расписания попробует снова', async () => {
    const a = makeTarget('telegram', '@ch');
    a.send.mockRejectedValue(
      Object.assign(new Error('connect failed'), { code: 'ETIMEDOUT' }),
    );
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { svc, recordPost } = makePhrases();
    const res = await new ChannelPublisherService([a.target], svc).publish();

    expect(recordPost).not.toHaveBeenCalled();
    expect(res.posted).toBe(false);
    expect(res.message).toContain('connect failed');
  });

  it('сбой записи поста и проверки остатка не отменяет отправленное', async () => {
    const a = makeTarget('telegram', '@ch');
    const { svc } = makePhrases();
    (svc.recordPost as jest.Mock).mockRejectedValue(new Error('db down'));
    (svc.poolStatus as jest.Mock).mockRejectedValue(new Error('db down'));
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    const res = await new ChannelPublisherService([a.target], svc).publish();
    expect(a.send).toHaveBeenCalled();
    expect(res.ok).toBe(true);
  });
});
