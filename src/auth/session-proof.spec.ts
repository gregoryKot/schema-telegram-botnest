// Сессия этого браузера при включении 2FA (S12): какая кука считается «своей
// живой» и что гасится. Фейк WebSession отдаёт только поля из `select` и
// фильтрует по `where`, как Prisma, — иначе запрос можно обеднить незаметно.
import { hashToken } from './email.util';
import { currentFamily, revokeOtherSessions } from './session-proof';

const NOW = new Date('2026-11-08T12:00:00Z');
const HOUR = 3_600_000;

type Row = {
  tokenHash: string;
  userId: bigint;
  family: string;
  revokedAt: Date | null;
  expiresAt: Date;
};
type Where = {
  userId: bigint;
  revokedAt: null;
  NOT?: { family: string };
};

const row = (raw: string, userId: bigint, over: Partial<Row> = {}): Row => ({
  tokenHash: hashToken(raw),
  userId,
  family: `f-${raw}`,
  revokedAt: null,
  expiresAt: new Date(+NOW + HOUR),
  ...over,
});

function makePrisma(rows: Row[]) {
  const findUnique = ({
    where,
    select,
  }: {
    where: { tokenHash: string };
    select: Partial<Record<keyof Row, boolean>>;
  }) => {
    const hit = rows.find((r) => r.tokenHash === where.tokenHash);
    if (!hit) return Promise.resolve(null);
    const picked = Object.entries(hit).filter(
      ([k]) => select[k as keyof Row] === true,
    );
    return Promise.resolve(Object.fromEntries(picked));
  };
  const updateMany = ({
    where,
    data,
  }: {
    where: Where;
    data: { revokedAt: Date };
  }) => {
    const hit = rows.filter(
      (r) =>
        r.userId === where.userId &&
        r.revokedAt === where.revokedAt &&
        r.family !== where.NOT?.family,
    );
    hit.forEach((r) => (r.revokedAt = data.revokedAt));
    return Promise.resolve({ count: hit.length });
  };
  return { webSession: { findUnique, updateMany } } as never;
}

beforeAll(() => {
  jest.useFakeTimers().setSystemTime(NOW);
});
afterAll(() => {
  jest.useRealTimers();
});

describe('currentFamily — чья кука и жива ли', () => {
  it('своя живая кука → её семья', async () => {
    const prisma = makePrisma([row('mine', 1n)]);
    expect(await currentFamily(prisma, 'mine', 1n)).toBe('f-mine');
  });

  it('куки нет или такой сессии не было → null', async () => {
    const prisma = makePrisma([row('mine', 1n)]);
    expect(await currentFamily(prisma, undefined, 1n)).toBeNull();
    expect(await currentFamily(prisma, 'unknown', 1n)).toBeNull();
  });

  it('отозванная кука своей не считается', async () => {
    const prisma = makePrisma([row('mine', 1n, { revokedAt: NOW })]);
    expect(await currentFamily(prisma, 'mine', 1n)).toBeNull();
  });

  it('истёкшая кука своей не считается', async () => {
    const past = new Date(+NOW - HOUR);
    const prisma = makePrisma([row('mine', 1n, { expiresAt: past })]);
    expect(await currentFamily(prisma, 'mine', 1n)).toBeNull();
  });

  it('живая кука другого аккаунта своей не считается', async () => {
    const prisma = makePrisma([row('alien', 2n)]);
    expect(await currentFamily(prisma, 'alien', 1n)).toBeNull();
  });
});

describe('revokeOtherSessions — что гасится при включении 2FA', () => {
  it('семья текущей куки остаётся, остальные гаснут текущим моментом', async () => {
    const rows = [row('mine', 1n), row('thief', 1n), row('other-user', 2n)];
    expect(await revokeOtherSessions(makePrisma(rows), 1n, 'mine')).toBe(1);
    expect(rows.map((r) => r.revokedAt)).toEqual([null, NOW, null]);
  });

  it('мёртвая кука семью не спасает: отозванная или истёкшая — гаснут все', async () => {
    const past = new Date(+NOW - HOUR);
    const rows = [
      row('revoked', 1n, { revokedAt: past }),
      row('same-family', 1n, { family: 'f-revoked' }),
      row('expired', 1n, { expiresAt: past }),
    ];
    expect(await revokeOtherSessions(makePrisma(rows), 1n, 'revoked')).toBe(2);
    expect(rows.map((r) => r.revokedAt)).toEqual([past, NOW, NOW]);

    const again = [row('expired', 1n, { expiresAt: past }), row('b', 1n)];
    expect(await revokeOtherSessions(makePrisma(again), 1n, 'expired')).toBe(2);
  });

  it('чужая кука не выбирает, что оставить: свои гаснут все, чужая сессия цела', async () => {
    const rows = [row('alien', 2n), row('a', 1n), row('b', 1n)];
    expect(await revokeOtherSessions(makePrisma(rows), 1n, 'alien')).toBe(2);
    expect(rows.map((r) => r.revokedAt)).toEqual([null, NOW, NOW]);
  });
});
