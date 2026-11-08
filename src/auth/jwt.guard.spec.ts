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
  webUser?: { userId: bigint; viaLinkToken?: true };
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
  sid?: string;
}): string {
  return jwt.sign(
    { sub: opts.sub ?? '123', type: opts.type ?? 'access', sid: opts.sid },
    opts.secret ?? SECRET,
    {
      algorithm: 'HS256',
      expiresIn: opts.expiresIn ?? 900,
      issuer: opts.issuer ?? ISSUER,
      audience: AUDIENCE,
    },
  );
}

// Живой аккаунт по умолчанию; тест меняет под своё условие.
function makePrisma(
  row: { deletedAt: Date | null } | null = { deletedAt: null },
  session: { id: string } | null = { id: 's1' },
) {
  return {
    user: { findUnique: jest.fn().mockResolvedValue(row) },
    webSession: { findFirst: jest.fn().mockResolvedValue(session) },
  };
}

function makeAuth(): AuthService {
  const config = { getOrThrow: () => SECRET } as any;
  return new AuthService({} as any, config, {} as any, {} as any);
}

describe('JwtAuthGuard', () => {
  const guard = new JwtAuthGuard(makeAuth(), makePrisma() as never);

  it('валидный access-токен → webUser.userId (BigInt)', async () => {
    const req: FakeRequest = {
      headers: { authorization: `Bearer ${signToken({ sub: '123' })}` },
    };
    await expect(guard.canActivate(makeCtx(req))).resolves.toBe(true);
    expect(req.webUser).toEqual({ userId: 123n });
  });

  // A5 (аудит 2026-10): подпись токена ничего не говорит о том, жив ли
  // аккаунт — access-токен живёт 15 минут, дольше удаления/слияния.
  it('аккаунт удалён (строки нет) → 401, webUser не ставится', async () => {
    const g = new JwtAuthGuard(makeAuth(), makePrisma(null) as never);
    const req: FakeRequest = {
      headers: { authorization: `Bearer ${signToken({ sub: '123' })}` },
    };
    await expect(g.canActivate(makeCtx(req))).rejects.toThrow(
      UnauthorizedException,
    );
    expect(req.webUser).toBeUndefined();
  });

  it('аккаунт помечен deletedAt → 401, webUser не ставится', async () => {
    const g = new JwtAuthGuard(
      makeAuth(),
      makePrisma({ deletedAt: new Date() }) as never,
    );
    const req: FakeRequest = {
      headers: { authorization: `Bearer ${signToken({ sub: '123' })}` },
    };
    await expect(g.canActivate(makeCtx(req))).rejects.toThrow(
      UnauthorizedException,
    );
    expect(req.webUser).toBeUndefined();
  });

  it('проверка жизни спрашивает именно userId из токена', async () => {
    const prisma = makePrisma();
    const g = new JwtAuthGuard(makeAuth(), prisma as never);
    await g.canActivate(
      makeCtx({
        headers: { authorization: `Bearer ${signToken({ sub: '42' })}` },
      }),
    );
    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 42n } }),
    );
  });

  it('невалидный токен отклоняется ДО обращения к БД', async () => {
    const prisma = makePrisma();
    const g = new JwtAuthGuard(makeAuth(), prisma as never);
    await expect(
      g.canActivate(makeCtx({ headers: { authorization: 'Bearer мусор' } })),
    ).rejects.toThrow(UnauthorizedException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it.each([
    ['нет заголовка', {}],
    ['не Bearer-схема', { authorization: 'Basic abc' }],
  ])('%s → UnauthorizedException', async (_name, headers) => {
    await expect(guard.canActivate(makeCtx({ headers }))).rejects.toThrow(
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
  ])('отвергает: %s', async (_name, token) => {
    const req: FakeRequest = { headers: { authorization: `Bearer ${token}` } };
    await expect(guard.canActivate(makeCtx(req))).rejects.toThrow(
      UnauthorizedException,
    );
    expect(req.webUser).toBeUndefined();
  });

  // Хвост S12 (аудит 2026-11): токен несёт sid (family цепочки). Отозвали
  // цепочку — 401 на следующем же запросе, а не через ≤15 минут.
  it('sid живой цепочки → пропуск; sid отозванной → 401', async () => {
    const live = makePrisma();
    const ok: FakeRequest = {
      headers: { authorization: `Bearer ${signToken({ sid: 'fam' })}` },
    };
    await expect(
      new JwtAuthGuard(makeAuth(), live as never).canActivate(makeCtx(ok)),
    ).resolves.toBe(true);
    expect(live.webSession.findFirst).toHaveBeenCalledWith({
      where: { family: 'fam', userId: 123n, revokedAt: null },
      select: { id: true },
    });

    const revoked = makePrisma({ deletedAt: null }, null);
    const req: FakeRequest = {
      headers: { authorization: `Bearer ${signToken({ sid: 'fam' })}` },
    };
    await expect(
      new JwtAuthGuard(makeAuth(), revoked as never).canActivate(makeCtx(req)),
    ).rejects.toThrow(UnauthorizedException);
    expect(req.webUser).toBeUndefined();
  });

  it('токен без sid (выписан до правки) принимается до истечения', async () => {
    const prisma = makePrisma({ deletedAt: null }, null);
    const req: FakeRequest = {
      headers: { authorization: `Bearer ${signToken({})}` },
    };
    await expect(
      new JwtAuthGuard(makeAuth(), prisma as never).canActivate(makeCtx(req)),
    ).resolves.toBe(true);
    expect(prisma.webSession.findFirst).not.toHaveBeenCalled();
  });
});

describe('OptionalJwtGuard', () => {
  const guard = new OptionalJwtGuard(makeAuth(), makePrisma() as never);

  it('без заголовка пропускает анонимом (webUser не ставится)', async () => {
    const req: FakeRequest = { headers: {} };
    expect(await guard.canActivate(makeCtx(req))).toBe(true);
    expect(req.webUser).toBeUndefined();
  });

  it('битый токен НЕ роняет запрос — аноним', async () => {
    const req: FakeRequest = { headers: { authorization: 'Bearer мусор' } };
    expect(await guard.canActivate(makeCtx(req))).toBe(true);
    expect(req.webUser).toBeUndefined();
  });

  it('валидный Bearer → webUser', async () => {
    const req: FakeRequest = {
      headers: { authorization: `Bearer ${signToken({ sub: '7' })}` },
    };
    await guard.canActivate(makeCtx(req));
    expect(req.webUser).toEqual({ userId: 7n });
  });

  it('link_token из httpOnly-cookie (type=link) → webUser', async () => {
    const req: FakeRequest = {
      headers: {},
      cookies: { link_token: signToken({ sub: '55', type: 'link' }) },
    };
    await guard.canActivate(makeCtx(req));
    expect(req.webUser).toEqual({ userId: 55n, viaLinkToken: true });
  });

  // A1 (аудит 2026-10): login-CSRF. Злоумышленник выпускает link-токен
  // СВОЕГО аккаунта (GET /api/auth/link-token) и отправляет жертву на
  // /api/auth/google?link_token=…; фолбэк на query делал жертву «вошедшей» как
  // злоумышленник, и её Google привязывался к его аккаунту.
  it('link_token из query-параметра ИГНОРИРУЕТСЯ — аноним (A1)', async () => {
    const req: FakeRequest = {
      headers: {},
      query: { link_token: signToken({ sub: '56', type: 'link' }) },
    };
    expect(await guard.canActivate(makeCtx(req))).toBe(true);
    expect(req.webUser).toBeUndefined();
  });

  it('валидный link_token в query не перебивает отсутствующую куку, но куку читает как раньше', async () => {
    const req: FakeRequest = {
      headers: {},
      cookies: { link_token: signToken({ sub: '55', type: 'link' }) },
      query: { link_token: signToken({ sub: '56', type: 'link' }) },
    };
    await guard.canActivate(makeCtx(req));
    expect(req.webUser).toEqual({ userId: 55n, viaLinkToken: true });
  });

  it('access-токен в link_token отвергается (webUser не ставится)', async () => {
    const req: FakeRequest = {
      headers: {},
      cookies: { link_token: signToken({ sub: '55', type: 'access' }) },
    };
    expect(await guard.canActivate(makeCtx(req))).toBe(true);
    expect(req.webUser).toBeUndefined();
  });

  it('Bearer имеет приоритет: link_token не перетирает webUser', async () => {
    const req: FakeRequest = {
      headers: { authorization: `Bearer ${signToken({ sub: '1' })}` },
      cookies: { link_token: signToken({ sub: '2', type: 'link' }) },
    };
    await guard.canActivate(makeCtx(req));
    expect(req.webUser).toEqual({ userId: 1n });
  });

  // Хвост S12: на роутах входа Bearer отозванной сессии — аноним, а не
  // вошедший (привязка через виджет Telegram, билет link, слияние).
  it('Bearer отозванной сессии или удалённого аккаунта → аноним, запрос не роняет', async () => {
    for (const prisma of [
      makePrisma({ deletedAt: null }, null),
      makePrisma(null),
    ]) {
      const g = new OptionalJwtGuard(makeAuth(), prisma as never);
      const req: FakeRequest = {
        headers: { authorization: `Bearer ${signToken({ sid: 'fam' })}` },
      };
      expect(await g.canActivate(makeCtx(req))).toBe(true);
      expect(req.webUser).toBeUndefined();
    }
  });
});
