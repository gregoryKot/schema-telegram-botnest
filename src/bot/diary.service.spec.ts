// TEST_COVERAGE_PLAN.md, этап 3 п.11: DiaryService — три шифрованных дневника
// (схем/режимов/благодарности). Правило CLAUDE.md «сохранил → нашёл»: тестируем
// связку create/upsert → get через собственный read-путь сервиса, а не только
// факт записи. Плюс изоляция между пользователями, применение EncryptSchema
// на write, порядок/лимит списка, edge-кейсы. Ключа шифрования нет (dev-режим
// crypto.ts) — encrypt()/decrypt() passthrough, но раунд-трип идёт через
// реальные encrypt/decrypt/encryptJson/decryptJson.
import { DiaryService } from './diary.service';

const baseSchema = { emotions: [] as unknown[], schemaIds: [] as string[] };

function makeDb() {
  const schemaRows: any[] = [];
  const modeRows: any[] = [];
  const gratitudeRows: any[] = [];
  let nextId = 1;

  const desc = (rows: any[], userId: bigint, key: string, take: number) =>
    rows
      .filter((r) => r.userId === userId)
      .sort((a, b) => (a[key] < b[key] ? 1 : a[key] > b[key] ? -1 : 0))
      .slice(0, take);

  const db: any = {
    schemaDiaryEntry: {
      create: jest.fn(({ data }: any) => {
        const row = { id: nextId++, createdAt: new Date(), ...data };
        schemaRows.push(row);
        return Promise.resolve(row);
      }),
      findMany: jest.fn(({ where, take }: any) =>
        Promise.resolve(desc(schemaRows, where.userId, 'createdAt', take)),
      ),
      deleteMany: jest.fn(({ where }: any) => {
        const before = schemaRows.length;
        for (let i = schemaRows.length - 1; i >= 0; i--)
          if (
            schemaRows[i].id === where.id &&
            schemaRows[i].userId === where.userId
          )
            schemaRows.splice(i, 1);
        return Promise.resolve({ count: before - schemaRows.length });
      }),
    },
    modeDiaryEntry: {
      create: jest.fn(({ data }: any) => {
        const row = { id: nextId++, createdAt: new Date(), ...data };
        modeRows.push(row);
        return Promise.resolve(row);
      }),
      findMany: jest.fn(({ where, take }: any) =>
        Promise.resolve(desc(modeRows, where.userId, 'createdAt', take)),
      ),
      deleteMany: jest.fn(({ where }: any) => {
        const before = modeRows.length;
        for (let i = modeRows.length - 1; i >= 0; i--)
          if (
            modeRows[i].id === where.id &&
            modeRows[i].userId === where.userId
          )
            modeRows.splice(i, 1);
        return Promise.resolve({ count: before - modeRows.length });
      }),
    },
    gratitudeDiaryEntry: {
      upsert: jest.fn(({ where, create, update }: any) => {
        const existing = gratitudeRows.find(
          (r) =>
            r.userId === where.userId_date.userId &&
            r.date === where.userId_date.date,
        );
        if (existing) {
          Object.assign(existing, update);
          return Promise.resolve(existing);
        }
        const row = { id: nextId++, ...create };
        gratitudeRows.push(row);
        return Promise.resolve(row);
      }),
      findMany: jest.fn(({ where, take }: any) =>
        Promise.resolve(desc(gratitudeRows, where.userId, 'date', take)),
      ),
      deleteMany: jest.fn(({ where }: any) => {
        const before = gratitudeRows.length;
        for (let i = gratitudeRows.length - 1; i >= 0; i--)
          if (
            gratitudeRows[i].id === where.id &&
            gratitudeRows[i].userId === where.userId
          )
            gratitudeRows.splice(i, 1);
        return Promise.resolve({ count: before - gratitudeRows.length });
      }),
    },
  };
  return { db, schemaRows, modeRows, gratitudeRows };
}

function makeService() {
  const t = makeDb();
  const svc = new DiaryService(t.db);
  return { svc, ...t };
}

const USER_A = 1n;
const USER_B = 2n;

