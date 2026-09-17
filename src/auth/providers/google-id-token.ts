// Проверка id_token от Google — вынесена из google.provider.ts отдельным
// чистым модулем: здесь сетевая логика JWKS, её тестировать проще без Nest.
//
// Инцидент 2026-08-04: с хостинга перестал резолвиться googleapis.com — вход
// через Google падал с «Google id_token JWT verification failed: fetch failed».
// Обмен кода на токен при этом проходил (у него уже был fallback на
// accounts.google.com), а вот JWKS живёт ТОЛЬКО на googleapis.com — запасного
// адреса у него нет, и подпись проверить было нечем.
//
// Что делаем, когда JWKS недостижим: проверяем claims офлайн (iss/aud/exp) и
// принимаем токен. Безопасность держится на канале: id_token приходит не от
// браузера, а нашим же POST'ом на токен-эндпоинт Google по TLS с client_secret,
// так что происхождение токена уже доказано — подпись здесь второй рубеж.
// Документация Google говорит то же самое: токен, полученный напрямую от
// Google по HTTPS, разрешено принимать без проверки подписи. Ослабление
// включается ТОЛЬКО на сетевом сбое: подделанная подпись, чужой aud и
// просрочка отвергаются как раньше.
import {
  createRemoteJWKSet,
  decodeJwt,
  jwtVerify,
  type JWTPayload,
} from 'jose';

const GOOGLE_JWKS_URI = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
/** Запас на расхождение часов хоста и Google. */
const CLOCK_SKEW_S = 60;

export interface GoogleIdTokenClaims {
  sub: string;
  email?: string;
  name?: string;
  emailVerified: boolean;
  /** Подпись проверить не удалось — JWKS недостижим, claims проверены офлайн. */
  offline: boolean;
}

// jose кэширует ключи внутри объекта, поэтому создаём его один раз и лениво:
// на старте приложения сети может не быть, а падать при загрузке модуля нельзя.
let keySet: ReturnType<typeof createRemoteJWKSet> | null = null;
function jwks(): ReturnType<typeof createRemoteJWKSet> {
  keySet ??= createRemoteJWKSet(new URL(GOOGLE_JWKS_URI));
  return keySet;
}

/** Только для тестов: сбросить закэшированный JWKS-клиент. */
export function resetGoogleJwks(): void {
  keySet = null;
}

const NETWORK_MESSAGE_RE =
  /fetch failed|ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EAI_AGAIN|network|timed? out|socket hang up/i;

/**
 * Сбой сети (JWKS не скачался) или вердикт по токену? Отличать обязательно:
 * на первом мы смягчаем проверку, на втором — отказываем.
 *
 * Ошибки самой jose несут код `ERR_*` — это вердикт (подпись, aud, exp).
 * Исключение — `ERR_JWKS_TIMEOUT`: он про сеть, а не про токен.
 */
function isJwksUnreachable(err: Error): boolean {
  const code = (err as { code?: unknown }).code;
  if (code === 'ERR_JWKS_TIMEOUT') return true;
  if (typeof code === 'string' && code.startsWith('ERR_')) return false;
  return NETWORK_MESSAGE_RE.test(err.message);
}

function toClaims(payload: JWTPayload, offline: boolean): GoogleIdTokenClaims {
  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    throw new Error('Google id_token without sub');
  }
  const email = payload['email'];
  const name = payload['name'];
  return {
    sub: payload.sub,
    email: typeof email === 'string' ? email : undefined,
    name: typeof name === 'string' ? name : undefined,
    emailVerified: payload['email_verified'] === true,
    offline,
  };
}

/**
 * Тот же набор проверок, что делает jwtVerify, минус подпись: издатель,
 * получатель, срок. Без них офлайн-ветка приняла бы вообще любой JWT.
 */
function verifyClaimsOffline(
  idToken: string,
  clientId: string,
  now: number,
): JWTPayload {
  const payload = decodeJwt(idToken);
  const iss = payload.iss ?? '';
  if (!GOOGLE_ISSUERS.includes(iss)) {
    throw new Error(`unexpected "iss" claim value`);
  }
  const aud = payload.aud;
  const audOk = Array.isArray(aud) ? aud.includes(clientId) : aud === clientId;
  if (!audOk) throw new Error(`unexpected "aud" claim value`);
  const nowS = Math.floor(now / 1000);
  if (typeof payload.exp !== 'number' || payload.exp + CLOCK_SKEW_S < nowS) {
    throw new Error(`"exp" claim timestamp check failed`);
  }
  if (typeof payload.iat === 'number' && payload.iat - CLOCK_SKEW_S > nowS) {
    throw new Error(`"iat" claim timestamp check failed`);
  }
  return payload;
}

export async function verifyGoogleIdToken(
  idToken: string,
  clientId: string,
  now: number = Date.now(),
): Promise<GoogleIdTokenClaims> {
  try {
    const { payload } = await jwtVerify(idToken, jwks(), {
      issuer: GOOGLE_ISSUERS,
      audience: clientId,
    });
    return toClaims(payload, false);
  } catch (e: unknown) {
    const err = e instanceof Error ? e : new Error(String(e));
    if (!isJwksUnreachable(err)) throw err;
    // Ключи не скачались — следующий вход попробует снова с чистого листа.
    resetGoogleJwks();
    return toClaims(verifyClaimsOffline(idToken, clientId, now), true);
  }
}
