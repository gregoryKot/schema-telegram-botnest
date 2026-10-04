// Форма initData MAX: нужны непустые hash и auth_date, ключи — целиком.
import { describe, it, expect } from 'vitest';
import { hasMaxInitDataShape } from './maxLaunchShape';

describe('hasMaxInitDataShape', () => {
  it('настоящая форма — да', () => {
    expect(
      hasMaxInitDataShape(
        'query_id=abc&user=%7B%7D&auth_date=1700000000&hash=' + 'a'.repeat(64),
      ),
    ).toBe(true);
  });

  it('порядок ключей не важен', () => {
    expect(hasMaxInitDataShape('hash=abc&auth_date=1')).toBe(true);
  });

  it.each([
    undefined,
    '',
    'x',
    'hash=abc',
    'auth_date=1',
    'auth_date=1&hash=',
    'auth_date=&hash=abc',
    'auth_date=1&xhash=abc',
    'auth_date=1&hash',
    '=1&hash=abc',
  ])('%j — нет', (v) => {
    expect(hasMaxInitDataShape(v)).toBe(false);
  });
});
