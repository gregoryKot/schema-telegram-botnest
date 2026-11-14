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
import {
  TICKET_DEVICE_COOKIE,
  TicketDeviceService,
} from './login-ticket/ticket-device';
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
  | 'requestEmailLogin'
  | 'linkEmailToAccount'
  | 'verifyTelegramWebAppData'
  | 'findOrCreateUserByProvider'
  | 'issueTokens'
  | 'verifyMergeToken'
  | 'linkProviderToUser'
  | 'buildMergeToken'
  | 'unlinkProvider'
> & {
  requestEmailLogin: jest.Mock;
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

// Билеты входа по хешу короткого кода — для настоящего TicketDeviceService
// (S9: сверка куки браузера с билетом идёт через шов, а не через мок).
type TicketRow = {
  intent: string;
  deviceCodeHash: string;
  deviceLabel: string;
  createdAt: Date;
  expiresAt: Date;
  consumedAt: Date | null;
  deniedAt: Date | null;
  approvedUserId: bigint | null;
};
function pendingTicket(deviceCode: string): TicketRow {
  return {
    intent: 'login',
    deviceCodeHash: hashToken(deviceCode),
    deviceLabel: 'iPhone · Safari',
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 300_000),
    consumedAt: null,
    deniedAt: null,
    approvedUserId: null,
  };
}

