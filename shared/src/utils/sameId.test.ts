import { describe, it, expect } from 'vitest';
import { sameId, isVirtualId, parseRouteUserId, idBucket } from './sameId';

describe('sameId', () => {
  it('число и строка с тем же значением — одно и то же', () => {
    expect(sameId(5, '5')).toBe(true);
    expect(sameId('5', 5)).toBe(true);
    expect(sameId(5, 5)).toBe(true);
  });

  it('разные значения — разные', () => {
    expect(sameId(5, 6)).toBe(false);
    expect(sameId('5', '50')).toBe(false);
  });

  // Аудит 2026-10, X-1: Number('1000000000000000123') === Number('1000000000000000124'),
  // а это два разных аккаунта.
  it('веб-id > 2^53 различаются точно', () => {
    expect(Number('1000000000000000123')).toBe(Number('1000000000000000124'));
    expect(sameId('1000000000000000123', '1000000000000000124')).toBe(false);
    expect(sameId('1000000000000000123', '1000000000000000123')).toBe(true);
  });

  it('null/undefined не равны ничему, даже друг другу', () => {
    expect(sameId(null, null)).toBe(false);
    expect(sameId(undefined, undefined)).toBe(false);
    expect(sameId(null, 0)).toBe(false);
    expect(sameId(1, undefined)).toBe(false);
  });
});

describe('isVirtualId', () => {
  it('отрицательный id — виртуальный клиент, число или строка', () => {
    expect(isVirtualId(-3)).toBe(true);
    expect(isVirtualId('-3')).toBe(true);
  });

  it('обычный и веб-id — нет', () => {
    expect(isVirtualId(555)).toBe(false);
    expect(isVirtualId('1000000000000000123')).toBe(false);
  });
});

describe('parseRouteUserId', () => {
  it('отдаёт строку как есть, без округления', () => {
    expect(parseRouteUserId('42')).toBe('42');
    expect(parseRouteUserId('-3')).toBe('-3');
    expect(parseRouteUserId('1000000000000000123')).toBe('1000000000000000123');
  });

  it('мусор, пустое и отсутствие — null', () => {
    expect(parseRouteUserId('abc')).toBeNull();
    expect(parseRouteUserId('12abc')).toBeNull();
    expect(parseRouteUserId('1e18')).toBeNull();
    expect(parseRouteUserId('')).toBeNull();
    expect(parseRouteUserId(undefined)).toBeNull();
  });
});

describe('idBucket', () => {
  it('совпадает с Math.abs(id) % n для обычных id', () => {
    expect(idBucket(555, 6)).toBe(555 % 6);
    expect(idBucket(-7, 6)).toBe(1);
    expect(idBucket('42', 6)).toBe(0);
  });

  it('точен для веб-id: число здесь теряет цифры', () => {
    // 1000000000000000123 % 6 = 1 (точно), а округлённый Number даёт иное.
    expect(idBucket('1000000000000000123', 6)).toBe(
      Number(1000000000000000123n % 6n),
    );
    expect(idBucket('1000000000000000123', 6)).toBe(1);
  });
});
