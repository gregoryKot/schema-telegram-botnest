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

import { makeFakeExecuteRaw } from './fake-cron-lease';
import { makeTable, withUserJoin, withDefaults } from './fake-prisma-engine';

/** Собирает фейковый PrismaService, готовый к .overrideProvider(PrismaService). */
export function makeFakePrisma() {
  const userTable = makeTable();
  const tables: Record<string, ReturnType<typeof makeTable>> = {
    user: userTable,
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
    // Колонки с дефолтом NULL перечислены явно: без них созданная строка
    // приходит БЕЗ ключа, и код, сверяющий «не отозван», вёл бы себя иначе, чем
    // на реальном Postgres (фейк уже трижды расходился с БД при зелёных тестах).
    webSession: withDefaults(makeTable(), {
      revokedAt: null,
      replacedByHash: null,
    }),
    // Билет входа и привязки (login-ticket e2e): подтверждение, отказ и опрос
    // помечают строку, поэтому дефолты нужны явные.
    loginTicket: withDefaults(makeTable(), {
      approvedUserId: null,
      approvedAt: null,
      deniedAt: null,
      consumedAt: null,
    }),
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
    // recordActivity (POST /api/activity) upsert'ит сюда; achievements/streak
    // читают через getActiveDates (app-ownership-sweep-3.e2e-spec.ts).
    appActivity: makeTable(),
    // Пары (app-ownership-sweep-2.e2e-spec.ts): @default(pending) в схеме —
    // createPairInvite/PairsController не передают status явно.
    pair: withDefaults(makeTable(), { status: 'pending', userId2: null }),
    schemaDiaryEntry: makeTable(),
    modeDiaryEntry: makeTable(),
    gratitudeDiaryEntry: makeTable(),
    userPractice: makeTable(),
    practicePlan: makeTable(),
    practiceSession: makeTable(),
    userBeliefCheck: makeTable(),
    userPhraseCheck: makeTable(),
    userLetter: makeTable(),
    userSafePlace: makeTable(),
    userFlashcard: makeTable(),
    ysqProgress: makeTable(),
    ysqResult: makeTable(),
    ysqResultHistory: makeTable(),
    analyticsEvent: makeTable(),
    diaryDraft: makeTable(),
    therapistRequest: makeTable(),
    // Therapy ownership smoke (test/therapy-ownership*.e2e-spec.ts, план
    // TEST_IMPROVEMENT_PLAN.md этап 1.2): связь терапевт↔клиент (join на
    // User через withUserJoin — см. выше) и клинические данные, которые
    // терапевт ведёт по клиенту.
    // clientId: null — не косметика: TherapyRelationsService.joinAsClient
    // читает сырое поле строки (`rel.clientId !== null`), а не where-условие
    // (matches() трактует cond===null как «== null», но здесь прямое сравнение
    // в сервисе — `undefined !== null` даёт true и ломает инвайт-флоу).
    therapyRelation: withUserJoin(
      withDefaults(makeTable(), { status: 'pending', clientId: null }),
      userTable,
    ),
    therapistNote: makeTable(),
    clientConceptualization: makeTable(),
    modeMap: makeTable(),
    therapistCustomMode: makeTable(),
    // TherapyTasksService.scheduleTaskNotification (POST /api/therapy/tasks
    // с clientId вызывает notificationService.schedule).
    scheduledNotification: makeTable(),
    // Платёжный контур (test/payment-webhooks.e2e-spec.ts): общий Robokassa
    // Result-вебхук маршрутизирует по InvId между booking/donation/subscriptionCharge;
    // BookingNotifyService.onConfirmed на confirm() ещё трогает clientMeeting.
    booking: makeTable(),
    clientMeeting: makeTable(),
    donation: makeTable(),
    subscription: makeTable(),
    subscriptionCharge: makeTable(),
    // Аренда прогона кронов (CronLeaderService): любой крон с захватом,
    // поднятый в смоуке, ходит сюда до первого побочного эффекта.
    cronLease: makeTable(),
    availabilityRule: withDefaults(makeTable(), { isActive: true }), // @default(true)
    slotOverride: makeTable(),
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
    // Единственный сырой запрос, который эмулирует фейк, — захват аренды крона
    // (см. fake-cron-lease.ts, там же почему не заглушкой «всегда лидер»).
    $executeRaw: makeFakeExecuteRaw(tables.cronLease._rows),
  };
  return prisma;
}

export type FakePrisma = ReturnType<typeof makeFakePrisma>;