describe('DiaryService — дневник схем: сохранил → нашёл', () => {
  it('созданная запись находится через getSchemaDiaryEntries с исходным содержимым', async () => {
    const { svc } = makeService();
    await svc.createSchemaDiaryEntry(USER_A, {
      trigger: 'коллега не ответил на сообщение',
      emotions: [{ id: 'anxiety', intensity: 4 }],
      schemaIds: ['abandonment', 'mistrust'],
      thoughts: 'меня игнорируют',
    });
    const [entry] = await svc.getSchemaDiaryEntries(USER_A);
    expect(entry.trigger).toBe('коллега не ответил на сообщение');
    expect(entry.schemaIds).toEqual(['abandonment', 'mistrust']);
    expect(entry.emotions).toEqual([{ id: 'anxiety', intensity: 4 }]);
    expect(entry.thoughts).toBe('меня игнорируют');
  });

  it('EncryptSchema применена на write: в БД поля хранятся не как исходный JS-объект/массив', async () => {
    const { svc, schemaRows } = makeService();
    await svc.createSchemaDiaryEntry(USER_A, {
      trigger: 'триггер',
      emotions: [{ id: 'anger', intensity: 3 }],
      schemaIds: ['abandonment'],
    });
    // jsonArrays/strings идут через encryptJson/encrypt — в БД это строки
    // (даже в passthrough-режиме encryptJson делает JSON.stringify), а не
    // «сырые» JS-массивы/объекты, которые Prisma положил бы напрямую.
    expect(typeof schemaRows[0].schemaIds).toBe('string');
    expect(typeof schemaRows[0].emotions).toBe('string');
    expect(schemaRows[0].schemaIds).toBe(JSON.stringify(['abandonment']));
  });

  it('пользователь A не видит записи пользователя B', async () => {
    const { svc } = makeService();
    await svc.createSchemaDiaryEntry(USER_A, {
      ...baseSchema,
      trigger: 'запись А',
    });
    await svc.createSchemaDiaryEntry(USER_B, {
      ...baseSchema,
      trigger: 'запись Б',
    });
    const entriesA = await svc.getSchemaDiaryEntries(USER_A);
    expect(entriesA).toHaveLength(1);
    expect(entriesA[0].trigger).toBe('запись А');
  });

  it('отсутствующие опциональные поля возвращаются как null, а не undefined/мусор', async () => {
    const { svc } = makeService();
    await svc.createSchemaDiaryEntry(USER_A, {
      ...baseSchema,
      trigger: 'только триггер',
    });
    const [entry] = await svc.getSchemaDiaryEntries(USER_A);
    expect(entry.thoughts).toBeNull();
    expect(entry.bodyFeelings).toBeNull();
    expect(entry.healthyBehavior).toBeNull();
  });

  it('deleteSchemaDiaryEntry не удаляет запись другого пользователя (ownership)', async () => {
    const { svc, schemaRows } = makeService();
    await svc.createSchemaDiaryEntry(USER_A, {
      ...baseSchema,
      trigger: 'запись А',
    });
    const id = schemaRows[0].id as number;
    await svc.deleteSchemaDiaryEntry(USER_B, id); // чужой userId
    expect(schemaRows).toHaveLength(1); // запись жива
    await svc.deleteSchemaDiaryEntry(USER_A, id); // владелец
    expect(schemaRows).toHaveLength(0);
  });

  it('порядок и лимит: свежие записи первыми, take ограничивает выдачу', async () => {
    const { svc, schemaRows } = makeService();
    for (let i = 0; i < 3; i++) {
      await svc.createSchemaDiaryEntry(USER_A, {
        ...baseSchema,
        trigger: `запись ${i}`,
      });
      schemaRows[i].createdAt = new Date(2026, 6, 10 + i); // разнести по датам
    }
    const limited = await svc.getSchemaDiaryEntries(USER_A, 2);
    expect(limited).toHaveLength(2);
    expect(limited[0].trigger).toBe('запись 2'); // самая свежая первая
    expect(limited[1].trigger).toBe('запись 1');
  });
});

