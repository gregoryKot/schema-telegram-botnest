// TherapistExitService: отказ терапевта от роли (переехал из AccountService)
// и счётчик для /stats (правило №8): событие therapist_resigned пишется ПОСЛЕ
// успешной транзакции, с числом завершённых связей с клиентами.
import type { PrismaService } from '../prisma/prisma.service';
import type { AnalyticsService } from '../analytics/analytics.service';
import { TherapistExitService } from './therapist-exit.service';
import { THERAPIST_RESIGNED } from './relation-end-reason';

const uid = 777n;

function makeTx(relCounts: number[] = [3, 1]) {
  const calls = [...relCounts];
  return {
    user: { update: jest.fn(() => Promise.resolve({})) },
    therapistRequest: {
      deleteMany: jest.fn(() => Promise.resolve({ count: 1 })),
    },
    therapyRelation: {
      updateMany: jest.fn(() => Promise.resolve({ count: calls.shift() ?? 0 })),
    },
  };
}

function makeService(tx: ReturnType<typeof makeTx>) {
  const $transaction = jest.fn((fn: (t: typeof tx) => unknown) => fn(tx));
  const track = jest.fn(() => Promise.resolve());
  const service = new TherapistExitService(
    { $transaction } as unknown as PrismaService,
    { track } as unknown as AnalyticsService,
  );
  return { service, $transaction, track };
}

describe('TherapistExitService.resign', () => {
  it('CLIENT + therapistMode=false + удаление заявки + завершение связей в одной транзакции', async () => {
    const tx = makeTx();
    const { service, $transaction } = makeService(tx);
    await service.resign(uid);
    expect($transaction).toHaveBeenCalledTimes(1);
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: uid },
      data: { role: 'CLIENT', therapistMode: false },
    });
    // Заявка удаляется, иначе status 'approved' заблокирует повторную подачу.
    expect(tx.therapistRequest.deleteMany).toHaveBeenCalledWith({
      where: { userId: uid },
    });
    // backend#33: связи завершаются (не удаляются) с причиной для клиента.
    for (const [arg] of tx.therapyRelation.updateMany.mock.calls as unknown as [
      { where: { therapistId: bigint }; data: { endReason: string } },
    ][]) {
      expect(arg.where.therapistId).toBe(uid);
      expect(arg.data).toMatchObject({
        status: 'ended',
        endReason: THERAPIST_RESIGNED,
      });
    }
  });

  it('после транзакции — событие therapist_resigned с числом клиентов', async () => {
    const { service, track } = makeService(makeTx([4, 2]));
    await service.resign(uid);
    expect(track).toHaveBeenCalledWith(uid, 'therapist_resigned', {
      clientsEnded: 4,
    });
  });

  it('сбой транзакции: ошибка уходит наружу, событие не пишется', async () => {
    const tx = makeTx();
    tx.therapyRelation.updateMany.mockImplementation(() =>
      Promise.reject(new Error('db down')),
    );
    const { service, track } = makeService(tx);
    await expect(service.resign(uid)).rejects.toThrow('db down');
    expect(track).not.toHaveBeenCalled();
  });
});

describe('TherapistExitService.formerTherapist', () => {
  it('спрашивает связи именно этого клиента', async () => {
    const count = jest.fn(() => Promise.resolve(1));
    const service = new TherapistExitService(
      { therapyRelation: { count } } as unknown as PrismaService,
      { track: jest.fn() } as unknown as AnalyticsService,
    );
    expect(await service.formerTherapist(42n)).toBeNull();
    expect(count).toHaveBeenCalledWith({
      where: { clientId: 42n, status: { in: ['active', 'pending'] } },
    });
  });
});
