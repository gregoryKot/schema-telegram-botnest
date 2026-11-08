// Ленивое закрытие просроченной серии — один код для /tasks клиента и
// обзоров психолога (хвост волны 3). Сквозные сценарии «психолог прочитал →
// клиент нашёл» — в therapy-tasks-view.service.spec.ts.
import { closeExpiredStreaks } from './streak-expire';

const NOW = new Date('2026-11-05T09:00:00Z');
const task = (over: Record<string, unknown> = {}) => ({
  id: 1,
  done: null as boolean | null,
  completedAt: null as Date | null,
  targetDays: 3 as number | null,
  createdAt: new Date('2026-11-01T09:00:00Z'), // окно 1–3 ноября
  ...over,
});

function makePrisma(rows: Array<ReturnType<typeof task>>) {
  const updateMany = jest.fn(
    ({ where, data }: { where: { id: number; done: null }; data: object }) => {
      const hits = rows.filter((r) => r.id === where.id && r.done === null);
      hits.forEach((r) => Object.assign(r, data));
      return Promise.resolve({ count: hits.length });
    },
  );
  return { prisma: { userTask: { updateMany } } as never, updateMany };
}

describe('closeExpiredStreaks', () => {
  it('срок вышел — закрывает «не вышло» в БД и в ответе', async () => {
    const db = [task()];
    const { prisma, updateMany } = makePrisma(db);
    const [out] = await closeExpiredStreaks(
      prisma,
      [task()],
      'Europe/Moscow',
      NOW,
    );
    expect(out).toMatchObject({ done: false, completedAt: NOW });
    expect(db[0]).toMatchObject({ done: false, completedAt: NOW });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 1, done: null },
      data: { done: false, completedAt: NOW },
    });
  });

  it('в окне, без числа дней, уже закрытое — не трогает и не пишет', async () => {
    const { prisma, updateMany } = makePrisma([]);
    const rows = [
      task({ id: 1, createdAt: new Date('2026-11-04T09:00:00Z') }),
      task({ id: 2, targetDays: null }),
      task({
        id: 3,
        done: true,
        completedAt: new Date('2026-11-02T09:00:00Z'),
      }),
    ];
    const out = await closeExpiredStreaks(prisma, rows, 'Europe/Moscow', NOW);
    expect(out).toEqual(rows);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('без пояса (виртуальный клиент) — как есть', async () => {
    const { prisma, updateMany } = makePrisma([]);
    const rows = [task()];
    expect(await closeExpiredStreaks(prisma, rows, undefined, NOW)).toBe(rows);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('«выполнено», пришедшее между чтением и записью, не перетирается', async () => {
    const db = [
      task({ done: true, completedAt: new Date('2026-11-03T09:00:00Z') }),
    ];
    const { prisma } = makePrisma(db);
    await closeExpiredStreaks(prisma, [task()], 'Europe/Moscow', NOW);
    expect(db[0].done).toBe(true);
  });
});
