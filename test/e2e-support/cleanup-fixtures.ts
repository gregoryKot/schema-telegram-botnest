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
// cleanupOwnershipFixtures НЕ трогает таблицы вне фикстур ownership-спеков
// (booking/donation/subscription, article, bookingSetting и т.п.) — для
// платёжного контура своя чистка, cleanupPaymentFixtures ниже.
import { createHash } from 'crypto';

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
  'userPhraseCheck',
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

/**
 * Заводит строки User для переданных id — фикстуры, на которые ссылаются данные
 * ownership-спеков через FK userId. Раньше строку лениво создавал upsert в
 * TelegramAuthGuard при первом Bearer-запросе. С 2026-08-31 guard этого больше
 * НЕ делает: устаревший 15-минутный токен не должен воскрешать удалённый или
 * слитый аккаунт (telegram-auth.guard.ts). Поэтому пользователей спеки заводят
 * явно — вызывать в beforeAll ПОСЛЕ cleanupOwnershipFixtures. Идемпотентно.
 */
export async function seedUsers(prisma: any, userIds: bigint[]): Promise<void> {
  for (const id of userIds) {
    await prisma.user.upsert({ where: { id }, update: {}, create: { id } });
  }
}

// ─── Платёжный контур (test/payment-webhooks.e2e-spec.ts) ─────────────────
//
// Booking/Donation/Subscription/SubscriptionCharge не имеют userId — вне
// области cleanupOwnershipFixtures выше. На фейке (fake-prisma.ts) каждый
// e2e-файл получает свежий in-memory прогон, чистка де-факто no-op. На
// реальном Postgres (TEST_TRUST_PLAN.md, п.1) спек гоняется трижды подряд на
// одной БД (проверка идемпотентности вебхука) — без чистки второй прогон
// падает на unique-констрейнтах Booking.cancelToken / Subscription.cancelToken
// (фикстуры используют фиксированные тестовые токены).

/** Фикстуры одного прогона payment-webhooks.e2e-spec — идентифицируются по
 * фиксированным тестовым токенам/маркерам, а не по всей таблице (та же БД
 * может содержать реальные записи, если когда-то будет шариться со staging). */
export interface PaymentFixtureIds {
  bookingCancelTokens: string[];
  subscriptionCancelTokens: string[];
  donationMarker: string;
  /** clientContact-и, для которых confirm() booking создаёт ClientMeeting
   * (клиентский ключ — sha256 нормализованного контакта, см. meeting.service.ts). */
  clientContacts?: string[];
}

export async function cleanupPaymentFixtures(
  prisma: any,
  fixture: PaymentFixtureIds,
): Promise<void> {
  // SubscriptionCharge.subscriptionId — FK on Subscription (onDelete: Cascade
  // в схеме, но фейк каскад не эмулирует) — чистим явно до subscription.
  const subs = await prisma.subscription.findMany({
    where: { cancelToken: { in: fixture.subscriptionCancelTokens } },
  });
  const subIds = subs.map((s: { id: number }) => s.id);
  if (subIds.length) {
    await prisma.subscriptionCharge.deleteMany({
      where: { subscriptionId: { in: subIds } },
    });
  }
  await prisma.subscription.deleteMany({
    where: { cancelToken: { in: fixture.subscriptionCancelTokens } },
  });
  await prisma.booking.deleteMany({
    where: { cancelToken: { in: fixture.bookingCancelTokens } },
  });
  await prisma.donation.deleteMany({
    where: { comment: fixture.donationMarker },
  });
  if (fixture.clientContacts?.length) {
    await prisma.clientMeeting.deleteMany({
      where: { clientKey: { in: fixture.clientContacts.map(clientKey) } },
    });
  }
}

// Дублирует нормализацию контакта из src/booking/meeting.service.ts
// (приватная функция сервиса, не экспортируется) — фикстуре нужен тот же
// хэш, чтобы найти и вычистить ClientMeeting, созданный подтверждением брони.
function clientKey(contact: string): string {
  const norm = contact
    .trim()
    .toLowerCase()
    .replace(/^@/, '')
    .replace(/[\s()+-]/g, '');
  return createHash('sha256').update(norm).digest('hex');
}