function makeAuth(): AuthMock {
  return {
    requestEmailLogin: jest.fn().mockResolvedValue({ ok: true }),
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
    consumeEmailToken: jest.fn().mockResolvedValue({
      kind: 'tokens',
      tokens: FAKE_TOKENS,
      purpose: 'login',
      userId: 1n,
    }),
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
    tickets?: Record<string, TicketRow>; // userCode → строка
    providerRow?: Record<string, unknown> | null;
  } = {},
) {
  const auth = makeAuth();
  const config = makeConfig();
  const byHash = new Map(
    Object.entries(opts.tickets ?? {}).map(([c, r]) => [hashToken(c), r]),
  );
  const prisma = {
    loginTicket: {
      findUnique: jest.fn(({ where }: { where: { userCodeHash: string } }) =>
        Promise.resolve(byHash.get(where.userCodeHash) ?? null),
      ),
    },
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
    new TicketDeviceService(
      prisma as unknown as PrismaService,
      securityLog as unknown as SecurityLogService,
    ),
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

describe('AuthAccountController.emailLoginLink', () => {
  it('без CSRF-заголовка → UnauthorizedException, письмо не отправляется', async () => {
    const { controller, auth } = makeController();
    await expect(
      controller.emailLoginLink({ email: 'a@b.ru' }, makeReq({ csrf: false })),
    ).rejects.toThrow(UnauthorizedException);
    expect(auth.requestEmailLogin).not.toHaveBeenCalled();
  });

  it('валидный запрос → делегирует в auth.requestEmailLogin', async () => {
    const { controller, auth } = makeController();
    const res = await controller.emailLoginLink({ email: 'a@b.ru' }, makeReq());
    expect(auth.requestEmailLogin).toHaveBeenCalledWith('a@b.ru', {});
    expect(res).toEqual({ ok: true });
  });

  // E14 (аудит 2026-11): письмо открывают новой вкладкой — адрес возврата едет в ссылке.
  it('адрес возврата уходит в auth.requestEmailLogin вместе с письмом', async () => {
    const { controller, auth } = makeController();
    await controller.emailLoginLink(
      { email: 'a@b.ru', returnTo: '/diary?tab=schemas' },
      makeReq(),
    );
    expect(auth.requestEmailLogin).toHaveBeenCalledWith('a@b.ru', {
      returnTo: '/diary?tab=schemas',
    });
  });
});

// B-14 (аудит 2026-10): GET по ссылке из письма больше НЕ гасит токен и не
// ставит куку — почтовые сканеры и превью ссылок открывают ссылки раньше
// человека. Гасит POST email/consume со страницы сайта.
describe('AuthAccountController.emailLoginCallback (GET) — только редирект', () => {
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
    controller.emailLoginCallback('tok-1', undefined, undefined, res);
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

  it('билет входа едет следом — сверку на странице решает человек, не сервер', () => {
    const { controller, emailTokens } = makeController();
    const res = makeGetRes();
    controller.emailLoginCallback('tok-1', 'K7M2QX94', undefined, res);
    expect(res.redirect).toHaveBeenCalledWith(
      302,
      `${WEBAPP_URL}/auth/callback?email_token=tok-1&ticket=K7M2QX94`,
    );
    expect(emailTokens.consumeEmailToken).not.toHaveBeenCalled();
  });

  it('адрес возврата из ссылки едет на страницу-погашение; чужой — отбрасывается', () => {
    const { controller } = makeController();
    const res = makeGetRes();
    controller.emailLoginCallback('tok-1', undefined, '/diary?tab=x', res);
    controller.emailLoginCallback('tok-1', undefined, '//evil.com', res);
    expect(res.redirect.mock.calls).toEqual([
      [
        302,
        `${WEBAPP_URL}/auth/callback?email_token=tok-1&return_to=%2Fdiary%3Ftab%3Dx`,
      ],
      [302, `${WEBAPP_URL}/auth/callback?email_token=tok-1`],
    ]);
  });

  it('нет токена или токен не строка (?token=a&token=b) → экран ошибки входа', () => {
    const { controller } = makeController();
    const res = makeGetRes();
    controller.emailLoginCallback(undefined, undefined, undefined, res);
    controller.emailLoginCallback(['a', 'b'], undefined, undefined, res);
    expect(res.redirect).toHaveBeenNthCalledWith(
      1,
      302,
      `${WEBAPP_URL}/auth/error?reason=email_link_expired`,
    );
    expect(res.redirect).toHaveBeenNthCalledWith(
      2,
      302,
      `${WEBAPP_URL}/auth/error?reason=email_link_expired`,
    );
  });
});

describe('AuthAccountController.emailConsume (POST)', () => {
  it('без CSRF-заголовка → UnauthorizedException, токен не гасится', async () => {
    const { controller, emailTokens } = makeController();
    await expect(
      controller.emailConsume(
        { token: 'tok-1' },
        makeReq({ csrf: false }),
        makeRes(),
      ),
    ).rejects.toThrow(UnauthorizedException);
    expect(emailTokens.consumeEmailToken).not.toHaveBeenCalled();
  });

  it('login → кука выставлена, в теле accessToken/expiresIn (без редиректа)', async () => {
    const { controller } = makeController();
    const res = makeRes();
    const body = await controller.emailConsume(
      { token: 'tok-1' },
      makeReq(),
      res,
    );
    expect(res.cookie).toHaveBeenCalledWith(
      REFRESH_COOKIE,
      FAKE_TOKENS.refreshToken,
      expect.objectContaining({ httpOnly: true, sameSite: 'strict' }),
    );
    expect(body).toEqual({
      accessToken: FAKE_TOKENS.accessToken,
      expiresIn: FAKE_TOKENS.expiresIn,
    });
    expect(res.redirect).not.toHaveBeenCalled();
  });

  // A3: привязка почты сессию НЕ выдаёт — человек уже вошёл в свой аккаунт.
  it('linked → { linked: true }, кука НЕ ставится', async () => {
    const { controller, emailTokens } = makeController();
    emailTokens.consumeEmailToken.mockResolvedValue({
      kind: 'linked',
      purpose: 'link_email_auth',
      userId: 1n,
    });
    const res = makeRes();
    await expect(
      controller.emailConsume({ token: 'tok-1' }, makeReq(), res),
    ).resolves.toEqual({ linked: true });
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('S12: почта привязана → владельцу уведомление о новом способе входа', async () => {
    const { controller, emailTokens, notice } = makeController();
    emailTokens.consumeEmailToken.mockResolvedValue({
      kind: 'linked',
      purpose: 'link_email_auth',
      userId: 1n,
    });
    await controller.emailConsume({ token: 'tok-1' }, makeReq(), makeRes());
    expect(notice.linked).toHaveBeenCalledWith(1n, 'email');
  });

  it('обычный вход по ссылке — не привязка, уведомления нет', async () => {
    const { controller, notice } = makeController();
    const result = await controller.emailConsume(
      { token: 'tok-1' },
      makeReq(),
      makeRes(),
    );
    expect(result).toEqual({
      accessToken: FAKE_TOKENS.accessToken,
      expiresIn: FAKE_TOKENS.expiresIn,
    });
    expect(notice.linked).not.toHaveBeenCalled();
  });

  it('сервису уходит userId сессии из refresh-куки браузера', async () => {
    const { controller, emailTokens } = makeController({
      sessions: { [hashToken('raw-refresh')]: liveSession(7n) },
    });
    const req = makeReq({ cookies: { [REFRESH_COOKIE]: 'raw-refresh' } });
    await controller.emailConsume({ token: 'tok-1' }, req, makeRes());
    expect(emailTokens.consumeEmailToken).toHaveBeenCalledWith(
      'tok-1',
      '198.51.100.1',
      undefined,
      7n,
    );
  });

  it('нет сессии в браузере → сервису уходит null (не undefined, не 0n)', async () => {
    const { controller, emailTokens } = makeController();
    await controller.emailConsume({ token: 'tok-1' }, makeReq(), makeRes());
    expect(emailTokens.consumeEmailToken.mock.calls[0][3]).toBeNull();
  });

  it('ссылка привязки открыта не в том браузере (A3) → ошибка пробрасывается (страница покажет подсказку), кука не ставится', async () => {
    const { controller, emailTokens } = makeController();
    emailTokens.consumeEmailToken.mockRejectedValue(
      new LinkSessionRequiredException(),
    );
    const res = makeRes();
    await expect(
      controller.emailConsume({ token: 'tok-1' }, makeReq(), res),
    ).rejects.toThrow(LinkSessionRequiredException);
    expect(res.cookie).not.toHaveBeenCalled();
  });

  // H1 (аудит 2026-08): login при включённом TOTP не выдаёт сессию сразу —
  // клиент уходит на экран ввода 2FA-кода с одноразовым challengeToken.
  it('totp_challenge → { challengeToken }, кука НЕ выставлена', async () => {
    const { controller, emailTokens } = makeController();
    emailTokens.consumeEmailToken.mockResolvedValue({
      kind: 'totp_challenge',
      challengeToken: 'ch-tok',
      purpose: 'login',
      userId: 1n,
    });
    const res = makeRes();
    await expect(
      controller.emailConsume({ token: 'tok-1' }, makeReq(), res),
    ).resolves.toEqual({ challengeToken: 'ch-tok' });
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('просроченный/невалидный токен → ошибка пробрасывается, без cookie', async () => {
    const { controller, emailTokens } = makeController();
    emailTokens.consumeEmailToken.mockRejectedValue(new Error('expired'));
    const res = makeRes();
    await expect(
      controller.emailConsume({ token: 'bad-tok' }, makeReq(), res),
    ).rejects.toThrow('expired');
    expect(res.cookie).not.toHaveBeenCalled();
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

// Вход по email из установленного приложения. Письмо часто открывают на
// ДРУГОМ устройстве — раньше сессия доставалась тому браузеру, а исходный
// экран навсегда оставался с надписью «письмо отправлено».
describe('AuthAccountController — билет входа в email-флоу', () => {
  const DEVICE = 'd'.repeat(64);
  it('свой билет (кука этого браузера) доезжает до письма', async () => {
    const { controller, auth } = makeController({
      tickets: { K7M2QX94: pendingTicket(DEVICE) },
    });
    const cookies = { [TICKET_DEVICE_COOKIE]: hashToken(DEVICE) };
    await controller.emailLoginLink(
      { email: 'a@b.ru', ticket: 'K7M2QX94' },
      makeReq({ cookies }),
    );
    expect(auth.requestEmailLogin).toHaveBeenCalledWith('a@b.ru', {
      ticket: 'K7M2QX94',
    });
  });

  // S9 (аудит 2026-11): атакующий выписывает билет у себя и просит сервер
  // прислать жертве НАСТОЯЩЕЕ письмо с его кодом. Без куки того браузера,
  // что выписал билет, письма нет вовсе.
  it.each([
    ['куки нет', {}],
    [
      'кука другого билета',
      { [TICKET_DEVICE_COOKIE]: hashToken('e'.repeat(64)) },
    ],
  ])(
    'чужой билет (%s) → 400 ticket_foreign, письмо не уходит',
    async (_l, cookies) => {
      const { controller, auth, securityLog } = makeController({
        tickets: { K7M2QX94: pendingTicket(DEVICE) },
      });
      const err = await controller
        .emailLoginLink(
          { email: 'victim@b.ru', ticket: 'K7M2QX94' },
          makeReq({ cookies }),
        )
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toMatchObject({
        reason: 'ticket_foreign',
      });
      expect(auth.requestEmailLogin).not.toHaveBeenCalled();
      expect(securityLog.log).toHaveBeenCalledWith(
        'login_ticket_foreign',
        expect.objectContaining({ reason: 'other_device' }),
      );
    },
  );

  it('билет уже подтверждён/не вход/неизвестен → тоже 400, письма нет', async () => {
    const approved = { ...pendingTicket(DEVICE), approvedUserId: 9n };
    const handoff = { ...pendingTicket(DEVICE), intent: 'handoff' };
    const { controller, auth } = makeController({
      tickets: { AAAAAAAA: approved, BBBBBBBB: handoff },
    });
    const cookies = { [TICKET_DEVICE_COOKIE]: hashToken(DEVICE) };
    for (const ticket of ['AAAAAAAA', 'BBBBBBBB', 'CCCCCCCC']) {
      await expect(
        controller.emailLoginLink(
          { email: 'a@b.ru', ticket },
          makeReq({ cookies }),
        ),
      ).rejects.toThrow(BadRequestException);
    }
    expect(auth.requestEmailLogin).not.toHaveBeenCalled();
  });

  it('без билета — обычное письмо входа, кука не нужна', async () => {
    const { controller, auth } = makeController();
    await controller.emailLoginLink({ email: 'a@b.ru' }, makeReq());
    expect(auth.requestEmailLogin).toHaveBeenCalledWith('a@b.ru', {});
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
