// docs/open/therapy.md «Гонка двух параллельных запросов не закрыта атомарно»:
// два одновременных «Запросить тест» одного терапевта оба видели «открытого
// задания нет» и создавали по строке `UserTask`. Фейк ниже воспроизводит
// гонку, как в `src/auth/unlink-provider.spec.ts`: транзакция читает СНИМОК,
// пишет при коммите, а коммит конкурента на тех же данных даёт P2034 — но
// только на уровне Serializable (как Postgres SSI).
import { ConflictException } from '@nestjs/common';
import {
  createFakeTable,
  type Row,
} from '../test-support/fake-prisma.spec-helper';
import { requestYsq, YSQ_TASK_TYPE } from './ysq-request';

const T = 10n;
const C = 20n;

function makeRacingDeps(opts: { alwaysConflict?: boolean } = {}) {
  const tasks: Row[] = [];
  let version = 0;
  let attempts = 0;
  const levels: Array<string | undefined> = [];
  const userTask = createFakeTable(tasks, { defaults: { done: null } });
  const prisma = {
    userTask,
    user: { findUnique: jest.fn(() => Promise.resolve({ firstName: 'Анна' })) },
    $transaction: async (
      fn: (tx: unknown) => Promise<unknown>,
      o?: { isolationLevel?: string },
    ) => {
      attempts++;
      levels.push(o?.isolationLevel);
      const startVersion = version;
      const snapshot: Row[] = tasks.map((r) => ({ ...r }));
      const result = await fn({
        userTask: createFakeTable(snapshot, { defaults: { done: null } }),
      });
      const raced =
        opts.alwaysConflict ||
        (o?.isolationLevel === 'Serializable' && version !== startVersion);
      if (raced)
        throw Object.assign(new Error('serialization failure'), {
          code: 'P2034',
        });
      tasks.splice(0, tasks.length, ...snapshot); // коммит
      version++;
      return result;
    },
  };
  const notifications = {
    hasPending: jest.fn(() => Promise.resolve(false)),
    schedule: jest.fn(() => Promise.resolve()),
  };
  const relations = { assertHasClient: jest.fn(() => Promise.resolve()) };
  const deps = { prisma, notifications, relations } as never;
  return {
    deps,
    tasks,
    levels,
    notifications,
    attempts: () => attempts,
  };
}

const ysq = (rows: Row[]) => rows.filter((r) => r.type === YSQ_TASK_TYPE);

describe('requestYsq — гонка двух параллельных запросов', () => {
  it('два одновременных запроса одного терапевта: одно задание, одно сообщение', async () => {
    const { deps, tasks, notifications, levels } = makeRacingDeps();
    await Promise.all([requestYsq(deps, T, C), requestYsq(deps, T, C)]);
    expect(ysq(tasks)).toHaveLength(1);
    expect(ysq(tasks)[0]).toMatchObject({ userId: C, assignedBy: T });
    expect(notifications.schedule).toHaveBeenCalledTimes(1);
    // «Проверка + вставка» идут на Serializable — иначе ретрай не спасает.
    expect(levels.every((l) => l === 'Serializable')).toBe(true);
  });

  it('проигравший перечитывает: повтор после P2034 видит задание первого', async () => {
    const { deps, tasks, attempts } = makeRacingDeps();
    await Promise.all([requestYsq(deps, T, C), requestYsq(deps, T, C)]);
    expect(attempts()).toBe(3); // победитель 1 + проигравший 2
    expect(ysq(tasks)).toHaveLength(1);
  });

  it('конфликт не проходит за три попытки → 409, задание не создано', async () => {
    const { deps, tasks, notifications, attempts } = makeRacingDeps({
      alwaysConflict: true,
    });
    await expect(requestYsq(deps, T, C)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(attempts()).toBe(3);
    expect(tasks).toHaveLength(0);
    expect(notifications.schedule).not.toHaveBeenCalled();
  });
});
