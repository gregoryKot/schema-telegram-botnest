import { SetMetadata } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';

// Инцидент 2026-09-13: @nestjs/throttler считает лимит в памяти процесса —
// на двух инстансах Amvera у каждого свой счётчик, и лимит POST
// /api/booking/book обходился ротацией инстанса. `@PersistentThrottle()`
// помечает денежные/заявочные ручки: их ключ HybridThrottleStorage
// (src/api/hybrid-throttle-storage.ts) считает в Postgres — счётчик общий на
// оба инстанса. Остальные маршруты остаются в памяти (не грузить БД записью
// на каждый запрос сайта).
export const PERSISTENT_THROTTLE_KEY = 'persistentThrottle';
export const PersistentThrottle = () =>
  SetMetadata(PERSISTENT_THROTTLE_KEY, true);

/** `db:`-префикс ключа — сигнал HybridThrottleStorage вести счёт в Postgres. */
export function withPersistentPrefix(
  key: string,
  reflector: Reflector,
  context: ExecutionContext,
): string {
  const persistent = reflector.getAllAndOverride<boolean>(
    PERSISTENT_THROTTLE_KEY,
    [context.getHandler(), context.getClass()],
  );
  return persistent ? `db:${key}` : key;
}
