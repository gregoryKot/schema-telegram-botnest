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
import { LAST_METHOD_MESSAGE, unlinkProviderSafely } from './unlink-provider';
import { WEB_USER_ID_MIN } from './user-id-range';

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

// Веб-аккаунт: без строки входа войти нечем. Номер из Telegram (TG) входит через бота и без строки.
const WEB = WEB_USER_ID_MIN + 7n;
const OTHER = WEB_USER_ID_MIN + 8n;
const TG = 7n;

const rows = (): Row[] => [
  { id: 1, userId: WEB, provider: 'vk' },
  { id: 2, userId: WEB, provider: 'yandex' },
];

describe('unlinkProviderSafely', () => {
  it('две параллельные отвязки разных провайдеров: остаётся ровно один способ входа', async () => {
    const { prisma, store } = makeRacingPrisma(rows());
    const results = await Promise.allSettled([
      unlinkProviderSafely(prisma, WEB, 'vk'),
      unlinkProviderSafely(prisma, WEB, 'yandex'),
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
    await unlinkProviderSafely(prisma, WEB, 'yandex');
    expect(levels).toEqual(['Serializable']);
  });

  it('две строки почты без другого входа — отвязка не проходит, строки на месте', async () => {
    const { prisma, store } = makeRacingPrisma([
      { id: 1, userId: WEB, provider: 'email' },
      { id: 2, userId: WEB, provider: 'email' },
    ]);
    await expect(
      unlinkProviderSafely(prisma, WEB, 'email'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(store).toHaveLength(2);
  });

  // QA 2026-11, М2: английский текст фронт подменял общим «Не удалось
  // отвязать» — человек не видел причину. Русский текст проходит на экран.
  it('последний вход — причина по-русски, её можно показать как есть', async () => {
    const { prisma } = makeRacingPrisma([
      { id: 1, userId: WEB, provider: 'vk' },
    ]);
    await expect(unlinkProviderSafely(prisma, WEB, 'vk')).rejects.toThrow(
      LAST_METHOD_MESSAGE,
    );
    expect(LAST_METHOD_MESSAGE).toMatch(/[А-Яа-я]/);
  });

  // Вход по почте отключён (решение владельца, ч. 10 ст. 8 149-ФЗ): почта и
  // Google входом не считаются, вход — VK ID, Яндекс ID, Telegram, MAX.
  it('VK + почта: отвязать VK — Conflict, ничего не удалено; отвязать почту — можно', async () => {
    const vkEmail = (): Row[] => [
      { id: 1, userId: WEB, provider: 'vk' },
      { id: 2, userId: WEB, provider: 'email' },
    ];
    const first = makeRacingPrisma(vkEmail());
    await expect(unlinkProviderSafely(first.prisma, WEB, 'vk')).rejects.toThrow(
      LAST_METHOD_MESSAGE,
    );
    expect(first.store).toHaveLength(2);
    const second = makeRacingPrisma(vkEmail());
    await unlinkProviderSafely(second.prisma, WEB, 'email');
    expect(second.store.map((r) => r.provider)).toEqual(['vk']);
  });

  it('Google + почта у веб-аккаунта: входа нет — ни одну строку не отвязать', async () => {
    for (const provider of ['google', 'email']) {
      const { prisma, store } = makeRacingPrisma([
        { id: 1, userId: WEB, provider: 'google' },
        { id: 2, userId: WEB, provider: 'email' },
      ]);
      await expect(
        unlinkProviderSafely(prisma, WEB, provider),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(store).toHaveLength(2);
    }
  });

  it.each(['telegram', 'max'])(
    '%s + почта у веб-аккаунта: почту отвязать можно, сам вход — нет',
    async (login) => {
      const pair = (): Row[] => [
        { id: 1, userId: WEB, provider: login },
        { id: 2, userId: WEB, provider: 'email' },
      ];
      const ok = makeRacingPrisma(pair());
      await unlinkProviderSafely(ok.prisma, WEB, 'email');
      expect(ok.store.map((r) => r.provider)).toEqual([login]);
      const blocked = makeRacingPrisma(pair());
      await expect(
        unlinkProviderSafely(blocked.prisma, WEB, login),
      ).rejects.toBeInstanceOf(ConflictException);
    },
  );

  it('номер из Telegram + почта: почту отвязать можно — вход через бота остаётся', async () => {
    const { prisma, store } = makeRacingPrisma([
      { id: 1, userId: TG, provider: 'email' },
    ]);
    await unlinkProviderSafely(prisma, TG, 'email');
    expect(store).toHaveLength(0);
  });

  it('чужие провайдеры не считаются способами входа этого пользователя', async () => {
    const { prisma, store } = makeRacingPrisma([
      { id: 1, userId: WEB, provider: 'vk' },
      { id: 2, userId: OTHER, provider: 'yandex' },
      { id: 3, userId: OTHER, provider: 'telegram' },
    ]);
    await expect(
      unlinkProviderSafely(prisma, WEB, 'vk'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(store).toHaveLength(3);
  });

  it('обычная отвязка при двух способах работает и не трогает чужие строки', async () => {
    const { prisma, store } = makeRacingPrisma([
      ...rows(),
      { id: 3, userId: OTHER, provider: 'yandex' },
    ]);
    await unlinkProviderSafely(prisma, WEB, 'yandex');
    expect(store.map((r) => r.id)).toEqual([1, 3]);
  });

  it('после исчерпания повторов при P2034 — Conflict, а не сырая ошибка', async () => {
    const prisma = {
      $transaction: () =>
        Promise.reject(Object.assign(new Error('x'), { code: 'P2034' })),
    } as never;
    await expect(
      unlinkProviderSafely(prisma, WEB, 'yandex'),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
