// AuthAccountController был на 0% покрытия. Инстанцируем напрямую (без Nest
// TestingModule) с типизированными двойниками — паттерн auth-flow.service.spec.ts
// (Pick<Service, 'method'> & { method: jest.Mock }, makeReq/makeRes через
// `as unknown as Request/Response`). Каждый мутирующий хендлер с requireCsrf
// проверяет: CSRF-заголовок отсутствует → UnauthorizedException ДО обращения
// к сервису (правило "Обработка ошибок" CLAUDE.md); happy-path + основная
// ошибка/guard-ветка — для остальных хендлеров.
import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthAccountController } from './auth-account.controller';
import { AuthService, TokenPair } from './auth.service';
import { MergeService } from './merge.service';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityNoticeService } from './security-notice.service';
import { SecurityLogService } from './security-log.service';
import { EmailTokenService } from './email-token.service';
import { REFRESH_COOKIE } from './auth-http.util';
import { CallerIdentityService } from './caller-identity';
import { TotpService } from './totp.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { LinkSessionRequiredException } from './link-session-required.exception';
import { hashToken } from './email.util';

const WEBAPP_URL = 'https://schemehappens.ru';

const FAKE_TOKENS: TokenPair = {
  accessToken: 'access-abc',
  refreshToken: 'refresh-abc',
  expiresIn: 900,
  rotated: true,
};

type AuthMock = Pick<
  AuthService,
  | 'linkEmailToAccount'
  | 'verifyTelegramWebAppData'
  | 'findOrCreateUserByProvider'
  | 'issueTokens'
  | 'verifyMergeToken'
  | 'linkProviderToUser'
  | 'buildMergeToken'
  | 'unlinkProvider'
> & {
  linkEmailToAccount: jest.Mock;
  verifyTelegramWebAppData: jest.Mock;
  findOrCreateUserByProvider: jest.Mock;
  issueTokens: jest.Mock;
  verifyMergeToken: jest.Mock;
  linkProviderToUser: jest.Mock;
  buildMergeToken: jest.Mock;
  unlinkProvider: jest.Mock;
};

type MergeMock = Pick<MergeService, 'merge' | 'summarize'> & {
  merge: jest.Mock;
  summarize: jest.Mock;
};

type SecurityLogMock = Pick<SecurityLogService, 'log'> & { log: jest.Mock };

type EmailTokensMock = Pick<EmailTokenService, 'consumeEmailToken'> & {
  consumeEmailToken: jest.Mock;
};

function makeAuth(): AuthMock {
  return {
    linkEmailToAccount: jest.fn().mockResolvedValue({ ok: true }),
    verifyTelegramWebAppData: jest
      .fn()
      .mockReturnValue({ id: 123, firstName: 'Bob' }),
    findOrCreateUserByProvider: jest.fn().mockResolvedValue(123n),
    issueTokens: jest.fn().mockResolvedValue(FAKE_TOKENS),
    verifyMergeToken: jest.fn().mockReturnValue({
      target: 1n,
      source: 2n,
      provider: 'google',
      providerId: 'g-1',
    }),
    linkProviderToUser: jest.fn().mockResolvedValue({ ok: true }),
    buildMergeToken: jest.fn().mockReturnValue('merge-tok'),
    unlinkProvider: jest.fn().mockResolvedValue(undefined),
  };
}

function makeMerge(): MergeMock {
  return {
    merge: jest.fn().mockResolvedValue(undefined),
    summarize: jest.fn().mockResolvedValue({
      counts: { Note: 3, Rating: 12 },
      lost: { Rating: 2 },
      twoFactorLost: false,
    }),
  };
}

function makeConfig(): ConfigService {
  return {
    getOrThrow: jest.fn((key: string) => {
      if (key === 'WEBAPP_URL') return WEBAPP_URL;
      throw new Error(`unexpected config key ${key}`);
    }),
  } as unknown as ConfigService;
}

