// Этап 1 плана покрытия (TEST_COVERAGE_PLAN.md): единые ворота всего API.
// Гард принимает initData Telegram, initData MAX ИЛИ JWT Bearer (сайт) —
// регрессия здесь означает обход авторизации всех эндпоинтов разом. До
// этого спека не тестировался вовсе.
//
// Подпись initData пересчитывается в тесте НЕЗАВИСИМО по алгоритму Telegram
// (secret = HMAC-SHA256(key="WebAppData", botToken)), а не через ту же
// библиотеку, которой валидирует гард. Путь MAX (path 3) мокает MaxProvider
// напрямую — сам алгоритм MAX проверяется отдельно в max-init-data.spec.ts.
import { UnauthorizedException, ExecutionContext } from '@nestjs/common';
import { createHmac } from 'crypto';
import { TelegramAuthGuard } from './telegram-auth.guard';
import { MaxProvider } from '../auth/providers/max.provider';
import { MaxNotConfiguredError } from '../auth/max-init-data';

const BOT_TOKEN = '12345:TEST_TOKEN';

function signInitData(opts: {
  user?: unknown;
  authDate?: number;
  botToken?: string;
  forgeHash?: boolean;
}): string {
  const params = new URLSearchParams();
  if (opts.user !== undefined) params.set('user', JSON.stringify(opts.user));
  params.set(
    'auth_date',
    String(opts.authDate ?? Math.floor(Date.now() / 1000)),
  );
  params.set('query_id', 'AAE_test');
  const checkString = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData')
    .update(opts.botToken ?? BOT_TOKEN)
    .digest();
  let hash = createHmac('sha256', secret).update(checkString).digest('hex');
  if (opts.forgeHash) hash = hash.replace(/^./, hash[0] === '0' ? '1' : '0');
  params.set('hash', hash);
  return params.toString();
}

interface FakeRequest {
  headers: Record<string, string | undefined>;
  ip?: string;
  telegramUserId?: number;
  telegramFirstName?: string;
  webUser?: { userId: bigint };
}

function makeCtx(req: FakeRequest): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

function makeGuard(
  env: Record<string, string | undefined> = {},
  opts: { maxProvider?: Partial<MaxProvider> } = {},
) {
  const config = {
    get: (k: string) => ({ BOT_TOKEN, ...env })[k],
  } as any;
  const prisma = {
    user: {
      // по умолчанию аккаунт жив — тесты про удаление/слияние переопределяют
      findUnique: jest.fn().mockResolvedValue({ id: 0n, deletedAt: null }),
    },
  } as any;
  const authService = {
    verifyAccessToken: jest.fn(),
    findOrCreateUserByProvider: jest.fn().mockResolvedValue(999n),
  };
  const securityLog = { log: jest.fn() };
  const maxProvider = (opts.maxProvider ?? {
    verifyInitData: jest.fn(),
  }) as MaxProvider;
  const analytics = { track: jest.fn().mockResolvedValue(undefined) };
  const guard = new TelegramAuthGuard(
    config,
    prisma,
    authService as any,
    securityLog as any,
    maxProvider,
    analytics as any,
  );
  return { guard, prisma, authService, securityLog, maxProvider, analytics };
}

const ORIGINAL_ENV = { ...process.env };
let fetchMock: jest.Mock;

beforeEach(() => {
  process.env.BOT_TOKEN = BOT_TOKEN;
  process.env.ADMIN_ID = '111';
  fetchMock = jest.fn().mockResolvedValue({ ok: true });
  global.fetch = fetchMock;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  jest.restoreAllMocks();
});

