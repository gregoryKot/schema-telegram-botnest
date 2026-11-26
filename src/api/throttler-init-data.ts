// Проверка подписи initData Telegram для бакета лимита. Вынесено из
// throttler-identity.ts (правило №10); общие правила бакета — в его шапке.
import { timingSafeEqual } from 'crypto';
import { verifyTelegramInitData } from '../auth/telegram-init-data';

/** Постоянное по времени сравнение строк разной длины. */
export function sameDigest(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * Подпись initData Telegram сходится? Проверяет тот же верификатор, что и
 * auth-гард (auth/telegram-init-data.ts): то же окно свежести, то же
 * сравнение. Пересланная старая initData чужого пользователя иначе позволяла бы
 * с любого адреса выжигать его личный бакет (аудит 2026-10, B2). Старше окна,
 * без `auth_date` или с любой иной ошибкой — null, то есть бакет адреса.
 */
export function verifiedInitDataSubject(
  initData: string,
  botToken: string | undefined,
  nowMs: number = Date.now(),
): string | null {
  if (!botToken) return null;
  try {
    return String(verifyTelegramInitData(initData, botToken, nowMs).user.id);
  } catch {
    return null;
  }
}
