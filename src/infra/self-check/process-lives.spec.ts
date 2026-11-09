// Жизни процессов в базе (process-lives.ts): прошлый процесс записал свою
// отметку — следующий её прочитал («сохранил → нашёл»). База — фейк в памяти
// с семантикой запросов Prisma, которые зовёт модуль.
import {
  LIVES_KEEP_MS,
  syncProcessLives,
  type ThisProcess,
} from './process-lives';
import type { PrismaService } from '../../prisma/prisma.service';

type Row = {
  id: string;
  startedAt: Date;
  seenAt: Date;
  dbFailureAt: Date | null;
};

function memoryDb() {
  const rows = new Map<string, Row>();
  const processLife = {
    upsert: jest.fn(
      async (q: {
        where: { id: string };
        create: Row;
        update: Partial<Row>;
      }) => {
        const was = rows.get(q.where.id);
        rows.set(q.where.id, was ? { ...was, ...q.update } : q.create);
      },
    ),
    deleteMany: jest.fn(async (q: { where: { seenAt: { lt: Date } } }) => {
      for (const [id, r] of rows)
        if (r.seenAt < q.where.seenAt.lt) rows.delete(id);
    }),
    findMany: jest.fn(async (q: { where: { id: { not: string } } }) =>
      [...rows.values()].filter((r) => r.id !== q.where.id.not),
    ),
  };
  return { rows, prisma: { processLife } as unknown as PrismaService };
}

const at = (s: string) => new Date(s).getTime();
const me = (p: Partial<ThisProcess> & { now: number }): ThisProcess => ({
  startedAt: at('2026-11-02T10:00:00Z'),
  failures: [],
  ...p,
});

describe('syncProcessLives', () => {
  it('прошлый процесс отметился — следующий видит его отрезок жизни', async () => {
    const { prisma } = memoryDb();
    const old = me({ now: at('2026-11-02T15:00:00Z') });
    expect(await syncProcessLives(prisma, old, 'app-1')).toEqual([]);

    const fresh = me({
      startedAt: at('2026-11-02T16:00:00Z'),
      now: at('2026-11-02T16:01:00Z'),
    });
    expect(await syncProcessLives(prisma, fresh, 'app-2')).toEqual([
      { from: at('2026-11-02T10:00:00Z'), to: at('2026-11-02T15:00:00Z') },
    ]);
  });

  it('повторная отметка двигает конец жизни, а не начало', async () => {
    const { prisma, rows } = memoryDb();
    await syncProcessLives(
      prisma,
      me({ now: at('2026-11-02T11:00:00Z') }),
      'a',
    );
    await syncProcessLives(
      prisma,
      me({ now: at('2026-11-02T12:00:00Z') }),
      'a',
    );
    expect([...rows.values()]).toEqual([
      expect.objectContaining({
        startedAt: new Date('2026-11-02T10:00:00Z'),
        seenAt: new Date('2026-11-02T12:00:00Z'),
      }),
    ]);
  });

  it('перезапуск того же контейнера (тот же HOSTNAME) — новая жизнь', async () => {
    const { prisma, rows } = memoryDb();
    await syncProcessLives(
      prisma,
      me({ now: at('2026-11-02T11:00:00Z') }),
      'a',
    );
    const restarted = me({
      startedAt: at('2026-11-02T13:00:00Z'),
      now: at('2026-11-02T13:01:00Z'),
    });
    const earlier = await syncProcessLives(prisma, restarted, 'a');
    expect(rows.size).toBe(2);
    expect(earlier).toEqual([
      { from: at('2026-11-02T10:00:00Z'), to: at('2026-11-02T11:00:00Z') },
    ]);
  });

  it('отказ базы сдвигает начало отрезка: тики до него прощаются', async () => {
    const { prisma } = memoryDb();
    const failures = [
      undefined,
      at('2026-11-02T12:30:00Z'),
      at('2026-11-02T12:10:00Z'),
    ];
    await syncProcessLives(
      prisma,
      me({ now: at('2026-11-02T14:00:00Z'), failures }),
      'a',
    );
    const next = me({
      startedAt: at('2026-11-02T15:00:00Z'),
      now: at('2026-11-02T15:01:00Z'),
    });
    expect(await syncProcessLives(prisma, next, 'b')).toEqual([
      { from: at('2026-11-02T12:30:00Z'), to: at('2026-11-02T14:00:00Z') },
    ]);
  });

  it('отметки старше срока хранения удаляются', async () => {
    const { prisma, rows } = memoryDb();
    await syncProcessLives(
      prisma,
      me({ now: at('2026-11-01T00:00:00Z') }),
      'a',
    );
    const later = at('2026-11-01T00:00:00Z') + LIVES_KEEP_MS + 60_000;
    await syncProcessLives(
      prisma,
      me({ startedAt: later - 60_000, now: later }),
      'b',
    );
    expect([...rows.keys()]).toEqual([
      `b@${new Date(later - 60_000).toISOString()}`,
    ]);
  });
});
