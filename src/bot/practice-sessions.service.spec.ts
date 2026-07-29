import { PracticeSessionsService } from './practice-sessions.service';

// Read-after-write (правило CLAUDE.md «Тесты»): record() обязан сразу
// показывать актуальное число прохождений именно той практики, что записали
// — не только «сохранилось», а «сохранил → нашёл» на том же ответе.
// Плюс: на чистом аккаунте все три практики — честный 0, а не undefined/NaN
// (groupBy в counts() не возвращает строку для инструмента без прохождений).

function makeDb() {
  const rows: Array<{
    id: number;
    userId: bigint;
    tool: string;
    createdAt: Date;
  }> = [];
  return {
    practiceSession: {
      create: jest.fn(async ({ data }: any) => {
        const row = { id: rows.length + 1, createdAt: new Date(), ...data };
        rows.push(row);
        return row;
      }),
      count: jest.fn(
        async ({ where }: any) =>
          rows.filter((r) => r.userId === where.userId && r.tool === where.tool)
            .length,
      ),
      groupBy: jest.fn(async ({ where }: any) => {
        const filtered = rows.filter((r) => r.userId === where.userId);
        const byTool = new Map<string, number>();
        for (const r of filtered) {
          byTool.set(r.tool, (byTool.get(r.tool) ?? 0) + 1);
        }
        return [...byTool.entries()].map(([tool, c]) => ({
          tool,
          _count: { _all: c },
        }));
      }),
    },
    _rows: rows,
  };
}

describe('PracticeSessionsService', () => {
  it('чистый аккаунт: все три практики — честный 0, не undefined/NaN', async () => {
    const svc = new PracticeSessionsService(makeDb() as any);
    const counts = await svc.counts(1n);
    expect(counts).toEqual({ breathing: 0, grounding: 0, stop: 0 });
  });

  it('read-after-write: record() сразу возвращает актуальное число ИМЕННО этой практики', async () => {
    const db = makeDb();
    const svc = new PracticeSessionsService(db as any);

    const first = await svc.record(1n, 'breathing');
    expect(first).toEqual({ count: 1 });
    const second = await svc.record(1n, 'breathing');
    expect(second).toEqual({ count: 2 });

    // остальные практики того же юзера не затронуты
    const counts = await svc.counts(1n);
    expect(counts).toEqual({ breathing: 2, grounding: 0, stop: 0 });
  });

  it('прохождения разных инструментов считаются раздельно', async () => {
    const db = makeDb();
    const svc = new PracticeSessionsService(db as any);

    await svc.record(1n, 'breathing');
    await svc.record(1n, 'grounding');
    await svc.record(1n, 'grounding');
    await svc.record(1n, 'stop');

    expect(await svc.counts(1n)).toEqual({
      breathing: 1,
      grounding: 2,
      stop: 1,
    });
  });

  it('счётчики не путают юзеров', async () => {
    const db = makeDb();
    const svc = new PracticeSessionsService(db as any);

    await svc.record(1n, 'breathing');
    await svc.record(2n, 'breathing');
    await svc.record(2n, 'breathing');

    expect(await svc.counts(1n)).toEqual({
      breathing: 1,
      grounding: 0,
      stop: 0,
    });
    expect(await svc.counts(2n)).toEqual({
      breathing: 2,
      grounding: 0,
      stop: 0,
    });
  });
});
