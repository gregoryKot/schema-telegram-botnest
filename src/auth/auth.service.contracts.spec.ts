// AuthService: то, что тесты основного спека (auth.service.spec.ts) не
// утверждали, а мутационный прогон волны А нашёл выжившим (nightly 2026-10-14,
// счёт файла 91,61% → 88,86%):
//  - тексты отказов (401/400): клиенты и логи различают причину по message;
//  - КАКИЕ ИМЕННО поля запрашиваются у Prisma (минимизация PII: токены и
//    хэши не должны подтягиваться «заодно») и по какому ключу;
//  - строки логов привязки/отвязки способа входа (аудит-след);
//  - развилка P2002 при гонке привязки: чужие ошибки пробрасываются;
//  - тревога об эхо мёртвой куки и вердикт ротации уходят в logger.warn.
// Prisma — общий stateful-фейк (src/test-support/fake-prisma.spec-helper.ts).
import { Logger, UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'crypto';
import * as cryptoModule from 'crypto';
// randomBytes обёрнут в jest.fn (по умолчанию — настоящая реализация), чтобы
// в одном тесте подставить детерминированный буфер — built-in 'crypto'
// через jest.spyOn не переопределяется.
jest.mock('crypto', () => {
  const actual = jest.requireActual('crypto');
  return { ...actual, randomBytes: jest.fn(actual.randomBytes) };
});
import { AuthService } from './auth.service';
import {
  createFakeTable,
  createFakeTransaction,
  Row,
} from '../test-support/fake-prisma.spec-helper';

const JWT_SECRET = 'test-jwt-secret';
const BOT_TOKEN = '12345:TEST_TOKEN';
const FIXED_DATE = new Date('2026-07-16T12:00:00.000Z');
const WEB_USER_ID_MIN = 1_000_000_000_000_000n;
const WEB_USER_ID_MAX = 9_000_000_000_000_000n;

function makeService() {
  const webSessions: Row[] = [];
  const authProviders: Row[] = [];
  const users: Row[] = [];
  const emailTokens: Row[] = [];
  const prisma: any = {
    emailToken: createFakeTable(emailTokens, { defaults: { usedAt: null } }),
    webSession: createFakeTable(webSessions, {
      defaults: { revokedAt: null, replacedByHash: null },
    }),
    authProvider: createFakeTable(authProviders),
    user: createFakeTable(users),
  };
  prisma.$transaction = createFakeTransaction<Row>(prisma);
  const config = {
    getOrThrow: (k: string) =>
      ({ JWT_SECRET, BOT_TOKEN, WEBAPP_URL: 'https://schemehappens.ru' })[
        k as 'JWT_SECRET' | 'BOT_TOKEN' | 'WEBAPP_URL'
      ],
  } as any;
  const securityLog = { log: jest.fn() } as any;
  const emailSvc = {
    sendLoginLink: jest.fn().mockResolvedValue(undefined),
    sendLinkEmailLetter: jest.fn().mockResolvedValue(undefined),
  } as any;
  const svc = new AuthService(prisma, config, securityLog, emailSvc);
  return {
    svc,
    prisma,
    webSessions,
    authProviders,
    users,
    emailTokens,
    emailSvc,
  };
}

/** initData с настоящей подписью; authDate: null — поля auth_date нет вовсе. */
function signedInitData(opts: {
  user?: string;
  authDate?: number | null;
}): string {
  const params = new URLSearchParams();
  if (opts.user !== undefined) params.set('user', opts.user);
  if (opts.authDate !== null)
    params.set(
      'auth_date',
      String(opts.authDate ?? Math.floor(Date.now() / 1000)),
    );
  const checkString = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  params.set(
    'hash',
    createHmac('sha256', secret).update(checkString).digest('hex'),
  );
  return params.toString();
}

beforeEach(() => jest.useFakeTimers({ now: FIXED_DATE }));
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('AuthService — тексты отказов initData', () => {
  it('нет auth_date вовсе → "expired" (отсутствие даты не равно «свежему»)', () => {
    const { svc } = makeService();
    const initData = signedInitData({ user: '{"id":1}', authDate: null });
    expect(() => svc.verifyTelegramWebAppData(initData)).toThrow(
      new UnauthorizedException('Telegram initData expired'),
    );
  });

  it('просроченный auth_date → "Telegram initData expired"', () => {
    const { svc } = makeService();
    const old = Math.floor(Date.now() / 1000) - 3601;
    expect(() =>
      svc.verifyTelegramWebAppData(
        signedInitData({ user: '{"id":1}', authDate: old }),
      ),
    ).toThrow('Telegram initData expired');
  });

  it('чужая подпись → "Invalid Telegram WebApp signature"', () => {
    const { svc } = makeService();
    const params = new URLSearchParams(signedInitData({ user: '{"id":1}' }));
    params.set('hash', 'a'.repeat(64));
    expect(() => svc.verifyTelegramWebAppData(params.toString())).toThrow(
      'Invalid Telegram WebApp signature',
    );
  });

  it('подпись верна, но user нет → "Missing user in initData"', () => {
    const { svc } = makeService();
    expect(() => svc.verifyTelegramWebAppData(signedInitData({}))).toThrow(
      'Missing user in initData',
    );
  });

  it('user — не JSON → "Invalid user JSON in initData"', () => {
    const { svc } = makeService();
    expect(() =>
      svc.verifyTelegramWebAppData(signedInitData({ user: '{oops' })),
    ).toThrow('Invalid user JSON in initData');
  });

  it('user без id → "Missing user id in initData"', () => {
    const { svc } = makeService();
    expect(() =>
      svc.verifyTelegramWebAppData(
        signedInitData({ user: '{"first_name":"A"}' }),
      ),
    ).toThrow('Missing user id in initData');
  });
});

describe('AuthService — тексты отказов токенов и почты', () => {
  it('невалидный email при входе → "Invalid email"', async () => {
    const { svc } = makeService();
    await expect(svc.requestEmailLogin('nope')).rejects.toThrow(
      'Invalid email',
    );
  });

  it('невалидный email при привязке → "Invalid email"', async () => {
    const { svc } = makeService();
    await expect(svc.linkEmailToAccount(1n, 'nope')).rejects.toThrow(
      'Invalid email',
    );
  });

  it('merge-токен чужого вида и мусорный — один и тот же понятный отказ', () => {
    const { svc } = makeService();
    const link = svc.buildLinkToken(1n);
    expect(() => svc.verifyMergeToken(link)).toThrow(
      new UnauthorizedException('Invalid or expired merge token'),
    );
    expect(() => svc.verifyMergeToken('garbage')).toThrow(
      'Invalid or expired merge token',
    );
  });

  it('2FA-токен чужого вида и мусорный — один и тот же понятный отказ', async () => {
    const { svc } = makeService();
    const { accessToken } = await svc.issueTokens(1n);
    expect(() => svc.verifyTotpChallengeToken(accessToken)).toThrow(
      new UnauthorizedException('Invalid or expired 2FA challenge token'),
    );
    expect(() => svc.verifyTotpChallengeToken('garbage')).toThrow(
      'Invalid or expired 2FA challenge token',
    );
  });

  it('неизвестный refresh-токен → "Unknown refresh token"', async () => {
    const { svc } = makeService();
    await expect(svc.rotateRefreshToken('нет-такого')).rejects.toThrow(
      new UnauthorizedException('Unknown refresh token'),
    );
  });
});

describe('AuthService — что спрашиваем у Prisma', () => {
  it('requestEmailLogin ищет провайдера по (email, адрес в нижнем регистре)', async () => {
    const { svc, prisma } = makeService();
    await svc.requestEmailLogin('Known@Example.com');
    expect(prisma.authProvider.findUnique).toHaveBeenCalledWith({
      where: {
        provider_providerId: {
          provider: 'email',
          providerId: 'known@example.com',
        },
      },
    });
  });

  it('requestEmailLogin: чужие провайдеры в таблице не подставляются — известный адрес получает СВОЙ userId, новый — null', async () => {
    const { svc, authProviders, emailTokens } = makeService();
    authProviders.push(
      { id: 1, userId: 5n, provider: 'telegram', providerId: '5' },
      { id: 2, userId: 7n, provider: 'email', providerId: 'known@example.com' },
    );
    await svc.requestEmailLogin('known@example.com');
    await svc.requestEmailLogin('fresh@example.com');
    expect(emailTokens.map((t) => t.userId)).toEqual([7n, null]);
  });

  it('форма обращения письма берётся у ВЛАДЕЛЬЦА адреса, а не у первого юзера в таблице', async () => {
    const { svc, prisma, authProviders, users, emailSvc } = makeService();
    users.push({ id: 1n, addressForm: 'ty' }, { id: 7n, addressForm: 'vy' });
    authProviders.push({
      id: 2,
      userId: 7n,
      provider: 'email',
      providerId: 'known@example.com',
    });
    await svc.requestEmailLogin('known@example.com');
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 7n },
      select: { addressForm: true },
    });
    expect(emailSvc.sendLoginLink).toHaveBeenCalledWith(
      'known@example.com',
      expect.any(String),
      'vy',
    );
  });

  it('getUserProviders запрашивает только provider/email/displayName (токены и id не подтягиваются)', async () => {
    const { svc, prisma } = makeService();
    await svc.getUserProviders(1n);
    expect(prisma.authProvider.findMany).toHaveBeenCalledWith({
      where: { userId: 1n },
      select: { provider: true, email: true, displayName: true },
    });
  });

  it('revokeSession ищет свою сессию по tokenHash и берёт только family', async () => {
    const { svc, prisma, webSessions } = makeService();
    await svc.issueTokens(2n);
    const mine = await svc.issueTokens(1n);
    await svc.revokeSession(mine.refreshToken);
    expect(prisma.webSession.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: expect.stringMatching(/^[0-9a-f]{64}$/) },
      select: { family: true },
    });
    // и семья именно ТОЙ сессии, не первой в таблице
    expect(webSessions[0].revokedAt).toBeNull();
    expect(webSessions[1].revokedAt).not.toBeNull();
  });
});

