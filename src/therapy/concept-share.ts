// Тумблер «Показать клиенту» во вкладке «Концептуализация» и схема случая в
// кабинете клиента. Решение «показывать ли» — за терапевтом, по каждому
// клиенту; по умолчанию не показано. Что именно видит клиент — белый список
// client-concept-view.ts. Выключил — следующий запрос клиента получает 404.
import { BadRequestException, ConflictException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { inSerializableTx } from '../prisma/serializable-retry';
import type { TherapyRelationsService } from './therapy-relations.service';
import {
  clientConceptView,
  type ClientConceptView,
} from './client-concept-view';
import { findClientRelation } from './therapy-relation-info';

export const OFFLINE_CLIENT_SHARE_ERROR =
  'Offline client has no account to show the case scheme to';

interface Deps {
  prisma: PrismaService;
  relations: Pick<TherapyRelationsService, 'assertHasClient'>;
}

/**
 * Включает или выключает показ. Только терапевт активной связи
 * (assertHasClient бросает «No active relation» — контроллер отвечает 403).
 * Повторное включение дату не сдвигает: клиент видит, с какого дня схема у
 * него. Строки ещё нет — создаётся пустая (поля заполнятся автосохранением).
 * Показ — не правка содержимого: версия строки (updatedAt, по ней сохранение
 * вкладки ловит чужую запись — concept-save.ts) остаётся прежней, иначе
 * следующее сохранение вкладки шло бы через 409 и перечитывание.
 */
export async function setConceptShared(
  deps: Deps,
  key: { therapistId: bigint; clientId: bigint },
  shared: boolean,
): Promise<{ sharedWithClientAt: Date | null }> {
  await deps.relations.assertHasClient(key.therapistId, key.clientId);
  // Офлайн-клиент (отрицательный id) без аккаунта: показывать некому.
  if (key.clientId < 0n)
    throw new BadRequestException(OFFLINE_CLIENT_SHARE_ERROR);
  const where = { therapistId_clientId: key };
  // Serializable: прочитанная версия пишется обратно, только если строку
  // между чтением и записью никто не тронул (иначе — повтор).
  return inSerializableTx(
    deps.prisma,
    async (tx) => {
      const concept = tx.clientConceptualization;
      const row = await concept.findUnique({
        where,
        select: { sharedWithClientAt: true, updatedAt: true },
      });
      const sharedWithClientAt = shared
        ? (row?.sharedWithClientAt ?? new Date())
        : null;
      if (row) {
        // Явный updatedAt: Prisma не подставит «сейчас» (@updatedAt).
        const data = { sharedWithClientAt, updatedAt: row.updatedAt };
        await concept.update({ where, data });
      } else if (shared) {
        // upsert: чужая вставка — тоже повтор, не P2002; update не исполняется.
        await concept.upsert({
          where,
          create: { ...key, sharedWithClientAt },
          update: { sharedWithClientAt },
        });
      }
      return { sharedWithClientAt };
    },
    () => new ConflictException('Conceptualization kept changing, try again'),
  );
}

/**
 * Схема случая клиента `clientId` от терапевта из «Мой терапевт»: null, если
 * связи нет, терапевт не показал схему или выключил показ.
 */
export async function findSharedConcept(
  prisma: PrismaService,
  clientId: bigint,
): Promise<ClientConceptView | null> {
  const relation = await findClientRelation(prisma, clientId);
  const therapistId = relation?.therapist?.id;
  if (!therapistId) return null;
  const row = await prisma.clientConceptualization.findUnique({
    where: { therapistId_clientId: { therapistId, clientId } },
  });
  return row ? clientConceptView(row) : null;
}
