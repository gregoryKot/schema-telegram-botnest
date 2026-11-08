// Step-up (S12, аудит 2026-11): 15 минут украденного access-токена не должны
// превращаться в постоянный доступ через новый способ входа. Правило:
// TOTP включён — нужен код в `x-totp-code`; не включён — пропуск («свежий
// вход» в iframe мессенджеров доказать нечем, docs/open/security.md).
// Отзыв сессий при включении 2FA (session-proof.ts) — на фейковой WebSession.
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { hashToken } from './email.util';
import { revokeOtherSessions } from './session-proof';
import { StepUpGuard, StepUpService, linkCookieUserId } from './step-up';
import { TotpLockedException } from './totp-attempts';

const NOW = new Date('2026-11-08T12:00:00Z').getTime();
const min = (n: number) => new Date(NOW - n * 60_000);

type Row = {
  tokenHash: string;
  userId: bigint;
  family: string;
  createdAt: Date;
  revokedAt: Date | null;
  expiresAt: Date;
};

function makePrisma(rows: Row[]) {
  return {
    rows,
    webSession: {
      findUnique: jest.fn(({ where }: { where: { tokenHash: string } }) =>
        Promise.resolve(rows.find((r) => r.tokenHash === where.tokenHash)),
      ),
      findFirst: jest.fn(({ where }: { where: { family: string } }) =>
        Promise.resolve(
          rows
            .filter((r) => r.family === where.family)
            .sort((a, b) => +a.createdAt - +b.createdAt)[0] ?? null,
        ),
      ),
      updateMany: jest.fn(
        ({
          where,
          data,
        }: {
          where: { userId: bigint; NOT?: { family: string } };
          data: { revokedAt: Date };
        }) => {
          const hit = rows.filter(
            (r) =>
              r.userId === where.userId &&
              r.revokedAt === null &&
              r.family !== where.NOT?.family,
          );
          hit.forEach((r) => (r.revokedAt = data.revokedAt));
          return Promise.resolve({ count: hit.length });
        },
      ),
    },
  };
}

const row = (raw: string, userId: bigint, family: string, created: Date) => ({
  tokenHash: hashToken(raw),
  userId,
  family,
  createdAt: created,
  revokedAt: null as Date | null,
  expiresAt: new Date(NOW + 86_400_000),
});

function makeReq(opts: {
  userId?: bigint;
  refresh?: string;
  code?: string;
  viaLinkToken?: true;
}): Request {
  return {
    headers: opts.code ? { 'x-totp-code': opts.code } : {},
    cookies: opts.refresh ? { refresh_token: opts.refresh } : {},
    webUser:
      opts.userId === undefined
        ? undefined
        : { userId: opts.userId, viaLinkToken: opts.viaLinkToken },
    ip: '203.0.113.7',
    path: '/api/auth/unlink/google',
  } as unknown as Request;
}

function makeService(rows: Row[], totpOn: boolean, codeOk = false) {
  const prisma = makePrisma(rows);
  const totp = {
    isEnabled: jest.fn().mockResolvedValue(totpOn),
    verifyCode: jest.fn().mockResolvedValue(codeOk),
  };
  const securityLog = { log: jest.fn() };
  const svc = new StepUpService(totp as never, securityLog as never);
  return { svc, prisma, totp, securityLog };
}

const reason = async (p: Promise<unknown>) => {
  const err = await p.catch((e: unknown) => e);
  expect(err).toBeInstanceOf(ForbiddenException);
  return ((err as ForbiddenException).getResponse() as { reason: string })
    .reason;
};

beforeEach(() => jest.useFakeTimers({ now: NOW }));
afterEach(() => jest.useRealTimers());

