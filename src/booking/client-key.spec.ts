// Аудит 2026-10 (docs/open/security.md): ключ ClientMeeting склеивал разные
// ящики (нормализация стирала `-` и `+` у любого контакта) и был несолёным
// sha256 — по утёкшему дампу перебирался словарём телефонов и ников.
// crypto-keys.ts читает ENCRYPTION_KEY(_OLD) при загрузке, поэтому модуль
// грузится под заданными ключами (loadWithKeys) — иначе проверялась бы только
// запасная ветка `k0:`.
import { createHash } from 'crypto';
import { loadWithKeys } from '../test-support/load-with-keys';

type Mod = typeof import('./client-key');
const KEY = 'ab'.repeat(32);
const OLD = 'cd'.repeat(32);
const load = (keys: { key: string; old?: string }): Mod =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  loadWithKeys(keys, () => require('./client-key') as Mod);
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

const saved = { ...process.env };
afterAll(() => {
  for (const k of ['ENCRYPTION_KEY', 'ENCRYPTION_KEY_OLD'] as const)
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
});

describe('normalizeContact — форма контакта решает, что стирать', () => {
  const { normalizeContact } = load({ key: KEY });

  it('почта: регистр и пробелы по краям, `-`, `+` и точки остаются', () => {
    expect(normalizeContact(' Ivan-Petrov@X.ru ')).toBe('ivan-petrov@x.ru');
    expect(normalizeContact('name+tag@x.ru')).toBe('name+tag@x.ru');
    expect(normalizeContact('a@my-site.ru')).toBe('a@my-site.ru');
  });

  it('телефон — только цифры, ник — без `@`, прочее — схлопнутые пробелы', () => {
    expect(normalizeContact('+7 (999) 123-45-67')).toBe('79991234567');
    expect(normalizeContact('8.999.123.45.67')).toBe('89991234567');
    expect(normalizeContact('@Ivan_P')).toBe('ivan_p');
    expect(normalizeContact('Иван   Петров ')).toBe('иван петров');
  });
});

describe('clientKey — HMAC с серверным ключом', () => {
  const m = load({ key: KEY });

  it('разные ящики из брифа дают разные ключи', () => {
    for (const [a, b] of [
      ['ivan-petrov@x.ru', 'ivanpetrov@x.ru'],
      ['a@my-site.ru', 'a@mysite.ru'],
      ['name+tag@x.ru', 'nametag@x.ru'],
    ])
      expect(m.clientKey(a)).not.toBe(m.clientKey(b));
  });

  // Контроль (правило №15 п.2): одно и то же лицо в разной записи склеивается.
  it('один человек в разной записи — один ключ', () => {
    expect(m.clientKey('+7 (999) 123-45-67')).toBe(m.clientKey('79991234567'));
    expect(m.clientKey('@Ivan_P')).toBe(m.clientKey('ivan_p'));
    expect(m.clientKey(' Ivan-Petrov@X.ru ')).toBe(
      m.clientKey('ivan-petrov@x.ru'),
    );
  });

  it('ключ с префиксом k1: и без секрета не перебирается: sha256 нормальной формы не совпадает', () => {
    const key = m.clientKey('79991234567');
    expect(key).toMatch(/^k1:[0-9a-f]{64}$/);
    expect(key.slice(3)).not.toBe(sha256('79991234567'));
    expect(key).not.toBe(m.legacyClientKey('79991234567'));
    // другой секрет — другой ключ того же контакта
    expect(load({ key: OLD }).clientKey('79991234567')).not.toBe(key);
  });

  it('без ENCRYPTION_KEY — запасной k0: от sha256 (dev, тесты)', () => {
    const noKey = load({ key: '' });
    expect(noKey.clientKey('@ivan_p')).toBe(`k0:${sha256('ivan_p')}`);
    expect(noKey.clientKeyCandidates('@ivan_p')).toEqual([
      noKey.clientKey('@ivan_p'),
    ]);
  });
});

describe('ротация ENCRYPTION_KEY: кандидаты и источники', () => {
  it('ключ под OLD входит в кандидаты вторым, текущий — первым', () => {
    const before = load({ key: OLD }).clientKey('@ivan_p');
    const rotated = load({ key: KEY, old: OLD });
    expect(rotated.clientKeyCandidates('@ivan_p')).toEqual([
      rotated.clientKey('@ivan_p'),
      before,
    ]);
  });

  it('источники для перевода: старая формула, ключ под OLD и k0, но не текущий ключ', () => {
    const rotated = load({ key: KEY, old: OLD });
    const src = rotated.clientKeySources('@Ivan_P');
    expect(src).toEqual([
      rotated.legacyClientKey('@Ivan_P'),
      load({ key: OLD }).clientKey('@Ivan_P'),
      `k0:${sha256('ivan_p')}`,
    ]);
    expect(src).not.toContain(rotated.clientKey('@Ivan_P'));
  });

  it('legacyClientKey — прежняя формула без изменений (склейка ящиков в ней сохранена)', () => {
    const { legacyClientKey, isLegacyKey } = load({ key: KEY });
    expect(legacyClientKey('ivan-petrov@x.ru')).toBe(sha256('ivanpetrov@x.ru'));
    expect(isLegacyKey(legacyClientKey('@x'))).toBe(true);
    expect(isLegacyKey('rot-e2e-client')).toBe(false);
    expect(isLegacyKey(`k1:${sha256('x')}`)).toBe(false);
  });
});
