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
