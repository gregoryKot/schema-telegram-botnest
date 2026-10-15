// Аргументы запросов AuthService к БД: какие колонки читаются и по какому
// ключу. Фейковая Prisma из остальных спеков ключ `select` игнорирует (отдаёт
// строку целиком), поэтому мутант `select: {}` их не краснит — а на живой БД
// это разница между «три колонки» и «вся строка AuthProvider/WebSession»,
// включая providerId и хеши токенов (nightly golden-auth, issue #614: 37
// выживших мутантов auth.service.ts, большинство — этого класса).
// Здесь Prisma — jest.fn с проверкой аргументов, а результат вызова проверяется
// на выходе сервиса, а не только на факте обращения.
import { createHash } from 'crypto';
import { AuthService } from './auth.service';

const config = {
  getOrThrow: (k: string) =>
    ({
      JWT_SECRET: 'test-jwt-secret',
      BOT_TOKEN: '1:T',
      WEBAPP_URL: 'https://x',
    })[k],
} as never;

function make(prisma: Record<string, unknown>, emailSvc: object = {}) {
  return new AuthService(
    prisma as never,
    config,
    { log: jest.fn() } as never,
    emailSvc as never,
  );
}

describe('AuthService — запросы читают только нужные колонки', () => {
  it('getUserProviders: три колонки и фильтр по владельцу, без providerId', async () => {
    const findMany = jest
      .fn()
      .mockResolvedValue([
        { provider: 'google', email: null, displayName: null },
      ]);
    const svc = make({ authProvider: { findMany } });

    const rows = await svc.getUserProviders(5n);

    expect(findMany).toHaveBeenCalledWith({
      where: { userId: 5n },
      select: { provider: true, email: true, displayName: true },
    });
    expect(rows).toEqual([
      { provider: 'google', email: null, displayName: null },
    ]);
  });

  it('revokeSession: ищет по SHA-256 токена, берёт только family и закрывает её целиком', async () => {
    const findUnique = jest.fn().mockResolvedValue({ family: 'fam-1' });
    const updateMany = jest.fn().mockResolvedValue({ count: 2 });
    const svc = make({ webSession: { findUnique, updateMany } });

    await svc.revokeSession('raw-token');

    expect(findUnique).toHaveBeenCalledWith({
      where: {
        tokenHash: createHash('sha256').update('raw-token').digest('hex'),
      },
      select: { family: true },
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: { family: 'fam-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('revokeSession: неизвестный токен — семью не трогаем', async () => {
    const updateMany = jest.fn();
    const svc = make({
      webSession: { findUnique: jest.fn().mockResolvedValue(null), updateMany },
    });
    await expect(svc.revokeSession('garbage')).resolves.toBeUndefined();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('привязка почты: форма обращения читается одной колонкой и доезжает до письма', async () => {
    const userFindUnique = jest.fn().mockResolvedValue({ addressForm: 'vy' });
    const providerFindUnique = jest.fn().mockResolvedValue(null);
    const create = jest.fn().mockResolvedValue({});
    const sendLinkEmailLetter = jest.fn().mockResolvedValue(undefined);
    const svc = make(
      {
        authProvider: { findUnique: providerFindUnique },
        user: { findUnique: userFindUnique },
        emailToken: { create },
      },
      { sendLinkEmailLetter },
    );

    await svc.linkEmailToAccount(5n, 'User@Example.com');

    expect(providerFindUnique).toHaveBeenCalledWith({
      where: {
        provider_providerId: {
          provider: 'email',
          providerId: 'user@example.com',
        },
      },
    });
    expect(userFindUnique).toHaveBeenCalledWith({
      where: { id: 5n },
      select: { addressForm: true },
    });
    expect(sendLinkEmailLetter).toHaveBeenCalledWith(
      'user@example.com',
      expect.stringContaining('https://x/api/auth/email/callback?token='),
      'vy',
    );
  });

  it('вход по почте: известный адрес ищется по паре provider+providerId в нижнем регистре', async () => {
    const providerFindUnique = jest.fn().mockResolvedValue(null);
    const sendLoginLink = jest.fn().mockResolvedValue(undefined);
    const svc = make(
      {
        authProvider: { findUnique: providerFindUnique },
        emailToken: { create: jest.fn().mockResolvedValue({}) },
      },
      { sendLoginLink },
    );

    await svc.requestEmailLogin('User@Example.com');

    expect(providerFindUnique).toHaveBeenCalledWith({
      where: {
        provider_providerId: {
          provider: 'email',
          providerId: 'user@example.com',
        },
      },
    });
    // Адрес неизвестен — письмо уходит по форме «ты» (аккаунта ещё нет).
    expect(sendLoginLink).toHaveBeenCalledWith(
      'user@example.com',
      expect.any(String),
      'ty',
    );
  });
});

describe('AuthService — ветки, которые мок Prisma не различал', () => {
  const p2002 = Object.assign(new Error('unique'), { code: 'P2002' });

  function makeLink(createError: Error, afterRace: unknown) {
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce(null) // до create строки нет
      .mockResolvedValueOnce(afterRace); // после ошибки — перечитываем
    const svc = make({
      authProvider: {
        findUnique,
        create: jest.fn().mockRejectedValue(createError),
      },
    });
    return { svc, findUnique };
  }

  it('гонка P2002 при привязке: тот же владелец — ok, чужой — конфликт с его id', async () => {
    const same = makeLink(p2002, { userId: 5n });
    await expect(
      same.svc.linkProviderToUser(5n, 'google', 'g-1'),
    ).resolves.toEqual({ ok: true });
    const other = makeLink(p2002, { userId: 9n });
    await expect(
      other.svc.linkProviderToUser(5n, 'google', 'g-1'),
    ).resolves.toEqual({ ok: false, conflictUserId: '9' });
  });

  it('любая другая ошибка create пробрасывается, даже если строка с тем же владельцем уже есть', async () => {
    // Только P2002 — «нас обогнал параллельный запрос». Падение БД с живой
    // строкой в таблице нельзя выдавать за успех привязки.
    const { svc, findUnique } = makeLink(new Error('db down'), { userId: 5n });
    await expect(svc.linkProviderToUser(5n, 'google', 'g-1')).rejects.toThrow(
      'db down',
    );
    // Строку после такой ошибки не перечитываем: лишний запрос в упавшую БД.
    expect(findUnique).toHaveBeenCalledTimes(1);
  });

  it('issueTokens: первая выдача помечена rotated=true и хранит только хеш refresh-токена', async () => {
    const create = jest.fn().mockResolvedValue({});
    const svc = make({ webSession: { create } });

    const pair = await svc.issueTokens(7n, '203.0.113.7', 'UA/1');

    expect(pair).toEqual({
      accessToken: expect.any(String),
      refreshToken: expect.stringMatching(/^[0-9a-f]{80}$/),
      expiresIn: 900,
      rotated: true,
    });
    const row = create.mock.calls[0][0].data;
    expect(row.tokenHash).toBe(
      createHash('sha256').update(pair.refreshToken).digest('hex'),
    );
    expect(Object.values(row)).not.toContain(pair.refreshToken);
    expect(row).toMatchObject({
      userId: 7n,
      ipAddress: '203.0.113.7',
      userAgent: 'UA/1',
    });
  });
});
