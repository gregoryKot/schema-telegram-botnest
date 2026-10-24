import { encryptJson, decryptJson } from '../utils/crypto';

/**
 * payload запланированного уведомления шифруется ЦЕЛИКОМ (аудит 2026-10, T1).
 * В нём лежали текст задания терапевта, текст практики, имя терапевта и текст
 * итога дня — свободный текст в открытом виде, а реестр шифрования уверял
 * «свободного текста нет». Шифровать «список текстовых ключей» хуже, чем всё
 * целиком: новый ключ с текстом в списке легко забыть, а шаблонам payload
 * нужен только после расшифровки в getDue — SQL по его полям нигде нет.
 *
 * Хранится как зашифрованная JSON-строка в Json-колонке — тот же приём, что у
 * `ClientConceptualization.schemaIds` (шифр. JSON-строка вместо объекта).
 */
export function encryptPayload(payload?: object): string | undefined {
  return payload ? (encryptJson(payload) ?? undefined) : undefined;
}

/**
 * Читает payload. Старые строки (записаны до шифрования) приходят из Prisma уже
 * объектом — отдаём как есть, отдельной миграции данных не нужно. Строка,
 * которую не удалось расшифровать и разобрать, превращается в null: шаблон без
 * payload вернёт «нечего слать», и очередь отметит строку, а не упадёт.
 */
export function decryptPayload(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;
  return decryptJson<Record<string, unknown>>(raw);
}
