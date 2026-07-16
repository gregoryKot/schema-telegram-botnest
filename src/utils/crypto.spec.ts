// Этап 1 плана покрытия (TEST_COVERAGE_PLAN.md): критический контур
// шифрования. AES-256-GCM для всех терапевтических текстов + multi-key
// ротация ENCRYPTION_KEY — CLAUDE.md называет баг ротации худшим сценарием
// (необратимая порча данных). До этого спека crypto.ts не имел прямых тестов.
//
// crypto.ts читает ключи один раз на уровне модуля, поэтому каждый сценарий
// загружает свежую копию модуля через jest.isolateModules с нужным env.

type CryptoModule = typeof import('./crypto');

const KEY_A = 'aa'.repeat(32); // 64 hex-символа = 32 байта
const KEY_B = 'bb'.repeat(32);

const ORIGINAL_ENV = { ...process.env };

function loadCrypto(env: {
  key?: string;
  old?: string;
  nodeEnv?: string;
}): CryptoModule {
  process.env.ENCRYPTION_KEY = env.key ?? '';
  process.env.ENCRYPTION_KEY_OLD = env.old ?? '';
  process.env.NODE_ENV = env.nodeEnv ?? 'test';
  let mod: CryptoModule | undefined;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('./crypto') as CryptoModule;
  });
  return mod!;
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  jest.restoreAllMocks();
});

