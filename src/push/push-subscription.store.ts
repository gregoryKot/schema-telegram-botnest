// Чтение и запись подписок на уведомления в приложении (модель
// PushSubscription). Адрес подписки — capability-URL: по нему можно слать
// человеку уведомления, поэтому он и ключи шифрования лежат зашифрованными
// (правило «Новая таблица с userId», реестр encryption-coverage.spec.ts), а
// поиск идёт по endpointHash. Отдельным файлом от PushService: подписчиков
// пачкой читает и AccountService (кому куда слать), а он с push-модулем не
// связан — функция над Prisma не тянет за собой граф модулей.
import type { PrismaService } from '../prisma/prisma.service';
import {
  decryptRecord,
  encryptRecord,
  type EncryptSchema,
} from '../utils/crypto';
import { hashEndpoint } from './push-endpoint';

export const PUSH_SCHEMA: EncryptSchema = {
  strings: ['endpoint', 'p256dh', 'auth'],
  model: 'PushSubscription',
};

export type PushDb = Pick<PrismaService, 'pushSubscription'>;

export interface PushKeys {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface StoredPush extends PushKeys {
  id: number;
}

/**
 * Сохранить подписку за человеком. Ключ — хэш адреса, unique глобальный:
 * тот же браузер под другим аккаунтом переезжает к нему (userId
 * перезаписывается), второй строки не появляется.
 */
export async function saveSubscription(
  db: PushDb,
  userId: bigint,
  keys: PushKeys,
): Promise<StoredPush> {
  const endpointHash = hashEndpoint(keys.endpoint);
  const secret = encryptRecord({ ...keys }, PUSH_SCHEMA);
  const row = await db.pushSubscription.upsert({
    where: { endpointHash },
    create: { userId, endpointHash, ...secret },
    update: { userId, ...secret },
    select: { id: true },
  });
  return { id: row.id, ...keys };
}

/** Все подписки человека, расшифрованные. */
export async function subscriptionsOf(
  db: PushDb,
  userId: bigint,
): Promise<StoredPush[]> {
  const rows = await db.pushSubscription.findMany({
    where: { userId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
    orderBy: { id: 'asc' },
  });
  return rows.map((r) => decryptRecord(r, PUSH_SCHEMA));
}

/** Удалить подписку по id (push-сервис ответил, что её больше нет). */
export async function deleteSubscription(db: PushDb, id: number) {
  await db.pushSubscription.deleteMany({ where: { id } });
}

/**
 * Удалить подписку с этим адресом, только если она принадлежит этому
 * человеку. true — строка была и удалена.
 */
export async function deleteOwnSubscription(
  db: PushDb,
  userId: bigint,
  endpoint: string,
): Promise<boolean> {
  const { count } = await db.pushSubscription.deleteMany({
    where: { endpointHash: hashEndpoint(endpoint), userId },
  });
  return count > 0;
}

/** У кого из пачки есть хоть одна подписка — одним запросом (тик очереди). */
export async function subscribedUserIds(
  db: PushDb,
  ids: bigint[],
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const rows = await db.pushSubscription.findMany({
    where: { userId: { in: ids } },
    select: { userId: true },
  });
  return new Set(rows.map((r) => r.userId.toString()));
}
