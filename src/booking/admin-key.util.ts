import { applyDecorators, ForbiddenException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { timingSafeEqual } from 'crypto';
import { PersistentThrottle } from '../api/persistent-throttle.decorator';

/** Минимальная длина ADMIN_BOOKING_KEY. Один ключ закрывает всю админку
 *  (записи, статьи, контент сайта, фразы канала), а лимит запросов на
 *  админ-ручках — потолок, не гарантия: короткий ключ перебирается. Аудит
 *  2026-10 (I2): формат реестра был `nonEmpty`, и ключ из четырёх символов
 *  считался валидным. */
export const MIN_ADMIN_KEY_LENGTH = 32;

/** Формат для реестра env (`env-registry.entries.booking.ts`): своя проверка,
 *  а не общий `formats.*` — реестр форматов правят параллельно. */
export const adminKeyFormat = (value: string): string | null =>
  value.length >= MIN_ADMIN_KEY_LENGTH
    ? null
    : `слишком короткий ключ: ${value.length} символов, нужно не меньше ${MIN_ADMIN_KEY_LENGTH}`;

/** Причина отказа — для аудита, наружу (в тело ответа) не уходит. */
export type AdminKeyRejectReason =
  'not_configured' | 'weak_config' | 'mismatch';

/** 403 админ-ручки. Отдельный класс, чтобы `AdminKeyAuditInterceptor`
 *  записал отказ в аудит, не меняя ни контроллеры, ни тело ответа (клиент
 *  по-прежнему видит обычный ForbiddenException «Invalid admin key»). */
export class AdminKeyRejectedException extends ForbiddenException {
  constructor(readonly reason: AdminKeyRejectReason) {
    super('Invalid admin key');
  }
}

/** Throws unless the provided key matches the configured ADMIN_BOOKING_KEY.
 * Constant-time compare (project invariant: never `===` on secrets). An empty
 * configured key always rejects, so a missing env never opens the endpoint.
 * Сконфигурированный ключ короче MIN_ADMIN_KEY_LENGTH приравнен к незаданному:
 * слабый ключ закрывает админку, а не открывает её «почти». */
export function assertAdminKey(
  provided: string | undefined,
  expected: string,
): void {
  if (!expected) throw new AdminKeyRejectedException('not_configured');
  if (expected.length < MIN_ADMIN_KEY_LENGTH) {
    throw new AdminKeyRejectedException('weak_config');
  }
  const e = Buffer.from(expected, 'utf8');
  const p = Buffer.from(provided ?? '', 'utf8');
  if (e.length !== p.length || !timingSafeEqual(e, p)) {
    throw new AdminKeyRejectedException('mismatch');
  }
}

/** Лимит на админ-ручки: 60 запросов/час на IP и ручку, счётчик в Postgres
 *  (общий на все инстансы Amvera — правило №5: в памяти процесса лимит
 *  обходится сменой инстанса). Глобальный лимит (200/мин, в памяти) для
 *  перебора ключа слишком щедр. Ставится на КЛАСС контроллера: guard читает
 *  метаданные и у метода, и у класса (persistent-throttle.decorator.ts). */
export const ADMIN_THROTTLE = { limit: 60, ttl: 3_600_000 } as const;
export const AdminThrottle = () =>
  applyDecorators(Throttle({ long: ADMIN_THROTTLE }), PersistentThrottle());
