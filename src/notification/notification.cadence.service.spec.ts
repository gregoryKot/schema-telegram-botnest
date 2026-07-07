import {
  NotificationCadenceService,
  CadenceUser,
  effectiveLevel,
} from './notification.cadence.service';

// Фиксированное «сейчас»: 2 июля 2026, 00:05 UTC (03:05 Москвы — полуночный прогон)
const NOW = new Date('2026-07-02T00:05:00Z');
const TODAY_MSK = '2026-07-02';
const YESTERDAY_MSK = '2026-07-01';

function makeUser(overrides: Partial<CadenceUser> = {}): CadenceUser {
  return {
    id: BigInt(42),
    notifyTimezone: 'Europe/Moscow',
    notifyFrequency: 0,
    notifyAdaptiveLevel: 0,
    notifyIgnoredCount: 0,
    notifyNextRemindDate: null,
    notifySkipAckDate: null,
    notifyLastEvalDate: null,
    notifyPausedUntil: null,
    ...overrides,
  };
}

function makeDeps() {
  const prisma = {
    user: {
      update: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn().mockResolvedValue(makeUser()),
    },
  } as any;
  const notifications = {
    lastSentAt: jest.fn().mockResolvedValue(null),
    cancel: jest.fn().mockResolvedValue(undefined),
    cancelProactive: jest.fn().mockResolvedValue(undefined),
  } as any;
  const analytics = {
    getDaysSinceLastFill: jest.fn().mockResolvedValue(-1),
    getFillDaysInLast: jest.fn().mockResolvedValue(0),
  } as any;
  return { prisma, notifications, analytics };
}

function updatedData(prisma: any) {
  return prisma.user.update.mock.calls[0][0].data;
}

