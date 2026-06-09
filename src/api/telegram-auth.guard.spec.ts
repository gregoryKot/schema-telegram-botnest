import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { TelegramAuthGuard } from './telegram-auth.guard';
import { validate } from '@tma.js/init-data-node';

jest.mock('@tma.js/init-data-node', () => ({ validate: jest.fn() }));
const mockValidate = validate as jest.Mock;

function ctx(req: any): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => req }) } as any;
}

// Валидный user-параметр initData
function initDataWith(user: object): string {
  return new URLSearchParams({ user: JSON.stringify(user) }).toString();
}

function makeDeps(opts: { botToken?: string; skipAuth?: string } = {}) {
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'BOT_TOKEN') return opts.botToken ?? 'bot-token';
      if (key === 'SKIP_AUTH') return opts.skipAuth;
      return undefined;
    }),
  } as any;
  const prisma = { user: { upsert: jest.fn().mockResolvedValue({}) } } as any;
  const authService = {
    verifyAccessToken: jest.fn(),
    findOrCreateUserByProvider: jest.fn().mockResolvedValue(100n),
  } as any;
  return { config, prisma, authService };
}

describe('TelegramAuthGuard', () => {
  const ORIG_ENV = { ...process.env };

  beforeEach(() => {
    mockValidate.mockReset();
    process.env.NODE_ENV = 'test';
    process.env.ADMIN_ID = '1';
    process.env.BOT_TOKEN = 'bot-token';
    global.fetch = jest.fn().mockResolvedValue({ ok: true }) as any;
  });

  afterEach(() => {
    process.env.NODE_ENV = ORIG_ENV.NODE_ENV;
    process.env.SKIP_AUTH = ORIG_ENV.SKIP_AUTH;
  });

  describe('Path 1 — JWT Bearer (web)', () => {
    it('валидный Bearer: ставит telegramUserId + upsert юзера', async () => {
      const { config, prisma, authService } = makeDeps();
      authService.verifyAccessToken.mockReturnValue({ userId: 7n });
      const guard = new TelegramAuthGuard(config, prisma, authService);
      const req: any = { headers: { authorization: 'Bearer jwt' } };

      expect(await guard.canActivate(ctx(req))).toBe(true);
      expect(req.telegramUserId).toBe(7);
      expect(req.webUser).toEqual({ userId: 7n });
      expect(prisma.user.upsert).toHaveBeenCalledWith({
        where: { id: 7n }, update: {}, create: { id: 7n },
      });
      expect(mockValidate).not.toHaveBeenCalled(); // путь initData не трогаем
    });
  });

  describe('Path 2 — Telegram initData', () => {
    it('валидный initData: резолвит canonical userId через провайдера', async () => {
      const { config, prisma, authService } = makeDeps();
      mockValidate.mockReturnValue(undefined); // подпись ок
      const guard = new TelegramAuthGuard(config, prisma, authService);
      const req: any = { headers: { 'x-telegram-init-data': initDataWith({ id: 555, first_name: 'Аня' }) } };

      expect(await guard.canActivate(ctx(req))).toBe(true);
      expect(authService.findOrCreateUserByProvider).toHaveBeenCalledWith('telegram', '555', 'Аня');
      expect(req.telegramUserId).toBe(100);
      expect(req.telegramFirstName).toBe('Аня');
      expect(req.webUser).toEqual({ userId: 100n });
    });

    it('нет ни Bearer, ни initData → 401 Missing authentication', async () => {
      const { config, prisma, authService } = makeDeps();
      const guard = new TelegramAuthGuard(config, prisma, authService);
      await expect(guard.canActivate(ctx({ headers: {} }))).rejects.toThrow(UnauthorizedException);
    });

    it('initData есть, но BOT_TOKEN не сконфигурирован → 401', async () => {
      const { config, prisma, authService } = makeDeps({ botToken: '' });
      const guard = new TelegramAuthGuard(config, prisma, authService);
      const req: any = { headers: { 'x-telegram-init-data': initDataWith({ id: 1 }) } };
      await expect(guard.canActivate(ctx(req))).rejects.toThrow('BOT_TOKEN not configured');
    });

    it('подделанная подпись: алертит админу и кидает 401 Invalid initData', async () => {
      const { config, prisma, authService } = makeDeps();
      mockValidate.mockImplementation(() => { throw new Error('Signature is invalid'); });
      const guard = new TelegramAuthGuard(config, prisma, authService);
      const req: any = { headers: { 'x-telegram-init-data': initDataWith({ id: 1 }) }, ip: '1.2.3.4' };

      await expect(guard.canActivate(ctx(req))).rejects.toThrow('Invalid initData');
      // алерт админу (suspicious_initdata) через Telegram API
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain('/sendMessage');
    });

    it('падение fetch-алерта не ломает гвард — всё равно 401 Invalid initData', async () => {
      const { config, prisma, authService } = makeDeps();
      mockValidate.mockImplementation(() => { throw new Error('expired'); });
      global.fetch = jest.fn().mockRejectedValue(new Error('network down')) as any;
      const guard = new TelegramAuthGuard(config, prisma, authService);
      const req: any = { headers: { 'x-telegram-init-data': initDataWith({ id: 1 }) } };

      await expect(guard.canActivate(ctx(req))).rejects.toThrow('Invalid initData');
      await Promise.resolve(); // даём отработать .catch(() => null)
    });

    it('валидная подпись, но нет user → 401 Missing user', async () => {
      const { config, prisma, authService } = makeDeps();
      mockValidate.mockReturnValue(undefined);
      const guard = new TelegramAuthGuard(config, prisma, authService);
      const req: any = { headers: { 'x-telegram-init-data': 'auth_date=1' } };
      await expect(guard.canActivate(ctx(req))).rejects.toThrow('Missing user');
    });

    it('user — битый JSON → 401 Invalid user data', async () => {
      const { config, prisma, authService } = makeDeps();
      mockValidate.mockReturnValue(undefined);
      const guard = new TelegramAuthGuard(config, prisma, authService);
      const req: any = { headers: { 'x-telegram-init-data': 'user=%7Bбитый' } };
      await expect(guard.canActivate(ctx(req))).rejects.toThrow('Invalid user data');
    });

    it('user.id не number → 401 Invalid user data', async () => {
      const { config, prisma, authService } = makeDeps();
      mockValidate.mockReturnValue(undefined);
      const guard = new TelegramAuthGuard(config, prisma, authService);
      const req: any = { headers: { 'x-telegram-init-data': initDataWith({ id: '555' }) } };
      await expect(guard.canActivate(ctx(req))).rejects.toThrow('Invalid user data');
    });
  });

  describe('SKIP_AUTH escape hatch', () => {
    it('в НЕ-production со SKIP_AUTH=true пропускает без валидации подписи', async () => {
      process.env.NODE_ENV = 'development';
      const { config, prisma, authService } = makeDeps({ skipAuth: 'true' });
      const guard = new TelegramAuthGuard(config, prisma, authService);
      const req: any = { headers: { 'x-telegram-init-data': initDataWith({ id: 42 }) } };

      expect(await guard.canActivate(ctx(req))).toBe(true);
      expect(mockValidate).not.toHaveBeenCalled();
    });

    it('в production SKIP_AUTH игнорируется — подпись всё равно проверяется', async () => {
      process.env.NODE_ENV = 'production';
      const { config, prisma, authService } = makeDeps({ skipAuth: 'true' });
      mockValidate.mockReturnValue(undefined);
      const guard = new TelegramAuthGuard(config, prisma, authService);
      const req: any = { headers: { 'x-telegram-init-data': initDataWith({ id: 42 }) } };

      await guard.canActivate(ctx(req));
      expect(mockValidate).toHaveBeenCalledTimes(1); // защита: hatch выключен в prod
    });
  });
});
