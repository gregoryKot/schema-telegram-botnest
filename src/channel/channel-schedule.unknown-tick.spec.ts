// Хвост R7 (аудит 2026-11): «исход неизвестен» досылка уже не повторяла, а
// основной тик — да. Если ни одна площадка не подтвердила, а у какой-то исход
// неизвестен, публикация считалась несостоявшейся (`posted: false`), слот
// оставался открытым, и следующий тик публиковал новую фразу везде — у
// площадки, где пост, возможно, уже вышел, получался второй.
//
// Сценарий — через настоящие расписание и рассылку; подделаны только
// площадки, пул и журнал.
import { Logger } from '@nestjs/common';
import { ChannelScheduleService } from './channel-schedule.service';
import { ChannelPublisherService } from './channel-publisher.service';
import type { ChannelTarget } from './channel-target';
import { markUnknown } from './unknown-outcome';
import type { HealthyAdultService } from '../bot/healthy-adult.service';
import type { DeliveryLogService } from './delivery-log.service';
import type { CronLeaderService } from '../infra/cron-leader.service';
import { notifyAdminWithFallback } from '../utils/admin-alert';

jest.mock('../utils/admin-alert', () => ({
  notifyAdminWithFallback: jest.fn().mockResolvedValue(undefined),
}));
const alertTexts = () =>
  (notifyAdminWithFallback as jest.Mock).mock.calls.map((c) => String(c[0]));

// Момент по МСК → UTC (МСК = UTC+3); 10:56–10:57 — утренний слот уже «пора».
const msk = (hour: number, minute: number): Date =>
  new Date(Date.UTC(2026, 6, 20, hour - 3, minute));

function target(platform: string, err: Error) {
  const send = jest.fn().mockRejectedValue(err);
  const t: ChannelTarget = {
    platform,
    title: platform,
    envKey: `ENV_${platform}`,
    destination: () => '@ch',
    send,
    explain: (e) => (e as Error).message,
  };
  return { target: t, send };
}

function setup() {
  let lastPostAt: Date | null = null;
  let now = msk(10, 56);
  const phrases = {
    lastPostAt: jest.fn(async () => lastPostAt),
    recentPostTexts: jest.fn().mockResolvedValue([]),
    pickFromPool: jest.fn().mockResolvedValue('фраза слота'),
    // Как в бою: запись поста закрывает слот для dueSlot.
    recordPost: jest.fn(async () => {
      lastPostAt = now;
    }),
    poolStatus: jest
      .fn()
      .mockResolvedValue({ enabled: 40, unused: 30, daysLeft: 15 }),
  } as unknown as HealthyAdultService;
  // Обрыв после отправки — пост мог выйти; отказ VK — точно не вышел.
  const tg = target(
    'telegram',
    Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' }),
  );
  const vk = target('vk', new Error('403: нет доступа'));
  const slotRows = jest.fn().mockResolvedValue([]);
  const journal = {
    record: jest.fn().mockResolvedValue(undefined),
    slotRows,
  } as unknown as DeliveryLogService;
  const publisher = new ChannelPublisherService(
    [tg.target, vk.target],
    phrases,
    journal,
  );
  const cronLeader = {
    claimRun: jest.fn().mockResolvedValue(true),
  } as unknown as CronLeaderService;
  const service = new ChannelScheduleService(
    publisher,
    phrases,
    journal,
    cronLeader,
  );
  const tick = async (at: Date) => {
    now = at;
    await service.maybePost(at);
  };
  return { service, tick, tg, vk, slotRows };
}

describe('ChannelScheduleService — исход неизвестен в основном тике (хвост R7)', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    (notifyAdminWithFallback as jest.Mock).mockClear();
  });
  afterEach(() => jest.restoreAllMocks());

  it('никто не подтвердил, у Telegram исход неизвестен — следующий тик не публикует', async () => {
    const { tick, tg, vk } = setup();

    await tick(msk(10, 56));
    await tick(msk(10, 57));

    // Одна отправка — первая, с фразой слота; второй фразы нигде нет.
    expect(tg.send.mock.calls).toEqual([
      [expect.objectContaining({ text: 'фраза слота' }), '@ch'],
    ]);
    expect(vk.send).toHaveBeenCalledTimes(1);
  });

  it('владельцу сразу: VK — «дошло не везде», Telegram — «проверить вручную»', async () => {
    const { tick } = setup();

    await tick(msk(10, 56));

    const [report, check] = alertTexts();
    expect(alertTexts()).toHaveLength(2);
    expect(report).toContain('дошло не везде');
    expect(report).toContain('403: нет доступа');
    // «Пробую дослать» — не про Telegram: его досылка не тронет.
    expect(report).not.toContain('telegram');
    expect(check).toContain('telegram');
    expect(check).toContain('проверить вручную');
  });

  it('досылка повторяет только VK тем же текстом и не повторяет «проверить вручную»', async () => {
    const { service, tick, tg, vk, slotRows } = setup();
    await tick(msk(10, 56));
    const row = (platform: string, reason: string) => ({
      source: 'утро',
      platform,
      destination: '@ch',
      ok: false,
      reason,
      text: 'фраза слота',
      createdAt: msk(10, 56),
    });
    slotRows.mockResolvedValue([
      row('telegram', markUnknown('socket hang up')),
      row('vk', '403: нет доступа'),
    ]);

    await service.catchUp(msk(11, 0));

    expect(tg.send).toHaveBeenCalledTimes(1);
    expect(vk.send.mock.calls.map(([post]) => post.text)).toEqual([
      'фраза слота',
      'фраза слота',
    ]);
    const checks = alertTexts().filter((t) => t.includes('проверить вручную'));
    expect(checks).toHaveLength(1);
  });
});
