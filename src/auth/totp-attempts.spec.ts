// S11 (аудит 2026-11): перебор кода 2FA считался по IP и по вызывающему, а
// не по защищаемому аккаунту — смена адреса давала свежие попытки. Здесь
// настоящие TotpService + TotpAttemptsService, общие для `2fa/challenge`
// (Auth2faController) и merge (assertSourceTotp): 10 промахов на аккаунт за
// сутки с любых адресов и любых путей → дальше 429 `totp_locked`.
//
// ThrottleHit эмулируется в памяти: атомарность INSERT … ON CONFLICT —
// свойство Postgres, она доказана на живой базе в
// test/throttle-storage.e2e-spec.ts; здесь проверяется логика поверх.
process.env.ENCRYPTION_KEY = 'bb'.repeat(32);
process.env.ENCRYPTION_KEY_OLD = '';

import { HttpException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { generateSecret, generateSync } from 'otplib';
import { PostgresThrottleStorage } from '../api/postgres-throttle-storage';
import { Auth2faController } from './auth-2fa.controller';
import { assertSourceTotp } from './merge-confirm';
import { newRecoveryCodes } from './totp-recovery';
import { TotpService } from './totp.service';
import {
  TOTP_FAIL_LIMIT,
  TotpAttemptsService,
  totpFailKey,
} from './totp-attempts';
import { encrypt } from '../utils/crypto';

const USER = 42n;
const T0 = new Date('2026-11-08T10:00:00Z').getTime();

type Hit = { hits: number; expiresAt: Date; blockedUntil: Date | null };

function makeWorld(opts: { storageDown?: boolean } = {}) {
  const secret = generateSecret();
  const recovery = newRecoveryCodes();
  const user: Record<string, unknown> = {
    totpSecret: encrypt(secret),
    totpEnabledAt: new Date(T0),
    totpRecoveryCodes: recovery.stored,
    totpLastStep: null,
  };
  const hits = new Map<string, Hit>();
  const prisma = {
    user: {
      findUnique: jest.fn(() => Promise.resolve({ ...user })),
      updateMany: jest.fn(
        ({ where, data }: { where: Record<string, unknown>; data: object }) => {
          const eq = where.totpRecoveryCodes as { equals: unknown } | undefined;
          if (eq && eq.equals !== user.totpRecoveryCodes)
            return Promise.resolve({ count: 0 });
          Object.assign(user, data);
          return Promise.resolve({ count: 1 });
        },
      ),
    },
    throttleHit: {
      findUnique: jest.fn(({ where }: { where: { key: string } }) =>
        Promise.resolve(hits.get(where.key) ?? null),
      ),
    },
  };
  // Окно как в PostgresThrottleStorage: новое окно, если прежнее истекло.
  jest
    .spyOn(PostgresThrottleStorage.prototype, 'increment')
    .mockImplementation((key: string, ttl: number, limit: number) => {
      if (opts.storageDown) return Promise.reject(new Error('db down'));
      const now = new Date();
      const cur = hits.get(key);
      const next: Hit =
        !cur || cur.expiresAt <= now
          ? { hits: 1, expiresAt: new Date(+now + ttl), blockedUntil: null }
          : { ...cur, hits: cur.hits + 1 };
      if (next.hits > limit) next.blockedUntil = new Date(+now + ttl);
      hits.set(key, next);
      return Promise.resolve({
        totalHits: next.hits,
        timeToExpire: 0,
        isBlocked: false,
        timeToBlockExpire: 0,
      });
    });
  const securityLog = { log: jest.fn() };
  const notice = { notify: jest.fn() };
  const attempts = new TotpAttemptsService(
    prisma as never,
    securityLog as never,
    notice as never,
  );
  const totp = new TotpService(prisma as never, attempts);
  const auth = {
    verifyTotpChallengeToken: jest.fn().mockReturnValue({ userId: USER }),
    issueTokens: jest.fn().mockResolvedValue({
      accessToken: 'a',
      refreshToken: 'r',
      expiresIn: 900,
    }),
  };
  const ctrl = new Auth2faController(auth as never, securityLog as never, totp);
  const challenge = (code: string, ip: string) =>
    ctrl.totpChallenge(
      { headers: { 'x-requested-with': 'x' }, ip } as unknown as Request,
      { cookie: jest.fn(), clearCookie: jest.fn() } as unknown as Response,
      { challengeToken: 't', code },
    );
  return {
    secret,
    recovery,
    hits,
    totp,
    attempts,
    notice,
    securityLog,
    challenge,
    merge: (code: string) => assertSourceTotp(totp, USER, code),
  };
}

const status = (e: unknown) => (e instanceof HttpException ? e.getStatus() : 0);
const reasonOf = (e: unknown) =>
  (e as HttpException).getResponse() as { reason?: string };

beforeEach(() => jest.useFakeTimers({ now: T0 }));
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('TotpAttemptsService + TotpService.verifyCode (S11)', () => {
  it('10 промахов с разных IP и путей → 11-я попытка отклонена 429, даже с верным кодом', async () => {
    const w = makeWorld();
    for (let i = 0; i < 5; i++) {
      const e = await w.challenge('000000', `198.51.100.${i}`).catch((x) => x);
      expect(status(e)).toBe(401);
      expect(status(await w.merge('000000').catch((x) => x))).toBe(403);
    }
    const right = generateSync({ secret: w.secret });
    const viaChallenge = await w
      .challenge(right, '203.0.113.99')
      .catch((x) => x);
    expect(status(viaChallenge)).toBe(429);
    expect(reasonOf(viaChallenge)).toMatchObject({ reason: 'totp_locked' });
    expect(status(await w.merge(right).catch((x) => x))).toBe(429);
  });

  it('уведомление владельцу и событие totp_locked — ровно одно на окно', async () => {
    const w = makeWorld();
    for (let i = 0; i < TOTP_FAIL_LIMIT; i++)
      await w.totp.verifyCode(USER, '000000');
    await w.challenge('000000', '1.1.1.1').catch(() => null);
    await w.merge('000000').catch(() => null);
    expect(w.notice.notify).toHaveBeenCalledTimes(1);
    expect(w.notice.notify).toHaveBeenCalledWith(USER, { kind: 'totp_locked' });
    const locked = w.securityLog.log.mock.calls.filter(
      (c) => c[0] === 'totp_locked',
    );
    expect(locked).toEqual([['totp_locked', { userId: USER }]]);
  });

  it('на паузе резервный код принимается — владелец не заперт на сутки', async () => {
    const w = makeWorld();
    for (let i = 0; i < TOTP_FAIL_LIMIT; i++)
      await w.totp.verifyCode(USER, '000000');
    await expect(w.totp.verifyCode(USER, w.recovery.codes[0])).resolves.toBe(
      true,
    );
    await expect(w.totp.verifyCode(USER, 'ffffffffff')).rejects.toMatchObject({
      status: 429,
    });
  });

  it('верный код счётчик не обнуляет: 9 промахов, вход, ещё 1 промах → пауза', async () => {
    const w = makeWorld();
    for (let i = 0; i < 9; i++) await w.totp.verifyCode(USER, '000000');
    await expect(
      w.totp.verifyCode(USER, generateSync({ secret: w.secret })),
    ).resolves.toBe(true);
    await w.totp.verifyCode(USER, '000000');
    expect(await w.attempts.lockedFor(USER)).toBeGreaterThan(0);
  });

  it('окно 24 ч прошло → коды снова принимаются', async () => {
    const w = makeWorld();
    for (let i = 0; i < TOTP_FAIL_LIMIT; i++)
      await w.totp.verifyCode(USER, '000000');
    expect(await w.attempts.lockedFor(USER)).toBe(24 * 3600);
    jest.setSystemTime(T0 + 24 * 3600_000 + 1000);
    expect(await w.attempts.lockedFor(USER)).toBe(0);
    await expect(
      w.totp.verifyCode(USER, generateSync({ secret: w.secret })),
    ).resolves.toBe(true);
  });

  // otplib 13 бросает на токене не из шести цифр; DTO такие пропускает
  // (6–10 символов). Это промах, как при otplib 12: false/401 и +1 к счётчику,
  // а не 500 мимо счётчика (тогда перебор шёл бы без паузы).
  it('код буквами, из 5 цифр или пустой — промах в счётчик, 401, не 500', async () => {
    const w = makeWorld();
    for (const code of ['abcdef', '12345', ''])
      await expect(w.totp.verifyCode(USER, code)).resolves.toBe(false);
    expect(w.hits.get(totpFailKey(USER))?.hits).toBe(3);
    const e = await w.challenge('abcdefg', '1.1.1.1').catch((x) => x);
    expect(status(e)).toBe(401);
    expect(w.hits.get(totpFailKey(USER))?.hits).toBe(4);
  });

  it('ключ счётчика — аккаунт, а не адрес: totp-fail:<userId>', async () => {
    const w = makeWorld();
    await w.totp.verifyCode(USER, '000000');
    expect([...w.hits.keys()]).toEqual([totpFailKey(USER)]);
    expect(totpFailKey(USER)).toBe('totp-fail:42');
  });

  it('счётчик недоступен (БД) → промах всё равно false, не 500', async () => {
    const w = makeWorld({ storageDown: true });
    await expect(w.totp.verifyCode(USER, '000000')).resolves.toBe(false);
    expect(w.notice.notify).not.toHaveBeenCalled();
  });

  it('2FA выключена → счётчик не трогается', async () => {
    const w = makeWorld();
    const off = new TotpService(
      {
        user: { findUnique: () => Promise.resolve({ totpEnabledAt: null }) },
      } as never,
      w.attempts,
    );
    await expect(off.verifyCode(USER, '000000')).resolves.toBe(false);
    expect(w.hits.size).toBe(0);
  });
});