function makeSecurityLog(): SecurityLogMock {
  return { log: jest.fn() };
}

function makeEmailTokens(): EmailTokensMock {
  return {
    // Погашение привязки отдаёт userId, к которому привязан адрес.
    consumeEmailToken: jest.fn().mockResolvedValue(1n),
  };
}

function makeReq(
  opts: {
    csrf?: boolean;
    webUser?: { userId: bigint };
    headers?: Record<string, string>;
    cookies?: Record<string, string>;
    query?: Record<string, string>;
  } = {},
): Request {
  const headers: Record<string, string> = { ...opts.headers };
  if (opts.csrf !== false) headers['x-requested-with'] = 'XMLHttpRequest';
  return {
    headers,
    webUser: opts.webUser,
    ip: '198.51.100.1',
    cookies: opts.cookies ?? {},
    query: opts.query ?? {},
  } as unknown as Request;
}

function makeRes(): Response & {
  cookie: jest.Mock;
  clearCookie: jest.Mock;
  redirect: jest.Mock;
} {
  return {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
    redirect: jest.fn(),
  } as unknown as Response & {
    cookie: jest.Mock;
    clearCookie: jest.Mock;
    redirect: jest.Mock;
  };
}

type TotpMock = { isEnabled: jest.Mock; verifyCode: jest.Mock };

// Живые сессии по sha256 сырого refresh-токена: CallerIdentityService берётся
// НАСТОЯЩИЙ (правило №14 — тест на шве), подменяется только таблица WebSession.
type SessionRow = { userId: bigint; revokedAt: Date | null; expiresAt: Date };
function makeIdentity(sessions: Record<string, SessionRow> = {}) {
  const prisma = {
    webSession: {
      findUnique: jest.fn(({ where }: { where: { tokenHash: string } }) =>
        Promise.resolve(sessions[where.tokenHash] ?? null),
      ),
    },
  };
  return new CallerIdentityService(prisma as never);
}
const liveSession = (userId: bigint): SessionRow => ({
  userId,
  revokedAt: null,
  expiresAt: new Date(Date.now() + 3600_000),
});

function makeController(
  opts: {
    sessions?: Record<string, SessionRow>;
    sourceTotp?: boolean;
    codeOk?: boolean;
    providerRow?: Record<string, unknown> | null;
  } = {},
) {
  const auth = makeAuth();
  const config = makeConfig();
  const prisma = {
    authProvider: {
      findUnique: jest.fn().mockResolvedValue(opts.providerRow ?? null),
    },
  };
  const merge = makeMerge();
  const securityLog = makeSecurityLog();
  const emailTokens = makeEmailTokens();
  const totp: TotpMock = {
    isEnabled: jest.fn().mockResolvedValue(opts.sourceTotp ?? false),
    verifyCode: jest.fn().mockResolvedValue(opts.codeOk ?? false),
  };
  const notice = { linked: jest.fn(), notify: jest.fn() };
  const analytics = { track: jest.fn().mockResolvedValue(undefined) };
  const controller = new AuthAccountController(
    auth as unknown as AuthService,
    config,
    prisma as unknown as PrismaService,
    merge as unknown as MergeService,
    securityLog as unknown as SecurityLogService,
    emailTokens as unknown as EmailTokenService,
    makeIdentity(opts.sessions),
    totp as unknown as TotpService,
    notice as unknown as SecurityNoticeService,
    analytics as unknown as AnalyticsService,
  );
  return {
    analytics,
    totp,
    controller,
    auth,
    config,
    merge,
    securityLog,
    emailTokens,
    notice,
  };
}

