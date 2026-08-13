// Подписанный носитель linkUserId для link-флоу (OAuth-`state` и
// `tg_link_user`-кука). Чистый модуль без Nest-зависимостей — как
// max-init-data.ts: так его проще тестировать и переиспользовать из
// AuthFlowService и контроллеров.
//
// Зачем подпись (аудит 2026-08-12, C1). Раньше `state` был НЕПОДПИСАННЫМ
// base64url(JSON). Атакующий, ведущий запрос своим HTTP-клиентом, ставил
// `oauth_state`-куку и query-параметр `state` в одно поддельное значение
// `{linkUserId:<жертва>}` — double-submit-проверка `savedState === state`
// проходила (он контролирует обе стороны), провайдер-code он предъявлял свой,
// и получал сессию жертвы: неаутентифицированный захват аккаунта в обход 2FA.
// Подпись убирает возможность подделать linkUserId — значение честно рождается
// на сервере из уже проверенной сессии в момент редиректа.
import * as jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';

// Те же issuer/audience, что у остальных токенов сервиса — токены не
// переиспользуются между сервисами с общим JWT_SECRET.
const ISSUER = 'schemehappens.ru';
const AUDIENCE = 'schemehappens.ru';
const KIND = 'oauth_state';
const TTL_S = 10 * 60; // окно редиректа

// Подписать носитель. linkUserId=null → анонимный вход (валидный кейс: юзер
// логинится, а не привязывает провайдер к существующей сессии).
export function signOAuthState(
  secret: string,
  linkUserId: bigint | null,
): string {
  return jwt.sign(
    {
      kind: KIND,
      // Случайный компонент: тот же linkUserId даёт свежий state на каждый
      // редирект (значение double-submit-куки не переиспользуется).
      nonce: randomBytes(12).toString('hex'),
      link: linkUserId != null ? String(linkUserId) : null,
    },
    secret,
    {
      expiresIn: TTL_S,
      algorithm: 'HS256',
      issuer: ISSUER,
      audience: AUDIENCE,
    },
  );
}

// Проверить подпись и достать linkUserId. Возвращает null при ЛЮБОЙ проблеме
// (плохая подпись, другой kind, просрочка, tamper, легаси-неподписанный) — то
// есть запрос, не доказавший намерение привязки, становится обычным анонимным
// входом, а НЕ захватом чужого аккаунта.
export function readOAuthState(
  secret: string,
  state: string | null | undefined,
): bigint | null {
  if (!state) return null;
  try {
    const p = jwt.verify(state, secret, {
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: AUDIENCE,
    }) as { kind?: string; link?: string | null };
    if (p.kind !== KIND) return null;
    return p.link ? BigInt(p.link) : null;
  } catch {
    return null;
  }
}
