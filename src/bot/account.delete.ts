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
 * После транзакции — VACUUM по затронутым таблицам (внутри транзакции его
 * запустить нельзя). Он освобождает мёртвые кортежи, то есть Postgres быстрее
 * физически перезапишет данные.
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
    // Пары (две ссылки).
    prisma.pair.deleteMany({
      where: { OR: [{ userId1: uid }, { userId2: uid }] },
    }),
    // Вход: провайдеры + веб-сессии + заявки терапевта.
    prisma.authProvider.deleteMany({ where: { userId: uid } }),
    prisma.webSession.deleteMany({ where: { userId: uid } }),
    prisma.therapistRequest.deleteMany({ where: { userId: uid } }),
    // Регулярные подписки: снимаем списание. Списания уходят каскадом по FK.
    prisma.subscription.deleteMany({
      where: { telegramId: { in: subscriptionIds } },
    }),
    // И наконец сама строка пользователя.
    prisma.user.delete({ where: { id: uid } }),
  ]);

  // Асинхронный VACUUM только по затронутым таблицам (не блокирует, не FULL).
  prisma
    .$executeRawUnsafe('VACUUM ANALYZE "User"')
    .catch((e) =>
      logger.warn(`Post-delete VACUUM failed: ${(e as Error).message}`),
    );
}
