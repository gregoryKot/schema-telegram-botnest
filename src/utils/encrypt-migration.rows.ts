import { Logger } from '@nestjs/common';
import { decrypt, looksLikeCiphertext } from './crypto';

const logger = new Logger('EncryptMigration');

// Heuristic — a value is plaintext iff decrypt() returns it unchanged
// (and it's non-empty). Decrypt is no-op for non-base64 / wrong-tag input.
//
// БАГ (найден аудитом, см. encrypt-migration.spec.ts): если ключ, которым
// строка была зашифрована, больше не сконфигурирован (ENCRYPTION_KEY_OLD
// убрали раньше времени), decrypt(v) === v тоже — не потому что v плейнтекст,
// а потому что decrypt() тихо возвращает вход как есть, не подобрав ключ.
// Раньше это трактовалось как «плейнтекст» и шифровалось ЕЩЁ РАЗ — оригинал
// становился нечитаемым без старого ключа.
//
// Фикс: если строка decrypt-инвариантна, но ПОХОЖА на наш формат шифротекста
// (looksLikeCiphertext — строгий base64 + длина ≥29 байт), это не плейнтекст,
// а неизвестный/утерянный ключ — строку нельзя трогать. Тред-офф: настоящий
// плейнтекст, случайно являющийся валидным base64 ≥29 байт (редко, но
// возможно), тоже будет пропущен и останется незашифрованным — миграция
// идемпотентна и дошифрует его позже, после починки ключей. Это дешевле, чем
// необратимая потеря данных от двойного шифрования.
export type PlaintextCheck = 'plaintext' | 'encrypted' | 'unknown-key';

export function classify(v: string): PlaintextCheck {
  if (!v) return 'encrypted'; // пусто — трогать нечего
  if (decrypt(v) !== v) return 'encrypted';
  if (looksLikeCiphertext(v)) return 'unknown-key';
  return 'plaintext';
}

/**
 * Строка похожа на шифротекст, но текущий ключ её не читает. Пер-строчный
 * уровень — warn (лавина DM на каждую строку не нужна): итог один раз за
 * старт уходит error-сводкой через счётчик по таблицам.
 */
export function warnUnknownKey(
  table: string,
  id: unknown,
  unknownKey: Record<string, number>,
): void {
  unknownKey[table] = (unknownKey[table] ?? 0) + 1;
  logger.warn(
    `[encrypt-migration] ${table}#${String(id)}: возможна неполная ротация ` +
      'ENCRYPTION_KEY — строка похожа на шифротекст, пропущена',
  );
}

// Обёртка над prisma.update — одна упавшая строка не должна обрывать всю
// миграцию (раньше падение for-цикла на первой же ошибке БД оставляло
// необработанными все остальные строки и таблицы, см. spec).
export async function safeUpdate(
  table: string,
  id: unknown,
  run: () => Promise<unknown>,
  failures: { count: number },
): Promise<boolean> {
  try {
    await run();
    return true;
  } catch (e) {
    failures.count++;
    logger.warn(
      `${table}#${String(id)}: update failed, skipping — ${(e as Error).message}`,
    );
    return false;
  }
}
