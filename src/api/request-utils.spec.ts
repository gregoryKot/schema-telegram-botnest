// uid()/parseId() — единый источник userId/id для ВСЕХ контроллеров api/*
// (аудит 2026-07, 2в). До выноса три копипасты незаметно разошлись:
// diary принимал «5abc» как 5 (голый parseInt), therapy разрешал
// отрицательные id без объяснения. Ловим именно эти классы регрессий.
import { BadRequestException } from '@nestjs/common';
import { uid, parseId } from './request-utils';

describe('uid', () => {
  it('берёт userId строго из req.webUser, а не откуда-то ещё', () => {
    const req = { webUser: { userId: 42n } } as any;
    expect(uid(req)).toBe(42n);
  });

  it('возвращает bigint как есть, не приводит к number (точность для больших id)', () => {
    const big = 9_007_199_254_740_993n; // > Number.MAX_SAFE_INTEGER
    const req = { webUser: { userId: big } } as any;
    expect(uid(req)).toBe(big);
  });
});

describe('parseId', () => {
  it('парсит валидное положительное целое', () => {
    expect(parseId('5')).toBe(5);
    expect(parseId('123456')).toBe(123456);
  });

  it('«5abc» — ошибка, а не 5 (регрессия голого parseInt)', () => {
    expect(() => parseId('5abc')).toThrow(BadRequestException);
  });

  it('дробное число отклоняется', () => {
    expect(() => parseId('5.5')).toThrow(BadRequestException);
  });

  it('ноль отклоняется (не валидный id)', () => {
    expect(() => parseId('0')).toThrow(BadRequestException);
  });

  it('отрицательное число отклоняется по умолчанию', () => {
    expect(() => parseId('-5')).toThrow(BadRequestException);
  });

  it('пустая строка/мусор отклоняются', () => {
    expect(() => parseId('')).toThrow(BadRequestException);
    expect(() => parseId('   ')).toThrow(BadRequestException);
    expect(() => parseId('null')).toThrow(BadRequestException);
  });

  // M6 (аудит 2026-10): Number(raw) принимал экзотические записи чисел.
  it.each([
    '1e20',
    '1e3',
    '0x1f',
    '99999999999999999999',
    ' 5',
    '5 ',
    '+5',
    '١٢٣',
    '5_0',
  ])('экзотическая/огромная запись %p отклоняется', (raw) => {
    expect(() => parseId(raw)).toThrow(BadRequestException);
    expect(() => parseId(raw, { allowNegative: true })).toThrow(
      BadRequestException,
    );
  });

  it('telegram-id (> INT4, ~1e10) без int32 проходит — therapy-клиенты', () => {
    expect(parseId('9876543210')).toBe(9876543210);
  });

  it('int32: true отклоняет значения за пределом INT4 (колонки Int)', () => {
    expect(parseId('2147483647', { int32: true })).toBe(2147483647);
    expect(() => parseId('2147483648', { int32: true })).toThrow(
      BadRequestException,
    );
    expect(() =>
      parseId('-2147483648', { int32: true, allowNegative: true }),
    ).toThrow(BadRequestException);
  });

  it('-3 при allowNegative — ок, без флага — ошибка', () => {
    expect(parseId('-3', { allowNegative: true })).toBe(-3);
    expect(() => parseId('-3')).toThrow(BadRequestException);
  });

  it('allowNegative: true пропускает отрицательные (виртуальные клиенты терапевта)', () => {
    expect(parseId('-5', { allowNegative: true })).toBe(-5);
  });

  it('allowNegative: true всё равно отклоняет ноль и мусор', () => {
    expect(() => parseId('0', { allowNegative: true })).toThrow(
      BadRequestException,
    );
    expect(() => parseId('abc', { allowNegative: true })).toThrow(
      BadRequestException,
    );
  });
});
