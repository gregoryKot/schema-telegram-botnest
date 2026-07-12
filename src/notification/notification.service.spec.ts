import { NotificationService, PROACTIVE_TYPES } from './notification.service';

function makePrisma() {
  return {
    scheduledNotification: {
      create: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
    },
  } as any;
}

describe('NotificationService', () => {
  describe('schedule', () => {
    it('creates a scheduled notification', async () => {
      const prisma = makePrisma();
      const svc = new NotificationService(prisma);
      const sendAt = new Date('2025-06-11T19:00:00Z');
      await svc.schedule(BigInt(42), 'reminder', sendAt);
      expect(prisma.scheduledNotification.create).toHaveBeenCalledWith({
        data: {
          userId: BigInt(42),
          type: 'reminder',
          sendAt,
          payload: undefined,
        },
      });
    });

    it('stores payload when provided', async () => {
      const prisma = makePrisma();
      const svc = new NotificationService(prisma);
      await svc.schedule(BigInt(1), 'summary', new Date(), { text: 'hello' });
      expect(prisma.scheduledNotification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ payload: { text: 'hello' } }),
        }),
      );
    });
  });

  describe('cancel', () => {
    it('sets cancelledAt on pending notifications', async () => {
      const prisma = makePrisma();
      const svc = new NotificationService(prisma);
      await svc.cancel(BigInt(42), 'reminder');
      expect(prisma.scheduledNotification.updateMany).toHaveBeenCalledWith({
        where: {
          userId: BigInt(42),
          type: 'reminder',
          sentAt: null,
          cancelledAt: null,
        },
        data: expect.objectContaining({ cancelledAt: expect.any(Date) }),
      });
    });
  });

  describe('getDue', () => {
    it('queries notifications where sendAt <= now, not sent, not cancelled', async () => {
      const prisma = makePrisma();
      const svc = new NotificationService(prisma);
      await svc.getDue();
      expect(prisma.scheduledNotification.findMany).toHaveBeenCalledWith({
        where: {
          sendAt: { lte: expect.any(Date) },
          sentAt: null,
          cancelledAt: null,
        },
        orderBy: { sendAt: 'asc' },
      });
    });

    it('returns rows with numeric userId', async () => {
      const prisma = makePrisma();
      const row = {
        id: 1,
        userId: BigInt(42),
        type: 'reminder',
        sendAt: new Date(),
      };
      prisma.scheduledNotification.findMany.mockResolvedValue([row]);
      const svc = new NotificationService(prisma);
      expect(await svc.getDue()).toEqual([{ ...row, userId: 42 }]);
    });
  });

  describe('markSent', () => {
    it('sets sentAt only on not-yet-sent rows (idempotent)', async () => {
      const prisma = makePrisma();
      const svc = new NotificationService(prisma);
      await svc.markSent(7);
      expect(prisma.scheduledNotification.updateMany).toHaveBeenCalledWith({
        where: { id: 7, sentAt: null },
        data: expect.objectContaining({ sentAt: expect.any(Date) }),
      });
    });
  });

  describe('hasPending', () => {
    it('returns false when count is 0', async () => {
      const prisma = makePrisma();
      const svc = new NotificationService(prisma);
      expect(await svc.hasPending(BigInt(1), 'reminder')).toBe(false);
    });

    it('returns true when count > 0', async () => {
      const prisma = makePrisma();
      prisma.scheduledNotification.count.mockResolvedValue(1);
      const svc = new NotificationService(prisma);
      expect(await svc.hasPending(BigInt(1), 'reminder')).toBe(true);
    });
  });

  describe('cancelAll', () => {
    it('cancels all pending notifications for user', async () => {
      const prisma = makePrisma();
      const svc = new NotificationService(prisma);
      await svc.cancelAll(BigInt(99));
      expect(prisma.scheduledNotification.updateMany).toHaveBeenCalledWith({
        where: { userId: BigInt(99), sentAt: null, cancelledAt: null },
        data: expect.objectContaining({ cancelledAt: expect.any(Date) }),
      });
    });
  });

  describe('cancelProactive', () => {
    it('cancels only proactive types', async () => {
      const prisma = makePrisma();
      const svc = new NotificationService(prisma);
      await svc.cancelProactive(BigInt(5));
      expect(prisma.scheduledNotification.updateMany).toHaveBeenCalledWith({
        where: {
          userId: BigInt(5),
          type: { in: PROACTIVE_TYPES },
          sentAt: null,
          cancelledAt: null,
        },
        data: expect.objectContaining({ cancelledAt: expect.any(Date) }),
      });
    });

    it('proactive set does not include reactive types', () => {
      for (const t of [
        'summary',
        'comeback',
        'task_assigned',
        'ysq_requested',
        'streak_7',
      ]) {
        expect(PROACTIVE_TYPES).not.toContain(t);
      }
    });
  });

  describe('lastSentAt', () => {
    it('returns null when nothing was sent', async () => {
      const prisma = makePrisma();
      const svc = new NotificationService(prisma);
      expect(await svc.lastSentAt(BigInt(1), 'reminder')).toBeNull();
    });

    it('returns the latest sentAt', async () => {
      const prisma = makePrisma();
      const sentAt = new Date('2026-07-01T18:00:00Z');
      prisma.scheduledNotification.findFirst.mockResolvedValue({ sentAt });
      const svc = new NotificationService(prisma);
      expect(await svc.lastSentAt(BigInt(1), 'reminder')).toEqual(sentAt);
    });
  });

  describe('defer', () => {
    it('moves sendAt only for unsent rows', async () => {
      const prisma = makePrisma();
      const svc = new NotificationService(prisma);
      const sendAt = new Date('2026-07-03T05:00:00Z');
      await svc.defer(3, sendAt);
      expect(prisma.scheduledNotification.updateMany).toHaveBeenCalledWith({
        where: { id: 3, sentAt: null },
        data: { sendAt },
      });
    });
  });
});
