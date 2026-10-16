// Единственный верификатор подписи initData мини-аппа Telegram. Им пользуются
// все три входа: auth-гард (api/init-data-paths.ts), бакет лимита
// (api/throttler-init-data.ts) и POST /api/auth/telegram/webapp (auth.service.ts).
//
// Аудит 2026-10: подпись проверяли три независимые реализации, окно свежести
// было общим только у двух. Правка константы расходила третий вход, а гард
// сравнивал подпись обычным `===` (внутри @tma.js). Теперь реализация одна:
//   - сравнение подписи — crypto.timingSafeEqual;
//   - окно — INIT_DATA_MAX_AGE_S из api/init-data-window.ts, литерала здесь нет;
//   - порядок «подпись → срок», как у MAX (max-init-data.ts): поддельная, но
//     старая строка получает ошибку подписи и будит админа, а не прячется под
//     «просрочена» (classifyInitDataFailure в api/initdata-alert.ts).
// Ошибки — обычные Error: каждый вход сам решает, во что их превратить.
// Алгоритм MAX здесь не живёт: другая площадка, свой токен и своё окно.
import { createHmac, timingSafeEqual } from 'crypto';
import { INIT_DATA_MAX_AGE_S } from '../api/init-data-window';

const HASH_RE = /^[0-9a-f]{64}$/i;
const AUTH_DATE_RE = /^\d{1,15}$/;

export interface TelegramInitDataUser {
  id: number;
  first_name?: string;
}

export interface VerifiedTelegramInitData {
  authDate: number;
  params: URLSearchParams;
}

/** Сообщение начинается с 'init data expired' — по нему классификатор отказов узнаёт просрочку. */
export const INIT_DATA_EXPIRED_MESSAGE = 'init data expired';

function byCodePoint(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Подпись сходится и initData свежая. Порядок проверок: hash → подпись →
 * auth_date → срок. user не читается (см. readTelegramUser).
 */
export function verifyTelegramInitDataSignature(
  initData: string,
  botToken: string,
  nowMs: number = Date.now(),
): VerifiedTelegramInitData {
  const params = new URLSearchParams(initData);
  const hashes = params.getAll('hash');
  if (hashes.length !== 1) throw new Error('Missing hash in initData');
  const hash = hashes[0];
  // Иначе Buffer.from(hash, 'hex') даёт буфер другой длины и timingSafeEqual
  // бросает RangeError → 500 вместо 401.
  if (!HASH_RE.test(hash)) throw new Error('Malformed hash in initData');
  params.delete('hash');

  // Спека Telegram: поля по алфавиту; сравнение по кодам символов, а не
  // localeCompare — тот зависит от локали ICU.
  const checkString = Array.from(params.entries())
    .sort(([a], [b]) => byCodePoint(a, b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secretKey = createHmac('sha256', 'WebAppData')
    .update(botToken.trim())
    .digest();
  const expected = createHmac('sha256', secretKey).update(checkString).digest();
  if (!timingSafeEqual(Buffer.from(hash, 'hex'), expected)) {
    throw new Error('Invalid Telegram WebApp signature');
  }

  // auth_date входит в подписанную строку: подделать нельзя, можно лишь
  // переслать старую подпись целиком. Нет даты — это формат, а не просрочка.
  const rawAuthDate = params.get('auth_date');
  if (rawAuthDate === null || !AUTH_DATE_RE.test(rawAuthDate)) {
    throw new Error('Invalid auth_date in initData');
  }
  const authDate = Number(rawAuthDate);
  if (authDate <= 0) throw new Error('Invalid auth_date in initData');
  if (nowMs / 1000 - authDate > INIT_DATA_MAX_AGE_S) {
    throw new Error(INIT_DATA_EXPIRED_MESSAGE);
  }
  return { authDate, params };
}

/** Поле user подписанной initData: JSON с числовым id. */
export function readTelegramUser(
  params: URLSearchParams,
): TelegramInitDataUser {
  const raw = params.get('user');
  if (!raw) throw new Error('Missing user in initData');
  let user: { id?: unknown; first_name?: unknown };
  try {
    user = JSON.parse(raw) as typeof user;
  } catch {
    throw new Error('Invalid user JSON in initData');
  }
  if (
    user === null ||
    typeof user !== 'object' ||
    typeof user.id !== 'number' ||
    !Number.isSafeInteger(user.id) ||
    user.id <= 0
  ) {
    throw new Error('Missing user id in initData');
  }
  return {
    id: user.id,
    ...(typeof user.first_name === 'string'
      ? { first_name: user.first_name }
      : {}),
  };
}

/** Подпись + срок + пользователь одним вызовом (auth.service, бакет лимита). */
export function verifyTelegramInitData(
  initData: string,
  botToken: string,
  nowMs: number = Date.now(),
): { user: TelegramInitDataUser; authDate: number } {
  const { params, authDate } = verifyTelegramInitDataSignature(
    initData,
    botToken,
    nowMs,
  );
  return { user: readTelegramUser(params), authDate };
}
