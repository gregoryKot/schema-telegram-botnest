import { BadRequestException } from '@nestjs/common';
import { parseUserId } from './parse-user-id';
import { parseId } from './request-utils';

// Аудит 2026-10, X-1: веб-id (≥ 1e18) не помещаются в Number — parseId их
// отвергает, а Number() округляет. parseUserId обязан вернуть точный bigint.
describe('parseUserId', () => {
  it('веб-id ≥ 2^53 возвращается точным bigint', () => {
    const id = parseUserId('1000000000000000123');
    expect(typeof id).toBe('bigint');
    expect(id).toBe(1000000000000000123n);
    // Сравнение, на котором держался баг: через Number id терялся.
    expect(BigInt(Number('1000000000000000123'))).not.toBe(id);
  });

  it('id Telegram парсится так же', () => {
    expect(parseUserId('123456789')).toBe(123456789n);
  });

  it.each(['', '0', '00', '5abc', '1e18', '0x1f', ' 5', '5 ', '1.5', '+5'])(
    'мусор %p → 400',
    (raw) => {
      expect(() => parseUserId(raw)).toThrow(BadRequestException);
    },
  );

  it('20 цифр и значение за int64 → 400', () => {
    expect(() => parseUserId('12345678901234567890')).toThrow(
      BadRequestException,
    );
    expect(() => parseUserId('9223372036854775808')).toThrow(
      BadRequestException,
    );
    expect(parseUserId('9223372036854775807')).toBe(9223372036854775807n);
  });

  it('минус — только с allowNegative (виртуальные клиенты)', () => {
    expect(() => parseUserId('-5')).toThrow(BadRequestException);
    expect(parseUserId('-5', { allowNegative: true })).toBe(-5n);
    expect(() => parseUserId('-0', { allowNegative: true })).toThrow(
      BadRequestException,
    );
    expect(() => parseUserId('--5', { allowNegative: true })).toThrow(
      BadRequestException,
    );
  });

  it('parseId (Int-колонки) веб-id по-прежнему не принимает', () => {
    expect(() => parseId('1000000000000000123')).toThrow(BadRequestException);
  });
});
