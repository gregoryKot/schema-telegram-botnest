// Валидаторы форматов (табличные, оба исхода) + структурная целостность
// реестра (правило №13: реестры держим отсортированными; имена уникальны).
import { formats } from './env-registry';
import { ENV_REGISTRY } from './env-registry.entries';

describe('formats', () => {
  it.each([
    ['url', formats.url, 'https://schemehappens.ru', null],
    ['url', formats.url, 'http://example.com', null],
    ['url', formats.url, 'not a url', 'не похоже на URL (не парсится)'],
    [
      'url',
      formats.url,
      'ftp://example.com',
      'схема «ftp:» — ожидался http(s)',
    ],
    ['httpsUrl', formats.httpsUrl, 'https://schemehappens.ru/cb', null],
    [
      'httpsUrl',
      formats.httpsUrl,
      'http://schemehappens.ru/cb',
      'ожидался https, а не http',
    ],
    ['integer', formats.integer, '42', null],
    ['integer', formats.integer, '-7', null],
    ['integer', formats.integer, '4.2', 'не целое число'],
    ['telegramId', formats.telegramId, '123456789', null],
    [
      'telegramId',
      formats.telegramId,
      '-1',
      'не похоже на Telegram id (ожидались только цифры)',
    ],
    ['hex32', formats.hex32, 'a'.repeat(64), null],
    [
      'hex32',
      formats.hex32,
      'a'.repeat(63),
      'ожидалось 64 hex-символа (32 байта), получено 63',
    ],
    [
      'hex32',
      formats.hex32,
      'z'.repeat(64),
      'ожидалось 64 hex-символа (32 байта), получено 64',
    ],
    ['email', formats.email, 'a@b.ru', null],
    ['email', formats.email, 'not-an-email', 'не похоже на email'],
    ['nonEmpty', formats.nonEmpty, 'x', null],
    ['nonEmpty', formats.nonEmpty, '   ', 'пустая строка'],
    ['botToken', formats.botToken, `123456789:${'A'.repeat(35)}`, null],
    [
      'botToken',
      formats.botToken,
      'not-a-token',
      'не похоже на токен бота (ожидался вид `123456789:AAAA...`)',
    ],
    ['any', formats.any, '', null],
    ['any', formats.any, 'что угодно', null],
  ] as const)('%s(%j) → %j', (_label, fn, input, expected) => {
    expect(fn(input)).toBe(expected);
  });

  it('oneOf — принимает только перечисленные значения', () => {
    const f = formats.oneOf(['true', 'false']);
    expect(f('true')).toBeNull();
    expect(f('yes')).toBe('ожидалось одно из [true, false], получено «yes»');
  });
});

describe('ENV_REGISTRY — структурная целостность', () => {
  it('отсортирован по имени (правило №13)', () => {
    const names = ENV_REGISTRY.map((e) => e.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it('имена уникальны', () => {
    const names = ENV_REGISTRY.map((e) => e.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('каждая запись — валидная env-переменная (SCREAMING_SNAKE_CASE) с непустым purpose', () => {
    for (const e of ENV_REGISTRY) {
      expect(e.name).toMatch(/^[A-Z][A-Z0-9_]*$/);
      expect(e.purpose.length).toBeGreaterThan(10);
      expect(typeof e.requiredInProd).toBe('boolean');
      expect(typeof e.format).toBe('function');
    }
  });

  it('не пуст — иначе гейт/отчёт бессмысленны', () => {
    expect(ENV_REGISTRY.length).toBeGreaterThan(20);
  });
});
