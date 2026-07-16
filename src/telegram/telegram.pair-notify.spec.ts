// Тест парного триггера (аудит 2026-07, этап 4.5): юзер заполнил трекер →
// активному напарнику уходит мягкое pair_activity. Ограничители: выключенные
// уведомления, уже заполнивший напарник, дедуп «одно в день».
import { TelegramScheduleService } from './telegram.schedule.service';

const FULL = {
  attachment: 7,
  autonomy: 7,
  expression: 7,
  play: 7,
  limits: 7,
};

function makeService(opts: {
  pairs?: any[];
  partnerSettings?: any;
  partnerRatings?: Record<string, number>;
  lastSent?: Date | null;
  hasPending?: boolean;
}) {
  const scheduled: Array<{ userId: bigint; type: string }> = [];
  const botService: any = {
    getUserSettings: jest.fn(() =>
      Promise.resolve(
        opts.partnerSettings ?? {
          notifyEnabled: true,
          notifyTimezone: 'Europe/Moscow',
        },
      ),
    ),
    getRatings: jest.fn(() => Promise.resolve(opts.partnerRatings ?? {})),
  };
  const pairsService: any = {
    getUserPairs: jest.fn(() => Promise.resolve(opts.pairs ?? [])),
  };
  const notificationService: any = {
    lastSentAt: jest.fn(() => Promise.resolve(opts.lastSent ?? null)),
    hasPending: jest.fn(() => Promise.resolve(opts.hasPending ?? false)),
    schedule: jest.fn((userId: bigint, type: string) => {
      scheduled.push({ userId, type });
      return Promise.resolve();
    }),
  };
  const service = new TelegramScheduleService(
    null,
    botService,
    {} as any, // analyticsService
    {} as any, // accountService
    pairsService,
    notificationService,
    {} as any, // cadenceService
    {} as any, // plannerService
  );
  return { service, scheduled, notificationService };
}

const ACTIVE_PAIR = {
  code: 'X',
  status: 'active',
  isCreator: true,
  partnerId: 777,
};

describe('maybeNotifyPairPartners', () => {
  // Fixed mid-day Moscow instant — avoids flake from real `new Date()` landing
  // on different local dates a moment apart near MSK midnight (the dedup
  // logic compares localDateString(tz, ...) for "today").
  const FIXED_NOW = new Date('2026-07-16T12:00:00+03:00');

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('активному напарнику уходит pair_activity', async () => {
    const { service, scheduled } = makeService({ pairs: [ACTIVE_PAIR] });
    await service.maybeNotifyPairPartners(1n);
    expect(scheduled).toEqual([{ userId: 777n, type: 'pair_activity' }]);
  });

  it('pending-пара или пара без напарника — тишина', async () => {
    const { service, scheduled } = makeService({
      pairs: [
        { ...ACTIVE_PAIR, status: 'pending' },
        { ...ACTIVE_PAIR, partnerId: null },
      ],
    });
    await service.maybeNotifyPairPartners(1n);
    expect(scheduled).toEqual([]);
  });

  it('уведомления у напарника выключены — тишина', async () => {
    const { service, scheduled } = makeService({
      pairs: [ACTIVE_PAIR],
      partnerSettings: {
        notifyEnabled: false,
        notifyTimezone: 'Europe/Moscow',
      },
    });
    await service.maybeNotifyPairPartners(1n);
    expect(scheduled).toEqual([]);
  });

  it('напарник сегодня уже заполнил сам — подсказка не нужна', async () => {
    const { service, scheduled } = makeService({
      pairs: [ACTIVE_PAIR],
      partnerRatings: FULL,
    });
    await service.maybeNotifyPairPartners(1n);
    expect(scheduled).toEqual([]);
  });

  it('дедуп: уже отправляли сегодня или висит в очереди — тишина', async () => {
    const sentToday = makeService({
      pairs: [ACTIVE_PAIR],
      lastSent: new Date(),
    });
    await sentToday.service.maybeNotifyPairPartners(1n);
    expect(sentToday.scheduled).toEqual([]);

    const pending = makeService({ pairs: [ACTIVE_PAIR], hasPending: true });
    await pending.service.maybeNotifyPairPartners(1n);
    expect(pending.scheduled).toEqual([]);
  });

  it('вчерашняя отправка дедупу не мешает', async () => {
    const { service, scheduled } = makeService({
      pairs: [ACTIVE_PAIR],
      lastSent: new Date(Date.now() - 2 * 86_400_000),
    });
    await service.maybeNotifyPairPartners(1n);
    expect(scheduled).toHaveLength(1);
  });
});
