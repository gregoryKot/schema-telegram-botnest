// Рассылка одной фразы по нескольким площадкам. Главное, что здесь защищено:
// фраза берётся из пула ОДИН раз на все площадки, а факт публикации пишется
// одной записью — иначе LRU-пул выгорал бы кратно числу площадок, а
// расписание считало бы «последний пост» по чужой строке.
import { Logger } from '@nestjs/common';
import { ChannelPublisherService } from './channel-publisher.service';
import type { ChannelTarget } from './channel-target';
import type { HealthyAdultService } from '../bot/healthy-adult.service';
import type { DeliveryLogService } from './delivery-log.service';

/** Журнал отправок в тестах: пишем в память, наружу не ходим. */
const journal = () =>
  ({
    record: jest.fn().mockResolvedValue(undefined),
    recent: jest.fn().mockResolvedValue([]),
  }) as unknown as DeliveryLogService;

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
      journal(),
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
    await new ChannelPublisherService(
      [a.target, b.target],
      svc,
      journal(),
    ).publish();
    expect(recordPost).toHaveBeenCalledTimes(1);
    expect(recordPost).toHaveBeenCalledWith('одна фраза', 'pool');
  });

  it('площадка без env не получает пост, но названа в отчёте', async () => {
    // Инцидент 2026-07-31: выключенная площадка выпадала из отчёта совсем, и
    // её молчание читалось как успех — «утром пришло не всё» заметили постфактум.
    const on = makeTarget('telegram', '@ch');
    const off = makeTarget('vk', null);
    const { svc } = makePhrases();
    const res = await new ChannelPublisherService(
      [on.target, off.target],
      svc,
      journal(),
    ).publish();

    expect(on.send).toHaveBeenCalled();
    expect(off.send).not.toHaveBeenCalled();
    expect(res.ok).toBe(true);
    expect(res.failed).toEqual([]);
    expect(res.silent).toEqual([{ title: 'vk', envKey: 'ENV_VK' }]);
    expect(res.message).toContain('Молчали');
    expect(res.message).toContain('ENV_VK');
  });

  it('исход каждой площадки уходит в журнал под именем публикации', async () => {
    const ok = makeTarget('telegram', '@ch');
    const bad = makeTarget('vk', 'club1');
    bad.send.mockRejectedValue(new Error('нет доступа'));
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { svc } = makePhrases();
    const log = journal();

    await new ChannelPublisherService(
      [ok.target, bad.target],
      svc,
      log,
    ).publish('утро');

    const [source, delivered, failed] = (log.record as jest.Mock).mock.calls[0];
    expect(source).toBe('утро');
    expect(delivered).toEqual([
      expect.objectContaining({ platform: 'telegram' }),
    ]);
    expect(failed).toEqual([
      expect.objectContaining({
        platform: 'vk',
        reason: 'причина: нет доступа',
      }),
    ]);
  });

  it('полный провал тоже попадает в журнал — иначе о нём нечего спросить', async () => {
    const bad = makeTarget('telegram', '@ch');
    bad.send.mockRejectedValue(new Error('таймаут'));
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { svc } = makePhrases();
    const log = journal();

    await new ChannelPublisherService([bad.target], svc, log).publish('вечер');

    const [, delivered, failed] = (log.record as jest.Mock).mock.calls[0];
    expect(delivered).toEqual([]);
    expect(failed).toHaveLength(1);
  });

  it('без единой настроенной площадки не трогает пул и подсказывает env', async () => {
    const off = makeTarget('telegram', null);
    const { svc } = makePhrases();
    const res = await new ChannelPublisherService(
      [off.target],
      svc,
      journal(),
    ).publish();

    expect(svc.pickFromPool).not.toHaveBeenCalled();
    expect(res.posted).toBe(false);
    expect(res.message).toContain('ENV_TELEGRAM');
  });

  it('пустой пул — ничего не отправляется', async () => {
    const a = makeTarget('telegram', '@ch');
    const { svc, recordPost } = makePhrases(null);
    const res = await new ChannelPublisherService(
      [a.target],
      svc,
      journal(),
    ).publish();

    expect(a.send).not.toHaveBeenCalled();
    expect(recordPost).not.toHaveBeenCalled();
    expect(res.message).toContain('админке');
  });

  it('отдаёт недавние посты в pickFromPool — чтобы не повторяться подряд', async () => {
    const a = makeTarget('telegram', '@ch');
    const { svc } = makePhrases();
    (svc.recentPostTexts as jest.Mock).mockResolvedValue(['вчерашнее']);
    await new ChannelPublisherService([a.target], svc, journal()).publish();
    expect(svc.pickFromPool).toHaveBeenCalledWith(['вчерашнее']);
  });

  describe('досылка упавшим площадкам', () => {
    it('шлёт ту же фразу только названным площадкам', async () => {
      const tg = makeTarget('telegram', '@ch');
      const max = makeTarget('max', 'c1');
      const { svc, recordPost } = makePhrases();
      const log = journal();

      const res = await new ChannelPublisherService(
        [tg.target, max.target],
        svc,
        log,
      ).retry('утро', 'та самая фраза', ['max']);

      expect(max.send).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'та самая фраза' }),
        'c1',
      );
      // Telegram пост уже принял — второй раз ему нельзя, это дубль.
      expect(tg.send).not.toHaveBeenCalled();
      expect(res.ok).toBe(true);
      // Пул и история публикации не трогаются: публикация уже состоялась.
      expect(svc.pickFromPool).not.toHaveBeenCalled();
      expect(recordPost).not.toHaveBeenCalled();
    });

    it('повтор виден в журнале отдельным источником', async () => {
      const max = makeTarget('max', 'c1');
      const { svc } = makePhrases();
      const log = journal();

      await new ChannelPublisherService([max.target], svc, log).retry(
        'вечер',
        'фраза',
        ['max'],
      );

      const [source, delivered] = (log.record as jest.Mock).mock.calls[0];
      expect(source).toBe('вечер — повтор');
      expect(delivered).toEqual([expect.objectContaining({ platform: 'max' })]);
    });

    it('площадка выключилась между попытками — в сеть не идём', async () => {
      const off = makeTarget('max', null);
      const { svc } = makePhrases();

      const res = await new ChannelPublisherService(
        [off.target],
        svc,
        journal(),
      ).retry('утро', 'фраза', ['max']);

      expect(off.send).not.toHaveBeenCalled();
      expect(res.posted).toBe(false);
    });
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
        journal(),
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
      expect(recordPost).toHaveBeenCalledWith('фраза из пула', 'pool');
    });
  });

  it('полный провал не записывает пост — тик расписания попробует снова', async () => {
    const a = makeTarget('telegram', '@ch');
    a.send.mockRejectedValue(
      Object.assign(new Error('connect failed'), { code: 'ETIMEDOUT' }),
    );
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { svc, recordPost } = makePhrases();
    const res = await new ChannelPublisherService(
      [a.target],
      svc,
      journal(),
    ).publish();

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

    const res = await new ChannelPublisherService(
      [a.target],
      svc,
      journal(),
    ).publish();
    expect(a.send).toHaveBeenCalled();
    expect(res.ok).toBe(true);
  });
});
