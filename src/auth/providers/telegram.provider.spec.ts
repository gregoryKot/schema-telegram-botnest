// Этап 1 плана покрытия (TEST_COVERAGE_PLAN.md), п.6: верификация подписи
// провайдеров логина. TelegramProvider проверяет Telegram Login Widget —
// регрессия здесь означает, что кто угодно может представиться любым
// telegramId и получить доступ к чужому аккаунту (данные общие с мини-аппом,
// см. CLAUDE.md «Два фронтенда — один бэк»).
//
// Подпись пересчитывается в тесте НЕЗАВИСИМО от provider'а — так же, как в
// telegram-auth.guard.spec.ts и jwt.guard.spec.ts: secret = SHA256(botToken),
// data_check_string — отсортированные "key=value" через "\n" (без hash),
// итоговый hash = HMAC-SHA256(secret, data_check_string) в hex.
import { UnauthorizedException, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { TelegramProvider } from './telegram.provider';
// GoogleProvider тянет пакет 'jose' (чистый ESM) — ts-jest не умеет его
// парсить (нет transformIgnorePatterns/babel-конфига под node_modules).
// registry.ts тестируем на фейковых провайдерах, поэтому реальный
// GoogleProvider (с сетевым JWKS-клиентом) тут не нужен — подменяем модуль,
// чтобы require('./google.provider') внутри registry.ts не парсил jose.
jest.mock('./google.provider', () => ({ GoogleProvider: class {} }));
import { AuthProviderRegistry } from './registry';
import { AuthProviderHandler } from './types';

const BOT_TOKEN = '111222333:AAExampleTestTokenNotReal';

function computeHash(fields: Record<string, string>, botToken: string): string {
  const checkString = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join('\n');
  const secretKey = crypto.createHash('sha256').update(botToken).digest();
  return crypto
    .createHmac('sha256', secretKey)
    .update(checkString)
    .digest('hex');
}

// Собирает валидный payload виджета (id/auth_date — числа, как реально
// присылает Telegram) и подписывает его под переданный botToken.
type FieldValue = string | number | undefined;

function buildPayload(
  overrides: Record<string, FieldValue> = {},
  botToken = BOT_TOKEN,
): Record<string, FieldValue> {
  const base: Record<string, FieldValue> = {
    id: 555666777,
    first_name: 'Аня',
    username: 'anna_test',
    photo_url: 'https://t.me/i/userpic/320/anna.jpg',
    auth_date: Math.floor(Date.now() / 1000),
    ...overrides,
  };
  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries(base)) {
    if (v == null) continue;
    fields[k] = String(v);
  }
  const hash = computeHash(fields, botToken);
  return { ...base, hash };
}

function makeProvider(botToken = BOT_TOKEN): TelegramProvider {
  const config = {
    getOrThrow: (key: string) => {
      if (key === 'BOT_TOKEN') return botToken;
      throw new Error(`unexpected config key: ${key}`);
    },
  } as unknown as ConfigService;
  return new TelegramProvider(config);
}

