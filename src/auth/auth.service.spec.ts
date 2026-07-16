// Этап 1 плана покрытия (TEST_COVERAGE_PLAN.md, п.5): AuthService — ротация
// refresh-токенов (reuse-детекция кражи), подпись initData (regression на
// RangeError вместо 401), генерация userId, merge-токены. Prisma — стейтфулый
// in-memory фейк; подпись пересчитана как в telegram-auth.guard.spec.ts.
import { UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { AuthService } from './auth.service';

const JWT_SECRET = 'test-jwt-secret';
const BOT_TOKEN = '12345:TEST_TOKEN';
const FIXED_DATE = new Date('2026-07-16T12:00:00.000Z');
const WEB_USER_ID_MIN = 1_000_000_000_000_000n;
const WEB_USER_ID_MAX = 9_000_000_000_000_000n;

// hash: undefined = подписать честно; 'omit' = без hash; иначе — как есть.
function signInitData(opts: {
  user?: unknown;
  authDate?: number;
  botToken?: string;
  hash?: string;
}): string {
  const params = new URLSearchParams();
  if (opts.user !== undefined) params.set('user', JSON.stringify(opts.user));
  params.set(
    'auth_date',
    String(opts.authDate ?? Math.floor(Date.now() / 1000)),
  );
  if (opts.hash === 'omit') return params.toString();
  const checkString = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData')
    .update(opts.botToken ?? BOT_TOKEN)
    .digest();
  const correct = createHmac('sha256', secret)
    .update(checkString)
    .digest('hex');
  params.set('hash', opts.hash ?? correct);
  return params.toString();
}

const matchesWhere = (row: any, where: Record<string, unknown>): boolean =>
  Object.entries(where).every(([k, v]) =>
    v && typeof v === 'object' && 'not' in (v as any)
      ? row[k] !== (v as any).not
      : row[k] === v,
  );

// Только таблицы, которые реально трогает AuthService в тестируемых путях.
function makeFakePrisma() {
  const webSessions: any[] = [];
  const authProviders: any[] = [];
  const users: any[] = [];
  const findProvider = (provider: string, providerId: string) =>
    authProviders.find(
      (p) => p.provider === provider && p.providerId === providerId,
    );

  const prisma: any = {
    webSession: {
      create: jest.fn(({ data }: any) => {
        const row = { revokedAt: null, ...data };
        webSessions.push(row);
        return row;
      }),
      findUnique: jest.fn(
        ({ where: { tokenHash } }: any) =>
          webSessions.find((s) => s.tokenHash === tokenHash) ?? null,
      ),
      update: jest.fn(({ where: { tokenHash }, data }: any) =>
        Object.assign(
          webSessions.find((s) => s.tokenHash === tokenHash),
          data,
        ),
      ),
      updateMany: jest.fn(({ where, data }: any) => {
        const hit = webSessions.filter((r) => matchesWhere(r, where));
        hit.forEach((r) => Object.assign(r, data));
        return { count: hit.length };
      }),
    },
    authProvider: {
      findUnique: jest.fn(({ where }: any) => {
        const { provider, providerId } = where.provider_providerId;
        return findProvider(provider, providerId) ?? null;
      }),
      upsert: jest.fn(({ where, create, update }: any) => {
        const { provider, providerId } = where.provider_providerId;
        const existing = findProvider(provider, providerId);
        if (existing) return Object.assign(existing, update);
        const row = { id: authProviders.length + 1, ...create };
        authProviders.push(row);
        return row;
      }),
      update: jest.fn(({ where: { id }, data }: any) =>
        Object.assign(
          authProviders.find((p) => p.id === id),
          data,
        ),
      ),
    },
    user: {
      upsert: jest.fn(({ where: { id }, create, update }: any) => {
        const row = users.find((u) => u.id === id);
        if (row) return Object.assign(row, update);
        const created = { ...create };
        users.push(created);
        return created;
      }),
    },
    $transaction: jest.fn((arg: any) =>
      Array.isArray(arg) ? Promise.all(arg) : arg(prisma),
    ),
  };

  return { prisma, webSessions, authProviders, users };
}

function makeService() {
  const { prisma, webSessions, authProviders, users } = makeFakePrisma();
  const config = {
    getOrThrow: (k: string) => ({ JWT_SECRET, BOT_TOKEN })[k],
  } as any;
  const securityLog = { log: jest.fn() } as any;
  const emailSvc = { sendLoginLink: jest.fn() } as any;
  const svc = new AuthService(prisma, config, securityLog, emailSvc);
  return { svc, prisma, webSessions, authProviders, users, securityLog };
}

beforeEach(() => jest.useFakeTimers({ now: FIXED_DATE }));

afterEach(() => jest.useRealTimers());

describe('AuthService — refresh-token rotation', () => {
  it('issueTokens хранит только хэш; rotateRefreshToken меняет токен ровно один раз', async () => {
    const { svc, webSessions } = makeService();
    const issued = await svc.issueTokens(1n, '1.1.1.1', 'ua');
    expect(webSessions).toHaveLength(1);
    expect(webSessions[0].tokenHash).not.toBe(issued.refreshToken); // сырой токен нигде не хранится
    expect(webSessions[0].tokenHash).toHaveLength(64); // sha256 hex
    expect(issued.expiresIn).toBe(15 * 60);

    const rotated = await svc.rotateRefreshToken(issued.refreshToken);
    expect(rotated.refreshToken).not.toBe(issued.refreshToken);
    expect(webSessions).toHaveLength(2);
    expect(webSessions[0].revokedAt).toEqual(FIXED_DATE); // старая отозвана
    expect(webSessions[1].revokedAt).toBeNull(); // новая жива
    expect(webSessions[1].family).toBe(webSessions[0].family);
  });

  it('повторное использование уже провёрнутого токена палит всю family (theft detection)', async () => {
    const { svc, webSessions, securityLog } = makeService();
    const issued = await svc.issueTokens(1n);
    await svc.rotateRefreshToken(issued.refreshToken); // легитимный refresh
    await expect(svc.rotateRefreshToken(issued.refreshToken)).rejects.toThrow(
      UnauthorizedException,
    );
    // вся family отозвана, включая токен, честно выданный на шаге выше
    expect(webSessions.every((s) => s.revokedAt !== null)).toBe(true);
    expect(securityLog.log).toHaveBeenCalledWith(
      'refresh_token_reuse',
      expect.objectContaining({ userId: 1n }),
    );
  });

  it.each<[string, (svc: AuthService) => Promise<string>]>([
    ['неизвестный (мусорный) токен', () => Promise.resolve('garbage-token')],
    [
      'истёкший',
      async (svc) => {
        const issued = await svc.issueTokens(1n);
        jest.setSystemTime(
          new Date(FIXED_DATE.getTime() + 31 * 24 * 3600 * 1000),
        );
        return issued.refreshToken;
      },
    ],
    [
      'явно отозванный (revokeSession)',
      async (svc) => {
        const issued = await svc.issueTokens(1n);
        await svc.revokeSession(issued.refreshToken);
        return issued.refreshToken;
      },
    ],
  ])('%s refresh-токен отклоняется', async (_name, setup) => {
    const { svc } = makeService();
    const token = await setup(svc);
    await expect(svc.rotateRefreshToken(token)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});

describe('AuthService — verifyTelegramWebAppData', () => {
  it('валидная подпись → id и firstName пользователя', () => {
    const { svc } = makeService();
    const initData = signInitData({ user: { id: 42, first_name: 'Грег' } });
    expect(svc.verifyTelegramWebAppData(initData)).toEqual({
      id: 42,
      firstName: 'Грег',
    });
  });

  it.each<[string, () => string]>([
    ['нет hash', () => signInitData({ user: { id: 1 }, hash: 'omit' })],
    // регрессия: раньше вело к RangeError (500), не к 401
    [
      'hash не 64-hex (мусор)',
      () => signInitData({ user: { id: 1 }, hash: 'not-hex-and-wrong-length' }),
    ],
    [
      'подделанный (но правильной длины) hash',
      () => signInitData({ user: { id: 42 }, hash: 'a'.repeat(64) }),
    ],
    [
      'просроченный auth_date (старше часа)',
      () =>
        signInitData({
          user: { id: 42 },
          authDate: Math.floor(Date.now() / 1000) - 3700,
        }),
    ],
  ])('%s → UnauthorizedException', (_name, buildInitData) => {
    const { svc } = makeService();
    expect(() => svc.verifyTelegramWebAppData(buildInitData())).toThrow(
      UnauthorizedException,
    );
  });
});

describe('AuthService — findOrCreateUserByProvider', () => {
  it('существующий провайдер → возвращает его userId, новую User-строку не создаёт', async () => {
    const { svc, authProviders, users } = makeService();
    authProviders.push({
      id: 1,
      userId: 777n,
      provider: 'google',
      providerId: 'g-1',
      displayName: 'Old Name',
    });
    const userId = await svc.findOrCreateUserByProvider(
      'google',
      'g-1',
      'New Name',
    );
    expect(userId).toBe(777n);
    expect(authProviders[0].displayName).toBe('New Name');
    expect(users).toHaveLength(0);
  });

  it.each<['telegram' | 'google', string, (id: bigint) => void]>([
    ['telegram', '555', (id) => expect(id).toBe(555n)], // userId = telegramId
    [
      'google', // web-only userId в безопасном от Telegram-ID диапазоне
      'g-sub-1',
      (id) => {
        expect(id).toBeGreaterThanOrEqual(WEB_USER_ID_MIN);
        expect(id).toBeLessThan(WEB_USER_ID_MAX);
      },
    ],
  ])(
    'новый %s-провайдер (%s) создаёт User + AuthProvider',
    async (provider, providerId, assertId) => {
      const { svc, users, authProviders } = makeService();
      const userId = await svc.findOrCreateUserByProvider(
        provider,
        providerId,
        'Имя',
      );
      assertId(userId);
      expect(users[0].id).toBe(userId);
      expect(authProviders[0]).toEqual(
        expect.objectContaining({ userId, provider }),
      );
    },
  );
});

describe('AuthService — merge-токены', () => {
  it('buildMergeToken → verifyMergeToken: roundtrip возвращает исходные поля', () => {
    const { svc } = makeService();
    const token = svc.buildMergeToken(1n, 2n, 'google', 'g-1');
    expect(svc.verifyMergeToken(token)).toEqual({
      target: 1n,
      source: 2n,
      provider: 'google',
      providerId: 'g-1',
    });
  });

  it('verifyMergeToken отклоняет токен чужого вида (link вместо merge)', () => {
    const { svc } = makeService();
    const linkToken = svc.buildLinkToken(1n);
    expect(() => svc.verifyMergeToken(linkToken)).toThrow(
      UnauthorizedException,
    );
  });
});
