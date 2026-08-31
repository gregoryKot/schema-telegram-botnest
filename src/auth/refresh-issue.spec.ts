// Юнит-тесты выдачи ротированной пары (refresh-issue.ts). Главное, что держит
// файл, — защита от гонки: два одновременных рефреша одного живого токена не
// должны создать ДВА живых наследника. Настоящую параллельность проверяет
// e2e на живом Postgres (test/refresh-rotation.e2e-spec.ts, READ COMMITTED
// сериализует updateMany); здесь — что при проигранной гонке (претендент уже
// отозван, `count === 0`) наследник НЕ создаётся, а возвращается access-only на
// прежней куке. Разбор 2026-08-31.
import {
  createFakeTable,
  createFakeTransaction,
  type Row,
} from '../test-support/fake-prisma.spec-helper';
import { issueRotatedPair, type IssueRotatedDeps } from './refresh-issue';

const RAW = 'raw-refresh-token';

function makeDeps(rows: Row[]): { deps: IssueRotatedDeps; rows: Row[] } {
  const webSession = createFakeTable(rows, { idField: 'id' });
  const prisma = { webSession } as unknown as IssueRotatedDeps['prisma'];
  (prisma as unknown as { $transaction: unknown }).$transaction =
    createFakeTransaction(prisma);
  const deps: IssueRotatedDeps = {
    prisma,
    hashToken: (raw: string) => `h:${raw}`,
    signAccessToken: (id: bigint) => `acc:${id}`,
    accessTtlS: 900,
    refreshTtlS: 2_592_000,
  };
  return { deps, rows };
}

const live = (over: Partial<Row> = {}): Row => ({
  id: 'sess-1',
  tokenHash: 'h:parent',
  userId: 7n,
  family: 'fam-1',
  revokedAt: null,
  replacedByHash: null,
  expiresAt: new Date(Date.now() + 86_400_000),
  createdAt: new Date(),
  ...over,
});

describe('issueRotatedPair — обычная ротация', () => {
  it('родитель жив → выигрыш: старый отозван, создан ровно один наследник', async () => {
    const { deps, rows } = makeDeps([live()]);
    const res = await issueRotatedPair(
      deps,
      {
        tokenHash: 'h:parent',
        userId: 7n,
        family: 'fam-1',
        replacedByHash: null,
      },
      RAW,
    );

    expect(res.rotated).toBe(true);
    if (!res.rotated) throw new Error('unreachable');
    // Старый помечен отозванным и указывает на нового наследника.
    const parent = rows.find((r) => r.tokenHash === 'h:parent')!;
    expect(parent.revokedAt).toBeInstanceOf(Date);
    expect(parent.replacedByHash).toBe(`h:${res.refreshToken}`);
    // Ровно один живой токен в семье — наследник.
    const liveRows = rows.filter((r) => !r.revokedAt);
    expect(liveRows).toHaveLength(1);
    expect(liveRows[0].tokenHash).toBe(`h:${res.refreshToken}`);
  });

  it('проиграл гонку (родитель уже отозван) → наследник НЕ создан, access-only', async () => {
    // Претендента уже погасил другой параллельный рефреш: updateMany вернёт
    // count 0. Второго живого токена быть не должно, а человек — не выкинут.
    const revokedParent = live({ revokedAt: new Date() });
    const { deps, rows } = makeDeps([revokedParent]);
    const res = await issueRotatedPair(
      deps,
      {
        tokenHash: 'h:parent',
        userId: 7n,
        family: 'fam-1',
        replacedByHash: null,
      },
      RAW,
    );

    expect(res.rotated).toBe(false);
    expect(res.refreshToken).toBe(RAW); // кука прежняя
    expect(res.accessToken).toBe('acc:7');
    // Ни одной новой строки: наследник не создан.
    expect(rows).toHaveLength(1);
  });
});

describe('issueRotatedPair — восстановление (есть прежний наследник)', () => {
  it('прежний наследник жив → выигрыш: он гасится, создан новый', async () => {
    const parent = live({ revokedAt: new Date(), replacedByHash: 'h:succ' });
    const succ = live({ id: 'sess-2', tokenHash: 'h:succ' });
    const { deps, rows } = makeDeps([parent, succ]);
    const res = await issueRotatedPair(
      deps,
      {
        tokenHash: 'h:parent',
        userId: 7n,
        family: 'fam-1',
        replacedByHash: 'h:succ',
      },
      RAW,
    );

    expect(res.rotated).toBe(true);
    // Прежний наследник погашен; живой ровно один — новый.
    expect(
      rows.find((r) => r.tokenHash === 'h:succ')!.revokedAt,
    ).toBeInstanceOf(Date);
    expect(rows.filter((r) => !r.revokedAt)).toHaveLength(1);
  });

  it('прежний наследник уже отозван (гонку проиграли) → access-only, без нового', async () => {
    const parent = live({ revokedAt: new Date(), replacedByHash: 'h:succ' });
    const succ = live({
      id: 'sess-2',
      tokenHash: 'h:succ',
      revokedAt: new Date(),
    });
    const { deps, rows } = makeDeps([parent, succ]);
    const res = await issueRotatedPair(
      deps,
      {
        tokenHash: 'h:parent',
        userId: 7n,
        family: 'fam-1',
        replacedByHash: 'h:succ',
      },
      RAW,
    );

    expect(res.rotated).toBe(false);
    expect(res.refreshToken).toBe(RAW);
    expect(rows).toHaveLength(2); // ничего не создано
  });
});