describe('путь 1: JWT Bearer (сайт)', () => {
  it('валидный токен, аккаунт жив → telegramUserId/webUser, строку НЕ воскрешаем', async () => {
    const { guard, prisma, authService } = makeGuard();
    authService.verifyAccessToken.mockReturnValue({ userId: 555n });
    prisma.user.findUnique.mockResolvedValue({ id: 555n, deletedAt: null });
    const req: FakeRequest = { headers: { authorization: 'Bearer tok' } };

    await expect(guard.canActivate(makeCtx(req))).resolves.toBe(true);
    expect(req.telegramUserId).toBe(555);
    expect(req.webUser).toEqual({ userId: 555n });
    // Только сверка существования — никакого upsert (он воскрешал бы удалённых).
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 555n },
      select: { id: true, deletedAt: true },
    });
    expect(prisma.user.upsert).toBeUndefined();
  });

  // Разбор 2026-08-31: токен живёт 15 минут — дольше удаления/слияния аккаунта.
  it('аккаунт удалён (строки нет) → 401, зомби-строка НЕ создаётся', async () => {
    const { guard, prisma, authService } = makeGuard();
    authService.verifyAccessToken.mockReturnValue({ userId: 555n });
    prisma.user.findUnique.mockResolvedValue(null);
    const req: FakeRequest = { headers: { authorization: 'Bearer tok' } };

    await expect(guard.canActivate(makeCtx(req))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('аккаунт помечен deletedAt → 401, не впускаем по старому токену', async () => {
    const { guard, prisma, authService } = makeGuard();
    authService.verifyAccessToken.mockReturnValue({ userId: 555n });
    prisma.user.findUnique.mockResolvedValue({
      id: 555n,
      deletedAt: new Date(),
    });
    const req: FakeRequest = { headers: { authorization: 'Bearer tok' } };

    await expect(guard.canActivate(makeCtx(req))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('битый Bearer → исключение от verifyAccessToken пробрасывается', async () => {
    const { guard, authService } = makeGuard();
    authService.verifyAccessToken.mockImplementation(() => {
      throw new UnauthorizedException('Invalid token');
    });
    const req: FakeRequest = { headers: { authorization: 'Bearer bad' } };
    await expect(guard.canActivate(makeCtx(req))).rejects.toThrow(
      UnauthorizedException,
    );
  });
});

describe('путь 2: Telegram initData (мини-апп)', () => {
  const USER = { id: 42, first_name: 'Грег' };

  it('валидная подпись → канонический userId через AuthProvider (merge-совместимость)', async () => {
    const { guard, authService } = makeGuard();
    const req: FakeRequest = {
      headers: { 'x-telegram-init-data': signInitData({ user: USER }) },
    };

    await expect(guard.canActivate(makeCtx(req))).resolves.toBe(true);
    expect(authService.findOrCreateUserByProvider).toHaveBeenCalledWith(
      'telegram',
      '42',
      'Грег',
    );
    // канонический id (999) из реестра провайдеров, НЕ сырой telegram id (42)
    expect(req.telegramUserId).toBe(999);
    expect(req.webUser).toEqual({ userId: 999n });
    expect(req.telegramFirstName).toBe('Грег');
  });

  it('нет ни Bearer, ни initData → Missing authentication', async () => {
    const { guard } = makeGuard();
    await expect(guard.canActivate(makeCtx({ headers: {} }))).rejects.toThrow(
      'Missing authentication',
    );
  });

  it('подделанный hash → Unauthorized + громкий алерт админу (suspicious_initdata)', async () => {
    const { guard, authService, securityLog } = makeGuard();
    const req: FakeRequest = {
      headers: {
        'x-telegram-init-data': signInitData({ user: USER, forgeHash: true }),
      },
      ip: '9.9.9.9',
    };

    await expect(guard.canActivate(makeCtx(req))).rejects.toThrow(
      'Invalid initData',
    );
    expect(authService.findOrCreateUserByProvider).not.toHaveBeenCalled();
    expect(securityLog.log).toHaveBeenCalledWith(
      'suspicious_initdata',
      expect.objectContaining({ ip: '9.9.9.9' }),
    );
  });

  it('подпись чужим bot-токеном → Unauthorized', async () => {
    const { guard } = makeGuard();
    const initData = signInitData({ user: USER, botToken: '666:EVIL' });
    await expect(
      guard.canActivate(
        makeCtx({ headers: { 'x-telegram-init-data': initData } }),
      ),
    ).rejects.toThrow('Invalid initData');
  });

  // Инцидент 2026-07-29: истёкшая initData — жизненный цикл мини-аппа (Telegram
  // не обновляет её у свернутого приложения), а не атака. Она обязана давать
  // машиночитаемый код (мини-апп по нему перевыпускает сессию) и НЕ будить
  // админа: один вход через час = десяток запросов = десяток DM.
  it('просроченный auth_date (старше часа) → 401 initdata_expired, без алерта', async () => {
    const { guard, securityLog } = makeGuard();
    const initData = signInitData({
      user: USER,
      authDate: Math.floor(Date.now() / 1000) - 7200,
    });
    await expect(
      guard.canActivate(
        makeCtx({ headers: { 'x-telegram-init-data': initData } }),
      ),
    ).rejects.toMatchObject({
      response: { code: 'initdata_expired' },
      status: 401,
    });
    expect(securityLog.log).not.toHaveBeenCalled();
  });

  it('валидная подпись, но нет user → Missing user', async () => {
    const { guard } = makeGuard();
    const initData = signInitData({});
    await expect(
      guard.canActivate(
        makeCtx({ headers: { 'x-telegram-init-data': initData } }),
      ),
    ).rejects.toThrow('Missing user');
  });

  it('user.id не число → Invalid user data', async () => {
    const { guard } = makeGuard();
    const initData = signInitData({ user: { id: 'not-a-number' } });
    await expect(
      guard.canActivate(
        makeCtx({ headers: { 'x-telegram-init-data': initData } }),
      ),
    ).rejects.toThrow('Invalid user data');
  });

  it('BOT_TOKEN не сконфигурирован → Unauthorized', async () => {
    const { guard } = makeGuard({ BOT_TOKEN: undefined });
    const initData = signInitData({ user: USER });
    await expect(
      guard.canActivate(
        makeCtx({ headers: { 'x-telegram-init-data': initData } }),
      ),
    ).rejects.toThrow('BOT_TOKEN not configured');
  });
});

describe('SKIP_AUTH — dev-лазейка (жёстко выключена в production)', () => {
  const USER = { id: 42, first_name: 'Грег' };

  it('в dev пропускает неподписанный initData (с warn)', async () => {
    const { guard } = makeGuard({ SKIP_AUTH: 'true' });
    const initData = signInitData({ user: USER, forgeHash: true });
    await expect(
      guard.canActivate(
        makeCtx({ headers: { 'x-telegram-init-data': initData } }),
      ),
    ).resolves.toBe(true);
  });

  it('в production игнорируется — подделка отбивается несмотря на SKIP_AUTH=true', async () => {
    process.env.NODE_ENV = 'production';
    const { guard } = makeGuard({ SKIP_AUTH: 'true' });
    const initData = signInitData({ user: USER, forgeHash: true });
    await expect(
      guard.canActivate(
        makeCtx({ headers: { 'x-telegram-init-data': initData } }),
      ),
    ).rejects.toThrow('Invalid initData');
  });
});

describe('путь 3: MAX initData (MAX мини-апп)', () => {
  it('валидная подпись → канонический userId через AuthProvider (провайдер max)', async () => {
    const verifyInitData = jest
      .fn()
      .mockReturnValue({ providerId: '77', displayName: 'Оля' });
    const { guard, authService } = makeGuard(
      {},
      { maxProvider: { verifyInitData } },
    );
    const req: FakeRequest = {
      headers: { 'x-max-init-data': 'raw-max-init-data' },
    };

    await expect(guard.canActivate(makeCtx(req))).resolves.toBe(true);
    expect(verifyInitData).toHaveBeenCalledWith('raw-max-init-data');
    expect(authService.findOrCreateUserByProvider).toHaveBeenCalledWith(
      'max',
      '77',
      'Оля',
    );
    // канонический id (999) из реестра провайдеров, НЕ сырой providerId (77)
    expect(req.telegramUserId).toBe(999);
    expect(req.webUser).toEqual({ userId: 999n });
    expect(req.telegramFirstName).toBe('Оля');
  });

  it('поддельная подпись → Unauthorized + алерт админу (suspicious_initdata)', async () => {
    const verifyInitData = jest.fn().mockImplementation(() => {
      throw new Error('Invalid MAX initData signature');
    });
    const { guard, authService, securityLog } = makeGuard(
      {},
      { maxProvider: { verifyInitData } },
    );
    const req: FakeRequest = {
      headers: { 'x-max-init-data': 'forged' },
      // IP отличный от остальных кейсов в этом файле — иначе AlertThrottle
      // (модульный синглтон в initdata-alert.ts) глушит алерт как повтор
      // с того же IP в пределах окна.
      ip: '7.7.7.7',
    };

    await expect(guard.canActivate(makeCtx(req))).rejects.toThrow(
      'Invalid initData',
    );
    expect(authService.findOrCreateUserByProvider).not.toHaveBeenCalled();
    expect(securityLog.log).toHaveBeenCalledWith(
      'suspicious_initdata',
      expect.objectContaining({ ip: '7.7.7.7' }),
    );
  });

  it('просроченная подпись MAX → 401 initdata_expired, без алерта', async () => {
    const verifyInitData = jest.fn().mockImplementation(() => {
      throw new Error('init data expired');
    });
    const { guard, securityLog } = makeGuard(
      {},
      { maxProvider: { verifyInitData } },
    );
    const req: FakeRequest = { headers: { 'x-max-init-data': 'stale' } };

    await expect(guard.canActivate(makeCtx(req))).rejects.toMatchObject({
      response: { code: 'initdata_expired' },
      status: 401,
    });
    expect(securityLog.log).not.toHaveBeenCalled();
  });

  // Пока MAX_BOT_TOKEN не проставлен, каждый запрос из мессенджера выглядел бы
  // для аудита подделкой подписи. Это наша конфигурация: 503 и тишина в лог.
  it('нет MAX_BOT_TOKEN → 503, и админ НЕ получает алерт о подделке', async () => {
    const verifyInitData = jest.fn().mockImplementation(() => {
      throw new MaxNotConfiguredError();
    });
    const { guard, authService, securityLog } = makeGuard(
      {},
      { maxProvider: { verifyInitData } },
    );
    const req: FakeRequest = {
      headers: { 'x-max-init-data': 'что угодно' },
      ip: '8.8.8.8',
    };

    await expect(guard.canActivate(makeCtx(req))).rejects.toMatchObject({
      status: 503,
    });
    expect(securityLog.log).not.toHaveBeenCalled();
    expect(authService.findOrCreateUserByProvider).not.toHaveBeenCalled();
  });
});

// Регресс инцидента 2026-08-08 на серверной стороне шва. Мини-апп в Telegram
// считал себя открытым в MAX и слал ПУСТУЮ подпись; пустая строка falsy, и
// запрос уходил в ветку «Missing authentication» — без лога, счётчика и
// алерта. Вход был сломан у всех пользователей Telegram, а сервер молчал.
describe('отказ входа: пустая подпись слышна', () => {
  it('пустой x-max-init-data → 401, алерт админу и серверное событие', async () => {
    const { guard, securityLog, analytics } = makeGuard();
    const ctx = makeCtx({ headers: { 'x-max-init-data': '' }, ip: '1.2.3.4' });

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    expect(securityLog.log).toHaveBeenCalledWith(
      'empty_signature',
      expect.objectContaining({ host: 'max' }),
    );
    expect(analytics.track).toHaveBeenCalledWith(
      null,
      'auth_rejected',
      expect.objectContaining({ host: 'max', reason: 'empty_signature' }),
    );
  });

  it('запрос вообще без заголовков — 401 молча (фон интернета не будит админа)', async () => {
    const { guard, securityLog, analytics } = makeGuard();
    const ctx = makeCtx({ headers: {}, ip: '9.9.9.9' });

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    expect(securityLog.log).not.toHaveBeenCalled();
    expect(analytics.track).not.toHaveBeenCalled();
  });
});

// Пара к «отказ входа»: успешный вход тоже даёт сигнал — иначе клиент,
// который просто перестал доезжать до сервера, неотличим с сервера от
// «сегодня никто не открывал приложение» (docs/SHIELD_PROMPT.md, известные
// дыры). Троттлинг проверен отдельно и детерминированно в
// auth-success.report.spec.ts — здесь только проверка, что guard реально
// зовёт его на всех трёх путях, с правильной площадкой.
describe('успешный вход считается (auth_success)', () => {
  it('путь 1 (JWT) → auth_success, host=web, userId в БД не попадает', async () => {
    const { guard, authService, analytics } = makeGuard();
    authService.verifyAccessToken.mockReturnValue({ userId: 111_001n });
    const req: FakeRequest = { headers: { authorization: 'Bearer tok' } };

    await guard.canActivate(makeCtx(req));

    expect(analytics.track).toHaveBeenCalledWith(null, 'auth_success', {
      host: 'web',
    });
  });

  it('путь 2 (Telegram initData) → auth_success, host=telegram', async () => {
    const { guard, authService, analytics } = makeGuard();
    authService.findOrCreateUserByProvider.mockResolvedValue(111_002n);
    const req: FakeRequest = {
      headers: { 'x-telegram-init-data': signInitData({ user: { id: 42 } }) },
    };

    await guard.canActivate(makeCtx(req));

    expect(analytics.track).toHaveBeenCalledWith(null, 'auth_success', {
      host: 'telegram',
    });
  });

  it('путь 3 (MAX initData) → auth_success, host=max', async () => {
    const verifyInitData = jest
      .fn()
      .mockReturnValue({ providerId: '77', displayName: 'Оля' });
    const { guard, authService, analytics } = makeGuard(
      {},
      { maxProvider: { verifyInitData } },
    );
    authService.findOrCreateUserByProvider.mockResolvedValue(111_003n);
    const req: FakeRequest = { headers: { 'x-max-init-data': 'raw' } };

    await guard.canActivate(makeCtx(req));

    expect(analytics.track).toHaveBeenCalledWith(null, 'auth_success', {
      host: 'max',
    });
  });

  // Критичное для стоимости: guard проверяет подпись на КАЖДЫЙ запрос экрана
  // мини-аппа (полтора десятка за одно открытие) — без троттлинга это было
  // бы полтора десятка строк auth_success вместо одной сессии.
  it('шквал запросов одного юзера — ОДНА строка auth_success, не по одной на запрос', async () => {
    const { guard, authService, analytics } = makeGuard();
    authService.findOrCreateUserByProvider.mockResolvedValue(111_004n);
    const makeReq = (): FakeRequest => ({
      headers: { 'x-telegram-init-data': signInitData({ user: { id: 42 } }) },
    });

    for (let i = 0; i < 5; i += 1) {
      await guard.canActivate(makeCtx(makeReq()));
    }

    const successCalls = (analytics.track as jest.Mock).mock.calls.filter(
      ([, name]) => name === 'auth_success',
    );
    expect(successCalls).toEqual([
      [null, 'auth_success', { host: 'telegram' }],
    ]);
  });

  // Два РАЗНЫХ юзера в том же окне — обе сессии реальны и обе обязаны
  // засчитаться, троттлинг режет повтор, а не разных людей.
  it('два разных юзера в том же окне — ДВЕ строки auth_success', async () => {
    const { guard, authService, analytics } = makeGuard();
    authService.findOrCreateUserByProvider
      .mockResolvedValueOnce(111_005n)
      .mockResolvedValueOnce(111_006n);
    const makeReq = (id: number): FakeRequest => ({
      headers: {
        'x-telegram-init-data': signInitData({ user: { id } }),
      },
    });

    await guard.canActivate(makeCtx(makeReq(501)));
    await guard.canActivate(makeCtx(makeReq(502)));

    const successCalls = (analytics.track as jest.Mock).mock.calls.filter(
      ([, name]) => name === 'auth_success',
    );
    expect(successCalls).toEqual([
      [null, 'auth_success', { host: 'telegram' }],
      [null, 'auth_success', { host: 'telegram' }],
    ]);
  });
});
