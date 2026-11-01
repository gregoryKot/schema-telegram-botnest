// Слияние пунктов дня благодарности (docs/open/frontend-ux.md, P0): пункт,
// добавленный с другой вкладки между чтением и записью, не теряется, а правка
// и удаление пунктов, которые клиент видел, по-прежнему работают.
import { ConflictException } from '@nestjs/common';
import { mergeGratitudeItems, saveGratitudeDay } from './gratitude-merge';

describe('mergeGratitudeItems', () => {
  it('клиент не видел пункт с другой вкладки — пункт остаётся, новый встаёт после', () => {
    expect(mergeGratitudeItems(['A'], [], ['B'])).toEqual(['A', 'B']);
  });

  it('пункт с другой вкладки встаёт на своё место относительно соседей', () => {
    expect(mergeGratitudeItems(['A', 'Y'], ['A'], ['A', 'X'])).toEqual([
      'A',
      'Y',
      'X',
    ]);
  });

  it('удалённый клиентом пункт (был в base) не возвращается', () => {
    expect(mergeGratitudeItems(['A', 'B'], ['A', 'B'], ['B'])).toEqual(['B']);
  });

  it('переписанный пункт остаётся на месте, старый текст не возвращается', () => {
    expect(mergeGratitudeItems(['A', 'K'], ['A', 'K'], ['A2', 'K'])).toEqual([
      'A2',
      'K',
    ]);
  });

  it('одинаковый пункт с двух вкладок не дублируется (сравнение без краёвых пробелов)', () => {
    expect(mergeGratitudeItems(['чай '], [], ['чай'])).toEqual(['чай']);
  });

  it('контроль: без расхождений результат — ровно то, что прислал клиент', () => {
    expect(mergeGratitudeItems(['A'], ['A'], ['A', 'B'])).toEqual(['A', 'B']);
  });

  it('пустые пункты сервера пропускаются', () => {
    expect(mergeGratitudeItems(['', 'A'], [], ['B'])).toEqual(['A', 'B']);
  });
});

describe('saveGratitudeDay — транзакция и повтор', () => {
  const USER = 7n;
  const DATE = '2026-07-16';

  function makePrisma(failures: string[], stored: unknown = null) {
    const tx = {
      gratitudeDiaryEntry: {
        findUnique: jest.fn().mockResolvedValue(stored),
        upsert: jest.fn(({ create }: { create: object }) =>
          Promise.resolve({ id: 1, ...create }),
        ),
      },
    };
    const prisma: any = {
      gratitudeDiaryEntry: { upsert: jest.fn() },
      $transaction: jest.fn((fn: (t: typeof tx) => unknown) => {
        const code = failures.shift();
        if (code)
          return Promise.reject(Object.assign(new Error(code), { code }));
        return fn(tx);
      }),
    };
    return { prisma, tx };
  }

  it('конфликт сериализации (P2034/P2002) перечитывает день и сохраняет', async () => {
    const { prisma } = makePrisma(['P2034', 'P2002']);
    const row = await saveGratitudeDay(prisma, USER, DATE, ['B'], []);
    expect(row.items).toEqual(['B']);
    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
  });

  it('три конфликта подряд — 409, а не молчаливая перезапись', async () => {
    const { prisma } = makePrisma(['P2034', 'P2034', 'P2034']);
    await expect(
      saveGratitudeDay(prisma, USER, DATE, ['B'], []),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('прочая ошибка БД не повторяется и уходит наверх', async () => {
    const { prisma } = makePrisma(['P1001']);
    await expect(
      saveGratitudeDay(prisma, USER, DATE, ['B'], []),
    ).rejects.toMatchObject({ code: 'P1001' });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('легаси-строка с незашифрованным массивом тоже сливается', async () => {
    const { prisma } = makePrisma([], { id: 1, items: ['A'] });
    const row = await saveGratitudeDay(prisma, USER, DATE, ['B'], []);
    expect(row.items).toEqual(['A', 'B']);
  });

  it('без base — прежняя замена дня без транзакции', async () => {
    const { prisma } = makePrisma([]);
    prisma.gratitudeDiaryEntry.upsert.mockResolvedValue({ id: 1 });
    const row = await saveGratitudeDay(prisma, USER, DATE, ['B']);
    expect(row.items).toEqual(['B']);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
