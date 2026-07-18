// Security-фаззинг: разбор initData в TelegramAuthGuard (security-таск
// 2026-07-17). Гард парсит JSON поля `user` из подписанного initData —
// вредонос с ВАЛИДНОЙ подписью (свой бот-токен утёк / инсайдер) может
// подсунуть патологический user-объект. Инвариант: гард НИКОГДА не отдаёт
// 500 (только чистый 401 или успех) и не загрязняет Object.prototype.
import { UnauthorizedException, ExecutionContext } from '@nestjs/common';
import { createHmac } from 'crypto';
import { TelegramAuthGuard } from '../api/telegram-auth.guard';

const BOT_TOKEN = '12345:TEST_TOKEN';

// Подписываем initData правильным секретом — чтобы дойти до разбора user
// (иначе всё падало бы на проверке подписи, а мы фаззим именно парсер).
function signWithUser(userStr: string): string {
  const params = new URLSearchParams();
  params.set('user', userStr);
  params.set('auth_date', String(Math.floor(Date.now() / 1000)));
  const checkString = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const hash = createHmac('sha256', secret).update(checkString).digest('hex');
  params.set('hash', hash);
  return params.toString();
}

function makeGuard() {
  const config = { get: (k: string) => ({ BOT_TOKEN })[k] } as any;
  const prisma = { user: { upsert: jest.fn().mockResolvedValue({}) } } as any;
  const authService = {
    verifyAccessToken: jest.fn(),
    findOrCreateUserByProvider: jest.fn().mockResolvedValue(999n),
  };
  return new TelegramAuthGuard(config, prisma, authService as any);
}

function ctx(initData: string): ExecutionContext {
  const req = { headers: { 'x-telegram-init-data': initData } };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

const ORIGINAL_ENV = { ...process.env };
beforeEach(() => {
  process.env.BOT_TOKEN = BOT_TOKEN;
  process.env.ADMIN_ID = '111';
  global.fetch = jest.fn().mockResolvedValue({ ok: true }) as any;
});
afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  jest.restoreAllMocks();
  delete (Object.prototype as Record<string, unknown>).polluted;
});

describe('initData fuzz: патологический user не роняет гард (нет 500)', () => {
  // Каждый кейс обязан завершиться либо UnauthorizedException, либо true —
  // но НИКОГДА иным исключением (TypeError/RangeError = 500 на проде).
  const CASES: Array<[string, string]> = [
    ['user=null', 'null'],
    ['user=число', '42'],
    ['user=строка', '"hello"'],
    ['user=массив', '[1,2,3]'],
    ['user=пустой объект', '{}'],
    ['id=строка', '{"id":"42"}'],
    ['id=булево', '{"id":true}'],
    ['битый JSON', '{"id":42'],
    ['id=float', '{"id":3.14,"first_name":"x"}'],
    ['id=отрицательный', '{"id":-1,"first_name":"x"}'],
    ['id=огромный', '{"id":999999999999999999999,"first_name":"x"}'],
    ['__proto__ в user', '{"id":42,"__proto__":{"polluted":"yes"}}'],
    ['constructor в user', '{"id":42,"constructor":{"x":1}}'],
    ['unicode/emoji в first_name', '{"id":42,"first_name":"👨‍👩‍👧 Ω 中文"}'],
    ['лишние поля', '{"id":42,"first_name":"x","evil":"drop","a":{"b":1}}'],
  ];

  it.each(CASES)('%s → 401 или успех, не 500', async (_name, userStr) => {
    const guard = makeGuard();
    let result: boolean | undefined;
    let error: unknown;
    try {
      result = await guard.canActivate(ctx(signWithUser(userStr)));
    } catch (e) {
      error = e;
    }
    // единственно допустимое исключение — UnauthorizedException
    if (error !== undefined) {
      expect(error).toBeInstanceOf(UnauthorizedException);
    } else {
      expect(result).toBe(true);
    }
  });

  it('огромный first_name (200k символов) не роняет и не виснет', async () => {
    const guard = makeGuard();
    const big = '{"id":42,"first_name":"' + 'я'.repeat(200_000) + '"}';
    await expect(guard.canActivate(ctx(signWithUser(big)))).resolves.toBe(true);
  });

  it('ни один кейс не загрязнил Object.prototype', () => {
    // прогоняем pollution-кейсы и проверяем прототип
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('__proto__ payload с валидной подписью не загрязняет прототип', async () => {
    const guard = makeGuard();
    await guard
      .canActivate(ctx(signWithUser('{"id":42,"__proto__":{"polluted":"x"}}')))
      .catch(() => null);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