describe('AuthService — след привязки и отвязки способов входа', () => {
  it('новый провайдер: в лог уходит провайдер и userId', async () => {
    const { svc } = makeService();
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const userId = await svc.findOrCreateUserByProvider('google', 'g-1', 'Имя');
    expect(log).toHaveBeenCalledWith(
      `New google auth provider linked to userId ${userId}`,
    );
  });

  it('привязка к существующему пользователю: в лог уходит провайдер и userId', async () => {
    const { svc } = makeService();
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    await svc.linkProviderToUser(9n, 'google', 'g-9');
    expect(log).toHaveBeenCalledWith('Linked google provider to userId 9');
  });

  it('отвязка: в лог уходит провайдер и userId', async () => {
    const { svc, authProviders } = makeService();
    authProviders.push(
      { id: 1, userId: 1n, provider: 'telegram', providerId: '1' },
      { id: 2, userId: 1n, provider: 'google', providerId: 'g-1' },
    );
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    await svc.unlinkProvider(1n, 'google');
    expect(log).toHaveBeenCalledWith('Unlinked google from userId 1');
  });

  // Развилка гонки привязки читает только код P2002. Любая другая ошибка
  // create (недоступна БД, нарушение другого ограничения) обязана дойти до
  // вызывающего, даже если параллельный запрос тем временем вставил строку, —
  // иначе мы ответили бы «привязано» на сбой, который строку не создавал.
  it('ошибка create без кода P2002 пробрасывается, даже когда строка уже появилась', async () => {
    const { svc, prisma } = makeService();
    prisma.authProvider.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ userId: 9n });
    prisma.authProvider.create.mockRejectedValueOnce(new Error('db down'));
    await expect(svc.linkProviderToUser(9n, 'google', 'g-9')).rejects.toThrow(
      'db down',
    );
  });
});