describe('TelegramProvider.verifyClientData', () => {
  it('валидный payload принимается, возвращает providerId и displayName', () => {
    const provider = makeProvider();
    const identity = provider.verifyClientData(buildPayload());
    expect(identity).toEqual({ providerId: '555666777', displayName: 'Аня' });
  });

  it('BOT_TOKEN с пробелами по краям — секрет всё равно совпадает (config.trim())', () => {
    const provider = makeProvider(`  ${BOT_TOKEN}  `);
    const identity = provider.verifyClientData(buildPayload());
    expect(identity.providerId).toBe('555666777');
  });

  it('подделанный hash → UnauthorizedException("Invalid Telegram signature")', () => {
    const provider = makeProvider();
    const payload = buildPayload();
    const hash = payload.hash as string;
    payload.hash = hash[0] === '0' ? `1${hash.slice(1)}` : `0${hash.slice(1)}`;
    expect(() => provider.verifyClientData(payload)).toThrow(
      'Invalid Telegram signature',
    );
  });

  it('чужой botToken (сервер подписывает не тем ключом) → отвергается', () => {
    const provider = makeProvider(BOT_TOKEN);
    const payload = buildPayload({}, 'attacker-controlled-token');
    expect(() => provider.verifyClientData(payload)).toThrow(
      UnauthorizedException,
    );
  });

  it('просроченный auth_date (>24ч) → UnauthorizedException("Telegram auth data expired")', () => {
    const provider = makeProvider();
    const payload = buildPayload({
      auth_date: Math.floor(Date.now() / 1000) - 86401,
    });
    expect(() => provider.verifyClientData(payload)).toThrow(
      'Telegram auth data expired',
    );
  });

  it('auth_date чуть моложе суток (86399с назад) ещё принимается', () => {
    // Не берём ровно 86400с: authDate округляется через Math.floor, а внутри
    // provider'а идёт секунда-две реального времени между сборкой payload'а
    // и вызовом verifyClientData — на самой границе сравнение флапает.
    // 86399 даёт однозначный запас, всё ещё проверяя «почти-граница», а не
    // «заведомо свежий» auth_date.
    const provider = makeProvider();
    const payload = buildPayload({
      auth_date: Math.floor(Date.now() / 1000) - 86399,
    });
    expect(() => provider.verifyClientData(payload)).not.toThrow();
  });

  it('нет hash → UnauthorizedException("Missing hash")', () => {
    const provider = makeProvider();
    const payload = buildPayload();
    delete payload.hash;
    expect(() => provider.verifyClientData(payload)).toThrow('Missing hash');
  });

  it('hash не 64 hex-символа → UnauthorizedException("Malformed hash"), без RangeError', () => {
    const provider = makeProvider();
    const payload = buildPayload();
    payload.hash = 'not-a-valid-hash';
    expect(() => provider.verifyClientData(payload)).toThrow('Malformed hash');
  });

  it('нет id (при иначе валидной подписи) → UnauthorizedException("Missing Telegram user id")', () => {
    const provider = makeProvider();
    const payload = buildPayload({ id: undefined });
    expect(() => provider.verifyClientData(payload)).toThrow(
      'Missing Telegram user id',
    );
  });

  it('id=0 отвергается как falsy (текущее поведение !id)', () => {
    const provider = makeProvider();
    const payload = buildPayload({ id: 0 });
    expect(() => provider.verifyClientData(payload)).toThrow(
      'Missing Telegram user id',
    );
  });
});

describe('AuthProviderRegistry', () => {
  function fakeProvider(id: string): AuthProviderHandler {
    return { id, displayName: id };
  }

  it('get() возвращает зарегистрированный провайдер по id', () => {
    const google = fakeProvider('google');
    const telegram = fakeProvider('telegram');
    const registry = new AuthProviderRegistry(
      google as never,
      telegram as never,
      fakeProvider('telegram-oidc') as never,
      fakeProvider('vk') as never,
    );
    expect(registry.get('telegram')).toBe(telegram);
    expect(registry.get('google')).toBe(google);
  });

  it('get() неизвестного id → NotFoundException', () => {
    const registry = new AuthProviderRegistry(
      fakeProvider('google') as never,
      fakeProvider('telegram') as never,
      fakeProvider('telegram-oidc') as never,
      fakeProvider('vk') as never,
    );
    expect(() => registry.get('apple')).toThrow(NotFoundException);
  });

  it('list() возвращает все зарегистрированные провайдеры', () => {
    const registry = new AuthProviderRegistry(
      fakeProvider('google') as never,
      fakeProvider('telegram') as never,
      fakeProvider('telegram-oidc') as never,
      fakeProvider('vk') as never,
    );
    expect(
      registry
        .list()
        .map((p) => p.id)
        .sort(),
    ).toEqual(['google', 'telegram', 'telegram-oidc', 'vk']);
  });
});
