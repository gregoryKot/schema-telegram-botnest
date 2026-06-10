import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { AuthService } from './auth.service';

const JWT_SECRET = 'test-secret-0123456789-abcdefghij';
const BOT_TOKEN = '123456:test-bot-secret';
const WEBAPP_URL = 'https://schemalab.ru/';

function makeDeps() {
  const prisma = {
    authProvider: {
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    emailToken: {
      create: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
    },
    webSession: {
      create: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    user: { upsert: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn().mockResolvedValue([]),
  } as any;
  const config = {
    getOrThrow: jest.fn((k: string) => ({ JWT_SECRET, BOT_TOKEN, WEBAPP_URL }[k])),
  } as any;
  const securityLog = { log: jest.fn() } as any;
  const emailSvc = { sendLoginLink: jest.fn().mockResolvedValue(undefined) } as any;
  const svc = new AuthService(prisma, config, securityLog, emailSvc);
  return { svc, prisma, config, securityLog, emailSvc };
}

// Собрать валидный initData (Telegram WebApp: secret = HMAC('WebAppData', botToken))
function signedInitData(user: object, authDate = Math.floor(Date.now() / 1000)): string {
  const params: Record<string, string> = { auth_date: String(authDate), user: JSON.stringify(user) };
  const checkString = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');
  return new URLSearchParams({ ...params, hash }).toString();
}

describe('AuthService.verifyTelegramWebAppData', () => {
  it('валидный initData → { id, firstName }', () => {
    const { svc } = makeDeps();
    const initData = signedInitData({ id: 777, first_name: 'Аня' });
    expect(svc.verifyTelegramWebAppData(initData)).toEqual({ id: 777, firstName: 'Аня' });
  });

  it('нет hash → 401', () => {
    const { svc } = makeDeps();
    expect(() => svc.verifyTelegramWebAppData('auth_date=1&user=%7B%7D')).toThrow('Missing hash');
  });

  it('malformed hash → 401', () => {
    const { svc } = makeDeps();
    expect(() => svc.verifyTelegramWebAppData('hash=zzz&auth_date=1')).toThrow('Malformed hash');
  });

  it('протухший auth_date → 401', () => {
    const { svc } = makeDeps();
    const initData = signedInitData({ id: 1 }, Math.floor(Date.now() / 1000) - 7200);
    expect(() => svc.verifyTelegramWebAppData(initData)).toThrow('expired');
  });

  it('подделанная подпись → 401', () => {
    const { svc } = makeDeps();
    const bad = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000)), user: '{"id":1}', hash: 'a'.repeat(64) }).toString();
    expect(() => svc.verifyTelegramWebAppData(bad)).toThrow('Invalid Telegram WebApp signature');
  });

  it('нет user.id → 401', () => {
    const { svc } = makeDeps();
    expect(() => svc.verifyTelegramWebAppData(signedInitData({ first_name: 'X' }))).toThrow('Missing user id');
  });

  it('битый user JSON (валидная подпись) → 401', () => {
    const { svc } = makeDeps();
    const authDate = String(Math.floor(Date.now() / 1000));
    const params: Record<string, string> = { auth_date: authDate, user: '{битый' };
    const checkString = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('\n');
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    const hash = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');
    const initData = new URLSearchParams({ ...params, hash }).toString();
    expect(() => svc.verifyTelegramWebAppData(initData)).toThrow('Invalid user JSON');
  });
});

