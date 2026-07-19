import { PairsService } from './pairs.service';

// Stateful in-memory fake Prisma для Pair. Приоритет: связь двух юзеров
// симметрична (оба видят друг друга как partnerId) и идемпотентна
// (повторный createPairInvite не плодит новые pending-пары).
function makeDb() {
  const pairs: any[] = [];

  const db: any = {
    pair: {
      findFirst: jest.fn(({ where, orderBy }: any) => {
        let rows = pairs.filter((p) => matchesWhere(p, where));
        if (orderBy?.createdAt === 'desc') {
          rows = [...rows].sort((a, b) => b.createdAt - a.createdAt);
        }
        return rows[0] ?? null;
      }),
      findMany: jest.fn(({ where, orderBy }: any) => {
        let rows = pairs.filter((p) => matchesWhere(p, where));
        if (orderBy?.createdAt === 'desc') {
          rows = [...rows].sort((a, b) => b.createdAt - a.createdAt);
        }
        return rows;
      }),
      findUnique: jest.fn(
        ({ where }: any) => pairs.find((p) => p.code === where.code) ?? null,
      ),
      create: jest.fn(({ data }: any) => {
        const row = {
          userId2: null,
          status: 'pending',
          createdAt: new Date(Date.now() + pairs.length),
          ...data,
        };
        pairs.push(row);
        return row;
      }),
      updateMany: jest.fn(({ where, data }: any) => {
        const matched = pairs.filter(
          (p) =>
            p.code === where.code &&
            p.status === where.status &&
            p.userId2 === where.userId2,
        );
        matched.forEach((p) => Object.assign(p, data));
        return { count: matched.length };
      }),
      update: jest.fn(({ where, data }: any) => {
        const row = pairs.find((p) => p.code === where.code);
        Object.assign(row, data);
        return row;
      }),
      delete: jest.fn(({ where }: any) => {
        const idx = pairs.findIndex((p) => p.code === where.code);
        const [row] = pairs.splice(idx, 1);
        return row;
      }),
    },
    _pairs: pairs,
  };
  return db;

  function matchesWhere(p: any, where: any): boolean {
    if (where.OR) return where.OR.some((cond: any) => matchesWhere(p, cond));
    return Object.entries(where).every(([k, v]) => p[k] === v);
  }
}

describe('PairsService — создание приглашения идемпотентно', () => {
  it('повторный createPairInvite с pending-парой возвращает тот же код', async () => {
    const db = makeDb();
    const svc = new PairsService(db);

    const code1 = await svc.createPairInvite(1n);
    const code2 = await svc.createPairInvite(1n);

    expect(code2).toBe(code1);
    expect(db._pairs.length).toBe(1);
  });
});

describe('PairsService — join/leave симметричны для обеих сторон', () => {
  it('после joinPair оба юзера видят друг друга как партнёра', async () => {
    const db = makeDb();
    const svc = new PairsService(db);
    const code = await svc.createPairInvite(1n);

    const ok = await svc.joinPair(2n, code);
    expect(ok).toBe(true);

    const creatorView = await svc.getUserPair(1n);
    const joinerView = await svc.getUserPair(2n);

    expect(creatorView?.partnerId).toBe(2);
    expect(creatorView?.isCreator).toBe(true);
    expect(joinerView?.partnerId).toBe(1);
    expect(joinerView?.isCreator).toBe(false);
    expect(creatorView?.status).toBe('active');
    expect(joinerView?.status).toBe('active');
  });

  it('создатель не может присоединиться к своему же коду', async () => {
    const db = makeDb();
    const svc = new PairsService(db);
    const code = await svc.createPairInvite(1n);

    expect(await svc.joinPair(1n, code)).toBe(false);
  });

  it('уже занятый (active) код повторно не занимается вторым претендентом', async () => {
    const db = makeDb();
    const svc = new PairsService(db);
    const code = await svc.createPairInvite(1n);
    await svc.joinPair(2n, code);

    expect(await svc.joinPair(3n, code)).toBe(false);
  });

  it('leavePair создателем удаляет пару целиком — для обоих', async () => {
    const db = makeDb();
    const svc = new PairsService(db);
    const code = await svc.createPairInvite(1n);
    await svc.joinPair(2n, code);

    await svc.leavePair(1n, code);

    expect(await svc.getUserPair(1n)).toBeNull();
    expect(await svc.getUserPair(2n)).toBeNull();
  });

  it('leavePair присоединившимся освобождает слот — пара снова pending для создателя', async () => {
    const db = makeDb();
    const svc = new PairsService(db);
    const code = await svc.createPairInvite(1n);
    await svc.joinPair(2n, code);

    await svc.leavePair(2n, code);

    const creatorView = await svc.getUserPair(1n);
    expect(creatorView?.status).toBe('pending');
    expect(creatorView?.partnerId).toBeNull();
    expect(await svc.getUserPair(2n)).toBeNull();
  });
});

describe('PairsService.getUserPairs — список всех пар юзера', () => {
  it('возвращает несколько pending-приглашений отдельно', async () => {
    const db = makeDb();
    const svc = new PairsService(db);
    db._pairs.push(
      {
        code: 'AAA',
        userId1: 1n,
        userId2: null,
        status: 'pending',
        createdAt: new Date(1),
      },
      {
        code: 'BBB',
        userId1: 1n,
        userId2: 3n,
        status: 'active',
        createdAt: new Date(2),
      },
    );

    const pairs = await svc.getUserPairs(1n);

    expect(pairs).toHaveLength(2);
    expect(pairs.map((p) => p.code).sort()).toEqual(['AAA', 'BBB']);
  });
});
