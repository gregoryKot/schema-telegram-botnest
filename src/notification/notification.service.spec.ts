import { NotificationService } from './notification.service';

function makePrisma() {
  return {
    scheduledNotification: {
      create: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
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
      await svc.schedule(42n, 'reminder', sendAt);
      expect(prisma.scheduledNotification.create).toHaveBeenCalledWith({
        data: { userId: BigInt(42), type: 'reminder', sendAt, payload: undefined },
      });
    });

    it('stores payload when provided', async () => {
      const prisma = makePrisma();
      const svc = new NotificationService(prisma);
      await svc.schedule(1n, 'summary', new Date(), { text: 'hello' });
      expect(prisma.scheduledNotification.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ payload: { text: 'hello' } }) }),
      );
    });
  });

  describe('cancel', () => {
    it('sets cancelledAt on pending notifications', async () => {
      const prisma = makePrisma();
      const svc = new NotificationService(prisma);
      await svc.cancel(42n, 'reminder');
      expect(prisma.scheduledNotification.updateMany).toHaveBeenCalledWith({
        where: { userId: BigInt(42), type: 'reminder', sentAt: null, cancelledAt: null },
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
        where: { sendAt: { lte: expect.any(Date) }, sentAt: null, cancelledAt: null },
        orderBy: { sendAt: 'asc' },
      });
    });

    it('конвертирует userId из bigint в number в результате', async () => {
      const prisma = makePrisma();
      const sendAt = new Date();
      prisma.scheduledNotification.findMany.mockResolvedValue([
        { id: 1, userId: 42n, type: 'reminder', sendAt },
      ]);
      const svc = new NotificationService(prisma);
      const due = await svc.getDue();
      expect(due).toEqual([{ id: 1, userId: 42, type: 'reminder', sendAt }]);
      expect(typeof due[0].userId).toBe('number');
    });
  });

  describe('markSent', () => {
    it('идемпотентно помечает sentAt через updateMany (where id + ещё не отправлено)', async () => {
      const prisma = makePrisma();
      const svc = new NotificationService(prisma);
      await svc.markSent(7);
      // updateMany, а не update — двойной вызов не кидает P2025 (две конкурентные обработки безопасны)
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
      expect(await svc.hasPending(1n, 'reminder')).toBe(false);
    });

    it('returns true when count > 0', async () => {
      const prisma = makePrisma();
      prisma.scheduledNotification.count.mockResolvedValue(1);
      const svc = new NotificationService(prisma);
      expect(await svc.hasPending(1n, 'reminder')).toBe(true);
    });
  });

  describe('cancelAll', () => {
    it('cancels all pending notifications for user', async () => {
      const prisma = makePrisma();
      const svc = new NotificationService(prisma);
      await svc.cancelAll(99n);
      expect(prisma.scheduledNotification.updateMany).toHaveBeenCalledWith({
        where: { userId: BigInt(99), sentAt: null, cancelledAt: null },
        data: expect.objectContaining({ cancelledAt: expect.any(Date) }),
      });
    });
  });
});
