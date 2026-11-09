// Разбор ключей шифрования из env (crypto-keys.ts) — прямо, без crypto.ts.
//
// Модуль читает ENCRYPTION_KEY(_OLD) один раз при загрузке, поэтому каждый
// сценарий грузит свежую копию через jest.isolateModules. Поведение снаружи
// (шифрование, падение бута в проде) пинит crypto.spec.ts; здесь — сама форма
// KEYS: что попадает в `all`, сколько битых старых ключей видит crypto.ts.
// Ночной мутационный замер (stryker.golden-auth.config.json) держал у этого
// файла трёх выживших — пустые элементы списка, отброс null и подстановку
// по умолчанию нельзя было отличить от исходника, пока битые ключи просто
// молча отбрасывались; счёт `badOld` делает их видимыми.

type KeysModule = typeof import('./crypto-keys');

const KEY_A = 'aa'.repeat(32);
const KEY_B = 'bb'.repeat(32);
const ORIGINAL_ENV = { ...process.env };

function loadKeys(env: { key?: string; old?: string }): KeysModule {
  delete process.env.ENCRYPTION_KEY;
  delete process.env.ENCRYPTION_KEY_OLD;
  if (env.key !== undefined) process.env.ENCRYPTION_KEY = env.key;
  if (env.old !== undefined) process.env.ENCRYPTION_KEY_OLD = env.old;
  let mod: KeysModule | undefined;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('./crypto-keys') as KeysModule;
  });
  return mod!;
}

const hex = (keys: Buffer[]) => keys.map((k) => k.toString('hex'));

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('KEYS: разбор ENCRYPTION_KEY и ENCRYPTION_KEY_OLD', () => {
  it('переменных нет вовсе — ни текущего, ни старых, битых ноль', () => {
    const { KEYS } = loadKeys({});
    expect(KEYS.current).toBeNull();
    expect(KEYS.all).toEqual([]);
    expect(KEYS.badOld).toBe(0);
  });

  it('текущий первым, затем старые в порядке списка', () => {
    const { KEYS } = loadKeys({ key: KEY_A, old: KEY_B });
    expect(KEYS.current?.toString('hex')).toBe(KEY_A);
    expect(hex(KEYS.all)).toEqual([KEY_A, KEY_B]);
    expect(KEYS.badOld).toBe(0);
  });

  it('пробелы и пустые элементы списка (вставка из панели хостинга) — не битые ключи', () => {
    const { KEYS } = loadKeys({ key: KEY_A, old: ` ${KEY_B} ,, ,` });
    expect(hex(KEYS.all)).toEqual([KEY_A, KEY_B]);
    expect(KEYS.badOld).toBe(0);
  });

  it('пустая строка в ENCRYPTION_KEY_OLD — ноль битых', () => {
    expect(loadKeys({ key: KEY_A, old: '' }).KEYS.badOld).toBe(0);
  });

  it('битый старый ключ считается и в `all` не попадает', () => {
    const { KEYS } = loadKeys({
      key: KEY_A,
      old: `zz${KEY_B.slice(2)},${KEY_B}`,
    });
    expect(hex(KEYS.all)).toEqual([KEY_A, KEY_B]);
    expect(KEYS.badOld).toBe(1);
  });

  it('без текущего ключа null в `all` не попадает: только валидные старые', () => {
    const { KEYS } = loadKeys({ key: 'не-ключ', old: `oops,${KEY_B}` });
    expect(KEYS.current).toBeNull();
    expect(hex(KEYS.all)).toEqual([KEY_B]);
    expect(KEYS.badOld).toBe(1);
  });
});

describe('keyedDigests: HMAC под подключом каждого ключа', () => {
  it('без ключей — current null и пустой all', () => {
    const { keyedDigests } = loadKeys({});
    expect(keyedDigests('room', 'x')).toEqual({ current: null, all: [] });
  });

  it('current совпадает с первым из all; старый ключ даёт другой дайджест', () => {
    const { keyedDigests } = loadKeys({ key: KEY_A, old: KEY_B });
    const d = keyedDigests('room', 'client-1');
    expect(d.all).toHaveLength(2);
    expect(d.current).toBe(d.all[0]);
    expect(d.all[1]).not.toBe(d.all[0]);
    expect(d.current).toMatch(/^[0-9a-f]{64}$/);
  });

  it('метка и данные входят в дайджест', () => {
    const { keyedDigests } = loadKeys({ key: KEY_A });
    const base = keyedDigests('room', 'client-1').current;
    expect(keyedDigests('other', 'client-1').current).not.toBe(base);
    expect(keyedDigests('room', 'client-2').current).not.toBe(base);
  });
});