describe('encrypt/decrypt roundtrip', () => {
  it('расшифровывает то, что зашифровал (кириллица, эмодзи, переносы)', () => {
    const { encrypt, decrypt } = loadCrypto({ key: KEY_A });
    const text = 'Дневник: мне тяжело 😔\nно я справляюсь';
    const blob = encrypt(text);
    expect(blob).not.toBe(text);
    expect(decrypt(blob)).toBe(text);
  });

  it('шифротекст — base64-блоб формата iv(12)+tag(16)+data', () => {
    const { encrypt } = loadCrypto({ key: KEY_A });
    const blob = encrypt('x')!;
    const buf = Buffer.from(blob, 'base64');
    // 12 IV + 16 GCM-тэг + 1 байт данных
    expect(buf.length).toBe(29);
  });

  it('два шифрования одного текста дают разные блобы (случайный IV)', () => {
    const { encrypt } = loadCrypto({ key: KEY_A });
    expect(encrypt('одинаковый текст')).not.toBe(encrypt('одинаковый текст'));
  });

  it('null/undefined/пустая строка проходят насквозь', () => {
    const { encrypt, decrypt } = loadCrypto({ key: KEY_A });
    expect(encrypt(null)).toBeNull();
    expect(encrypt(undefined)).toBeNull();
    expect(encrypt('')).toBe('');
    expect(decrypt(null)).toBeNull();
    expect(decrypt('')).toBe('');
  });

  it('легаси-плейнтекст (не base64-блоб) возвращается как есть без warn', () => {
    const { decrypt } = loadCrypto({ key: KEY_A });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(decrypt('обычная старая заметка')).toBe('обычная старая заметка');
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('конфигурация ключей', () => {
  it('без ключа в dev — passthrough (encrypt и decrypt не трогают текст)', () => {
    const { encrypt, decrypt } = loadCrypto({});
    expect(encrypt('текст')).toBe('текст');
    expect(decrypt('текст')).toBe('текст');
  });

  it('ключ неверной длины игнорируется (эквивалент отсутствия)', () => {
    const { encrypt } = loadCrypto({ key: 'deadbeef' });
    expect(encrypt('текст')).toBe('текст');
  });

  it('в production без ключа модуль падает на загрузке (крash на буте, не тихий плейнтекст)', () => {
    expect(() => loadCrypto({ nodeEnv: 'production' })).toThrow(
      /ENCRYPTION_KEY missing/,
    );
  });
});

describe('multi-key ротация (сценарий из CLAUDE.md)', () => {
  it('блоб, зашифрованный старым ключом, читается через ENCRYPTION_KEY_OLD', () => {
    const oldMod = loadCrypto({ key: KEY_A });
    const blob = oldMod.encrypt('данные до ротации');

    const rotated = loadCrypto({ key: KEY_B, old: KEY_A });
    expect(rotated.decrypt(blob)).toBe('данные до ротации');
  });

  it('новые записи шифруются ТОЛЬКО текущим ключом (старый — read-only)', () => {
    const rotated = loadCrypto({ key: KEY_B, old: KEY_A });
    const blob = rotated.encrypt('данные после ротации');

    const onlyNew = loadCrypto({ key: KEY_B });
    expect(onlyNew.decrypt(blob)).toBe('данные после ротации');
  });

  it('reencrypt перешифровывает старый блоб текущим ключом', () => {
    const oldMod = loadCrypto({ key: KEY_A });
    const oldBlob = oldMod.encrypt('перешифруй меня');

    const rotated = loadCrypto({ key: KEY_B, old: KEY_A });
    const newBlob = rotated.reencrypt(oldBlob);
    expect(newBlob).not.toBe(oldBlob);

    // после удаления ENCRYPTION_KEY_OLD данные обязаны остаться читаемыми
    const onlyNew = loadCrypto({ key: KEY_B });
    expect(onlyNew.decrypt(newBlob)).toBe('перешифруй меня');
  });

  it('reencrypt не трогает плейнтекст и null', () => {
    const { reencrypt } = loadCrypto({ key: KEY_A });
    expect(reencrypt('просто текст')).toBe('просто текст');
    expect(reencrypt(null)).toBeNull();
  });

  it('ENCRYPTION_KEY_OLD принимает несколько ключей через запятую', () => {
    const a = loadCrypto({ key: KEY_A }).encrypt('от ключа A');
    const b = loadCrypto({ key: KEY_B }).encrypt('от ключа B');

    const third = loadCrypto({
      key: 'cc'.repeat(32),
      old: ` ${KEY_A} , ${KEY_B} `,
    });
    expect(third.decrypt(a)).toBe('от ключа A');
    expect(third.decrypt(b)).toBe('от ключа B');
  });
});

describe('GCM-аутентификация и алерт о порче (аудит 2026-07, S-3)', () => {
  function tamper(blob: string): string {
    const buf = Buffer.from(blob, 'base64');
    buf[buf.length - 1] ^= 0xff; // портим последний байт шифротекста
    return buf.toString('base64');
  }

  it('подделанный блоб не расшифровывается и триггерит console.warn', () => {
    const { encrypt, decrypt } = loadCrypto({ key: KEY_A });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const tampered = tamper(encrypt('секрет')!);

    // возвращается как есть (легаси-фолбэк), но никогда — расшифрованный текст
    expect(decrypt(tampered)).toBe(tampered);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[crypto]'));
  });

  it('блоб от неизвестного ключа (неполная ротация) тоже даёт warn', () => {
    const foreign = loadCrypto({ key: KEY_A }).encrypt('чужой ключ')!;
    const { decrypt } = loadCrypto({ key: KEY_B });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    expect(decrypt(foreign)).toBe(foreign);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('warn троттлится: не чаще раза в минуту', () => {
    const { encrypt, decrypt } = loadCrypto({ key: KEY_A });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const t0 = 1_700_000_000_000;
    const now = jest.spyOn(Date, 'now').mockReturnValue(t0);

    const bad = tamper(encrypt('секрет')!);
    decrypt(bad);
    decrypt(bad);
    expect(warn).toHaveBeenCalledTimes(1);

    now.mockReturnValue(t0 + 61_000);
    decrypt(bad);
    expect(warn).toHaveBeenCalledTimes(2);
  });
});

describe('encryptJson / decryptJson', () => {
  it('roundtrip массива и объекта', () => {
    const { encryptJson, decryptJson } = loadCrypto({ key: KEY_A });
    const items = [{ id: 1, text: 'пункт' }, 'строка'];
    expect(decryptJson(encryptJson(items))).toEqual(items);
  });

  it('null → null; мусор после расшифровки → null', () => {
    const { encrypt, encryptJson, decryptJson } = loadCrypto({ key: KEY_A });
    expect(encryptJson(null)).toBeNull();
    // валидный блоб, но внутри не JSON
    expect(decryptJson(encrypt('не json'))).toBeNull();
  });
});

describe('encryptRecord / decryptRecord (схема записи)', () => {
  const SCHEMA = { strings: ['text'], jsonArrays: ['items'] };

  it('roundtrip: шифрует объявленные поля, не трогает id/userId/enum', () => {
    const { encryptRecord, decryptRecord } = loadCrypto({ key: KEY_A });
    const data = {
      id: 7,
      userId: 42n,
      needId: 'safety',
      text: 'зашифруй меня',
      items: ['a', 'b'],
    };
    const stored = encryptRecord(data, SCHEMA);
    expect(stored.id).toBe(7);
    expect(stored.userId).toBe(42n);
    expect(stored.needId).toBe('safety');
    expect(stored.text).not.toBe(data.text);
    expect(typeof stored.items).toBe('string');

    expect(decryptRecord(stored, SCHEMA)).toEqual(data);
  });

  it('null-поля остаются null', () => {
    const { encryptRecord, decryptRecord } = loadCrypto({ key: KEY_A });
    const stored = encryptRecord({ text: null, items: null }, SCHEMA);
    expect(stored).toEqual({ text: null, items: null });
    expect(decryptRecord(stored, SCHEMA)).toEqual({ text: null, items: null });
  });

  it('forward-compat: легаси-строка с уже десериализованным JSON-полем возвращается как есть', () => {
    const { decryptRecord } = loadCrypto({ key: KEY_A });
    const legacyRow = { text: 'плейнтекст', items: ['уже', 'массив'] };
    expect(decryptRecord(legacyRow, SCHEMA)).toEqual(legacyRow);
  });
});
