import { Prisma } from '@prisma/client';
import { encryptJson, decryptJson } from '../utils/crypto';

/**
 * payload уведомления шифруется ЦЕЛИКОМ (аудит 2026-10, T1): список текстовых
 * ключей легко забыть дополнить, а SQL по полям payload нет — шаблоны читают
 * его после расшифровки в getDue. Шифр. JSON-строка в Json-колонке.
 */
export function encryptPayload(payload?: object): string | undefined {
  return payload ? (encryptJson(payload) ?? undefined) : undefined;
}

/** Старые строки (до шифрования) приходят объектом — как есть; нерасшифрованная
 *  строка → null: шаблон вернёт «нечего слать», очередь отметит строку. */
export function decryptPayload(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;
  return decryptJson<Record<string, unknown>>(raw);
}

// Ушедшая из очереди строка payload не хранит: его читает только getDue у
// ждущих, а у строк до #1140 в нём данные о состоянии (РКН, #1135).
export const sentNow = () => ({ sentAt: new Date(), payload: Prisma.DbNull });
export const cancelledNow = () => ({
  cancelledAt: new Date(),
  payload: Prisma.DbNull,
});
