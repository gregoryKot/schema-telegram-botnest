import { Prisma } from '@prisma/client';

// Ключ pg_advisory_xact_lock для сериализации «проверить слот → создать бронь».
// Один глобальный лок на все брони: трафик записи низкий, сериализация дешевле,
// чем exclusion constraint по времени (P-1, аудит 2026-07).
export const BOOKING_SLOT_LOCK_KEY = 911_001;

/**
 * Берёт транзакционный advisory-lock на бронирование слотов. Снимается сам
 * на commit/rollback транзакции, в которой вызван.
 *
 * Инцидент 2026-09-13: запись на консультацию падала 500 на КАЖДОЙ попытке.
 * `pg_advisory_xact_lock` возвращает `void`, а Prisma 7 с driver-adapter
 * (`@prisma/adapter-pg`) не умеет десериализовать колонку такого типа в
 * `$queryRaw` — «Failed to deserialize column of type 'void'». Поэтому лок
 * берётся через `$executeRaw`: он не читает колонки ответа. Юнит-тесты с
 * моком `tx.$queryRaw` этого не видели по построению — свойство драйвера
 * доказывается только на живом Postgres (`test/booking-slot-lock.e2e-spec.ts`,
 * джоба `migrations`).
 */
export async function lockBookingSlots(
  tx: Pick<Prisma.TransactionClient, '$executeRaw'>,
): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${BOOKING_SLOT_LOCK_KEY})`;
}