describe('NotificationCadenceService', () => {
  describe('evaluate — детекция игнора', () => {
    it('инкрементирует счётчик когда напоминание отправлено вчера и дневник не заполнен', async () => {
      const { prisma, notifications, analytics } = makeDeps();
      notifications.lastSentAt.mockResolvedValue(
        new Date('2026-07-01T18:00:00Z'),
      ); // 21:00 МСК вчера
      analytics.getDaysSinceLastFill.mockResolvedValue(5);
      const svc = new NotificationCadenceService(
        prisma,
        notifications,
        analytics,
      );
      await svc.evaluate(makeUser(), NOW);
      expect(updatedData(prisma).notifyIgnoredCount).toBe(1);
    });

    it('НЕ считает игнором когда дневник заполнен вчера', async () => {
      const { prisma, notifications, analytics } = makeDeps();
      notifications.lastSentAt.mockResolvedValue(
        new Date('2026-07-01T18:00:00Z'),
      );
      analytics.getDaysSinceLastFill.mockResolvedValue(1);
      const svc = new NotificationCadenceService(
        prisma,
        notifications,
        analytics,
      );
      await svc.evaluate(makeUser(), NOW);
      expect(updatedData(prisma).notifyIgnoredCount).toBe(0);
    });

    it('НЕ считает игнором день с «Сегодня не могу»', async () => {
      const { prisma, notifications, analytics } = makeDeps();
      notifications.lastSentAt.mockResolvedValue(
        new Date('2026-07-01T18:00:00Z'),
      );
      analytics.getDaysSinceLastFill.mockResolvedValue(5);
      const svc = new NotificationCadenceService(
        prisma,
        notifications,
        analytics,
      );
      await svc.evaluate(makeUser({ notifySkipAckDate: YESTERDAY_MSK }), NOW);
      expect(updatedData(prisma).notifyIgnoredCount).toBe(0);
    });

    it('НЕ считает игнором когда вчера напоминания не было', async () => {
      const { prisma, notifications, analytics } = makeDeps();
      notifications.lastSentAt.mockResolvedValue(
        new Date('2026-06-28T18:00:00Z'),
      );
      const svc = new NotificationCadenceService(
        prisma,
        notifications,
        analytics,
      );
      await svc.evaluate(makeUser(), NOW);
      expect(updatedData(prisma).notifyIgnoredCount).toBe(0);
    });
  });

  describe('evaluate — сдвиги уровня', () => {
    it('3 игнора → уровень вниз, счётчик сброшен', async () => {
      const { prisma, notifications, analytics } = makeDeps();
      notifications.lastSentAt.mockResolvedValue(
        new Date('2026-07-01T18:00:00Z'),
      );
      analytics.getDaysSinceLastFill.mockResolvedValue(5);
      const svc = new NotificationCadenceService(
        prisma,
        notifications,
        analytics,
      );
      await svc.evaluate(makeUser({ notifyIgnoredCount: 2 }), NOW);
      const data = updatedData(prisma);
      expect(data.notifyAdaptiveLevel).toBe(1);
      expect(data.notifyIgnoredCount).toBe(0);
    });

    it('уровень 3 — пол, ниже не падает', async () => {
      const { prisma, notifications, analytics } = makeDeps();
      notifications.lastSentAt.mockResolvedValue(
        new Date('2026-07-01T18:00:00Z'),
      );
      analytics.getDaysSinceLastFill.mockResolvedValue(20);
      const svc = new NotificationCadenceService(
        prisma,
        notifications,
        analytics,
      );
      await svc.evaluate(
        makeUser({ notifyAdaptiveLevel: 3, notifyIgnoredCount: 2 }),
        NOW,
      );
      expect(updatedData(prisma).notifyAdaptiveLevel).toBe(3);
    });

    it('ап на один шаг при ≥2 записях за 7 дней', async () => {
      const { prisma, notifications, analytics } = makeDeps();
      analytics.getFillDaysInLast.mockResolvedValue(3);
      const svc = new NotificationCadenceService(
        prisma,
        notifications,
        analytics,
      );
      await svc.evaluate(makeUser({ notifyAdaptiveLevel: 2 }), NOW);
      expect(updatedData(prisma).notifyAdaptiveLevel).toBe(1);
    });

    it('НЕ поднимается ниже потолка notifyFrequency', async () => {
      const { prisma, notifications, analytics } = makeDeps();
      analytics.getFillDaysInLast.mockResolvedValue(7);
      const svc = new NotificationCadenceService(
        prisma,
        notifications,
        analytics,
      );
      await svc.evaluate(
        makeUser({ notifyFrequency: 2, notifyAdaptiveLevel: 2 }),
        NOW,
      );
      expect(updatedData(prisma).notifyAdaptiveLevel).toBe(2);
      expect(analytics.getFillDaysInLast).not.toHaveBeenCalled();
    });

    it('НЕ поднимается при <2 записях за 7 дней', async () => {
      const { prisma, notifications, analytics } = makeDeps();
      analytics.getFillDaysInLast.mockResolvedValue(1);
      const svc = new NotificationCadenceService(
        prisma,
        notifications,
        analytics,
      );
      await svc.evaluate(makeUser({ notifyAdaptiveLevel: 2 }), NOW);
      expect(updatedData(prisma).notifyAdaptiveLevel).toBe(2);
    });
  });

  describe('evaluate — день напоминания', () => {
    it('nextRemindDate=null → сегодня день напоминания', async () => {
      const { prisma, notifications, analytics } = makeDeps();
      const svc = new NotificationCadenceService(
        prisma,
        notifications,
        analytics,
      );
      const { remindToday } = await svc.evaluate(makeUser(), NOW);
      expect(remindToday).toBe(true);
      expect(updatedData(prisma).notifyNextRemindDate).toBe('2026-07-03'); // уровень 0 → завтра
    });

    it('nextRemindDate в будущем → не сегодня', async () => {
      const { prisma, notifications, analytics } = makeDeps();
      const svc = new NotificationCadenceService(
        prisma,
        notifications,
        analytics,
      );
      const { remindToday } = await svc.evaluate(
        makeUser({ notifyNextRemindDate: '2026-07-05' }),
        NOW,
      );
      expect(remindToday).toBe(false);
      expect(updatedData(prisma).notifyNextRemindDate).toBe('2026-07-05');
    });

    it('интервал считается по эффективному уровню (недельный)', async () => {
      const { prisma, notifications, analytics } = makeDeps();
      const svc = new NotificationCadenceService(
        prisma,
        notifications,
        analytics,
      );
      const { remindToday } = await svc.evaluate(
        makeUser({ notifyFrequency: 3 }),
        NOW,
      );
      expect(remindToday).toBe(true);
      expect(updatedData(prisma).notifyNextRemindDate).toBe('2026-07-09');
    });

    it('идемпотентна: повторный прогон в тот же день ничего не меняет', async () => {
      const { prisma, notifications, analytics } = makeDeps();
      const svc = new NotificationCadenceService(
        prisma,
        notifications,
        analytics,
      );
      const { remindToday } = await svc.evaluate(
        makeUser({ notifyLastEvalDate: TODAY_MSK, notifyIgnoredCount: 2 }),
        NOW,
      );
      expect(remindToday).toBe(false);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('пауза', () => {
    it('активная пауза → paused', async () => {
      const { prisma, notifications, analytics } = makeDeps();
      const svc = new NotificationCadenceService(
        prisma,
        notifications,
        analytics,
      );
      const res = await svc.expirePauseIfDue(
        makeUser({ notifyPausedUntil: new Date('2026-07-10T00:00:00Z') }),
        NOW,
      );
      expect(res).toBe('paused');
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('истёкшая пауза → expired, состояние сброшено', async () => {
      const { prisma, notifications, analytics } = makeDeps();
      const svc = new NotificationCadenceService(
        prisma,
        notifications,
        analytics,
      );
      const res = await svc.expirePauseIfDue(
        makeUser({
          notifyPausedUntil: new Date('2026-07-01T00:00:00Z'),
          notifyIgnoredCount: 2,
        }),
        NOW,
      );
      expect(res).toBe('expired');
      const data = updatedData(prisma);
      expect(data.notifyPausedUntil).toBeNull();
      expect(data.notifyIgnoredCount).toBe(0);
      expect(data.notifyNextRemindDate).toBe('2026-07-03');
    });

    it('pause() ставит дату и отменяет только проактивные', async () => {
      const { prisma, notifications, analytics } = makeDeps();
      const svc = new NotificationCadenceService(
        prisma,
        notifications,
        analytics,
      );
      const until = await svc.pause(BigInt(42), 7, NOW);
      expect(until.toISOString()).toBe('2026-07-09T00:05:00.000Z');
      expect(notifications.cancelProactive).toHaveBeenCalledWith(BigInt(42));
    });
  });

  describe('событийные апдейты', () => {
    it('registerFill сбрасывает счётчик и сдвигает следующий контакт', async () => {
      const { prisma, notifications, analytics } = makeDeps();
      prisma.user.findUnique.mockResolvedValue(
        makeUser({ notifyFrequency: 1 }),
      );
      const svc = new NotificationCadenceService(
        prisma,
        notifications,
        analytics,
      );
      await svc.registerFill(BigInt(42), NOW);
      const data = updatedData(prisma);
      expect(data.notifyIgnoredCount).toBe(0);
      expect(data.notifySkipAckDate).toBeNull();
      expect(data.notifyNextRemindDate).toBe('2026-07-04'); // через день
    });

    it('skipToday ставит только skipAck и отменяет pre_reminder', async () => {
      const { prisma, notifications, analytics } = makeDeps();
      const svc = new NotificationCadenceService(
        prisma,
        notifications,
        analytics,
      );
      await svc.skipToday(BigInt(42), NOW);
      expect(updatedData(prisma)).toEqual({ notifySkipAckDate: TODAY_MSK });
      expect(notifications.cancel).toHaveBeenCalledWith(
        BigInt(42),
        'pre_reminder',
      );
    });

    it.each([
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 3],
    ])('slower: с уровня %i на %i', async (from, to) => {
      const { prisma, notifications, analytics } = makeDeps();
      prisma.user.findUnique.mockResolvedValue(
        makeUser({ notifyFrequency: from, notifyAdaptiveLevel: from }),
      );
      const svc = new NotificationCadenceService(
        prisma,
        notifications,
        analytics,
      );
      expect(await svc.slower(BigInt(42), NOW)).toBe(to);
      const data = updatedData(prisma);
      expect(data.notifyFrequency).toBe(to);
      expect(data.notifyAdaptiveLevel).toBe(to);
    });
  });

  describe('effectiveLevel', () => {
    it('берёт максимум из frequency и adaptive', () => {
      expect(
        effectiveLevel({ notifyFrequency: 1, notifyAdaptiveLevel: 2 }),
      ).toBe(2);
      expect(
        effectiveLevel({ notifyFrequency: 3, notifyAdaptiveLevel: 0 }),
      ).toBe(3);
      expect(
        effectiveLevel({ notifyFrequency: 0, notifyAdaptiveLevel: 0 }),
      ).toBe(0);
    });
  });
});
