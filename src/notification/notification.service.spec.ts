import { NotificationService, PROACTIVE_TYPES } from './notification.service';
import { createFakeTable } from '../test-support/fake-prisma.spec-helper';

function makePrisma() {
  return {
    scheduledNotification: createFakeTable(),
  } as any;
}

// ── Stateful in-memory fake (общий src/test-support/fake-prisma.spec-helper.ts,
// этап 2.4 TEST_IMPROVEMENT_PLAN.md) ────────────────────────────────────────
// Instead of mirroring the service's where-clause via toHaveBeenCalledWith
// (a change to the clause and its test happen in the same PR by the same
// person and prove nothing), this fake actually applies the where-semantics
// to a rows array and we assert on what getDue()/markSent() RETURN or MUTATE.
type Row = {
  id: number;
  userId: bigint;
  type: string;
  sendAt: Date;
  sentAt: Date | null;
  cancelledAt: Date | null;
  payload: unknown;
};

function makeStatefulPrisma(rows: Row[]) {
  return {
    scheduledNotification: createFakeTable(rows),
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
    const now = Date.now();
    const base = (over: Partial<Row>): Row => ({
      id: 0,
      userId: BigInt(1),
      type: 'reminder',
      sendAt: new Date(now - 1_000),
      sentAt: null,
      cancelledAt: null,
      payload: null,
      ...over,
    });

    it('returns only due rows: sendAt in the past, not sent, not cancelled — with numeric userId', async () => {
      const due = base({ id: 1, userId: BigInt(42) });
      const future = base({ id: 2, sendAt: new Date(now + 100_000) }); // not due yet
      const alreadySent = base({ id: 3, sentAt: new Date(now - 500) });
      const cancelled = base({ id: 4, cancelledAt: new Date(now - 500) });
      const rows = [due, future, alreadySent, cancelled];

      const prisma = makeStatefulPrisma(rows);
      const svc = new NotificationService(prisma);
      const result = await svc.getDue();

      expect(result).toEqual([{ ...due, userId: 42 }]);
    });

    it('orders due rows by sendAt ascending', async () => {
      const later = base({ id: 1, sendAt: new Date(now - 1_000) });
      const earlier = base({ id: 2, sendAt: new Date(now - 5_000) });
      const rows = [later, earlier];

      const prisma = makeStatefulPrisma(rows);
      const svc = new NotificationService(prisma);
      const result = await svc.getDue();

      expect(result.map((r) => r.id)).toEqual([2, 1]);
    });
  });

  describe('markSent', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it('sets sentAt on the row', async () => {
      const row: Row = {
        id: 7,
        userId: BigInt(1),
        type: 'reminder',
        sendAt: new Date('2026-07-01T09:00:00Z'),
        sentAt: null,
        cancelledAt: null,
        payload: null,
      };
      const prisma = makeStatefulPrisma([row]);
      const svc = new NotificationService(prisma);

      await svc.markSent(7);

      expect(row.sentAt).toBeInstanceOf(Date);
    });

    it('is idempotent: a second call does not move sentAt (behavioral, not just call-shape)', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-07-01T10:00:00Z'));

      const row: Row = {
        id: 7,
        userId: BigInt(1),
        type: 'reminder',
        sendAt: new Date('2026-07-01T09:00:00Z'),
        sentAt: null,
        cancelledAt: null,
        payload: null,
      };
      const prisma = makeStatefulPrisma([row]);
      const svc = new NotificationService(prisma);

      await svc.markSent(7);
      expect(row.sentAt).toEqual(new Date('2026-07-01T10:00:00Z'));

      // Time moves on, but the row is already sent — a naive implementation
      // without the `sentAt: null` guard would overwrite sentAt here.
      jest.setSystemTime(new Date('2026-07-01T11:00:00Z'));
      await svc.markSent(7);

      expect(row.sentAt).toEqual(new Date('2026-07-01T10:00:00Z'));
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