describe('AuthService — выдача и ротация токенов', () => {
  it('первая выдача помечена rotated: true (клиент обязан записать куку)', async () => {
    const { svc } = makeService();
    const issued = await svc.issueTokens(1n);
    expect(issued.rotated).toBe(true);
  });

  it('повтор потерянного ответа пишет вердикт в logger.warn', async () => {
    const { svc } = makeService();
    const issued = await svc.issueTokens(1n);
    await svc.rotateRefreshToken(issued.refreshToken);
    jest.setSystemTime(new Date(FIXED_DATE.getTime() + 3600_000));
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    await svc.rotateRefreshToken(issued.refreshToken);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.any(String));
  });

  it('эхо мёртвой куки после кражи: вердикт и пометка «эхо» — оба в logger.warn', async () => {
    const { svc } = makeService();
    const issued = await svc.issueTokens(1n);
    const second = await svc.rotateRefreshToken(issued.refreshToken);
    await svc.rotateRefreshToken(second.refreshToken);
    await expect(svc.rotateRefreshToken(issued.refreshToken)).rejects.toThrow(
      UnauthorizedException,
    ); // кража: семья отозвана, алерт ушёл
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    await expect(svc.rotateRefreshToken(issued.refreshToken)).rejects.toThrow(
      UnauthorizedException,
    );
    const messages = warn.mock.calls.map((c) => String(c[0]));
    expect(messages).toHaveLength(2);
    expect(messages.some((m) => m.includes('echo of a dead cookie'))).toBe(
      true,
    );
  });
});

describe('AuthService — генерация web-userId', () => {
  // Старый тест (auth.service.spec.ts) брал 0xff…ff: это число кратно и
  // разности границ, и их сумме с одинаковым остатком, поэтому подмена
  // «MAX − MIN» на «MAX + MIN» его переживала. Здесь остаток считается от
  // числа, у которого эти два варианта расходятся.
  it('id = MIN + rand % (MAX − MIN): сумма границ вместо разности даёт другой id', async () => {
    const { svc } = makeService();
    const rand = 8_500_000_000_000_000n;
    const bytes = Buffer.from(rand.toString(16).padStart(16, '0'), 'hex');
    (cryptoModule.randomBytes as unknown as jest.Mock).mockReturnValueOnce(
      bytes,
    );
    const userId = await svc.findOrCreateUserByProvider(
      'google',
      'g-arith',
      'Имя',
    );
    const range = WEB_USER_ID_MAX - WEB_USER_ID_MIN;
    expect(rand % range).not.toBe(rand % (WEB_USER_ID_MAX + WEB_USER_ID_MIN));
    expect(userId).toBe(WEB_USER_ID_MIN + (rand % range));
  });
});
