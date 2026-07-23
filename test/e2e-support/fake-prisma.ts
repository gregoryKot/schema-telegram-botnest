// Стейтфулый in-memory фейк PrismaService для e2e-смоука (TEST_COVERAGE_PLAN.md,
// этап 1 п.7). Стиль — как в src/auth/auth.service.spec.ts: настоящие таблицы
// эмулируются массивами объектов + generic where-матчер, а не заглушки-заглушки
// на каждый вызов. Покрывает ТОЛЬКО делегаты, которых реально касаются
// сценарии смоука + сервисы, которые ApiModule/ArticlesModule трогают при
// старте приложения (onModuleInit).
//
// Это НЕ полная эмуляция Prisma — только generic CRUD по `where`/`data`,
// достаточный для findUnique/findMany/create/update/upsert/delete на плоских
// объектах и составных unique-ключах вида `{ userId_schemaId: { userId, schemaId } }`.
// Методы синхронные (без async) — как в auth.service.spec.ts: `await` на
// не-Promise значении резолвится мгновенно, а лишний async ловит
// require-await в typed-линте.

type Row = Record<string, any>;

function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([key, cond]) => {
    if (cond && typeof cond === 'object' && !Array.isArray(cond)) {
      if ('not' in cond) return row[key] !== cond.not;
      if ('in' in cond) return cond.in.includes(row[key]);
      // Диапазонные операторы (practicesService.getPendingPlans/getPlanHistory
      // фильтруют scheduledDate: { gte: ... }) — сравнение строк ISO-дат
      // (YYYY-MM-DD) лексикографически совпадает с хронологическим.
      if ('gte' in cond) return row[key] >= cond.gte;
      if ('lte' in cond) return row[key] <= cond.lte;
      if ('gt' in cond) return row[key] > cond.gt;
      if ('lt' in cond) return row[key] < cond.lt;
      // Составной unique-ключ (userId_schemaId: { userId, schemaId }) —
      // Prisma называет его условно, реальные поля лежат внутри.
      return Object.entries(cond).every(([k, v]) => row[k] === v);
    }
    // cond === null матчит и явный null, и отсутствующее поле (undefined) —
    // реальный Postgres всегда возвращает колонку (NULL, если не задана при
    // create()), а этот фейк просто не кладёт ключ в объект вовсе
    // (practicePlan.create не передаёт `done` → row.done остаётся undefined,
    // но getPendingPlans фильтрует `done: null` и должен находить такую строку).
    if (cond === null) return row[key] == null;
    return row[key] === cond;
  });
}

function makeTable(rows: Row[] = []) {
  return {
    _rows: rows,
    findUnique: jest.fn(({ where }: any) => {
      return rows.find((r) => matches(r, where)) ?? null;
    }),
    findFirst: jest.fn(({ where }: any = {}) => {
      return rows.find((r) => matches(r, where)) ?? null;
    }),
    findMany: jest.fn(({ where }: any = {}) => {
      return rows.filter((r) => matches(r, where));
    }),
    create: jest.fn(({ data }: any) => {
      const row = { id: rows.length + 1, ...data };
      rows.push(row);
      return row;
    }),
    update: jest.fn(({ where, data }: any) => {
      const row = rows.find((r) => matches(r, where));
      if (!row) throw new Error('Record not found (fake prisma update)');
      Object.assign(row, data);
      return row;
    }),
    updateMany: jest.fn(({ where, data }: any = {}) => {
      const hit = rows.filter((r) => matches(r, where));
      hit.forEach((r) => Object.assign(r, data));
      return { count: hit.length };
    }),
    upsert: jest.fn(({ where, create, update }: any) => {
      const row = rows.find((r) => matches(r, where));
      if (row) {
        Object.assign(row, update);
        return row;
      }
      const created = { id: rows.length + 1, ...create };
      rows.push(created);
      return created;
    }),
    delete: jest.fn(({ where }: any) => {
      const idx = rows.findIndex((r) => matches(r, where));
      if (idx === -1) throw new Error('Record not found (fake prisma delete)');
      const [row] = rows.splice(idx, 1);
      return row;
    }),
    deleteMany: jest.fn(({ where }: any = {}) => {
      const hit = rows.filter((r) => matches(r, where));
      hit.forEach((r) => rows.splice(rows.indexOf(r), 1));
      return { count: hit.length };
    }),
    count: jest.fn(({ where }: any = {}) => {
      return rows.filter((r) => matches(r, where)).length;
    }),
  };
}

/** Собирает фейковый PrismaService, готовый к .overrideProvider(PrismaService). */
export function makeFakePrisma() {
  const tables: Record<string, ReturnType<typeof makeTable>> = {
    user: makeTable(),
    userSchemaNote: makeTable(),
    userModeNote: makeTable(),
    bookingSetting: makeTable([
      // ArticlesService.onModuleInit сверяет версию сида статей — предзаполняем
      // актуальной, чтобы приложение не пыталось писать в article-таблицу
      // (которую этот смоук не эмулирует) при каждом старте.
      { key: 'articlesSeedVersion', value: '8' },
    ]),
    article: makeTable(),
    // Auth flows (test/auth-flows.e2e-spec.ts): провайдеры, refresh-сессии,
    // email magic-link токены.
    authProvider: makeTable(),
    webSession: makeTable(),
    emailToken: makeTable(),
    // Затрагивается TherapyTasksService.checkStreakTasks (fire-and-forget
    // побочный вызов из tracker/diary контроллеров) — пустая таблица
    // достаточна, чтобы findMany() вернул [] и метод рано вышел.
    userTask: makeTable(),
    // Ownership sweep (test/app-ownership-sweep.e2e-spec.ts): трекер,
    // дневники, планы/практики, инструменты, тест на схемы.
    rating: makeTable(),
    note: makeTable(),
    childhoodRating: makeTable(),
    schemaDiaryEntry: makeTable(),
    modeDiaryEntry: makeTable(),
    gratitudeDiaryEntry: makeTable(),
    userPractice: makeTable(),
    practicePlan: makeTable(),
    userBeliefCheck: makeTable(),
    userLetter: makeTable(),
    userSafePlace: makeTable(),
    userFlashcard: makeTable(),
    ysqProgress: makeTable(),
    ysqResult: makeTable(),
    ysqResultHistory: makeTable(),
    analyticsEvent: makeTable(),
  };

  const prisma: any = {
    ...tables,
    $connect: jest.fn(() => undefined),
    $disconnect: jest.fn(() => undefined),
    $transaction: jest.fn((fnOrArr: any) => {
      // Только форма с callback используется в затронутых смоуком сервисах
      // (NotesService.addToMyList) — callback уже возвращает Promise сам по
      // себе (он async), оборачивать в дополнительный async не нужно.
      if (typeof fnOrArr === 'function') return fnOrArr(prisma);
      return Promise.all(fnOrArr);
    }),
  };
  return prisma;
}

export type FakePrisma = ReturnType<typeof makeFakePrisma>;
