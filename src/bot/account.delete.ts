// Полное удаление аккаунта (right-to-erasure). Вынесено из account.service.ts
// отдельным файлом: транзакция перечисляет двадцать с лишним таблиц и по
// правилу №10 не имеет права жить внутри сервиса, у которого есть ещё десяток
// обязанностей.
import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { telegramIdFor } from '../auth/telegram-identity';
import { USER_DATA_TABLES } from './user-data-tables';

/**
 * HARD delete — вырываем каждую строку, которая ссылается на человека, включая
 * провайдеров входа, веб-сессии, заявки терапевта и саму строку User. Никакого
 * мягкого удаления с флагом.
 *
 * После транзакции — VACUUM только `"User"`: имя и id там открытым текстом, таблица
 * небольшая. Остальные таблицы — шифротекст и служебные поля, их чистит автовакуум:
 * проход по большим (Rating) на каждое удаление — под statement_timeout 30 с без обхода.
 */
export async function deleteAllUserData(
  prisma: PrismaService,
  logger: Logger,
  userId: bigint,
): Promise<void> {
  const uid = userId;
  // Подписку ищем по АДРЕСУ в Telegram, а не по userId. Раньше здесь стояло
  // `telegramId: uid` с пояснением «у телеграм-пользователей userId ===
  // telegramId» — после слияния аккаунтов это перестаёт быть правдой, и
  // удаление веб-аккаунта не отменяло подписку: списания продолжались с
  // человека, который аккаунт удалил. Веб-подписки без telegramId к аккаунту
  // не привязаны — ими управляют по собственному cancelToken.
  const telegramId = await telegramIdFor(prisma, uid);
  const subscriptionIds = [uid, ...(telegramId !== null ? [telegramId] : [])];

  await prisma.$transaction([
    // Все таблицы с userId (реестр USER_DATA_TABLES).
    ...USER_DATA_TABLES.map((table) =>
      (
        prisma[table] as unknown as {
          deleteMany(args: {
            where: { userId: bigint };
          }): Prisma.PrismaPromise<Prisma.BatchPayload>;
        }
      ).deleteMany({ where: { userId: uid } }),
    ),
    // Клинические строки о человеке: убираем, когда удаляется ЛЮБАЯ из сторон.
    // clientId важен не меньше therapistId — right-to-erasure клиента включает
    // конспектуализацию и заметки терапевта О НЁМ (аудит 2026-07, D-1).
    prisma.clientConceptualization.deleteMany({
      where: { OR: [{ therapistId: uid }, { clientId: uid }] },
    }),
    prisma.therapistNote.deleteMany({
      where: { OR: [{ therapistId: uid }, { clientId: uid }] },
    }),
    prisma.therapyRelation.deleteMany({
      where: { OR: [{ therapistId: uid }, { clientId: uid }] },
    }),
    // Карты режимов (о клиенте, созданы терапевтом) — убираем, если уходит
    // любая из сторон.
    prisma.modeMap.deleteMany({
      where: { OR: [{ therapistId: uid }, { clientId: uid }] },
    }),
    prisma.therapistCustomMode.deleteMany({ where: { therapistId: uid } }),
    // Задания офлайн-клиентов терапевта: у них userId = -TherapyRelation.id и
    // нет FK на User, поэтому ни реестр USER_DATA_TABLES (по userId = uid), ни
    // каскад их не достают — без этой строки они оставались сиротами (аудит
    // 2026-10, T8). Текст заданий — клинический, шифрованный.
    prisma.userTask.deleteMany({
      where: { assignedBy: uid, userId: { lt: 0n } },
    }),
    // Пары (две ссылки).
    prisma.pair.deleteMany({
      where: { OR: [{ userId1: uid }, { userId2: uid }] },
    }),
    // Вход: провайдеры + веб-сессии + заявки терапевта.
    prisma.authProvider.deleteMany({ where: { userId: uid } }),
    prisma.webSession.deleteMany({ where: { userId: uid } }),
    prisma.therapistRequest.deleteMany({ where: { userId: uid } }),
    // Билеты входа, где человек стоит НЕ в колонке userId: `shownToTelegramId`
    // — сырой telegramId того, кому бот показал карточку сверки,
    // `approvedUserId` — кто её подтвердил. Реестр чистит LoginTicket только по
    // userId, поэтому обе оси оставались (L3, 2026-07-20 — тот же класс, что
    // Subscription.telegramId). Протухшие билеты сносятся при выписке
    // следующего, но «следующий» может не случиться месяцами, и до тех пор
    // мёртвая строка хранит адрес человека, который аккаунт удалил.
    prisma.loginTicket.deleteMany({
      where: {
        OR: [
          { shownToTelegramId: { in: subscriptionIds } },
          { approvedUserId: uid },
        ],
      },
    }),
    // Регулярные подписки: снимаем списание. Списания уходят каскадом по FK.
    prisma.subscription.deleteMany({
      where: { telegramId: { in: subscriptionIds } },
    }),
    // Записи на консультацию не удаляем — это финансовые и календарные записи
    // (оплата, встреча в календаре терапевта), но связь с человеком рвём и по
    // Telegram-id, и по аккаунту: иначе после удаления по id по-прежнему можно
    // найти все его записи (аудит 2026-10, F3). Связь пишет только запись из
    // приложения (Booking.userId + clientTelegramId, #546); FK SetNull сделал
    // бы то же для userId, но удаление не полагается на каскад молча. Имя,
    // контакт и текст запроса удалением аккаунта НЕ затрагиваются — их
    // закрывает ретенция по сроку (booking-retention.service.ts, решение
    // владельца 2026-10-08 по находке L3).
    prisma.booking.updateMany({
      where: {
        OR: [{ clientTelegramId: { in: subscriptionIds } }, { userId: uid }],
      },
      data: { clientTelegramId: null, userId: null },
    }),
    // И наконец сама строка пользователя.
    prisma.user.delete({ where: { id: uid } }),
  ]);

  // Асинхронный VACUUM "User" (не блокирует, не FULL) — почему одной таблицы, см. выше.
  prisma
    .$executeRawUnsafe('VACUUM ANALYZE "User"')
    .catch((e) =>
      logger.warn(`Post-delete VACUUM failed: ${(e as Error).message}`),
    );
}