describe('DiaryService — дневник режимов: сохранил → нашёл', () => {
  it('созданная запись находится через getModeDiaryEntries с исходным содержимым', async () => {
    const { svc } = makeService();
    await svc.createModeDiaryEntry(USER_A, {
      modeId: 'vulnerable_child',
      situation: 'партнёр повысил голос',
      feelings: 'страх',
    });
    const [entry] = await svc.getModeDiaryEntries(USER_A);
    expect(entry.modeId).toBe('vulnerable_child');
    expect(entry.situation).toBe('партнёр повысил голос');
    expect(entry.feelings).toBe('страх');
  });

  it('пользователь A не видит записи режимов пользователя B', async () => {
    const { svc } = makeService();
    await svc.createModeDiaryEntry(USER_A, {
      modeId: 'punitive_parent',
      situation: 'ситуация А',
    });
    await svc.createModeDiaryEntry(USER_B, {
      modeId: 'healthy_adult',
      situation: 'ситуация Б',
    });
    const entriesA = await svc.getModeDiaryEntries(USER_A);
    expect(entriesA).toHaveLength(1);
    expect(entriesA[0].situation).toBe('ситуация А');
  });

  it('пустая строка в опциональном поле не превращается в null (edge-кейс falsy)', async () => {
    const { svc } = makeService();
    await svc.createModeDiaryEntry(USER_A, {
      modeId: 'healthy_adult',
      situation: 'ситуация',
      feelings: '',
    });
    const [entry] = await svc.getModeDiaryEntries(USER_A);
    // '' ?? null → '' (не null), а не потерянные данные
    expect(entry.feelings).toBe('');
  });
});

describe('DiaryService — дневник благодарности: сохранил → нашёл', () => {
  it('upsertGratitudeDiaryEntry → getGratitudeDiaryEntries отдаёт исходный массив items', async () => {
    const { svc } = makeService();
    await svc.upsertGratitudeDiaryEntry(USER_A, '2026-07-16', [
      'спал 8 часов',
      'вкусный обед',
    ]);
    const [entry] = await svc.getGratitudeDiaryEntries(USER_A);
    expect(entry.items).toEqual(['спал 8 часов', 'вкусный обед']);
  });

  it('повторный upsert на ту же дату обновляет, а не дублирует запись', async () => {
    const { svc, gratitudeRows } = makeService();
    await svc.upsertGratitudeDiaryEntry(USER_A, '2026-07-16', [
      'первая версия',
    ]);
    await svc.upsertGratitudeDiaryEntry(USER_A, '2026-07-16', [
      'обновлённая версия',
    ]);
    expect(gratitudeRows).toHaveLength(1);
    const [entry] = await svc.getGratitudeDiaryEntries(USER_A);
    expect(entry.items).toEqual(['обновлённая версия']);
  });

  it('пользователь A не видит записи благодарности пользователя B', async () => {
    const { svc } = makeService();
    await svc.upsertGratitudeDiaryEntry(USER_A, '2026-07-16', ['А']);
    await svc.upsertGratitudeDiaryEntry(USER_B, '2026-07-16', ['Б']);
    const entriesA = await svc.getGratitudeDiaryEntries(USER_A);
    expect(entriesA).toHaveLength(1);
    expect(entriesA[0].items).toEqual(['А']);
  });

  it('пустой массив items сохраняется и читается как пустой массив (не null/фолбэк)', async () => {
    const { svc } = makeService();
    await svc.upsertGratitudeDiaryEntry(USER_A, '2026-07-16', []);
    const [entry] = await svc.getGratitudeDiaryEntries(USER_A);
    expect(entry.items).toEqual([]);
  });
});

// Находка для отчёта (не баг-фикс): createSchemaDiaryEntry() возвращает
// schemaIds НЕ расшифрованным — взят «сырой» JSON из prisma.create, а не
// data.schemaIds (emotions переопределён плейнтекстом, schemaIds — нет).
// diary.controller.ts отдаёт этот же объект клиенту как есть: на POST
// /diary/schema фронт получит schemaIds строкой вида '["abandonment"]',
// а не массивом, хотя GET-путь (getSchemaDiaryEntries) отдаёт корректный
// массив. См. отчёт.
describe('DiaryService — create() отличается от чтения (находка)', () => {
  it('create() возвращает schemaIds НЕ как исходный массив (сырую JSON-строку)', async () => {
    const { svc } = makeService();
    const created = await svc.createSchemaDiaryEntry(USER_A, {
      ...baseSchema,
      trigger: 'триггер',
      schemaIds: ['abandonment'],
    });
    expect(created.schemaIds).not.toEqual(['abandonment']);
    expect(created.schemaIds).toBe(JSON.stringify(['abandonment']));
  });
});
