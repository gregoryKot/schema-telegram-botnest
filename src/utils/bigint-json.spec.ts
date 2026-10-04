import { bigintToJson, installBigIntJson } from './bigint-json';

// Аудит 2026-10, X-1: веб-id ≥ 1e18 округлялись `Number(...)` в JSON-ответах.
describe('bigintToJson', () => {
  it('безопасное целое отдаётся числом (id Telegram)', () => {
    expect(bigintToJson(123456789n)).toBe(123456789);
    expect(bigintToJson(-5n)).toBe(-5);
    expect(bigintToJson(BigInt(Number.MAX_SAFE_INTEGER))).toBe(
      Number.MAX_SAFE_INTEGER,
    );
    expect(bigintToJson(-BigInt(Number.MAX_SAFE_INTEGER))).toBe(
      -Number.MAX_SAFE_INTEGER,
    );
  });

  it('за пределами ±MAX_SAFE_INTEGER — точная десятичная строка', () => {
    const webId = 1000000000000000123n;
    // Число бы округлилось — это и есть баг, который держит тест.
    expect(BigInt(Number(webId))).not.toBe(webId);
    expect(bigintToJson(webId)).toBe('1000000000000000123');
    expect(bigintToJson(BigInt(Number.MAX_SAFE_INTEGER) + 1n)).toBe(
      '9007199254740992',
    );
    expect(bigintToJson(-webId)).toBe('-1000000000000000123');
  });
});

describe('installBigIntJson', () => {
  it('JSON.stringify использует обе ветки', () => {
    installBigIntJson();
    expect(JSON.stringify({ tg: 1234567890n, web: 1000000000000000123n })).toBe(
      '{"tg":1234567890,"web":"1000000000000000123"}',
    );
  });
});
