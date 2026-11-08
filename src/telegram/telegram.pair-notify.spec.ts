// Тест парного триггера (аудит 2026-07, этап 4.5): юзер заполнил трекер →
// активному напарнику уходит мягкое pair_activity. Ограничители: выключенные
// уведомления, уже заполнивший напарник, пауза и дневной бюджет проактивных
// (R5, аудит 2026-11 — раньше пауза и бюджет не проверялись). Очередь —
// настоящий NotificationService на фейковой таблице: дедуп и бюджет считаются
// по строкам, а не по замоканным ответам.
import { TelegramScheduleService } from './telegram.schedule.service';
import { NotificationService } from '../notification/notification.service';
import {
  createFakeTable,
  type Row,
} from '../test-support/fake-prisma.spec-helper';

const FULL = {
  attachment: 7,
  autonomy: 7,
  expression: 7,
  play: 7,
  limits: 7,
};

// Середина дня по Москве: «сегодня» не съезжает на границе суток.
const FIXED_NOW = new Date('2026-07-16T12:00:00+03:00');
const at = (iso: string) => new Date(iso);

/** Строка очереди напарника 777. */
function row(type: string, sendAt: Date, sentAt: Date | null = null): Row {
  return { userId: 777n, type, sendAt, sentAt, cancelledAt: null };
}

function makeService(opts: {
  pairs?: any[];
  partnerSettings?: any;
  partnerRatings?: Record<string, number>;
  rows?: Row[];
}) {
  const table = createFakeTable(opts.rows ?? []);
  const botService: any = {
    getUserSettings: jest.fn(() =>
      Promise.resolve(
        opts.partnerSettings ?? {
          notifyEnabled: true,
          notifyTimezone: 'Europe/Moscow',
          notifyPausedUntil: null,
        },
      ),
    ),
    getRatings: jest.fn(() => Promise.resolve(opts.partnerRatings ?? {})),
  };
  const pairsService: any = {
    getUserPairs: jest.fn(() => Promise.resolve(opts.pairs ?? [])),
  };
  const notificationService = new NotificationService({
    scheduledNotification: table,
  } as never);
  const service = new TelegramScheduleService(
    null,
    botService,
    {} as any, // analyticsService
    {} as any, // accountService
    pairsService,
    notificationService,
    {} as any, // cadenceService
    {} as any, // plannerService
    { claimRun: jest.fn().mockResolvedValue(true) } as any, // cronLeader
  );
  const scheduled = () =>
    table._rows
      .filter((r) => r.type === 'pair_activity' && r.sentAt == null)
      .filter((r) => r.cancelledAt == null)
      .map((r) => ({ userId: r.userId, type: r.type }));
  return { service, scheduled };
}

const ACTIVE_PAIR = {
  code: 'X',
  status: 'active',
  isCreator: true,
  partnerId: 777n,
};

describe('maybeNotifyPairPartners', () => {
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
    expect(scheduled()).toEqual([{ userId: 777n, type: 'pair_activity' }]);
  });

  it('pending-пара или пара без напарника — тишина', async () => {
    const { service, scheduled } = makeService({
      pairs: [
        { ...ACTIVE_PAIR, status: 'pending' },
        { ...ACTIVE_PAIR, partnerId: null },
      ],
    });
    await service.maybeNotifyPairPartners(1n);
    expect(scheduled()).toEqual([]);
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
    expect(scheduled()).toEqual([]);
  });

  it('напарник сегодня уже заполнил сам — подсказка не нужна', async () => {
    const { service, scheduled } = makeService({
      pairs: [ACTIVE_PAIR],
      partnerRatings: FULL,
    });
    await service.maybeNotifyPairPartners(1n);
    expect(scheduled()).toEqual([]);
  });

  it('дедуп: уже отправляли сегодня или висит в очереди — тишина', async () => {
    const sentToday = makeService({
      pairs: [ACTIVE_PAIR],
      rows: [
        row(
          'pair_activity',
          at('2026-07-16T07:00:00Z'),
          at('2026-07-16T07:00:00Z'),
        ),
      ],
    });
    await sentToday.service.maybeNotifyPairPartners(1n);
    expect(sentToday.scheduled()).toEqual([]);

    const pending = makeService({
      pairs: [ACTIVE_PAIR],
      rows: [row('pair_activity', at('2026-07-16T08:00:00Z'))],
    });
    await pending.service.maybeNotifyPairPartners(1n);
    expect(pending.scheduled()).toHaveLength(1); // только прежняя строка
  });

  it('вчерашняя отправка дедупу не мешает', async () => {
    const { service, scheduled } = makeService({
      pairs: [ACTIVE_PAIR],
      rows: [
        row(
          'pair_activity',
          at('2026-07-14T09:00:00Z'),
          at('2026-07-14T09:00:00Z'),
        ),
      ],
    });
    await service.maybeNotifyPairPartners(1n);
    expect(scheduled()).toHaveLength(1);
  });

  describe('R5: пауза и дневной бюджет напарника', () => {
    it('напарник на паузе — pair_activity не ставится', async () => {
      const { service, scheduled } = makeService({
        pairs: [ACTIVE_PAIR],
        partnerSettings: {
          notifyEnabled: true,
          notifyTimezone: 'Europe/Moscow',
          notifyPausedUntil: at('2026-07-20T00:00:00Z'),
        },
      });
      await service.maybeNotifyPairPartners(1n);
      expect(scheduled()).toEqual([]);
    });

    it('пауза кончилась — ставится', async () => {
      const { service, scheduled } = makeService({
        pairs: [ACTIVE_PAIR],
        partnerSettings: {
          notifyEnabled: true,
          notifyTimezone: 'Europe/Moscow',
          notifyPausedUntil: at('2026-07-15T00:00:00Z'),
        },
      });
      await service.maybeNotifyPairPartners(1n);
      expect(scheduled()).toHaveLength(1);
    });

    it('сегодня уже ушло напоминание — бюджет исчерпан, тишина', async () => {
      const { service, scheduled } = makeService({
        pairs: [ACTIVE_PAIR],
        rows: [
          row(
            'reminder',
            at('2026-07-16T06:00:00Z'),
            at('2026-07-16T06:00:00Z'),
          ),
        ],
      });
      await service.maybeNotifyPairPartners(1n);
      expect(scheduled()).toEqual([]);
    });

    it('на сегодня стоит напоминание — парное уступает ему место', async () => {
      const { service, scheduled } = makeService({
        pairs: [ACTIVE_PAIR],
        rows: [row('reminder', at('2026-07-16T18:00:00Z'))], // 21:00 МСК
      });
      await service.maybeNotifyPairPartners(1n);
      expect(scheduled()).toEqual([]);
    });

    it('напоминание на завтра, отменённое и сводка дня бюджет не занимают', async () => {
      const cancelled = {
        ...row('reminder', at('2026-07-16T18:00:00Z')),
        cancelledAt: at('2026-07-16T08:00:00Z'),
      };
      const { service, scheduled } = makeService({
        pairs: [ACTIVE_PAIR],
        rows: [
          row('reminder', at('2026-07-17T18:00:00Z')),
          cancelled,
          row(
            'summary',
            at('2026-07-16T06:00:00Z'),
            at('2026-07-16T06:00:00Z'),
          ),
        ],
      });
      await service.maybeNotifyPairPartners(1n);
      expect(scheduled()).toHaveLength(1);
    });
  });
});
