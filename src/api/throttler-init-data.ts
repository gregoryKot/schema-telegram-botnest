// Проверка подписи initData Telegram для бакета лимита. Вынесено из
// throttler-identity.ts (правило №10); общие правила бакета — в его шапке.
import { createHmac, timingSafeEqual } from 'crypto';
import { INIT_DATA_MAX_AGE_S } from './init-data-window';

/** Постоянное по времени сравнение строк разной длины. */
export function sameDigest(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * Подпись initData Telegram сходится? Схема площадки: ключ — HMAC от токена
 * бота по строке `WebAppData`, им подписан отсортированный список полей.
 * Свежесть проверяется тем же окном, что и в auth-гарде: пересланная старая
 * initData чужого пользователя иначе позволяла бы с любого адреса выжигать его
 * личный бакет (аудит 2026-10, B2). Старше окна или без `auth_date` — null, то
 * есть бакет адреса.
 */
export function verifiedInitDataSubject(
  initData: string,
  botToken: string | undefined,
  nowMs: number = Date.now(),
): string | null {
  if (!botToken) return null;
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return null;
    params.delete('hash');
    const checkString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
    const secretKey = createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();
    const expected = createHmac('sha256', secretKey)
      .update(checkString)
      .digest('hex');
    if (!sameDigest(hash, expected)) return null;
    // auth_date входит в подписанную строку, так что подделать его нельзя —
    // можно только переслать старую подпись целиком.
    const authDate = Number(params.get('auth_date'));
    if (!Number.isFinite(authDate) || authDate <= 0) return null;
    if (nowMs / 1000 - authDate > INIT_DATA_MAX_AGE_S) return null;
    const user = JSON.parse(params.get('user') ?? '{}') as {
      id?: string | number;
    };
    return user.id == null ? null : String(user.id);
  } catch {
    return null;
  }
}
