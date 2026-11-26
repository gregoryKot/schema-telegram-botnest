// Тест-сверка семантики общего юнит-фейка Prisma (TEST_IMPROVEMENT_PLAN.md,
// этап 2.4, правило CLAUDE.md №4 «денормализация/дублированные реестры —
// только с тестом-сверкой», применено здесь к дублированной where-логике:
// один источник семантики, один тест на неё — вместо девяти неявных копий).
import {
  createFakeTable,
  createFakeTransaction,
  matchesWhere,
  Row,
} from './fake-prisma.spec-helper';

describe('matchesWhere', () => {
  const row: Row = {
    id: 1,
    userId: 42n,
    date: '2026-07-16',
    status: 'active',
    sentAt: null,
    score: 5,
  };

  it('точное равенство по нескольким полям (AND по умолчанию)', () => {
    expect(matchesWhere(row, { userId: 42n, status: 'active' })).toBe(true);
    expect(matchesWhere(row, { userId: 42n, status: 'pending' })).toBe(false);
  });

  it('null матчит явный null и отсутствующее поле', () => {
    expect(matchesWhere(row, { sentAt: null })).toBe(true);
    expect(matchesWhere({ id: 1 }, { sentAt: null })).toBe(true);
    expect(matchesWhere({ ...row, sentAt: new Date() }, { sentAt: null })).toBe(
      false,
    );
  });

  it('составной unique-ключ ({ userId_date: { userId, date } })', () => {
    expect(
      matchesWhere(row, { userId_date: { userId: 42n, date: '2026-07-16' } }),
    ).toBe(true);
    expect(
      matchesWhere(row, { userId_date: { userId: 42n, date: '2026-07-15' } }),
    ).toBe(false);
  });

  it('not', () => {
    expect(matchesWhere(row, { status: { not: 'cancelled' } })).toBe(true);
    expect(matchesWhere(row, { status: { not: 'active' } })).toBe(false);
  });

  it('in', () => {
    expect(matchesWhere(row, { status: { in: ['active', 'pending'] } })).toBe(
      true,
    );
    expect(matchesWhere(row, { status: { in: ['pending'] } })).toBe(false);
  });

  it('gte/lte/gt/lt', () => {
    expect(matchesWhere(row, { score: { gte: 5 } })).toBe(true);
    expect(matchesWhere(row, { score: { gte: 6 } })).toBe(false);
    expect(matchesWhere(row, { score: { lte: 5 } })).toBe(true);
    expect(matchesWhere(row, { score: { gt: 5 } })).toBe(false);
    expect(matchesWhere(row, { score: { lt: 5 } })).toBe(false);
    expect(matchesWhere(row, { score: { lt: 6 } })).toBe(true);
  });

  it('gte/lte по датам сравнивают по времени, а не по ссылке', () => {
    const withDate: Row = { sendAt: new Date('2026-07-16T12:00:00Z') };
    expect(
      matchesWhere(withDate, {
        sendAt: { lte: new Date('2026-07-16T13:00:00Z') },
      }),
    ).toBe(true);
    expect(
      matchesWhere(withDate, {
        sendAt: { gte: new Date('2026-07-16T13:00:00Z') },
      }),
    ).toBe(false);
  });

  it('contains — подстрока в строковом поле', () => {
    expect(matchesWhere(row, { status: { contains: 'ctiv' } })).toBe(true);
    expect(matchesWhere(row, { status: { contains: 'zzz' } })).toBe(false);
  });

  it('OR верхнего уровня комбинируется с остальными ключами через AND', () => {
    expect(
      matchesWhere(row, {
        status: 'active',
        OR: [{ userId: 1n }, { userId: 42n }],
      }),
    ).toBe(true);
    expect(
      matchesWhere(row, {
        status: 'inactive',
        OR: [{ userId: 42n }],
      }),
    ).toBe(false);
  });

  it('AND верхнего уровня требует совпадения всех подусловий', () => {
    expect(
      matchesWhere(row, { AND: [{ userId: 42n }, { status: 'active' }] }),
    ).toBe(true);
    expect(
      matchesWhere(row, { AND: [{ userId: 42n }, { status: 'pending' }] }),
    ).toBe(false);
  });
});

