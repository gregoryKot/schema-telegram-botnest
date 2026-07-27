// Этап 1 плана покрытия (TEST_COVERAGE_PLAN.md, п.5): AuthService — ротация
// refresh-токенов (reuse-детекция кражи), подпись initData (regression на
// RangeError вместо 401), генерация userId, merge-токены. Prisma — стейтфулый
// in-memory фейк; подпись пересчитана как в telegram-auth.guard.spec.ts.
import {
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { createHmac, createHash } from 'crypto';
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
  const emailTokens: any[] = [];
  const findProvider = (provider: string, providerId: string) =>
    authProviders.find(
      (p) => p.provider === provider && p.providerId === providerId,
    );

  const prisma: any = {
    emailToken: {
      create: jest.fn(({ data }: any) => {
        const row = { usedAt: null, ...data };
        emailTokens.push(row);
        return row;
      }),
      findUnique: jest.fn(
        ({ where: { tokenHash } }: any) =>
          emailTokens.find((t) => t.tokenHash === tokenHash) ?? null,
      ),
      update: jest.fn(({ where: { id }, data }: any) =>
        Object.assign(
          emailTokens.find((t) => t.id === id),
          data,
        ),
      ),
    },
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
      create: jest.fn(({ data }: any) => {
        const row = { id: authProviders.length + 1, ...data };
        authProviders.push(row);
        return row;
      }),
      findMany: jest.fn(({ where, select }: any) => {
        const rows = authProviders.filter((p) => matchesWhere(p, where));
        if (!select) return rows;
        return rows.map((r) =>
          Object.fromEntries(Object.keys(select).map((k) => [k, r[k] ?? null])),
        );
      }),
      deleteMany: jest.fn(({ where }: any) => {
        const before = authProviders.length;
        for (let i = authProviders.length - 1; i >= 0; i--)
          if (matchesWhere(authProviders[i], where)) authProviders.splice(i, 1);
        return { count: before - authProviders.length };
      }),
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

  return { prisma, webSessions, authProviders, users, emailTokens };
}

function makeService() {
  const { prisma, webSessions, authProviders, users, emailTokens } =
    makeFakePrisma();
  const config = {
    getOrThrow: (k: string) =>
      ({ JWT_SECRET, BOT_TOKEN, WEBAPP_URL: 'https://schemehappens.ru' })[k],
  } as any;
  const securityLog = { log: jest.fn() } as any;
  const emailSvc = {
    sendLoginLink: jest.fn().mockResolvedValue(undefined),
  } as any;
  const svc = new AuthService(prisma, config, securityLog, emailSvc);
  return {
    svc,
    prisma,
    webSessions,
    authProviders,
    users,
    emailTokens,
    securityLog,
    emailSvc,
  };
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

describe('AuthService — verifyTelegramWebAppData: битый user JSON', () => {
  it('user-поле — не валидный JSON → UnauthorizedException (не SyntaxError наружу)', () => {
    const { svc } = makeService();
    // signInitData сериализует user через JSON.stringify — здесь собираем
    // initData вручную, чтобы протащить синтаксически битый JSON в user=.
    const params = new URLSearchParams();
    params.set('user', '{not-valid-json');
    params.set('auth_date', String(Math.floor(Date.now() / 1000)));
    const checkString = [...params.entries()]
      .map(([k, v]) => `${k}=${v}`)
      .sort()
      .join('\n');
    const secret = createHmac('sha256', 'WebAppData')
      .update(BOT_TOKEN)
      .digest();
    const hash = createHmac('sha256', secret).update(checkString).digest('hex');
    params.set('hash', hash);
    expect(() => svc.verifyTelegramWebAppData(params.toString())).toThrow(
      UnauthorizedException,
    );
  });

  it('user.id отсутствует → UnauthorizedException', () => {
    const { svc } = makeService();
    const initData = signInitData({ user: { first_name: 'Без id' } });
    expect(() => svc.verifyTelegramWebAppData(initData)).toThrow(
      UnauthorizedException,
    );
  });
});

describe('AuthService — requestEmailLogin', () => {
  it.each([
    ['без @', 'not-an-email'],
    ['без домена', 'a@b'],
    ['слишком длинный (>254)', 'a'.repeat(250) + '@b.co'],
  ])('невалидный email (%s) → BadRequestException', async (_name, email) => {
    const { svc } = makeService();
    await expect(svc.requestEmailLogin(email)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('валидный email → создаёт пользователя, emailToken и шлёт письмо со ссылкой', async () => {
    const { svc, users, emailTokens, emailSvc } = makeService();
    const result = await svc.requestEmailLogin('User@Example.com');
    expect(result).toEqual({ ok: true });
    expect(users).toHaveLength(1);
    expect(emailTokens).toHaveLength(1);
    expect(emailTokens[0].purpose).toBe('login');
    expect(emailSvc.sendLoginLink).toHaveBeenCalledWith(
      'user@example.com',
      expect.stringContaining('/api/auth/email/callback?token='),
    );
  });

  it('повторный запрос для того же email переиспользует существующего пользователя', async () => {
    const { svc, users } = makeService();
    await svc.requestEmailLogin('same@example.com');
    await svc.requestEmailLogin('same@example.com');
    expect(users).toHaveLength(1); // findOrCreateUserByProvider не плодит второго User
  });

  it('падение отправки письма не роняет запрос (fire-and-forget) — ok:true всё равно возвращается', async () => {
    const { svc, emailSvc } = makeService();
    emailSvc.sendLoginLink.mockRejectedValueOnce(new Error('smtp down'));
    await expect(svc.requestEmailLogin('fails@example.com')).resolves.toEqual({
      ok: true,
    });
  });
});

describe('AuthService — consumeEmailToken', () => {
  it('пустой токен → UnauthorizedException', async () => {
    const { svc } = makeService();
    await expect(svc.consumeEmailToken('')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('неизвестный токен → UnauthorizedException', async () => {
    const { svc } = makeService();
    await expect(svc.consumeEmailToken('garbage')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('уже использованный токен → UnauthorizedException', async () => {
    const { svc } = makeService();
    await svc.requestEmailLogin('used@example.com');
    const raw = extractTokenFromLink(svc);
    await svc.consumeEmailToken(raw);
    await expect(svc.consumeEmailToken(raw)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('просроченный токен → UnauthorizedException', async () => {
    const { svc, emailTokens } = makeService();
    await svc.requestEmailLogin('expired@example.com');
    emailTokens[0].expiresAt = new Date(FIXED_DATE.getTime() - 1000);
    const raw = extractTokenFromLink(svc);
    await expect(svc.consumeEmailToken(raw)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('токен с неизвестным purpose → UnauthorizedException', async () => {
    const { svc, emailTokens } = makeService();
    await svc.requestEmailLogin('badpurpose@example.com');
    emailTokens[0].purpose = 'something_else';
    const raw = extractTokenFromLink(svc);
    await expect(svc.consumeEmailToken(raw)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('токен без userId → UnauthorizedException', async () => {
    const { svc, emailTokens } = makeService();
    await svc.requestEmailLogin('nouser@example.com');
    emailTokens[0].userId = null;
    const raw = extractTokenFromLink(svc);
    await expect(svc.consumeEmailToken(raw)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('purpose=login → возвращает токены, помечает использованным', async () => {
    const { svc, emailTokens } = makeService();
    await svc.requestEmailLogin('login@example.com');
    const raw = extractTokenFromLink(svc);
    const result = await svc.consumeEmailToken(raw);
    expect(result.purpose).toBe('login');
    expect(result.tokens.accessToken).toBeDefined();
    expect(emailTokens[0].usedAt).not.toBeNull();
  });

  it('purpose=link_email_auth → привязывает email к целевому userId', async () => {
    const { svc, authProviders } = makeService();
    await svc.linkEmailToAccount(42n, 'link@example.com');
    const raw = extractTokenFromLink(svc);
    const result = await svc.consumeEmailToken(raw);
    expect(result.purpose).toBe('link_email_auth');
    expect(
      authProviders.some(
        (p) => p.provider === 'email' && String(p.userId) === '42',
      ),
    ).toBe(true);
  });

  it('purpose=link_email_auth, email привязался к другому userId между отправкой и переходом по ссылке (race) → ConflictException', async () => {
    const { svc, emailTokens, authProviders } = makeService();
    // Токен уже выпущен (пользователь получил письмо), но прежде чем он
    // перешёл по ссылке — email успел стать AuthProvider'ом другого userId
    // (напр. параллельный login тем же email). consumeEmailToken должен
    // отклонить привязку, а не молча перезаписать чужой провайдер.
    const raw = 'test-race-raw-token';
    const tokenHash = createHash('sha256').update(raw).digest('hex');
    emailTokens.push({
      id: 'et-race',
      userId: 999999n,
      tokenHash,
      email: 'taken@example.com',
      purpose: 'link_email_auth',
      expiresAt: new Date(FIXED_DATE.getTime() + 100_000),
      usedAt: null,
    });
    authProviders.push({
      id: 1,
      userId: 111n,
      provider: 'email',
      providerId: 'taken@example.com',
    });
    await expect(svc.consumeEmailToken(raw)).rejects.toThrow(ConflictException);
  });

  it('consumeEmailLoginToken (алиас) возвращает только TokenPair', async () => {
    const { svc } = makeService();
    await svc.requestEmailLogin('alias@example.com');
    const raw = extractTokenFromLink(svc);
    const tokens = await svc.consumeEmailLoginToken(raw);
    expect(tokens.accessToken).toBeDefined();
    expect(tokens.refreshToken).toBeDefined();
  });
});

describe('AuthService — linkEmailToAccount', () => {
  it('невалидный email → BadRequestException', async () => {
    const { svc } = makeService();
    await expect(svc.linkEmailToAccount(1n, 'nope')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('email уже привязан к ДРУГОМУ userId → ConflictException, письмо не шлётся', async () => {
    const { svc, authProviders, emailSvc } = makeService();
    authProviders.push({
      id: 1,
      userId: 111n,
      provider: 'email',
      providerId: 'busy@example.com',
    });
    await expect(
      svc.linkEmailToAccount(222n, 'busy@example.com'),
    ).rejects.toThrow(ConflictException);
    expect(emailSvc.sendLoginLink).not.toHaveBeenCalled();
  });

  it('email уже привязан к ТОМУ ЖЕ userId → не конфликт, письмо шлётся снова', async () => {
    const { svc, authProviders, emailSvc } = makeService();
    authProviders.push({
      id: 1,
      userId: 111n,
      provider: 'email',
      providerId: 'own@example.com',
    });
    await expect(
      svc.linkEmailToAccount(111n, 'own@example.com'),
    ).resolves.toEqual({ ok: true });
    expect(emailSvc.sendLoginLink).toHaveBeenCalled();
  });
});

// Достаёт сырой токен из последней вызванной ссылки sendLoginLink — линк вида
// ".../api/auth/email/callback?token=<raw>".
function extractTokenFromLink(svc: AuthService): string {
  const emailSvc = (svc as any).emailSvc;
  const link: string =
    emailSvc.sendLoginLink.mock.calls[
      emailSvc.sendLoginLink.mock.calls.length - 1
    ][1];
  return new URL(link).searchParams.get('token')!;
}

describe('AuthService — linkProviderToUser', () => {
  it('провайдер уже привязан к этому же userId → ok:true, ничего не создаёт', async () => {
    const { svc, authProviders } = makeService();
    authProviders.push({
      id: 1,
      userId: 5n,
      provider: 'google',
      providerId: 'g-5',
    });
    const result = await svc.linkProviderToUser(5n, 'google', 'g-5');
    expect(result).toEqual({ ok: true });
    expect(authProviders).toHaveLength(1);
  });

  it('провайдер привязан к ДРУГОМУ userId → ok:false с conflictUserId', async () => {
    const { svc, authProviders } = makeService();
    authProviders.push({
      id: 1,
      userId: 5n,
      provider: 'google',
      providerId: 'g-5',
    });
    const result = await svc.linkProviderToUser(6n, 'google', 'g-5');
    expect(result).toEqual({ ok: false, conflictUserId: '5' });
  });

  it('новый провайдер → создаёт AuthProvider, логирует, ok:true', async () => {
    const { svc, authProviders } = makeService();
    const result = await svc.linkProviderToUser(7n, 'google', 'g-7', 'Имя');
    expect(result).toEqual({ ok: true });
    expect(authProviders[0]).toEqual(
      expect.objectContaining({ userId: 7n, provider: 'google' }),
    );
  });

  it('гонка (P2002) при create: конкурент вставил ту же пару → повторный findUnique возвращает тот же userId → ok:true', async () => {
    const { svc, prisma, authProviders } = makeService();
    const conflictErr = Object.assign(new Error('unique violation'), {
      code: 'P2002',
    });
    (prisma.authProvider.create as jest.Mock).mockImplementationOnce(() => {
      // Имитируем гонку: конкурентный запрос успел вставить строку раньше нас.
      authProviders.push({
        id: 99,
        userId: 8n,
        provider: 'google',
        providerId: 'g-race',
      });
      throw conflictErr;
    });
    const result = await svc.linkProviderToUser(8n, 'google', 'g-race');
    expect(result).toEqual({ ok: true });
  });

  it('гонка (P2002), но конкурент привязал другого userId → ok:false с его conflictUserId', async () => {
    const { svc, prisma, authProviders } = makeService();
    const conflictErr = Object.assign(new Error('unique violation'), {
      code: 'P2002',
    });
    (prisma.authProvider.create as jest.Mock).mockImplementationOnce(() => {
      authProviders.push({
        id: 99,
        userId: 8n,
        provider: 'google',
        providerId: 'g-race2',
      });
      throw conflictErr;
    });
    const result = await svc.linkProviderToUser(9n, 'google', 'g-race2');
    expect(result).toEqual({ ok: false, conflictUserId: '8' });
  });

  it('ошибка create без кода P2002 пробрасывается наружу как есть', async () => {
    const { svc, prisma } = makeService();
    (prisma.authProvider.create as jest.Mock).mockImplementationOnce(() => {
      throw new Error('db exploded');
    });
    await expect(
      svc.linkProviderToUser(10n, 'google', 'g-boom'),
    ).rejects.toThrow('db exploded');
  });
});

describe('AuthService — unlinkProvider / getUserProviders', () => {
  it('unlinkProvider: единственный метод входа → ConflictException, ничего не удаляется', async () => {
    const { svc, authProviders } = makeService();
    authProviders.push({
      id: 1,
      userId: 1n,
      provider: 'telegram',
      providerId: '1',
    });
    await expect(svc.unlinkProvider(1n, 'telegram')).rejects.toThrow(
      ConflictException,
    );
    expect(authProviders).toHaveLength(1);
  });

  it('unlinkProvider: есть второй метод входа → отвязывает указанный провайдер', async () => {
    const { svc, authProviders } = makeService();
    authProviders.push(
      { id: 1, userId: 1n, provider: 'telegram', providerId: '1' },
      { id: 2, userId: 1n, provider: 'google', providerId: 'g-1' },
    );
    await svc.unlinkProvider(1n, 'google');
    expect(authProviders).toHaveLength(1);
    expect(authProviders[0].provider).toBe('telegram');
  });

  it('getUserProviders возвращает провайдеры только запрошенного userId', async () => {
    const { svc, authProviders } = makeService();
    authProviders.push(
      {
        id: 1,
        userId: 1n,
        provider: 'telegram',
        providerId: '1',
        email: null,
        displayName: 'Грег',
      },
      {
        id: 2,
        userId: 2n,
        provider: 'google',
        providerId: 'g-2',
        email: 'x@y.z',
        displayName: 'Другой',
      },
    );
    const rows = await svc.getUserProviders(1n);
    expect(rows).toEqual([
      { provider: 'telegram', email: null, displayName: 'Грег' },
    ]);
  });
});

describe('AuthService — 2FA challenge токены', () => {
  it('buildTotpChallengeToken → verifyTotpChallengeToken: roundtrip с ip/userAgent', () => {
    const { svc } = makeService();
    const token = svc.buildTotpChallengeToken(1n, '1.2.3.4', 'Mozilla/5.0');
    const decoded = svc.verifyTotpChallengeToken(token);
    expect(decoded.userId).toBe(1n);
    expect(decoded.ip).toBe('1.2.3.4');
    expect(decoded.ua).toBe('Mozilla/5.0');
  });

  it('buildTotpChallengeToken без ip/userAgent → ip null, ua пустая строка', () => {
    const { svc } = makeService();
    const token = svc.buildTotpChallengeToken(1n);
    const decoded = svc.verifyTotpChallengeToken(token);
    expect(decoded.ip).toBeNull();
    expect(decoded.ua).toBe('');
  });
});

describe('AuthService — verifyLinkToken: невалидные токены', () => {
  it('мусорный токен → UnauthorizedException("Invalid or expired link token")', () => {
    const { svc } = makeService();
    expect(() => svc.verifyLinkToken('garbage')).toThrow(
      'Invalid or expired link token',
    );
  });
});

describe('AuthService — revokeAllSessions', () => {
  it('отзывает все активные сессии пользователя, чужие не трогает', async () => {
    const { svc, webSessions } = makeService();
    await svc.issueTokens(1n);
    await svc.issueTokens(1n);
    await svc.issueTokens(2n);
    await svc.revokeAllSessions(1n);
    const forUser1 = webSessions.filter((s) => s.userId === 1n);
    const forUser2 = webSessions.filter((s) => s.userId === 2n);
    expect(forUser1.every((s) => s.revokedAt !== null)).toBe(true);
    expect(forUser2.every((s) => s.revokedAt === null)).toBe(true);
  });
});
