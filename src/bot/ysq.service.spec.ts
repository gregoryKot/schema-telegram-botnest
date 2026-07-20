import { YsqService } from './ysq.service';

// Stateful in-memory fake Prisma для YsqProgress/YsqResult/YsqResultHistory.
// Приоритет: progress save/resume (read-after-write) и инвариант
// saveYsqResult — каждое завершение теста дописывает историю, не
// перезаписывая её, при этом «текущий» результат — всегда последний.
function makeDb() {
  let progress: any = null;
  let result: any = null;
  const history: any[] = [];

  const db: any = {
    ysqProgress: {
      findUnique: jest.fn(({ where }: any) =>
        progress && progress.userId === where.userId ? progress : null,
      ),
      upsert: jest.fn(({ where, update, create }: any) => {
        if (progress && progress.userId === where.userId) {
          Object.assign(progress, update);
        } else {
          progress = { ...create };
        }
        return progress;
      }),
      deleteMany: jest.fn(({ where }: any) => {
        if (progress && progress.userId === where.userId) {
          progress = null;
          return { count: 1 };
        }
        return { count: 0 };
      }),
    },
    ysqResult: {
      findUnique: jest.fn(({ where }: any) =>
        result && result.userId === where.userId ? result : null,
      ),
      upsert: jest.fn(({ where, update, create }: any) => {
        if (result && result.userId === where.userId) {
          Object.assign(result, update);
        } else {
          result = { ...create };
        }
        return result;
      }),
      deleteMany: jest.fn(({ where }: any) => {
        if (result && result.userId === where.userId) {
          result = null;
          return { count: 1 };
        }
        return { count: 0 };
      }),
    },
    ysqResultHistory: {
      create: jest.fn(({ data }: any) => {
        const row = { id: history.length + 1, ...data };
        history.push(row);
        return row;
      }),
      findMany: jest.fn(({ where, orderBy, take }: any) => {
        let rows = history.filter((r) => r.userId === where.userId);
        if (orderBy?.completedAt === 'desc') {
          rows = [...rows].sort(
            (a, b) => b.completedAt.getTime() - a.completedAt.getTime(),
          );
        }
        return take ? rows.slice(0, take) : rows;
      }),
    },
    // saveYsqResult вызывает $transaction с массивом промисов (batch-форма).
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  return db;
}

describe('YsqService.saveYsqProgress / getYsqProgress — read-after-write', () => {
  it('сохранённый прогресс (ответы + страница) читается назад', async () => {
    const db = makeDb();
    const svc = new YsqService(db);

    await svc.saveYsqProgress(1n, [1, 2, 3], 2);
    const progress = await svc.getYsqProgress(1n);

    expect(progress).toEqual({ answers: [1, 2, 3], page: 2 });
  });

  it('повторное сохранение прогресса (продолжил тест) обновляет, а не создаёт новую строку', async () => {
    const db = makeDb();
    const svc = new YsqService(db);

    await svc.saveYsqProgress(1n, [1, 2], 1);
    await svc.saveYsqProgress(1n, [1, 2, 3, 4], 3);

    expect(db.ysqProgress.upsert).toHaveBeenCalledTimes(2);
    expect(await svc.getYsqProgress(1n)).toEqual({
      answers: [1, 2, 3, 4],
      page: 3,
    });
  });

  it('нет прогресса → getYsqProgress возвращает null', async () => {
    const db = makeDb();
    const svc = new YsqService(db);
    expect(await svc.getYsqProgress(1n)).toBeNull();
  });

  it('deleteYsqProgress убирает прогресс (сброс перед новой попыткой)', async () => {
    const db = makeDb();
    const svc = new YsqService(db);
    await svc.saveYsqProgress(1n, [1], 1);

    await svc.deleteYsqProgress(1n);

    expect(await svc.getYsqProgress(1n)).toBeNull();
  });
});

describe('YsqService.saveYsqResult — история накапливается, текущий результат — последний', () => {
  it('первое завершение теста: результат и одна запись истории', async () => {
    const db = makeDb();
    const svc = new YsqService(db);

    await svc.saveYsqResult(1n, [1, 2, 3]);

    expect((await svc.getYsqResult(1n))?.answers).toEqual([1, 2, 3]);
    expect(await svc.getYsqHistory(1n)).toHaveLength(1);
  });

  it('повторное прохождение: результат обновлён на последний, история содержит ОБА прохождения', async () => {
    const db = makeDb();
    const svc = new YsqService(db);

    // Разные completedAt важны для проверки сортировки истории — без
    // реального разрыва во времени два вызова в одном тике получили бы
    // одинаковый Date.now() и порядок сортировки был бы недетерминирован.
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-01T12:00:00Z'));
    await svc.saveYsqResult(1n, [1, 1, 1]);
    jest.setSystemTime(new Date('2026-07-10T12:00:00Z'));
    await svc.saveYsqResult(1n, [5, 5, 5]);
    jest.useRealTimers();

    expect((await svc.getYsqResult(1n))?.answers).toEqual([5, 5, 5]);
    const history = await svc.getYsqHistory(1n);
    expect(history).toHaveLength(2);
    // Свежее прохождение — первым (orderBy completedAt desc)
    expect(history[0].answers).toEqual([5, 5, 5]);
    expect(history[1].answers).toEqual([1, 1, 1]);
  });

  it('запись результата и истории идёт одной транзакцией', async () => {
    const db = makeDb();
    const svc = new YsqService(db);

    await svc.saveYsqResult(1n, [1]);

    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });

  it('deleteYsqResult убирает текущий результат, но не трогает историю прохождений', async () => {
    const db = makeDb();
    const svc = new YsqService(db);
    await svc.saveYsqResult(1n, [1]);

    await svc.deleteYsqResult(1n);

    expect(await svc.getYsqResult(1n)).toBeNull();
    expect(await svc.getYsqHistory(1n)).toHaveLength(1);
  });
});

// Аудит 2026-07-20: ответы YSQ — клинический профиль схем, до этого лежали
// в БД plaintext-массивом. Теперь в Json-колонке — строка-блоб (шифроблоб,
// без ключа в тестовом окружении — JSON-строка), наружу — числа.
describe('YsqService — ответы не лежат в БД plaintext-массивом', () => {
  it('в хранилище строка-блоб, а не массив (result, history, progress)', async () => {
    const db = makeDb();
    const svc = new YsqService(db);

    await svc.saveYsqResult(1n, [1, 2, 3]);
    await svc.saveYsqProgress(1n, [4, 5], 1);

    const storedResult = db.ysqResult.upsert.mock.calls[0][0].create.answers;
    const storedHistory =
      db.ysqResultHistory.create.mock.calls[0][0].data.answers;
    const storedProgress =
      db.ysqProgress.upsert.mock.calls[0][0].create.answers;
    for (const stored of [storedResult, storedHistory, storedProgress]) {
      expect(typeof stored).toBe('string');
      expect(Array.isArray(stored)).toBe(false);
    }
  });

  it('легаси-строки с plaintext-массивом читаются как есть', async () => {
    const db = makeDb();
    // Строка старого формата: answers — массив прямо в Json-колонке.
    db.ysqResult.findUnique.mockReturnValueOnce({
      userId: 1n,
      answers: [1, 2, 3],
      completedAt: new Date(),
    });
    const svc = new YsqService(db);

    expect((await svc.getYsqResult(1n))?.answers).toEqual([1, 2, 3]);
  });
});