// B-14 (аудит 2026-10): GET по ссылке из письма НЕ гасит токен и не ставит
// куку — почтовые сканеры и превью ссылок открывают ссылки раньше человека.
// Гасит POST email/consume со страницы сайта.
describe('AuthAccountController.emailCallback (GET) — только редирект', () => {
  function makeGetRes() {
    return {
      ...makeRes(),
      set: jest.fn().mockReturnThis(),
    } as unknown as Response & {
      cookie: jest.Mock;
      redirect: jest.Mock;
      set: jest.Mock;
    };
  }

  it('302 на страницу-погашение с токеном; токен НЕ гасится, кука НЕ ставится', () => {
    const { controller, emailTokens } = makeController();
    const res = makeGetRes();
    controller.emailCallback('tok-1', res);
    expect(res.redirect).toHaveBeenCalledWith(
      302,
      `${WEBAPP_URL}/auth/callback?email_token=tok-1`,
    );
    expect(emailTokens.consumeEmailToken).not.toHaveBeenCalled();
    expect(res.cookie).not.toHaveBeenCalled();
    // Ответ не кэшируется и не утекает токен в Referer.
    expect(res.set).toHaveBeenCalledWith(
      expect.objectContaining({
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
      }),
    );
  });

  it('нет токена или токен не строка (?token=a&token=b) → экран ошибки', () => {
    const { controller } = makeController();
    const res = makeGetRes();
    controller.emailCallback(undefined, res);
    controller.emailCallback(['a', 'b'], res);
    expect(res.redirect.mock.calls).toEqual([
      [302, `${WEBAPP_URL}/auth/error?reason=email_link_expired`],
      [302, `${WEBAPP_URL}/auth/error?reason=email_link_expired`],
    ]);
  });
});

// Вход по ссылке на почту убран (решение владельца, ч. 10 ст. 8 149-ФЗ):
// погашение только привязывает адрес и сессию не выдаёт никогда.
describe('AuthAccountController.emailConsume (POST)', () => {
  it('без CSRF-заголовка → UnauthorizedException, токен не гасится', async () => {
    const { controller, emailTokens } = makeController();
    await expect(
      controller.emailConsume({ token: 'tok-1' }, makeReq({ csrf: false })),
    ).rejects.toThrow(UnauthorizedException);
    expect(emailTokens.consumeEmailToken).not.toHaveBeenCalled();
  });

  it('привязка → { linked: true }, владельцу уведомление о новом способе (S12)', async () => {
    const { controller, notice } = makeController();
    await expect(
      controller.emailConsume({ token: 'tok-1' }, makeReq()),
    ).resolves.toEqual({ linked: true });
    expect(notice.linked).toHaveBeenCalledWith(1n, 'email');
  });

  it('сервису уходит userId сессии из refresh-куки браузера', async () => {
    const { controller, emailTokens } = makeController({
      sessions: { [hashToken('raw-refresh')]: liveSession(7n) },
    });
    const req = makeReq({ cookies: { [REFRESH_COOKIE]: 'raw-refresh' } });
    await controller.emailConsume({ token: 'tok-1' }, req);
    expect(emailTokens.consumeEmailToken).toHaveBeenCalledWith('tok-1', 7n);
  });

  it('нет сессии в браузере → сервису уходит null (не undefined, не 0n)', async () => {
    const { controller, emailTokens } = makeController();
    await controller.emailConsume({ token: 'tok-1' }, makeReq());
    expect(emailTokens.consumeEmailToken.mock.calls[0][1]).toBeNull();
  });

  it.each([
    [
      'ссылка открыта не в том браузере (A3)',
      new LinkSessionRequiredException(),
    ],
    ['токен просрочен, чужой или выписан на вход', new UnauthorizedException()],
  ])('%s → ошибка пробрасывается, уведомления нет', async (_l, err) => {
    const { controller, emailTokens, notice } = makeController();
    emailTokens.consumeEmailToken.mockRejectedValue(err);
    await expect(
      controller.emailConsume({ token: 'tok-1' }, makeReq()),
    ).rejects.toBe(err);
    expect(notice.linked).not.toHaveBeenCalled();
  });
});