describe('StepUpService.assert — TOTP включён', () => {
  it('без кода → 403 totp_required, код не проверяется', async () => {
    const { svc, totp } = makeService([], true);
    expect(await reason(svc.assert(makeReq({ userId: 1n }), 1n))).toBe(
      'totp_required',
    );
    expect(totp.verifyCode).not.toHaveBeenCalled();
  });

  it('неверный код → 403 totp_required и след totp_failed', async () => {
    const { svc, securityLog } = makeService([], true, false);
    const req = makeReq({ userId: 1n, code: '123456' });
    expect(await reason(svc.assert(req, 1n))).toBe('totp_required');
    expect(securityLog.log).toHaveBeenCalledWith('totp_failed', {
      userId: 1n,
      ip: '203.0.113.7',
      route: '/api/auth/unlink/google',
    });
  });

  it('верный код → пропуск', async () => {
    const { svc, totp } = makeService([], true, true);
    await expect(
      svc.assert(makeReq({ userId: 1n, code: ' 123456 ' }), 1n),
    ).resolves.toBeUndefined();
    expect(totp.verifyCode).toHaveBeenCalledWith(1n, '123456');
  });

  it('мусор в заголовке кодом не считается', async () => {
    const { svc, totp } = makeService([], true, true);
    const req = makeReq({ userId: 1n, code: '12; DROP' });
    expect(await reason(svc.assert(req, 1n))).toBe('totp_required');
    expect(totp.verifyCode).not.toHaveBeenCalled();
  });

  it('аккаунт на паузе после подбора (S11) → 429 пробрасывается как есть', async () => {
    const { svc, totp } = makeService([], true);
    totp.verifyCode.mockRejectedValue(new TotpLockedException(600));
    await expect(
      svc.assert(makeReq({ userId: 1n, code: '123456' }), 1n),
    ).rejects.toBeInstanceOf(TotpLockedException);
  });
});

describe('StepUpService.assert — TOTP выключен', () => {
  it('пропуск без кода и без куки: проверять нечем, ответ — уведомление', async () => {
    const { svc, totp } = makeService([], false);
    await expect(
      svc.assert(makeReq({ userId: 1n }), 1n),
    ).resolves.toBeUndefined();
    expect(totp.verifyCode).not.toHaveBeenCalled();
  });

  it('и с каким-то кодом в заголовке — тоже пропуск, код не проверяется', async () => {
    const { svc, totp } = makeService([], false);
    await expect(
      svc.assert(makeReq({ userId: 1n, code: '123456' }), 1n),
    ).resolves.toBeUndefined();
    expect(totp.verifyCode).not.toHaveBeenCalled();
  });
});

describe('гарды и помощники', () => {
  const ctx = (req: Request) =>
    ({
      switchToHttp: () => ({ getRequest: () => req }),
    }) as unknown as ExecutionContext;

  it('StepUpGuard без webUser (не после JwtAuthGuard) → 401', async () => {
    const { svc } = makeService([], false);
    await expect(
      new StepUpGuard(svc).canActivate(ctx(makeReq({}))),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('StepUpGuard: TOTP включён, кода нет → 403; с верным кодом → true', async () => {
    const { svc, totp } = makeService([], true, false);
    const guard = new StepUpGuard(svc);
    await expect(
      guard.canActivate(ctx(makeReq({ userId: 1n }))),
    ).rejects.toBeInstanceOf(ForbiddenException);
    totp.verifyCode.mockResolvedValue(true);
    await expect(
      guard.canActivate(ctx(makeReq({ userId: 1n, code: '123456' }))),
    ).resolves.toBe(true);
  });

  it('assertIfBearer: кука link_token — без проверки, Bearer — со step-up', async () => {
    const { svc, totp } = makeService([], true);
    await expect(
      svc.assertIfBearer(makeReq({ userId: 1n, viaLinkToken: true })),
    ).resolves.toBeUndefined();
    await expect(svc.assertIfBearer(makeReq({}))).resolves.toBeUndefined();
    expect(totp.isEnabled).not.toHaveBeenCalled();
    expect(await reason(svc.assertIfBearer(makeReq({ userId: 1n })))).toBe(
      'totp_required',
    );
  });

  it('linkCookieUserId: привязывает только кука link_token, не Bearer', () => {
    expect(linkCookieUserId(makeReq({ userId: 4n, viaLinkToken: true }))).toBe(
      4n,
    );
    expect(linkCookieUserId(makeReq({ userId: 4n }))).toBeNull();
    expect(linkCookieUserId(makeReq({}))).toBeNull();
  });
});

describe('revokeOtherSessions (включение 2FA, S12)', () => {
  it('гасит чужие сессии аккаунта, семью текущей куки оставляет', async () => {
    const rows = [
      row('mine', 1n, 'f-mine', min(3)),
      row('thief', 1n, 'f-thief', min(60)),
      row('other-user', 2n, 'f-x', min(60)),
    ];
    const prisma = makePrisma(rows);
    expect(await revokeOtherSessions(prisma as never, 1n, 'mine')).toBe(1);
    expect(rows.map((r) => r.revokedAt !== null)).toEqual([false, true, false]);
  });

  it('куки нет или она чужая → гасит все сессии аккаунта', async () => {
    const rows = [row('a', 1n, 'f-a', min(3)), row('b', 1n, 'f-b', min(9))];
    const prisma = makePrisma(rows);
    expect(await revokeOtherSessions(prisma as never, 1n, undefined)).toBe(2);
  });
});
