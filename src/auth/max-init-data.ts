// Валидация подписи мини-аппа MAX. Спека: dev.max.ru/docs/webapps/validation.
//
// Алгоритм идентичен телеграмному WebApp (auth.service.ts:
// verifyTelegramWebAppData) — тот же secret_key = HMAC_SHA256(key:
// "WebAppData", data: botToken) — но у MAX свой формат разбора строки и
// СВОЙ токен бота (MAX_BOT_TOKEN, не связан с Telegram BOT_TOKEN).
//
// Чистая функция без Nest-зависимостей — так её проще тестировать и
// переиспользовать (MaxProvider, TelegramAuthGuard).
import { createHmac, timingSafeEqual } from 'crypto';

export interface MaxInitData {
  id: string;
  firstName?: string;
  username?: string;
}

/**
 * Токен бота MAX не задан — это НАША несобранная конфигурация, а не плохая
 * подпись от клиента. Отдельный класс нужен, чтобы вызывающий не отправил
 * такую ошибку в rejectInitData: тот классифицировал бы её как подделку и
 * будил админа алертом «suspicious_initdata» на каждой попытке входа, пока
 * переменную не проставят. Ровно этот случай и ждёт нас до появления токена.
 */
export class MaxNotConfiguredError extends Error {
  constructor() {
    super('MAX_BOT_TOKEN not configured');
    this.name = 'MaxNotConfiguredError';
  }
}

const HASH_RE = /^[0-9a-f]{64}$/i;
const DEFAULT_EXPIRES_IN_S = 3600; // MAX: «рекомендуемый интервал — 1 час»

interface VerifyOpts {
  expiresIn?: number; // секунды
  now?: number; // мс, для тестов — по умолчанию Date.now()
}

// Разбирает initData вручную: split('&'), затем split по ПЕРВОМУ '='.
// НЕ используем URLSearchParams — оно превращает буквальный `+` в пробел
// при парсинге query-строк, а MAX ожидает decodeURIComponent (буквальный
// `+` внутри значения иначе теряется и подпись не сойдётся). Регрессионный
// тест на это — max-init-data.spec.ts.
function parsePairs(initData: string): {
  entries: [string, string][];
  hash?: string;
  hashCount: number;
} {
  const entries: [string, string][] = [];
  let hash: string | undefined;
  let hashCount = 0;
  for (const pair of initData.split('&')) {
    if (pair.length === 0) continue;
    const eq = pair.indexOf('=');
    const key = eq === -1 ? pair : pair.slice(0, eq);
    const rawValue = eq === -1 ? '' : pair.slice(eq + 1);
    let value: string;
    try {
      value = decodeURIComponent(rawValue);
    } catch {
      throw new Error('Malformed initData encoding');
    }
    if (key === 'hash') {
      hashCount += 1;
      hash = value;
      continue;
    }
    entries.push([key, value]);
  }
  return { entries, hash, hashCount };
}

export function verifyMaxInitData(
  initData: string,
  botToken: string,
  opts: VerifyOpts = {},
): MaxInitData {
  const expiresIn = opts.expiresIn ?? DEFAULT_EXPIRES_IN_S;
  const now = opts.now ?? Date.now();

  const { entries, hash, hashCount } = parsePairs(initData);
  // Спека MAX: hash обязан встречаться РОВНО один раз.
  if (hashCount !== 1 || !hash) throw new Error('Missing hash in initData');
  // Иначе Buffer.from(hash, 'hex') даёт буфер другой длины и timingSafeEqual
  // бросает RangeError → 500 вместо 401 (та же защита, что в telegram.provider.ts).
  if (!HASH_RE.test(hash)) throw new Error('Malformed hash in initData');

  const launchParams = entries
    .slice()
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secretKey = createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();
  const expectedHash = createHmac('sha256', secretKey)
    .update(launchParams)
    .digest('hex');

  if (
    !timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(expectedHash, 'hex'))
  ) {
    throw new Error('Invalid MAX initData signature');
  }

  // Просрочка проверяется ПОСЛЕ проверки подписи (порядок из спеки MAX).
  // Сообщение обязано начинаться с 'init data expired' — от этого зависит
  // classifyInitDataFailure (src/api/initdata-alert.ts): просрочка не
  // должна будить админа алертом suspicious_initdata.
  const authDate = parseInt(
    entries.find(([k]) => k === 'auth_date')?.[1] ?? '0',
    10,
  );
  if (now / 1000 - authDate > expiresIn) {
    throw new Error('init data expired');
  }

  const userRaw = entries.find(([k]) => k === 'user')?.[1];
  if (!userRaw) throw new Error('Missing user in initData');
  let user: { id?: unknown; first_name?: unknown; username?: unknown };
  try {
    user = JSON.parse(userRaw) as typeof user;
  } catch {
    throw new Error('Invalid user JSON in initData');
  }
  if (typeof user.id !== 'number')
    throw new Error('Missing user id in initData');

  return {
    id: String(user.id),
    firstName:
      typeof user.first_name === 'string' ? user.first_name : undefined,
    username: typeof user.username === 'string' ? user.username : undefined,
  };
}
