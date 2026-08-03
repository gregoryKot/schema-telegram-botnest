// Общая чистка user-scoped фикстур ownership-спеков (app-ownership*,
// therapy-ownership*) между прогонами (TEST_TRUST_PLAN.md, п.1: те же
// спеки гоняются вторым разом на реальном Postgres джобы `migrations`).
// На реальной БД без явной чистки повторный локальный прогон падает на
// unique-констрейнтах (Note.[userId,date], UserSchemaNote.[userId,schemaId],
// AppActivity.[userId,date]…) или копит мусорные строки, которые путают
// assertions на count/length (streak/achievements/insights читают ВСЮ
// историю юзера, не только только что созданную).
//
// На фейке (fake-prisma.ts) deleteMany с `in`/`OR` тоже работает (см.
// matches() в fake-prisma.ts) — тот же вызов безопасен и в фейковом режиме
// (де-факто no-op, каждый e2e-файл получает свежий in-memory прогон), поэтому
// спеки зовут его одинаково в обоих режимах без if/else на E2E_REAL_DB.
//
// НЕ трогает таблицы вне фикстур этих спеков (booking/donation/subscription,
// article, bookingSetting и т.п. — другой контур со своим e2e).

// Таблицы с прямой колонкой userId (в реальной схеме — FK на User с
// ON DELETE CASCADE), которую можно почистить общим `in`-списком.
const USER_ID_TABLES = [
  'userSchemaNote',
  'userModeNote',
  'rating',
  'note',
  'childhoodRating',
  'appActivity',
  'schemaDiaryEntry',
  'modeDiaryEntry',
  'gratitudeDiaryEntry',
  'userPractice',
  'practicePlan',
  'practiceSession',
  'userBeliefCheck',
  'userLetter',
  'userSafePlace',
  'userFlashcard',
  'ysqProgress',
  'ysqResult',
  'ysqResultHistory',
  'analyticsEvent',
  'scheduledNotification',
] as const;

/**
 * Удаляет все строки, привязанные к переданным userId — по прямой колонке
 * userId (трекер/дневники/инструменты/YSQ), по паре (userId1/userId2) для
 * пар, по (therapistId/clientId) для therapy-контура, и сами User-строки
 * последними (после явной чистки non-FK таблиц therapy-контура — TherapistNote/
 * ClientConceptualization/ModeMap/TherapistCustomMode не имеют FK на User в
 * schema.prisma, каскад их не тронет).
 */
export async function cleanupOwnershipFixtures(
  // Фейк и реальный PrismaService структурно совпадают по нужным делегатам
  // (find*/create/upsert/deleteMany) — общий тип без `any` здесь не выразить
  // проще, чем шумом; no-explicit-any уже выключен для test/e2e-support/**
  // (eslint.config.mjs).
  prisma: any,
  userIds: bigint[],
): Promise<void> {
  for (const table of USER_ID_TABLES) {
    await prisma[table].deleteMany({ where: { userId: { in: userIds } } });
  }
  // UserTask — БЕЗ FK на User (осознанно, см. schema.prisma: задачи
  // виртуальных клиентов терапевта хранятся с userId < 0). Кэскад от
  // user.deleteMany его не тронет — чистим явно и по userId (клиент), и по
  // assignedBy (терапевт, назначивший задачу).
  await prisma.userTask.deleteMany({
    where: {
      OR: [{ userId: { in: userIds } }, { assignedBy: { in: userIds } }],
    },
  });
  await prisma.pair.deleteMany({
    where: {
      OR: [{ userId1: { in: userIds } }, { userId2: { in: userIds } }],
    },
  });
  await prisma.therapyRelation.deleteMany({
    where: {
      OR: [{ therapistId: { in: userIds } }, { clientId: { in: userIds } }],
    },
  });
  await prisma.therapistNote.deleteMany({
    where: {
      OR: [{ therapistId: { in: userIds } }, { clientId: { in: userIds } }],
    },
  });
  await prisma.clientConceptualization.deleteMany({
    where: {
      OR: [{ therapistId: { in: userIds } }, { clientId: { in: userIds } }],
    },
  });
  await prisma.modeMap.deleteMany({
    where: {
      OR: [{ therapistId: { in: userIds } }, { clientId: { in: userIds } }],
    },
  });
  await prisma.therapistCustomMode.deleteMany({
    where: { therapistId: { in: userIds } },
  });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}
