// Этап 1 плана покрытия (TEST_COVERAGE_PLAN.md): гард web-сессий.
// До этого спека логика отклонения токена (подпись, тип, срок, issuer)
// не проверялась нигде — регрессия означала бы обход авторизации.
//
// AuthService берётся НАСТОЯЩИЙ (verifyAccessToken/verifyLinkToken не ходят
// в БД), а токены подписываются в тесте независимо через jsonwebtoken —
// как в robokassa.service.spec.ts, где подпись пересчитывается руками.
import { UnauthorizedException, ExecutionContext } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { AuthService } from './auth.service';
import { JwtAuthGuard, OptionalJwtGuard } from './jwt.guard';

const SECRET = 'test-secret';
const ISSUER = 'schemehappens.ru';
const AUDIENCE = 'schemehappens.ru';

interface FakeRequest {
  headers: Record<string, string | undefined>;
  cookies?: Record<string, string>;
  query?: Record<string, string>;
  webUser?: { userId: bigint };
}

function makeCtx(req: FakeRequest): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

function signToken(opts: {
  sub?: string;
  type?: string;
  secret?: string;
  issuer?: string;
  expiresIn?: number;
}): string {
  return jwt.sign(
    { sub: opts.sub ?? '123', type: opts.type ?? 'access' },
    opts.secret ?? SECRET,
    {
      algorithm: 'HS256',
      expiresIn: opts.expiresIn ?? 900,
      issuer: opts.issuer ?? ISSUER,
      audience: AUDIENCE,
    },
  );
}

function makeAuth(): AuthService {
  const config = { getOrThrow: () => SECRET } as any;
  return new AuthService({} as any, config, {} as any, {} as any);
}

describe('JwtAuthGuard', () => {
  const guard = new JwtAuthGuard(makeAuth());

  it('валидный access-токен → webUser.userId (BigInt)', () => {
    const req: FakeRequest = {
      headers: { authorization: `Bearer ${signToken({ sub: '123' })}` },
    };
    expect(guard.canActivate(makeCtx(req))).toBe(true);
    expect(req.webUser).toEqual({ userId: 123n });
  });

  it.each([
    ['нет заголовка', {}],
    ['не Bearer-схема', { authorization: 'Basic abc' }],
  ])('%s → UnauthorizedException', (_name, headers) => {
    expect(() => guard.canActivate(makeCtx({ headers }))).toThrow(
      UnauthorizedException,
    );
  });

  it.each([
    ['мусор вместо токена', 'not-a-jwt'],
    ['чужой секрет', signToken({ secret: 'attacker-secret' })],
    ['просроченный', signToken({ expiresIn: -10 })],
    ['чужой issuer', signToken({ issuer: 'evil.example' })],
    // refresh/link-токены подписаны тем же секретом — но access-гард
    // обязан их отвергать (иначе украденный merge-токен = сессия)
    ['type=refresh', signToken({ type: 'refresh' })],
    ['type=link', signToken({ type: 'link' })],
  ])('отвергает: %s', (_name, token) => {
    const req: FakeRequest = { headers: { authorization: `Bearer ${token}` } };
    expect(() => guard.canActivate(makeCtx(req))).toThrow(
      UnauthorizedException,
    );
    expect(req.webUser).toBeUndefined();
  });
});

describe('OptionalJwtGuard', () => {
  const guard = new OptionalJwtGuard(makeAuth());

  it('без заголовка пропускает анонимом (webUser не ставится)', () => {
    const req: FakeRequest = { headers: {} };
    expect(guard.canActivate(makeCtx(req))).toBe(true);
    expect(req.webUser).toBeUndefined();
  });

  it('битый токен НЕ роняет запрос — аноним', () => {
    const req: FakeRequest = { headers: { authorization: 'Bearer мусор' } };
    expect(guard.canActivate(makeCtx(req))).toBe(true);
    expect(req.webUser).toBeUndefined();
  });

  it('валидный Bearer → webUser', () => {
    const req: FakeRequest = {
      headers: { authorization: `Bearer ${signToken({ sub: '7' })}` },
    };
    guard.canActivate(makeCtx(req));
    expect(req.webUser).toEqual({ userId: 7n });
  });

  it('link_token из httpOnly-cookie (type=link) → webUser', () => {
    const req: FakeRequest = {
      headers: {},
      cookies: { link_token: signToken({ sub: '55', type: 'link' }) },
    };
    guard.canActivate(makeCtx(req));
    expect(req.webUser).toEqual({ userId: 55n });
  });

  it('link_token из query — legacy-fallback (аудит 2026-07, S-4)', () => {
    const req: FakeRequest = {
      headers: {},
      query: { link_token: signToken({ sub: '56', type: 'link' }) },
    };
    guard.canActivate(makeCtx(req));
    expect(req.webUser).toEqual({ userId: 56n });
  });

  it('access-токен в link_token отвергается (webUser не ставится)', () => {
    const req: FakeRequest = {
      headers: {},
      cookies: { link_token: signToken({ sub: '55', type: 'access' }) },
    };
    expect(guard.canActivate(makeCtx(req))).toBe(true);
    expect(req.webUser).toBeUndefined();
  });

  it('Bearer имеет приоритет: link_token не перетирает webUser', () => {
    const req: FakeRequest = {
      headers: { authorization: `Bearer ${signToken({ sub: '1' })}` },
      cookies: { link_token: signToken({ sub: '2', type: 'link' }) },
    };
    guard.canActivate(makeCtx(req));
    expect(req.webUser).toEqual({ userId: 1n });
  });
});
