// D-6 аудита 2026-10: UserTask.assignedBy и LoginTicket.approvedUserId не
// переносились при слиянии. Проверяем и сам хелпер (SQL + значения), и то, что
// merge() его реально вызывает — внутри транзакции и до удаления source.
import { remapAssignerRefs } from './merge-assigner-refs';
import { MergeService } from './merge.service';

type Call = { sql: string; values: unknown[] };
const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

function fakeTx() {
  const calls: Call[] = [];
  const tx = {
    $executeRaw: jest.fn((q: { sql: string; values: unknown[] }) => {
      calls.push({ sql: norm(q.sql), values: q.values });
      return Promise.resolve(0);
    }),
  };
  return { tx, calls };
}

describe('remapAssignerRefs', () => {
  it('переписывает assignedBy и approvedUserId с source на target (и только их)', async () => {
    const { tx, calls } = fakeTx();
    await remapAssignerRefs(tx as never, 111n, 222n);
    expect(calls).toEqual([
      {
        sql: 'UPDATE "UserTask" SET "assignedBy" = ? WHERE "assignedBy" = ?',
        values: [222n, 111n],
      },
      {
        sql: 'UPDATE "LoginTicket" SET "approvedUserId" = ? WHERE "approvedUserId" = ?',
        values: [222n, 111n],
      },
    ]);
  });
});

describe('MergeService.merge вызывает remapAssignerRefs', () => {
  it('UPDATE assignedBy/approvedUserId идут в транзакции ДО удаления User source', async () => {
    const { tx, calls } = fakeTx();
    const prisma = {
      $transaction: (fn: (t: unknown) => Promise<void>) => fn(tx),
      // recoveryEmail/флаги и подписки читают то, что мерж-хелперы просят у tx:
    };
    const withReads = {
      ...tx,
      $queryRaw: jest.fn().mockResolvedValue([]),
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
      subscription: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn(),
      },
    };
    prisma.$transaction = (fn) => fn(withReads);
    const svc = new MergeService(prisma as never, { log: jest.fn() } as never);
    await svc.merge(111n, 222n).catch(() => undefined);

    const idx = (needle: string) =>
      calls.findIndex((c) => c.sql.includes(needle));
    expect(idx('UPDATE "UserTask" SET "assignedBy"')).toBeGreaterThanOrEqual(0);
    expect(
      idx('UPDATE "LoginTicket" SET "approvedUserId"'),
    ).toBeGreaterThanOrEqual(0);
    expect(idx('UPDATE "UserTask" SET "assignedBy"')).toBeLessThan(
      idx('DELETE FROM "User"'),
    );
  });
});
