// Аудит 2026-10, R3: unlinkProvider считал способы входа и удалял без
// транзакции — две параллельные отвязки разных провайдеров обе видели «два» и
// обе удаляли, аккаунт оставался без входа. Фейк ниже воспроизводит гонку:
// транзакция читает СНИМОК, пишет при коммите, а коммит конкурента на тех же
// данных даёт P2034 — но только на уровне Serializable (как Postgres SSI);
// на READ COMMITTED обе транзакции коммитятся.
import { ConflictException } from '@nestjs/common';
import {
  createFakeTable,
  type Row,
} from '../test-support/fake-prisma.spec-helper';
import { unlinkProviderSafely } from './unlink-provider';

function makeRacingPrisma(initial: Row[]) {
  const store: Row[] = [...initial];
  let version = 0;
  const levels: Array<string | undefined> = [];
  const prisma = {
    authProvider: createFakeTable(store),
    $transaction: async (
      fn: (tx: unknown) => Promise<void>,
      opts?: { isolationLevel?: string },
    ) => {
      levels.push(opts?.isolationLevel);
      const startVersion = version;
      const snapshot: Row[] = store.map((r) => ({ ...r }));
      const tx = { authProvider: createFakeTable(snapshot) };
      await fn(tx);
      if (opts?.isolationLevel === 'Serializable' && version !== startVersion) {
        throw Object.assign(new Error('serialization failure'), {
          code: 'P2034',
        });
      }
      store.splice(0, store.length, ...snapshot); // коммит
      version++;
    },
  };
  return { prisma: prisma as never, store, levels };
}

const rows = (): Row[] => [
  { id: 1, userId: 7n, provider: 'telegram' },
  { id: 2, userId: 7n, provider: 'google' },
];

describe('unlinkProviderSafely', () => {
  it('две параллельные отвязки разных провайдеров: остаётся ровно один способ входа', async () => {
    const { prisma, store } = makeRacingPrisma(rows());
    const results = await Promise.allSettled([
      unlinkProviderSafely(prisma, 7n, 'telegram'),
      unlinkProviderSafely(prisma, 7n, 'google'),
    ]);
    expect(store).toHaveLength(1);
    // Одна отвязка прошла, вторая перечитала состояние и получила Conflict.
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const failed = results.find(
      (r) => r.status === 'rejected',
    ) as PromiseRejectedResult;
    expect(failed.reason).toBeInstanceOf(ConflictException);
  });

  it('транзакция идёт на уровне Serializable', async () => {
    const { prisma, levels } = makeRacingPrisma(rows());
    await unlinkProviderSafely(prisma, 7n, 'google');
    expect(levels).toEqual(['Serializable']);
  });

  it('две строки одного провайдера (email) — отвязка не сносит все способы входа', async () => {
    const { prisma, store } = makeRacingPrisma([
      { id: 1, userId: 7n, provider: 'email' },
      { id: 2, userId: 7n, provider: 'email' },
    ]);
    await expect(
      unlinkProviderSafely(prisma, 7n, 'email'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(store).toHaveLength(2);
  });

  it('чужие провайдеры не считаются способами входа этого пользователя', async () => {
    const { prisma, store } = makeRacingPrisma([
      { id: 1, userId: 7n, provider: 'telegram' },
      { id: 2, userId: 8n, provider: 'google' },
      { id: 3, userId: 8n, provider: 'email' },
    ]);
    await expect(
      unlinkProviderSafely(prisma, 7n, 'telegram'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(store).toHaveLength(3);
  });

  it('обычная отвязка при двух способах работает и не трогает чужие строки', async () => {
    const { prisma, store } = makeRacingPrisma([
      ...rows(),
      { id: 3, userId: 8n, provider: 'google' },
    ]);
    await unlinkProviderSafely(prisma, 7n, 'google');
    expect(store.map((r) => r.id)).toEqual([1, 3]);
  });

  it('после исчерпания повторов при P2034 — Conflict, а не сырая ошибка', async () => {
    const prisma = {
      $transaction: () =>
        Promise.reject(Object.assign(new Error('x'), { code: 'P2034' })),
    } as never;
    await expect(
      unlinkProviderSafely(prisma, 7n, 'google'),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
