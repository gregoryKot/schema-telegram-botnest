// R7 (аудит 2026-11): дубли постов канала. Отправка в Telegram висела дольше
// тика (5 мин): следующий тик читал «когда постили» до того, как первый
// записал пост, видел слот пустым и публиковал его второй раз. Аренда
// CronLeaderService этого не ловила — её окно короче зависшей отправки.
import { Logger } from '@nestjs/common';
import { ChannelScheduleService } from './channel-schedule.service';
import type { ChannelPublisherService } from './channel-publisher.service';
import { OneAtATime } from './one-at-a-time';
import type { PublishResult } from './channel-target';
import type { HealthyAdultService } from '../bot/healthy-adult.service';
import type { DeliveryLogService } from './delivery-log.service';
import type { CronLeaderService } from '../infra/cron-leader.service';
import { ZvRunner } from '../telegram/zv-runner';

jest.mock('../utils/admin-alert', () => ({
  notifyAdminWithFallback: jest.fn().mockResolvedValue(undefined),
}));

const POSTED: PublishResult = {
  ok: true,
  posted: true,
  message: 'ok',
  delivered: [{ platform: 'telegram', title: 'Telegram', destination: '@ch' }],
  failed: [],
  silent: [],
};

/** Отправка, которая висит, пока тест её не отпустит. */
function slowCall() {
  let release: (r: PublishResult) => void = () => undefined;
  const fn = jest.fn(
    () =>
      new Promise<PublishResult>((resolve) => {
        release = resolve;
      }),
  );
  return { fn, release: (r: PublishResult = POSTED) => release(r) };
}

function setup(over: { publish?: jest.Mock; retry?: jest.Mock } = {}) {
  const publish = over.publish ?? jest.fn().mockResolvedValue(POSTED);
  const retry = over.retry ?? jest.fn().mockResolvedValue(POSTED);
  const claimRun = jest.fn().mockResolvedValue(true);
  const lastPostAt = jest.fn().mockResolvedValue(null);
  // Долг слота: Telegram не принял утреннюю фразу.
  const slotRows = jest.fn().mockResolvedValue([
    {
      source: 'утро',
      platform: 'telegram',
      destination: '@ch',
      ok: false,
      reason: 'таймаут',
      text: 'фраза',
      createdAt: new Date(),
    },
  ]);
  const publisher = { publish, retry, inFlight: new OneAtATime() };
  const service = new ChannelScheduleService(
    publisher as unknown as ChannelPublisherService,
    { lastPostAt } as unknown as HealthyAdultService,
    { slotRows } as unknown as DeliveryLogService,
    { claimRun } as unknown as CronLeaderService,
  );
  return { service, publish, retry, claimRun, publisher };
}

// 10:55 и 11:00 МСК (UTC+3): конец утреннего окна — слот «пора».
const at = (h: number, m: number) => new Date(Date.UTC(2026, 6, 21, h - 3, m));
const flush = () => new Promise((r) => setImmediate(r));

describe('ChannelScheduleService — публикация «в полёте» (R7)', () => {
  let warns: jest.SpyInstance;
  beforeEach(() => {
    warns = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('медленная отправка — второй тик не постит', async () => {
    const slow = slowCall();
    const { service, publish } = setup({ publish: slow.fn });

    const first = service.maybePost(at(10, 55));
    await flush();
    await service.maybePost(at(10, 56));

    expect(publish.mock.calls).toEqual([['утро']]);
    expect(String(warns.mock.calls[0]?.[0])).toContain('ещё идёт');
    slow.release();
    await first;
  });

  it('тики крона: второй тик аренду забирает, но не публикует', async () => {
    // Аренда остаётся за процессом, который публикует: отдай он тик, соседний
    // инстанс опубликовал бы тот же слот.
    const slow = slowCall();
    const { service, publish, claimRun } = setup({ publish: slow.fn });
    jest.useFakeTimers({ now: at(10, 55), doNotFake: ['setImmediate'] });
    try {
      const first = service.tickMorning();
      await flush();
      await service.tickMorning();
      expect(claimRun.mock.calls.map((c) => c[0])).toEqual([
        'healthyAdultMorning',
        'healthyAdultMorning',
      ]);
      expect(publish.mock.calls).toEqual([['утро']]);
      slow.release();
      await first;
    } finally {
      jest.useRealTimers();
    }
  });

  it('прошлая публикация закончилась — следующий тик снова может постить', async () => {
    const slow = slowCall();
    const { service, publish } = setup({ publish: slow.fn });

    const first = service.maybePost(at(10, 55));
    await flush();
    slow.release({ ...POSTED, posted: false, delivered: [] });
    await first;
    const second = service.maybePost(at(10, 56));
    await flush();
    slow.release();
    await second;

    expect(publish.mock.calls).toEqual([['утро'], ['утро']]);
  });

  // Хвост R7 (аудит 2026-11): /zv и расписание держат ОДИН флаг публикации.
  it('пока идёт /zv, тик расписания не публикует; /zv кончился — публикует', async () => {
    const slow = slowCall();
    const { service, publish, publisher } = setup({ publish: slow.fn });
    const zv = new ZvRunner();
    const reply = jest.fn().mockResolvedValue(undefined);
    const log = { error: jest.fn(), warn: jest.fn() };
    const refused = zv.start(
      () => publisher.publish() as Promise<PublishResult>,
      reply,
      log,
      publisher.inFlight,
    );
    expect(refused).toBeNull();
    await flush();

    await service.maybePost(at(10, 55));
    expect(publish.mock.calls).toEqual([[]]); // только ручная, без слота
    expect(String(warns.mock.calls[0]?.[0])).toContain('/zv');

    slow.release();
    await zv.current;
    const tick = service.maybePost(at(10, 56));
    await flush();
    slow.release();
    await tick;
    expect(publish.mock.calls).toEqual([[], ['утро']]);
  });

  it('медленная досылка — следующий тик досылки не шлёт ту же фразу', async () => {
    const slow = slowCall();
    const { service, retry } = setup({ retry: slow.fn });

    const first = service.catchUp(at(11, 0));
    await flush();
    await service.catchUp(at(11, 15));

    expect(retry.mock.calls).toEqual([['утро', 'фраза', ['telegram']]]);
    slow.release();
    await first;
  });

  it('досылка упала — флаг снят, следующий тик пробует', async () => {
    const retry = jest
      .fn()
      .mockRejectedValueOnce(new Error('db down'))
      .mockResolvedValueOnce(POSTED);
    const { service } = setup({ retry });

    await expect(service.catchUp(at(11, 0))).rejects.toThrow('db down');
    await service.catchUp(at(11, 15));

    expect(retry.mock.calls).toEqual([
      ['утро', 'фраза', ['telegram']],
      ['утро', 'фраза', ['telegram']],
    ]);
  });
});
