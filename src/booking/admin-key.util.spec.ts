// assertAdminKey — единственная защита admin-эндпоинтов бронирования.
// Ключевые инварианты: константное сравнение (timingSafeEqual) и пустой
// сконфигурированный ключ ВСЕГДА отклоняет (даже если provided тоже пуст).
import { ForbiddenException } from '@nestjs/common';
import { assertAdminKey } from './admin-key.util';

describe('assertAdminKey', () => {
  it('совпадающие ключи — не бросает', () => {
    expect(() => assertAdminKey('secret123', 'secret123')).not.toThrow();
  });

  it('несовпадающие ключи одинаковой длины — ForbiddenException', () => {
    expect(() => assertAdminKey('wrong-key', 'secret123')).toThrow(
      ForbiddenException,
    );
  });

  it('ключи разной длины — ForbiddenException (без падения на timingSafeEqual)', () => {
    expect(() => assertAdminKey('short', 'much-longer-secret')).toThrow(
      ForbiddenException,
    );
  });

  it('provided не передан (undefined) — ForbiddenException', () => {
    expect(() => assertAdminKey(undefined, 'secret123')).toThrow(
      ForbiddenException,
    );
  });

  it('expected пуст — ВСЕГДА отклоняет, даже если provided тоже пустая строка', () => {
    expect(() => assertAdminKey('', '')).toThrow(ForbiddenException);
  });

  it('expected пуст, provided непустой — тоже отклоняет (пустой env никогда не открывает эндпоинт)', () => {
    expect(() => assertAdminKey('anything', '')).toThrow(ForbiddenException);
  });

  it('регистр имеет значение — "Secret" !== "secret"', () => {
    expect(() => assertAdminKey('Secret123', 'secret123')).toThrow(
      ForbiddenException,
    );
  });

  it('сообщение об ошибке — "Invalid admin key"', () => {
    expect(() => assertAdminKey('x', 'y')).toThrow('Invalid admin key');
  });
});
