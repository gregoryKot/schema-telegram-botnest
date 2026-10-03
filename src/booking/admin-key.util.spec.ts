// assertAdminKey — единственная защита admin-эндпоинтов бронирования.
// Ключевые инварианты: константное сравнение (timingSafeEqual) и пустой
// сконфигурированный ключ ВСЕГДА отклоняет (даже если provided тоже пуст).
import { ForbiddenException } from '@nestjs/common';
import { throwError, of, lastValueFrom } from 'rxjs';
import { Reflector } from '@nestjs/core';
import {
  AdminKeyRejectedException,
  AdminThrottle,
  MIN_ADMIN_KEY_LENGTH,
  adminKeyFormat,
  assertAdminKey,
} from './admin-key.util';
import { AdminKeyAuditInterceptor } from './admin-key-audit.interceptor';
import { PERSISTENT_THROTTLE_KEY } from '../api/persistent-throttle.decorator';
import { BookingAdminController } from './booking-admin.controller';
import { BookingCalendarAdminController } from './booking-calendar-admin.controller';
import { ArticlesAdminController } from '../articles/articles-admin.controller';
import { SiteContentAdminController } from '../site-content/site-content-admin.controller';
import { HealthyAdultAdminController } from '../telegram/healthy-adult-admin.controller';

const KEY = 'admin-key-0123456789-abcdefghijklmnop';

describe('assertAdminKey', () => {
  it('совпадающие ключи — не бросает', () => {
    expect(() => assertAdminKey(KEY, KEY)).not.toThrow();
  });

  it('несовпадающие ключи одинаковой длины — ForbiddenException', () => {
    expect(() => assertAdminKey(KEY.replace('a', 'b'), KEY)).toThrow(
      ForbiddenException,
    );
  });

  it('ключи разной длины — ForbiddenException (без падения на timingSafeEqual)', () => {
    expect(() => assertAdminKey('short', KEY)).toThrow(ForbiddenException);
  });

  it('provided не передан (undefined) — ForbiddenException', () => {
    expect(() => assertAdminKey(undefined, KEY)).toThrow(ForbiddenException);
  });

  it('expected пуст — ВСЕГДА отклоняет, даже если provided тоже пустая строка', () => {
    expect(() => assertAdminKey('', '')).toThrow(ForbiddenException);
  });

  it('expected пуст, provided непустой — тоже отклоняет (пустой env никогда не открывает эндпоинт)', () => {
    expect(() => assertAdminKey('anything', '')).toThrow(ForbiddenException);
  });

  it('регистр имеет значение — "Secret" !== "secret"', () => {
    expect(() => assertAdminKey(KEY.toUpperCase(), KEY)).toThrow(
      ForbiddenException,
    );
  });

  it('сообщение об ошибке — "Invalid admin key"', () => {
    expect(() => assertAdminKey('x', KEY)).toThrow('Invalid admin key');
  });
});

// Аудит 2026-10 (I2): ключ короче 32 символов приравнен к незаданному, отказ
// пишется в аудит, ручки лимитированы персистентным троттлом.
describe('слабый ключ', () => {
  const weak = 'a'.repeat(MIN_ADMIN_KEY_LENGTH - 1);

  it('сконфигурированный ключ короче 32 символов — 403 даже при точном совпадении', () => {
    expect(() => assertAdminKey(weak, weak)).toThrow(ForbiddenException);
  });

  it('ровно 32 символа — принимается', () => {
    const ok = 'b'.repeat(MIN_ADMIN_KEY_LENGTH);
    expect(() => assertAdminKey(ok, ok)).not.toThrow();
  });

  it('формат реестра env отклоняет короткий ключ и принимает длинный', () => {
    expect(adminKeyFormat('abcd')).toMatch(/слишком короткий/);
    expect(adminKeyFormat(KEY)).toBeNull();
  });
});

describe('причина отказа', () => {
  const reasonOf = (provided: string | undefined, expected: string) => {
    try {
      assertAdminKey(provided, expected);
    } catch (e) {
      return (e as AdminKeyRejectedException).reason;
    }
    return null;
  };

  it('различает не заданный, слабый и неверный ключ', () => {
    expect(reasonOf(KEY, '')).toBe('not_configured');
    expect(reasonOf('abcd', 'abcd')).toBe('weak_config');
    expect(reasonOf('x'.repeat(KEY.length), KEY)).toBe('mismatch');
  });
});

describe('AdminKeyAuditInterceptor', () => {
  const run = async (handler: ReturnType<typeof throwError | typeof of>) => {
    const securityLog = { log: jest.fn() };
    const interceptor = new AdminKeyAuditInterceptor(securityLog as never);
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({
          ip: '203.0.113.7',
          path: '/api/booking/admin/list',
        }),
      }),
    };
    const result = await lastValueFrom(
      interceptor.intercept(ctx as never, { handle: () => handler }),
    ).catch((e: unknown) => e);
    return { securityLog, result };
  };

  it('неверный ключ → событие admin_key_rejected с ip и причиной, исключение не меняется', async () => {
    const err = new AdminKeyRejectedException('mismatch');
    const { securityLog, result } = await run(throwError(() => err));
    expect(securityLog.log).toHaveBeenCalledWith('admin_key_rejected', {
      ip: '203.0.113.7',
      path: '/api/booking/admin/list',
      reason: 'mismatch',
    });
    expect(result).toBe(err);
  });

  it('присланный ключ в событие не попадает', async () => {
    const { securityLog } = await run(
      throwError(() => new AdminKeyRejectedException('mismatch')),
    );
    expect(JSON.stringify(securityLog.log.mock.calls)).not.toContain(KEY);
  });

  it('чужая ошибка (не про ключ) — события нет', async () => {
    const { securityLog, result } = await run(
      throwError(() => new Error('boom')),
    );
    expect(securityLog.log).not.toHaveBeenCalled();
    // Чужая ошибка проходит сквозь интерцептор как есть — он не глотает её.
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toBe('boom');
  });

  it('успешный ответ — события нет', async () => {
    const { securityLog, result } = await run(of('ok'));
    expect(securityLog.log).not.toHaveBeenCalled();
    expect(result).toBe('ok');
  });
});

describe('троттлинг админ-контроллеров', () => {
  const reflector = new Reflector();
  const controllers = [
    BookingAdminController,
    BookingCalendarAdminController,
    ArticlesAdminController,
    SiteContentAdminController,
    HealthyAdultAdminController,
  ];

  it.each(controllers.map((c) => [c.name, c] as const))(
    '%s: 60/час на класс и счётчик в Postgres',
    (_name, cls) => {
      expect(reflector.get(PERSISTENT_THROTTLE_KEY, cls)).toBe(true);
      expect(Reflect.getMetadata('THROTTLER:LIMITlong', cls)).toBe(60);
      expect(Reflect.getMetadata('THROTTLER:TTLlong', cls)).toBe(3_600_000);
    },
  );

  it('AdminThrottle — декоратор класса (вызывается без ошибок)', () => {
    expect(typeof AdminThrottle()).toBe('function');
  });
});
