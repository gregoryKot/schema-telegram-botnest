// Подпись access-JWT для e2e-запросов — тот же алгоритм/issuer/audience,
// что и AuthService.verifyAccessToken (src/auth/auth.service.ts), пересчитан
// руками независимо от прод-кода (как в src/auth/jwt.guard.spec.ts).
import * as jwt from 'jsonwebtoken';

const ISSUER = 'schemehappens.ru';
const AUDIENCE = 'schemehappens.ru';

export function signAccessToken(userId: bigint, secret: string): string {
  return jwt.sign({ sub: userId.toString(), type: 'access' }, secret, {
    algorithm: 'HS256',
    expiresIn: 900,
    issuer: ISSUER,
    audience: AUDIENCE,
  });
}
