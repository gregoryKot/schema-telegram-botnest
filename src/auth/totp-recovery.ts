// Резервные коды 2FA: выпуск, чтение списка и одноразовое погашение.
// Вынесено из totp.service.ts (правило №10): туда сел счётчик неудач на
// аккаунт (S11), а резервные коды — самостоятельный кусок со своим CAS.
import * as crypto from 'crypto';
import type { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { encryptJson, decryptJson } from '../utils/crypto';

const RECOVERY_CODES = 10;
const RECOVERY_CODE_BYTES = 5; // 10 hex chars per code

export function hashRecoveryCode(code: string): string {
  return crypto
    .createHash('sha256')
    .update(code.trim().toLowerCase())
    .digest('hex');
}

/** Новая пачка: коды показываются человеку ОДИН раз, в БД — шифрованные хеши. */
export function newRecoveryCodes(): { codes: string[]; stored: string } {
  const codes = Array.from({ length: RECOVERY_CODES }, () =>
    crypto.randomBytes(RECOVERY_CODE_BYTES).toString('hex'),
  );
  const hashes = codes.map(hashRecoveryCode);
  return { codes, stored: encryptJson(hashes) ?? JSON.stringify(hashes) };
}

/** Хеши из колонки: шифрованная строка (текущий формат) или старый массив. */
export function readRecoveryHashes(raw: unknown): string[] {
  if (typeof raw === 'string') return decryptJson<string[]>(raw) ?? [];
  return Array.isArray(raw) ? raw.map(String) : [];
}

/**
 * Погасить резервный код — АТОМАРНО (F1 аудита 2026-08). Раньше здесь был
 * read→filter→update: два параллельных запроса с ОДНИМ кодом оба проходили
 * indexOf и оба писали остаток — одноразовый код срабатывал двумя входами.
 * updateMany с CAS по текущему блобу (equals: raw = jsonb-равенство в
 * Postgres) пускает ровно одну запись: у проигравшего фильтр уже не совпадает
 * (count=0), код не засчитан. Два РАЗНЫХ кода, поданных строго одновременно,
 * тоже конфликтуют по блобу — проигравший повторит ввод (fail-closed).
 */
export async function consumeRecoveryCode(
  prisma: PrismaService,
  logger: Logger,
  userId: bigint,
  raw: unknown,
  code: string,
): Promise<boolean> {
  const hashes = readRecoveryHashes(raw);
  const idx = hashes.indexOf(hashRecoveryCode(code));
  if (idx === -1) return false;
  const remaining = hashes.filter((_, i) => i !== idx);
  const consumed = await prisma.user.updateMany({
    where: {
      id: userId,
      totpRecoveryCodes: { equals: raw as Prisma.InputJsonValue },
    },
    data: {
      totpRecoveryCodes: encryptJson(remaining) ?? JSON.stringify(remaining),
    },
  });
  if (consumed.count === 0) return false; // проиграли гонку — код не гасим
  logger.warn(
    `Recovery code consumed for user ${userId} (${remaining.length} left)`,
  );
  return true;
}
