// Этап 1 плана покрытия (TEST_COVERAGE_PLAN.md): единые ворота всего API.
// Гард принимает initData (мини-апп) ИЛИ JWT Bearer (сайт) — регрессия здесь
// означает обход авторизации всех эндпоинтов разом. До этого спека не
// тестировался вовсе.
//
// Подпись initData пересчитывается в тесте НЕЗАВИСИМО по алгоритму Telegram
// (secret = HMAC-SHA256(key="WebAppData", botToken)), а не через ту же
// библиотеку, которой валидирует гард.
import { UnauthorizedException, ExecutionContext } from '@nestjs/common';
import { createHmac } from 'crypto';
import { TelegramAuthGuard } from './telegram-auth.guard';

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

function makeGuard(env: Record<string, string | undefined> = {}) {
  const config = {
    get: (k: string) => ({ BOT_TOKEN, ...env })[k],
  } as any;
  const prisma = { user: { upsert: jest.fn().mockResolvedValue({}) } } as any;
  const authService = {
    verifyAccessToken: jest.fn(),
    findOrCreateUserByProvider: jest.fn().mockResolvedValue(999n),
  };
  const guard = new TelegramAuthGuard(config, prisma, authService as any);
  return { guard, prisma, authService };
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
  it('валидный токен → telegramUserId/webUser + upsert строки User', async () => {
    const { guard, prisma, authService } = makeGuard();
    authService.verifyAccessToken.mockReturnValue({ userId: 555n });
    const req: FakeRequest = { headers: { authorization: 'Bearer tok' } };

    await expect(guard.canActivate(makeCtx(req))).resolves.toBe(true);
    expect(req.telegramUserId).toBe(555);
    expect(req.webUser).toEqual({ userId: 555n });
    // web-only юзер мог никогда не трогать бота — строка обязана появиться
    expect(prisma.user.upsert).toHaveBeenCalledWith({
      where: { id: 555n },
      update: {},
      create: { id: 555n },
    });
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
    const { guard, authService } = makeGuard();
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
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      expect.objectContaining({ method: 'POST' }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.text).toContain('suspicious_initdata');
    expect(body.text).toContain('9.9.9.9');
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

  it('просроченный auth_date (старше часа) → Unauthorized', async () => {
    const { guard } = makeGuard();
    const initData = signInitData({
      user: USER,
      authDate: Math.floor(Date.now() / 1000) - 7200,
    });
    await expect(
      guard.canActivate(
        makeCtx({ headers: { 'x-telegram-init-data': initData } }),
      ),
    ).rejects.toThrow('Invalid initData');
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