describe('AuthAccountController.emailLinkToAccount', () => {
  it('без CSRF-заголовка → UnauthorizedException, линковка не выполняется', async () => {
    const { controller, auth } = makeController();
    await expect(
      controller.emailLinkToAccount(
        { email: 'a@b.ru' },
        makeReq({ csrf: false, webUser: { userId: 1n } }),
      ),
    ).rejects.toThrow(UnauthorizedException);
    expect(auth.linkEmailToAccount).not.toHaveBeenCalled();
  });

  it('валидный запрос → делегирует в auth.linkEmailToAccount', async () => {
    const { controller, auth } = makeController();
    const res = await controller.emailLinkToAccount(
      { email: 'a@b.ru' },
      makeReq({ webUser: { userId: 9n } }),
    );
    expect(auth.linkEmailToAccount).toHaveBeenCalledWith(9n, 'a@b.ru');
    expect(res).toEqual({ ok: true });
  });
});

describe('AuthAccountController.telegramWebApp', () => {
  // Login-CSRF (security#6): см. auth-max.controller.spec.ts.
  it('без CSRF-заголовка (форма с чужого сайта) → 401, ни подписи, ни куки', async () => {
    const { controller, auth } = makeController();
    const res = makeRes();
    await expect(
      controller.telegramWebApp(
        { initData: 'attacker-signed' },
        makeReq({
          csrf: false,
          headers: {
            'content-type': 'application/x-www-form-urlencoded',
            'sec-fetch-site': 'cross-site',
          },
        }),
        res,
      ),
    ).rejects.toThrow(UnauthorizedException);
    expect(auth.verifyTelegramWebAppData).not.toHaveBeenCalled();
    expect(auth.issueTokens).not.toHaveBeenCalled();
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('без initData → BadRequestException, подпись не проверяется', async () => {
    const { controller, auth } = makeController();
    await expect(
      controller.telegramWebApp({ initData: '' }, makeReq(), makeRes()),
    ).rejects.toThrow(BadRequestException);
    expect(auth.verifyTelegramWebAppData).not.toHaveBeenCalled();
  });

  it('валидный initData → находит/создаёт юзера, выдаёт токены, ставит cookie', async () => {
    const { controller, auth } = makeController();
    const req = makeReq();
    const res = makeRes();
    const result = await controller.telegramWebApp(
      { initData: 'init-data' },
      req,
      res,
    );
    // IP уходит в верификатор: по нему троттлится алерт о подделке подписи;
    // третьим аргументом — колбэк строки отказа обмена для /stats.
    expect(auth.verifyTelegramWebAppData).toHaveBeenCalledWith(
      'init-data',
      req.ip,
      expect.any(Function),
    );
    expect(auth.findOrCreateUserByProvider).toHaveBeenCalledWith(
      'telegram',
      '123',
      'Bob',
    );
    expect(auth.issueTokens).toHaveBeenCalledWith(
      123n,
      '198.51.100.1',
      undefined,
    );
    expect(res.cookie).toHaveBeenCalledWith(
      REFRESH_COOKIE,
      FAKE_TOKENS.refreshToken,
      expect.objectContaining({ httpOnly: true, sameSite: 'strict' }),
    );
    expect(result).toEqual({
      accessToken: FAKE_TOKENS.accessToken,
      expiresIn: FAKE_TOKENS.expiresIn,
    });
  });

  // Telegram Web (web.telegram.org, Web A/K) грузит мини-апп в iframe, как
  // MAX — Strict-кука там не продлевается (2026-08-21, «постоянно нужно
  // логиниться заново»). Нативное вебвью Telegram не шлёт Sec-Fetch-Site —
  // остаётся строгим (тест выше, без заголовка → sameSite:strict).
  it('Sec-Fetch-Site: cross-site (Telegram Web в iframe) → кука SameSite=none', async () => {
    const { controller } = makeController();
    const req = makeReq({ headers: { 'sec-fetch-site': 'cross-site' } });
    const res = makeRes();
    await controller.telegramWebApp({ initData: 'init-data' }, req, res);
    expect(res.cookie).toHaveBeenCalledWith(
      REFRESH_COOKIE,
      FAKE_TOKENS.refreshToken,
      expect.objectContaining({ sameSite: 'none' }),
    );
  });

  // Так приходит настоящий обмен из Telegram Web: fetch из фрейма — same-origin
  // (аудит 2026-10; проверено в браузере, e2e-browser/live/telegram-frame.spec.ts).
  it('из фрейма (same-origin) с платформой weba → SameSite=none и Partitioned', async () => {
    const { controller } = makeController();
    const req = makeReq({ headers: { 'sec-fetch-site': 'same-origin' } });
    const res = makeRes();
    await controller.telegramWebApp(
      { initData: 'init-data', platform: 'weba' },
      req,
      res,
    );
    expect(res.cookie).toHaveBeenCalledWith(
      REFRESH_COOKIE,
      FAKE_TOKENS.refreshToken,
      expect.objectContaining({ sameSite: 'none', partitioned: true }),
    );
  });

  // Аудит 2026-10: платформа запуска (tgWebAppPlatform) не писалась, и тихую
  // поломку одной платформы по /stats было не увидеть.
  it('успешный обмен пишет messenger_launch с платформой, userId = null', async () => {
    const { controller, analytics } = makeController();
    await controller.telegramWebApp(
      { initData: 'init-data', platform: 'weba' },
      makeReq(),
      makeRes(),
    );
    expect(analytics.track).toHaveBeenCalledWith(null, 'messenger_launch', {
      host: 'telegram',
      platform: 'weba',
    });
  });

  it('незнакомая или пустая платформа пишется как other, вход не падает', async () => {
    const { controller, analytics } = makeController();
    await controller.telegramWebApp(
      { initData: 'init-data', platform: 'tizen<script>' },
      makeReq(),
      makeRes(),
    );
    await controller.telegramWebApp(
      { initData: 'init-data' },
      makeReq(),
      makeRes(),
    );
    expect(analytics.track).toHaveBeenNthCalledWith(
      1,
      null,
      'messenger_launch',
      {
        host: 'telegram',
        platform: 'other',
      },
    );
    expect(analytics.track).toHaveBeenNthCalledWith(
      2,
      null,
      'messenger_launch',
      {
        host: 'telegram',
        platform: 'other',
      },
    );
  });

  // Находка 2026-11-08: отказ обмена уходил только в журнал безопасности, и
  // /stats не видел, что сайт в Telegram не может войти. Мок ведёт себя как
  // AuthService: зовёт колбэк отказа и бросает 401. Троттлинг строки — по
  // площадке и IP (exchange-failure.report.ts), поэтому у каждого теста свой IP.
  const rejectWith = (auth: AuthMock, err: Error) =>
    auth.verifyTelegramWebAppData.mockImplementation(
      (_i: string, _ip: string, onReject?: (e: unknown) => void) => {
        onReject?.(err);
        throw new UnauthorizedException('Invalid initData');
      },
    );
  const reqFrom = (ip: string) =>
    Object.assign(makeReq(), { ip }) as unknown as Request;

  it('подделка → 401 и строка отказа: площадка, платформа, причина suspicious', async () => {
    const { controller, auth, analytics } = makeController();
    rejectWith(auth, new Error('Invalid initData signature'));
    await expect(
      controller.telegramWebApp(
        { initData: 'forged', platform: 'weba' },
        reqFrom('203.0.113.31'),
        makeRes(),
      ),
    ).rejects.toThrow(UnauthorizedException);
    // Запуска не было — платформа в messenger_launch не засчитывается.
    expect(analytics.track).toHaveBeenCalledTimes(1);
    expect(analytics.track).toHaveBeenCalledWith(
      null,
      'messenger_launch_failed',
      { host: 'telegram', platform: 'weba', reason: 'suspicious' },
    );
    expect(auth.issueTokens).not.toHaveBeenCalled();
  });

  it('просрочка → строка отказа с причиной expired', async () => {
    const { controller, auth, analytics } = makeController();
    rejectWith(auth, new Error('init data expired'));
    await expect(
      controller.telegramWebApp(
        { initData: 'stale', platform: 'ios' },
        reqFrom('203.0.113.32'),
        makeRes(),
      ),
    ).rejects.toThrow(UnauthorizedException);
    expect(analytics.track).toHaveBeenCalledWith(
      null,
      'messenger_launch_failed',
      { host: 'telegram', platform: 'ios', reason: 'expired' },
    );
  });

  it('отказ без вызова колбэка (не проверка подписи) — событий нет', async () => {
    const { controller, auth, analytics } = makeController();
    auth.verifyTelegramWebAppData.mockImplementation(() => {
      throw new Error('BOT_TOKEN not set');
    });
    await expect(
      controller.telegramWebApp({ initData: 'x' }, makeReq(), makeRes()),
    ).rejects.toThrow('BOT_TOKEN not set');
    expect(analytics.track).not.toHaveBeenCalled();
  });
});

// Токен объединения — согласие на действие, а не доказательство, что
// вызывающий владеет аккаунтом-целью (аудит 2026-10, A2/A4). target из токена = 1n.
describe('AuthAccountController.confirmMerge', () => {
  const asTarget = () => makeReq({ webUser: { userId: 1n } });

  it('без CSRF-заголовка → UnauthorizedException, токен не проверяется', async () => {
    const { controller, auth } = makeController();
    await expect(
      controller.confirmMerge(
        { token: 'tok-1' },
        makeReq({ csrf: false }),
        makeRes(),
      ),
    ).rejects.toThrow(UnauthorizedException);
    expect(auth.verifyMergeToken).not.toHaveBeenCalled();
  });

  it('пустой токен → BadRequestException, verifyMergeToken не вызывается', async () => {
    const { controller, auth } = makeController();
    await expect(
      controller.confirmMerge({ token: '' }, makeReq(), makeRes()),
    ).rejects.toThrow(BadRequestException);
    expect(auth.verifyMergeToken).not.toHaveBeenCalled();
  });

  // A2: до фикса анонимный держатель токена проходил (проверялось лишь
  // «если вошёл — то как тот же юзер»), и перехваченный токен отдавал аккаунт.
  it('АНОНИМ с валидным токеном → UnauthorizedException, merge не выполняется', async () => {
    const { controller, merge, auth } = makeController();
    await expect(
      controller.confirmMerge({ token: 'tok-1' }, makeReq(), makeRes()),
    ).rejects.toThrow(UnauthorizedException);
    expect(merge.merge).not.toHaveBeenCalled();
    expect(auth.issueTokens).not.toHaveBeenCalled();
  });

  it('текущая сессия принадлежит другому userId → UnauthorizedException, merge не выполняется', async () => {
    const { controller, merge } = makeController();
    const req = makeReq({ webUser: { userId: 999n } });
    await expect(
      controller.confirmMerge({ token: 'tok-1' }, req, makeRes()),
    ).rejects.toThrow(UnauthorizedException);
    expect(merge.merge).not.toHaveBeenCalled();
  });

  it('refresh-кука ЖИВОЙ сессии target (без Bearer) → merge проходит', async () => {
    const { controller, merge } = makeController({
      sessions: { [hashToken('raw-refresh')]: liveSession(1n) },
    });
    const req = makeReq({ cookies: { [REFRESH_COOKIE]: 'raw-refresh' } });
    await controller.confirmMerge({ token: 'tok-1' }, req, makeRes());
    expect(merge.merge).toHaveBeenCalledWith(2n, 1n);
  });

  it('refresh-кука ДРУГОГО пользователя → UnauthorizedException, merge не выполняется', async () => {
    const { controller, merge } = makeController({
      sessions: { [hashToken('raw-refresh')]: liveSession(999n) },
    });
    const req = makeReq({ cookies: { [REFRESH_COOKIE]: 'raw-refresh' } });
    await expect(
      controller.confirmMerge({ token: 'tok-1' }, req, makeRes()),
    ).rejects.toThrow(UnauthorizedException);
    expect(merge.merge).not.toHaveBeenCalled();
  });

  it.each([
    ['отозванная', { ...liveSession(1n), revokedAt: new Date() }],
    ['истёкшая', { ...liveSession(1n), expiresAt: new Date(Date.now() - 1) }],
  ])(
    'refresh-кука target, но сессия %s → UnauthorizedException',
    async (_n, row) => {
      const { controller, merge } = makeController({
        sessions: { [hashToken('raw-refresh')]: row },
      });
      const req = makeReq({ cookies: { [REFRESH_COOKIE]: 'raw-refresh' } });
      await expect(
        controller.confirmMerge({ token: 'tok-1' }, req, makeRes()),
      ).rejects.toThrow(UnauthorizedException);
      expect(merge.merge).not.toHaveBeenCalled();
    },
  );

  it('merge.merge падает → BadRequestException с дружелюбным текстом, линковка провайдера не выполняется', async () => {
    const { controller, auth, merge } = makeController();
    merge.merge.mockRejectedValue(new Error('db down'));
    await expect(
      controller.confirmMerge({ token: 'tok-1' }, asTarget(), makeRes()),
    ).rejects.toThrow(BadRequestException);
    expect(auth.linkProviderToUser).not.toHaveBeenCalled();
  });

  it('linkProviderToUser возвращает ok:false → BadRequestException "Provider link failed"', async () => {
    const { controller, auth } = makeController();
    auth.linkProviderToUser.mockResolvedValue({
      ok: false,
      conflictUserId: '2',
    });
    await expect(
      controller.confirmMerge({ token: 'tok-1' }, asTarget(), makeRes()),
    ).rejects.toThrow(BadRequestException);
  });

  it('валидный merge → данные перенесены, токены выданы, cookie httpOnly/strict, аудит merge_confirmed', async () => {
    const { controller, auth, merge, securityLog } = makeController();
    const req = asTarget();
    const res = makeRes();
    const result = await controller.confirmMerge({ token: 'tok-1' }, req, res);
    expect(merge.merge).toHaveBeenCalledWith(2n, 1n);
    expect(auth.linkProviderToUser).toHaveBeenCalledWith(1n, 'google', 'g-1');
    expect(auth.issueTokens).toHaveBeenCalledWith(
      1n,
      '198.51.100.1',
      undefined,
    );
    expect(res.cookie).toHaveBeenCalledWith(
      REFRESH_COOKIE,
      FAKE_TOKENS.refreshToken,
      expect.objectContaining({ httpOnly: true, sameSite: 'strict' }),
    );
    expect(securityLog.log).toHaveBeenCalledWith('merge_confirmed', {
      target: 1n,
      source: 2n,
      provider: 'google',
      ip: '198.51.100.1',
    });
    expect(result).toEqual({
      accessToken: FAKE_TOKENS.accessToken,
      expiresIn: FAKE_TOKENS.expiresIn,
    });
  });

  // A4: владелец одного лишь взломанного входа (Google) мог поглотить
  // аккаунт, защищённый TOTP, — второй фактор source не спрашивали никогда.
  describe('второй фактор поглощаемого аккаунта (A4)', () => {
    const forbiddenBody = async (p: Promise<unknown>) => {
      const err = await p.then(
        () => null,
        (e: ForbiddenException) => e,
      );
      expect(err).toBeInstanceOf(ForbiddenException);
      return (err as ForbiddenException).getResponse() as { reason: string };
    };

    it('у source включён TOTP, кода нет → 403 source_totp_required, merge не выполняется', async () => {
      const { controller, merge, totp } = makeController({ sourceTotp: true });
      const body = await forbiddenBody(
        controller.confirmMerge({ token: 'tok-1' }, asTarget(), makeRes()),
      );
      expect(body.reason).toBe('source_totp_required');
      expect(totp.isEnabled).toHaveBeenCalledWith(2n);
      expect(totp.verifyCode).not.toHaveBeenCalled();
      expect(merge.merge).not.toHaveBeenCalled();
    });

    it('у source включён TOTP, код неверный → 403, merge не выполняется', async () => {
      const { controller, merge, totp } = makeController({
        sourceTotp: true,
        codeOk: false,
      });
      const body = await forbiddenBody(
        controller.confirmMerge(
          { token: 'tok-1', code: '000000' },
          asTarget(),
          makeRes(),
        ),
      );
      expect(body.reason).toBe('source_totp_required');
      expect(totp.verifyCode).toHaveBeenCalledWith(2n, '000000');
      expect(merge.merge).not.toHaveBeenCalled();
    });

    it('у source включён TOTP, код верный → merge проходит', async () => {
      const { controller, merge, totp } = makeController({
        sourceTotp: true,
        codeOk: true,
      });
      await controller.confirmMerge(
        { token: 'tok-1', code: '123456' },
        asTarget(),
        makeRes(),
      );
      expect(totp.verifyCode).toHaveBeenCalledWith(2n, '123456');
      expect(merge.merge).toHaveBeenCalledWith(2n, 1n);
    });

    it('TOTP у source нет → код не спрашивается', async () => {
      const { controller, totp, merge } = makeController();
      await controller.confirmMerge({ token: 'tok-1' }, asTarget(), makeRes());
      expect(totp.verifyCode).not.toHaveBeenCalled();
      expect(merge.merge).toHaveBeenCalledWith(
        expect.any(BigInt),
        expect.any(BigInt),
      );
    });

    it('проверка TOTP идёт только ПОСЛЕ доказательства личности target', async () => {
      const { controller, totp } = makeController({ sourceTotp: true });
      await expect(
        controller.confirmMerge({ token: 'tok-1' }, makeReq(), makeRes()),
      ).rejects.toThrow(UnauthorizedException);
      expect(totp.isEnabled).not.toHaveBeenCalled();
    });
  });
});

// Экран /account/merge берёт имя и счётчики отсюда, а не из query редиректа.
describe('AuthAccountController.mergePreview', () => {
  it('свой токен → провайдер, имя поглощаемого аккаунта, сводка, флаг 2FA', async () => {
    const { controller, merge } = makeController({
      providerRow: { userId: 2n, displayName: 'Другой', email: null },
    });
    const res = await controller.mergePreview(
      { token: 'merge-tok' },
      makeReq({ webUser: { userId: 1n } }),
    );
    expect(merge.summarize).toHaveBeenCalledWith(2n, 1n);
    expect(res).toEqual({
      provider: 'google',
      otherDisplay: 'Другой',
      summary: { Note: 3, Rating: 12 },
      lost: { Rating: 2 },
      twoFactorLost: false,
    });
  });

  it('токен выписан на объединение в ЧУЖОЙ аккаунт → 403, сводка не считается', async () => {
    const { controller, merge } = makeController();
    await expect(
      controller.mergePreview(
        { token: 'merge-tok' },
        makeReq({ webUser: { userId: 99n } }),
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(merge.summarize).not.toHaveBeenCalled();
  });

  it('строка провайдера уже не у source → имя не показываем', async () => {
    const { controller } = makeController({
      providerRow: { userId: 77n, displayName: 'Чужой', email: null },
    });
    const res = await controller.mergePreview(
      { token: 'merge-tok' },
      makeReq({ webUser: { userId: 1n } }),
    );
    expect(res.otherDisplay).toBeNull();
  });

  it('без CSRF-заголовка → 401 до проверки токена', () => {
    const { controller, auth } = makeController();
    expect(() =>
      controller.mergePreview(
        { token: 'merge-tok' },
        makeReq({ csrf: false, webUser: { userId: 1n } }),
      ),
    ).toThrow(UnauthorizedException);
    expect(auth.verifyMergeToken).not.toHaveBeenCalled();
  });
});