describe('AuthService — JWT round-trips', () => {
  it('issueTokens → access декодируется через verifyAccessToken, refresh захэширован в webSession', async () => {
    const { svc, prisma } = makeDeps();
    const pair = await svc.issueTokens(5n, '1.2.3.4', 'UA');
    expect(svc.verifyAccessToken(pair.accessToken)).toEqual({ userId: 5n });
    expect(pair.expiresIn).toBe(15 * 60);
    const created = prisma.webSession.create.mock.calls[0][0].data;
    expect(created.tokenHash).toBe(crypto.createHash('sha256').update(pair.refreshToken).digest('hex'));
    expect(created.family).toBeDefined();
  });

  it('verifyAccessToken: токен другого типа (link) → 401', () => {
    const { svc } = makeDeps();
    const link = svc.buildLinkToken(5n);
    expect(() => svc.verifyAccessToken(link)).toThrow('Wrong token type');
  });

  it('verifyAccessToken: подделанный токен → 401', () => {
    const { svc } = makeDeps();
    expect(() => svc.verifyAccessToken('not.a.jwt')).toThrow('Invalid or expired access token');
  });

  it('link-токен round-trip; verifyAccessToken его отвергает и наоборот', () => {
    const { svc } = makeDeps();
    expect(svc.verifyLinkToken(svc.buildLinkToken(9n))).toEqual({ userId: 9n });
    // merge-токен валиден по подписи, но type !== 'link' → 'Wrong token type'
    expect(() => svc.verifyLinkToken(svc.buildMergeToken(1n, 2n, 'google', 'g'))).toThrow('Wrong token type');
  });

  it('merge-токен round-trip; чужой kind → 401', () => {
    const { svc } = makeDeps();
    const t = svc.buildMergeToken(1n, 2n, 'google', 'gid');
    expect(svc.verifyMergeToken(t)).toEqual({ target: 1n, source: 2n, provider: 'google', providerId: 'gid' });
    expect(() => svc.verifyMergeToken(svc.buildLinkToken(1n))).toThrow('Invalid or expired merge token');
  });

  it('totp-challenge токен round-trip; чужой kind → 401', () => {
    const { svc } = makeDeps();
    const t = svc.buildTotpChallengeToken(7n, '1.1.1.1', 'UA');
    expect(svc.verifyTotpChallengeToken(t)).toEqual({ userId: 7n, ip: '1.1.1.1', ua: 'UA' });
    expect(() => svc.verifyTotpChallengeToken(svc.buildLinkToken(7n))).toThrow('Invalid or expired 2FA challenge token');
  });
});

describe('AuthService.rotateRefreshToken — ротация и детекция кражи', () => {
  it('неизвестный refresh → 401', async () => {
    const { svc } = makeDeps();
    await expect(svc.rotateRefreshToken('nope')).rejects.toThrow('Unknown refresh token');
  });

  it('повторное использование (revoked + family) → отзыв всей семьи + аудит + 401', async () => {
    const { svc, prisma, securityLog } = makeDeps();
    prisma.webSession.findUnique.mockResolvedValue({
      userId: 5n, family: 'fam1', revokedAt: new Date(), expiresAt: new Date(Date.now() + 1e6),
    });
    await expect(svc.rotateRefreshToken('stolen')).rejects.toThrow('already used or expired');
    expect(securityLog.log).toHaveBeenCalledWith('refresh_token_reuse', expect.objectContaining({ family: 'fam1' }));
    expect(prisma.webSession.updateMany).toHaveBeenCalled(); // revokeFamilyExcept
  });

  it('валидный refresh → транзакция (отзыв старого + новый), новая пара', async () => {
    const { svc, prisma } = makeDeps();
    prisma.webSession.findUnique.mockResolvedValue({
      userId: 5n, family: 'fam1', revokedAt: null, expiresAt: new Date(Date.now() + 1e6),
    });
    const pair = await svc.rotateRefreshToken('valid', '1.2.3.4', 'UA');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(svc.verifyAccessToken(pair.accessToken)).toEqual({ userId: 5n });
    expect(pair.refreshToken).toBeDefined();
  });
});

