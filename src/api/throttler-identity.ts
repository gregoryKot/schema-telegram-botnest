// Кто именно исчерпал лимит запросов. Чистый модуль без Nest — так его можно
// накрыть тестом целиком, включая подделку (образец — max-init-data.ts).
//
// Правило №5: бакет строится по ПРОВЕРЕННОЙ подписи. Проверка тут настоящая,
// а не «распарсили и поверили»: до 2026-08 гард доверял `sub` из JWT, который
// никто не сверял, и скованность с IP (`uid:<sub>|ip:<ip>`) бакет не спасала —
// ротация фейкового `sub` давала новый ключ на каждый запрос, то есть лимит с
// одного адреса обходился целиком. Комментарий в гарде при этом утверждал
// обратное, и утверждение прожило год.
//
// Почему не «просто по IP». Легитимные люди за общим NAT делили бы один
// бакет — это чинит обход ценой лимита для честных. С проверкой подписи цена
// не нужна: у настоящего пользователя подпись сходится всегда, у подделки —
// никогда, и она падает в IP-бакет, где ротация уже ничего не даёт.
import { createHmac, timingSafeEqual } from 'crypto';

/** Постоянное по времени сравнение строк разной длины. */
function sameDigest(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * Подпись HS256 сходится И это именно ACCESS-токен, ещё живой? Ключ — тот же,
 * чем подписывали (JWT_SECRET).
 *
 * Почему мало одной подписи (разбор 2026-08-31). Тем же JWT_SECRET подписаны
 * не только access-токены: link, merge, totp-challenge, refresh. Утёкший
 * ИСТОРИЧЕСКИЙ токен любого из этих видов сходится по подписи и — раз бакет
 * больше не скован с IP — позволил бы кросс-IP занять и «отравить» чужой
 * бакет лимита. Поэтому требуем `type === 'access'` и непросроченный `exp`:
 * протухший или чужого вида токен падает в IP-бакет, как подделка.
 */
export function verifiedJwtSubject(
  token: string,
  secret: string | undefined,
): string | null {
  if (!secret) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  const expected = createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url');
  if (!sameDigest(signature, expected)) return null;
  try {
    const body = JSON.parse(Buffer.from(payload, 'base64url').toString()) as {
      sub?: string | number;
      type?: string;
      exp?: number;
    };
    if (body.type !== 'access') return null;
    // exp в секундах (стандарт JWT); нет exp или уже прошёл — не наш случай.
    if (typeof body.exp !== 'number' || body.exp * 1000 <= Date.now())
      return null;
    return body.sub == null ? null : String(body.sub);
  } catch {
    return null;
  }
}

/**
 * Подпись initData Telegram сходится? Схема площадки: ключ — HMAC от токена
 * бота по строке `WebAppData`, им подписан отсортированный список полей.
 * Свежесть тут не проверяется — это забота auth-гарда, а не счётчика.
 */
export function verifiedInitDataSubject(
  initData: string,
  botToken: string | undefined,
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
    const user = JSON.parse(params.get('user') ?? '{}') as {
      id?: string | number;
    };
    return user.id == null ? null : String(user.id);
  } catch {
    return null;
  }
}

export interface TrackerRequest {
  telegramUserId?: number;
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
}

export interface TrackerSecrets {
  jwtSecret?: string;
  botToken?: string;
}

/** Ключ бакета: проверенный хозяин или адрес, третьего не дано. */
export function resolveTracker(
  req: TrackerRequest,
  secrets: TrackerSecrets,
): string {
  // Ставится TelegramAuthGuard'ом, который идёт ПОСЛЕ этого гарда, — значит
  // на первом проходе поля нет. Оставлено на случай повторной проверки.
  if (req.telegramUserId) return `uid:${req.telegramUserId}`;

  const header = (name: string): string | undefined => {
    const value = req.headers?.[name];
    return typeof value === 'string' ? value : undefined;
  };

  const auth = header('authorization');
  if (auth?.startsWith('Bearer ')) {
    const sub = verifiedJwtSubject(auth.slice(7), secrets.jwtSecret);
    if (sub) return `uid:${sub}`;
  }

  const initData = header('x-telegram-init-data');
  if (initData) {
    const sub = verifiedInitDataSubject(initData, secrets.botToken);
    if (sub) return `uid:${sub}`;
  }

  return req.ip ?? 'unknown';
}