describe('createFakeTable', () => {
  it('create назначает автоинкрементный id, если он не передан', () => {
    const table = createFakeTable();
    const a = table.create({ data: { name: 'a' } });
    const b = table.create({ data: { name: 'b' } });
    expect(a.id).toBe(1);
    expect(b.id).toBe(2);
  });

  it('create сохраняет явно переданный id (напр. User.id = telegramId) и не переиспользует его', () => {
    const table = createFakeTable();
    table.create({ data: { id: 777, name: 'явный' } });
    const next = table.create({ data: { name: 'следующий' } });
    expect(next.id).toBe(778);
  });

  it('createMany создаёт несколько строк, count возвращает число вставленных', () => {
    const table = createFakeTable();
    const res = table.createMany({ data: [{ name: 'a' }, { name: 'b' }] });
    expect(res).toEqual({ count: 2 });
    expect(table.findMany({})).toHaveLength(2);
  });

  it('findUnique/findFirst/findMany фильтруют по where', () => {
    const table = createFakeTable([
      { id: 1, userId: 1n, done: null },
      { id: 2, userId: 1n, done: true },
      { id: 3, userId: 2n, done: null },
    ]);
    expect(table.findUnique({ where: { id: 2 } })?.done).toBe(true);
    expect(table.findUnique({ where: { id: 999 } })).toBeNull();
    expect(table.findFirst({ where: { userId: 1n } })?.id).toBe(1);
    expect(table.findMany({ where: { userId: 1n } })).toHaveLength(2);
  });

  it('orderBy сортирует (asc/desc), поддерживает Date/number/string', () => {
    const table = createFakeTable([
      { id: 1, sendAt: new Date('2026-07-16T12:00:00Z') },
      { id: 2, sendAt: new Date('2026-07-10T12:00:00Z') },
      { id: 3, sendAt: new Date('2026-07-20T12:00:00Z') },
    ]);
    expect(
      table.findMany({ orderBy: { sendAt: 'asc' } }).map((r) => r.id),
    ).toEqual([2, 1, 3]);
    expect(
      table.findMany({ orderBy: { sendAt: 'desc' } }).map((r) => r.id),
    ).toEqual([3, 1, 2]);
  });

  it('take ограничивает результат findMany после orderBy', () => {
    const table = createFakeTable([{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(
      table.findMany({ orderBy: { id: 'desc' }, take: 2 }).map((r) => r.id),
    ).toEqual([3, 2]);
  });

  it('select возвращает только запрошенные поля (недостающие — null)', () => {
    const table = createFakeTable([{ id: 1, email: 'a@b.c', secret: 'x' }]);
    const rows = table.findMany({ select: { email: true, displayName: true } });
    expect(rows).toEqual([{ email: 'a@b.c', displayName: null }]);
  });

  it('update мутирует найденную строку, бросает при отсутствии совпадения', () => {
    const table = createFakeTable([{ id: 1, name: 'old' }]);
    const row = table.update({ where: { id: 1 }, data: { name: 'new' } });
    expect(row.name).toBe('new');
    expect(() =>
      table.update({ where: { id: 999 }, data: { name: 'x' } }),
    ).toThrow(/not found/);
  });

  it('updateMany возвращает count и мутирует все совпавшие строки', () => {
    const table = createFakeTable([
      { id: 1, userId: 1n, done: null },
      { id: 2, userId: 1n, done: null },
      { id: 3, userId: 2n, done: null },
    ]);
    const res = table.updateMany({
      where: { userId: 1n },
      data: { done: true },
    });
    expect(res).toEqual({ count: 2 });
    expect(table.findMany({ where: { userId: 1n, done: true } })).toHaveLength(
      2,
    );
  });

  it('upsert обновляет существующую строку или создаёт новую', () => {
    const table = createFakeTable();
    const created = table.upsert({
      where: { userId: 1n },
      create: { userId: 1n, page: 1 },
      update: { page: 99 },
    });
    expect(created.page).toBe(1);
    const updated = table.upsert({
      where: { userId: 1n },
      create: { userId: 1n, page: 1 },
      update: { page: 2 },
    });
    expect(updated.page).toBe(2);
    expect(table.findMany({})).toHaveLength(1);
  });

  it('delete удаляет и возвращает строку, бросает при отсутствии', () => {
    const table = createFakeTable([{ id: 1 }]);
    const removed = table.delete({ where: { id: 1 } });
    expect(removed.id).toBe(1);
    expect(table.findMany({})).toHaveLength(0);
    expect(() => table.delete({ where: { id: 1 } })).toThrow(/not found/);
  });

  it('deleteMany удаляет все совпавшие строки, count — их число', () => {
    const table = createFakeTable([
      { id: 1, userId: 1n },
      { id: 2, userId: 1n },
      { id: 3, userId: 2n },
    ]);
    const res = table.deleteMany({ where: { userId: 1n } });
    expect(res).toEqual({ count: 2 });
    expect(table.findMany({})).toHaveLength(1);
  });

  it('count считает только совпавшие строки', () => {
    const table = createFakeTable([
      { id: 1, done: null },
      { id: 2, done: true },
    ]);
    expect(table.count({ where: { done: null } })).toBe(1);
  });

  it('defaults (объект) применяются при create, но не перекрывают явные data', () => {
    const table = createFakeTable([], { defaults: { revokedAt: null } });
    const row = table.create({ data: { userId: 1n } });
    expect(row.revokedAt).toBeNull();
    const row2 = table.create({ data: { userId: 2n, revokedAt: 'x' } });
    expect(row2.revokedAt).toBe('x');
  });

  it('defaults (функция) — вычисляемый дефолт на основе data', () => {
    const table = createFakeTable([], {
      defaults: (data) => ({
        status: 'pending',
        code: `code-${String(data.userId)}`,
      }),
    });
    const row = table.create({ data: { userId: 5n } });
    expect(row).toMatchObject({ status: 'pending', code: 'code-5' });
  });

  it('_rows — та же ссылка на переданный массив, тест может мутировать её напрямую', () => {
    const seed: Row[] = [];
    const table = createFakeTable(seed);
    seed.push({ id: 1, name: 'внешняя мутация' });
    expect(table.findMany({})).toEqual([{ id: 1, name: 'внешняя мутация' }]);
    expect(table._rows).toBe(seed);
  });
});

describe('createFakeTransaction', () => {
  it('batch-форма ($transaction([...])) — резолвит уже переданные значения', async () => {
    const tx = createFakeTransaction({});
    const result = await tx([Promise.resolve(1), 2]);
    expect(result).toEqual([1, 2]);
  });

  it('интерактивная форма ($transaction(async (tx) => ...)) — колбэк получает сам prisma', async () => {
    const prisma = { marker: 'fake-prisma' };
    const tx = createFakeTransaction(prisma);
    const result = await tx((p: typeof prisma) => p.marker);
    expect(result).toBe('fake-prisma');
  });
});