describe('AuthService — logout / revoke', () => {
  it('revokeSession отзывает по хэшу', async () => {
    const { svc, prisma } = makeDeps();
    await svc.revokeSession('raw');
    expect(prisma.webSession.updateMany).toHaveBeenCalledWith({
      where: { tokenHash: crypto.createHash('sha256').update('raw').digest('hex'), revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('revokeAllSessions отзывает все активные сессии юзера', async () => {
    const { svc, prisma } = makeDeps();
    await svc.revokeAllSessions(5n);
    expect(prisma.webSession.updateMany).toHaveBeenCalledWith({
      where: { userId: 5n, revokedAt: null }, data: { revokedAt: expect.any(Date) },
    });
  });
});

describe('AuthService.findOrCreateUserByProvider', () => {
  it('существующий провайдер → возвращает userId, обновляет displayName', async () => {
    const { svc, prisma } = makeDeps();
    prisma.authProvider.findUnique.mockResolvedValue({ id: 'ap1', userId: 42n });
    expect(await svc.findOrCreateUserByProvider('telegram', '42', 'Аня')).toBe(42n);
    expect(prisma.authProvider.update).toHaveBeenCalled();
    expect(prisma.user.upsert).not.toHaveBeenCalled();
  });

  it('новый telegram → userId = telegramId', async () => {
    const { svc, prisma } = makeDeps();
    const id = await svc.findOrCreateUserByProvider('telegram', '777', 'Аня');
    expect(id).toBe(777n);
    expect(prisma.user.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 777n } }));
  });

  it('новый google → web-only userId в безопасном диапазоне (≥10^15)', async () => {
    const { svc } = makeDeps();
    const id = await svc.findOrCreateUserByProvider('google', 'g-sub', 'Аня', 'a@b.com') as bigint;
    expect(id).toBeGreaterThanOrEqual(1_000_000_000_000_000n);
    expect(id).toBeLessThan(9_000_000_000_000_000n);
  });
});

describe('AuthService.linkProviderToUser / unlinkProvider', () => {
  it('провайдер уже у этого юзера → {ok:true}', async () => {
    const { svc, prisma } = makeDeps();
    prisma.authProvider.findUnique.mockResolvedValue({ userId: 5n });
    expect(await svc.linkProviderToUser(5n, 'google', 'g')).toEqual({ ok: true });
  });

  it('провайдер у другого юзера → {ok:false, conflictUserId}', async () => {
    const { svc, prisma } = makeDeps();
    prisma.authProvider.findUnique.mockResolvedValue({ userId: 99n });
    expect(await svc.linkProviderToUser(5n, 'google', 'g')).toEqual({ ok: false, conflictUserId: '99' });
  });

  it('новый провайдер → создаётся, {ok:true}', async () => {
    const { svc, prisma } = makeDeps();
    expect(await svc.linkProviderToUser(5n, 'google', 'g')).toEqual({ ok: true });
    expect(prisma.authProvider.create).toHaveBeenCalled();
  });

  it('unlink последнего провайдера → Conflict (нельзя потерять доступ)', async () => {
    const { svc, prisma } = makeDeps();
    prisma.authProvider.findMany.mockResolvedValue([{ provider: 'google' }]);
    await expect(svc.unlinkProvider(5n, 'google')).rejects.toThrow(ConflictException);
  });

  it('unlink при нескольких провайдерах → deleteMany', async () => {
    const { svc, prisma } = makeDeps();
    prisma.authProvider.findMany.mockResolvedValue([{ provider: 'google' }, { provider: 'telegram' }]);
    await svc.unlinkProvider(5n, 'google');
    expect(prisma.authProvider.deleteMany).toHaveBeenCalledWith({ where: { userId: 5n, provider: 'google' } });
  });
});

describe('AuthService — email magic-link', () => {
  it('requestEmailLogin: невалидный email → BadRequest', async () => {
    const { svc } = makeDeps();
    await expect(svc.requestEmailLogin('нет-собаки')).rejects.toThrow(BadRequestException);
  });

  it('requestEmailLogin: валидный → создаёт токен (хэш) и шлёт ссылку', async () => {
    const { svc, prisma, emailSvc } = makeDeps();
    await svc.requestEmailLogin('User@Mail.com');
    const tokenData = prisma.emailToken.create.mock.calls[0][0].data;
    expect(tokenData.email).toBe('user@mail.com'); // нормализован
    expect(tokenData.purpose).toBe('login');
    expect(tokenData.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(emailSvc.sendLoginLink).toHaveBeenCalled();
  });

  it('consumeEmailToken: не найден → 401', async () => {
    const { svc } = makeDeps();
    await expect(svc.consumeEmailToken('raw')).rejects.toThrow('Token not found');
  });

  it('consumeEmailToken: уже использован → 401', async () => {
    const { svc, prisma } = makeDeps();
    prisma.emailToken.findUnique.mockResolvedValue({ id: 't', usedAt: new Date(), userId: 5n, purpose: 'login', expiresAt: new Date(Date.now() + 1e6) });
    await expect(svc.consumeEmailToken('raw')).rejects.toThrow('already used');
  });

  it('consumeEmailToken: просрочен → 401', async () => {
    const { svc, prisma } = makeDeps();
    prisma.emailToken.findUnique.mockResolvedValue({ id: 't', usedAt: null, userId: 5n, purpose: 'login', expiresAt: new Date(Date.now() - 1000) });
    await expect(svc.consumeEmailToken('raw')).rejects.toThrow('expired');
  });

  it('consumeEmailToken: валидный login → помечает использованным и выдаёт токены', async () => {
    const { svc, prisma } = makeDeps();
    prisma.emailToken.findUnique.mockResolvedValue({ id: 't', usedAt: null, userId: 5n, purpose: 'login', email: 'a@b.com', expiresAt: new Date(Date.now() + 1e6) });
    const res = await svc.consumeEmailToken('raw', '1.2.3.4', 'UA');
    expect(prisma.emailToken.update).toHaveBeenCalledWith({ where: { id: 't' }, data: { usedAt: expect.any(Date) } });
    expect(svc.verifyAccessToken(res.tokens.accessToken)).toEqual({ userId: 5n });
    expect(res.purpose).toBe('login');
  });

  it('linkEmailToAccount: email занят другим юзером → Conflict', async () => {
    const { svc, prisma } = makeDeps();
    prisma.authProvider.findUnique.mockResolvedValue({ userId: 99n });
    await expect(svc.linkEmailToAccount(5n, 'a@b.com')).rejects.toThrow(ConflictException);
  });

  it('linkEmailToAccount: свободный email → создаёт link-токен и шлёт письмо', async () => {
    const { svc, prisma, emailSvc } = makeDeps();
    await svc.linkEmailToAccount(5n, 'New@Mail.com');
    const data = prisma.emailToken.create.mock.calls[0][0].data;
    expect(data.purpose).toBe('link_email_auth');
    expect(data.email).toBe('new@mail.com');
    expect(emailSvc.sendLoginLink).toHaveBeenCalled();
  });

  it('consumeEmailToken: link_email_auth → привязывает провайдера и выдаёт токены', async () => {
    const { svc, prisma } = makeDeps();
    prisma.emailToken.findUnique.mockResolvedValue({ id: 't', usedAt: null, userId: 5n, purpose: 'link_email_auth', email: 'a@b.com', expiresAt: new Date(Date.now() + 1e6) });
    const res = await svc.consumeEmailToken('raw');
    expect(prisma.authProvider.create).toHaveBeenCalled(); // провайдер привязан
    expect(res.purpose).toBe('link_email_auth');
    expect(svc.verifyAccessToken(res.tokens.accessToken)).toEqual({ userId: 5n });
  });

  it('consumeEmailToken: link_email_auth, email уже у другого → Conflict', async () => {
    const { svc, prisma } = makeDeps();
    prisma.emailToken.findUnique.mockResolvedValue({ id: 't', usedAt: null, userId: 5n, purpose: 'link_email_auth', email: 'a@b.com', expiresAt: new Date(Date.now() + 1e6) });
    prisma.authProvider.findUnique.mockResolvedValue({ userId: 99n }); // занят другим
    await expect(svc.consumeEmailToken('raw')).rejects.toThrow(ConflictException);
  });
});

describe('AuthService.getUserProviders', () => {
  it('возвращает список провайдеров юзера', async () => {
    const { svc, prisma } = makeDeps();
    prisma.authProvider.findMany.mockResolvedValue([{ provider: 'google', email: 'a@b.com', displayName: 'Аня' }]);
    expect(await svc.getUserProviders(5n)).toEqual([{ provider: 'google', email: 'a@b.com', displayName: 'Аня' }]);
  });
});
