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

  it('ровно 29 декодированных байт (iv12+tag16+1 байт данных) — минимально валидный шифротекст, decrypt его реально расшифровывает, а не отбрасывает как "слишком короткий" (граница < vs <=)', () => {
    const { encrypt, decrypt } = loadCrypto({ key: KEY_A });
    const blob = encrypt('x')!;
    expect(Buffer.from(blob, 'base64').length).toBe(29);
    expect(decrypt(blob)).toBe('x');
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

  it('encrypt() перепроверяет NODE_ENV динамически при каждом вызове, а не только на загрузке модуля', () => {
    // Модуль грузим НЕ в production (падения при загрузке не будет), затем окружение
    // переключается в production уже после загрузки — encrypt() обязан среагировать
    // на это при следующем вызове, а не полагаться только на проверку из loadKeys().
    const { encrypt } = loadCrypto({ nodeEnv: 'test' });
    process.env.NODE_ENV = 'production';
    expect(() => encrypt('текст')).toThrow(/ENCRYPTION_KEY is not configured/);
  });
});

describe('ALL_KEYS: полное отсутствие ключей (ни current, ни old)', () => {
  it('decrypt без единого настроенного ключа не пытается расшифровать блоб-подобную строку и не шлёт предупреждение', () => {
    // Если бы CURRENT_KEY (null) случайно попадал в ALL_KEYS вместо того, чтобы быть
    // отфильтрованным, ALL_KEYS.length перестал бы быть 0 — decrypt() пошёл бы в цикл
    // расшифровки, впустую перебрал бы "ключ" null и с шумом сообщил бы о порче данных,
    // хотя на самом деле шифрование просто не настроено вовсе.
    const { decrypt } = loadCrypto({}); // ни ENCRYPTION_KEY, ни ENCRYPTION_KEY_OLD
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const blobShaped = Buffer.alloc(30, 1).toString('base64'); // валиден по форме (>=29 байт)
    expect(decrypt(blobShaped)).toBe(blobShaped);
    expect(warn).not.toHaveBeenCalled();
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

  it('старый ключ из ENCRYPTION_KEY_OLD парсится в Buffer правильной длины (32 байта), а не остаётся сырой hex-строкой — иначе createDecipheriv валится на длине ключа и расшифровка молча не срабатывает', () => {
    const oldMod = loadCrypto({ key: KEY_A });
    const blob = oldMod.encrypt('чувствительный текст под старым ключом')!;

    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const rotated = loadCrypto({ key: KEY_B, old: KEY_A });
    expect(rotated.decrypt(blob)).toBe(
      'чувствительный текст под старым ключом',
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it('reencrypt без CURRENT_KEY (настроен только OLD) не пытается зашифровать заново — блоб остаётся зашифрованным, а не превращается в открытый текст', () => {
    // Опасный сценарий: если ранний return по !CURRENT_KEY пропадёт, reencrypt дойдёт
    // до decrypt() (успешно расшифрует через OLD-ключ) и затем до encrypt() — а encrypt()
    // без CURRENT_KEY в dev/test-режиме возвращает текст КАК ЕСТЬ, т.е. plaintext секрет
    // вместо исходного шифроблока.
    const encrypted = loadCrypto({ key: KEY_A }).encrypt(
      'чувствительные данные, не должны утечь в plaintext',
    )!;
    const { reencrypt } = loadCrypto({ old: KEY_A }); // CURRENT_KEY отсутствует
    expect(reencrypt(encrypted)).toBe(encrypted);
  });

  it('reencrypt: значение, которое decrypt() распознал как легаси-плейнтекст (не шифроблок), не прогоняется через encrypt() заново', () => {
    const { reencrypt } = loadCrypto({ key: KEY_A });
    const legacyPlain = 'ещё одна легаси-запись без шифрования';
    expect(reencrypt(legacyPlain)).toBe(legacyPlain);
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

  it('троттлинг: ровно 60000мс с прошлого warn — это уже НЕ "слишком рано", warn обязан сработать снова (граница < vs <=)', () => {
    const { encrypt, decrypt } = loadCrypto({ key: KEY_A });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const t0 = 1_700_000_000_000;
    const now = jest.spyOn(Date, 'now').mockReturnValue(t0);
    const bad = tamper(encrypt('секрет')!);

    decrypt(bad);
    expect(warn).toHaveBeenCalledTimes(1);

    now.mockReturnValue(t0 + 60_000); // ровно минута, а не "меньше минуты"
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

describe('looksLikeCiphertext (используется encrypt-migration.ts для защиты от двойного шифрования)', () => {
  it('настоящий шифроблок распознаётся как «похоже на шифротекст»', () => {
    const { encrypt, looksLikeCiphertext } = loadCrypto({ key: KEY_A });
    const blob = encrypt('данные')!;
    expect(looksLikeCiphertext(blob)).toBe(true);
  });

  it('обычный плейнтекст (не base64 нужной длины) — не похож на шифротекст', () => {
    const { looksLikeCiphertext } = loadCrypto({ key: KEY_A });
    expect(looksLikeCiphertext('anxiety,anger')).toBe(false);
    expect(looksLikeCiphertext('')).toBe(false);
    expect(looksLikeCiphertext(null)).toBe(false);
    expect(looksLikeCiphertext(undefined)).toBe(false);
  });

  it('короткий base64-блоб (< 29 байт) и мусор с недопустимыми символами — не похожи на шифротекст', () => {
    const { looksLikeCiphertext } = loadCrypto({ key: KEY_A });
    expect(looksLikeCiphertext(Buffer.from('short').toString('base64'))).toBe(
      false,
    );
    // содержит пробел/запятую — не строгий base64-алфавит
    expect(looksLikeCiphertext('not base64!, with spaces ===')).toBe(false);
  });

  it('невалидный символ (пробел) внутри строки правильной длины (кратной 4, декод >=29 байт) не считается шифротекстом — регэксп обязан быть заякорён и слева (^), и справа ($)', () => {
    const { encrypt, looksLikeCiphertext } = loadCrypto({ key: KEY_A });
    // достаточно длинный текст, чтобы порча одного символа не увела декодированную
    // длину ниже 29 байт — иначе тест ловил бы длину, а не алфавит
    const blob = encrypt(
      'текст такой длины, чтобы порча одного символа не опустила декодированную длину ниже 29 байт',
    )!;
    const tampered = blob.slice(0, 10) + ' ' + blob.slice(11);
    expect(tampered.length % 4).toBe(0);
    expect(Buffer.from(tampered, 'base64').length).toBeGreaterThanOrEqual(29);
    expect(looksLikeCiphertext(tampered)).toBe(false);
  });

  it('длина строки не кратна 4 — не похоже на шифротекст, даже если алфавит валиден', () => {
    const { encrypt, looksLikeCiphertext } = loadCrypto({ key: KEY_A });
    const blob = encrypt(
      'текст такой длины, чтобы обрезка на 1 символ не увела декодированную длину ниже 29 байт',
    )!;
    const truncated = blob.slice(0, -1);
    expect(truncated.length % 4).not.toBe(0);
    expect(looksLikeCiphertext(truncated)).toBe(false);
  });

  it('ровно 29 декодированных байт — граница >= (не >), считается шифротекстом', () => {
    const { encrypt, looksLikeCiphertext } = loadCrypto({ key: KEY_A });
    const blob = encrypt('x')!;
    expect(Buffer.from(blob, 'base64').length).toBe(29);
    expect(looksLikeCiphertext(blob)).toBe(true);
  });

  it('длина декодируется именно как base64, а не как utf8-байты самой строки — короткий (28 байт) payload с длинной (40 символов) base64-записью не должен ложно распознаваться как шифротекст', () => {
    const { looksLikeCiphertext } = loadCrypto({ key: KEY_A });
    // 28 декодированных байт (< 29 — НЕ шифротекст), но сама base64-строка длиной
    // 40 символов (её utf8-длина как текста была бы >= 29 — если бы decode шёл
    // как utf8 вместо base64, проверка длины ложно прошла бы)
    const raw = Buffer.alloc(28, 5).toString('base64');
    expect(raw.length).toBe(40);
    expect(Buffer.from(raw, 'base64').length).toBe(28);
    expect(looksLikeCiphertext(raw)).toBe(false);
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

  it('jsonArrays-поле реально шифруется (в хранимом значении нет читаемого текста) — это не эквивалент незашифрованного JSON.stringify', () => {
    const { encryptRecord, looksLikeCiphertext } = loadCrypto({ key: KEY_A });
    const stored = encryptRecord(
      { items: ['секретный пункт', 'ещё один секрет'] },
      { jsonArrays: ['items'] },
    );
    expect(stored.items).not.toContain('секретный пункт');
    expect(looksLikeCiphertext(stored.items as string)).toBe(true);
  });
});

describe('encryptRecord/decryptRecord: необъявленные поля не трогаются (дефолт-массив полей ?? [] не должен стать непустым)', () => {
  // Если бы `schema.strings ?? []` / `schema.jsonArrays ?? []` вдруг вернул непустой
  // список полей по умолчанию, поле с таким именем "утекло" бы в шифрование/расшифровку,
  // даже не будучи объявленным в схеме вызывающего кода.
  const PLACEHOLDER = 'Stryker was here';

  it('encryptRecord: поле без объявления в strings/jsonArrays не меняется', () => {
    const { encryptRecord } = loadCrypto({ key: KEY_A });
    const data = { id: 1, [PLACEHOLDER]: 'не должно измениться' };
    expect(encryptRecord(data, {})[PLACEHOLDER]).toBe('не должно измениться');
  });

  it('decryptRecord: поле без объявления в strings/jsonArrays не меняется', () => {
    const { decryptRecord } = loadCrypto({ key: KEY_A });
    const row = { id: 1, [PLACEHOLDER]: 'плейнтекст' };
    expect(decryptRecord(row, {})[PLACEHOLDER]).toBe('плейнтекст');
  });
});

describe('encryptRecord/decryptRecord: undefined-поле остаётся undefined, а не превращается в null', () => {
  it('encryptRecord пропускает undefined-поле (не подставляет encrypt(undefined) === null)', () => {
    const { encryptRecord } = loadCrypto({ key: KEY_A });
    const data: Record<string, unknown> = { id: 1, text: undefined };
    expect(encryptRecord(data, { strings: ['text'] }).text).toBeUndefined();
  });

  it('decryptRecord пропускает undefined-поле (не подставляет decrypt(undefined) === null)', () => {
    const { decryptRecord } = loadCrypto({ key: KEY_A });
    const row: Record<string, unknown> = { id: 1, text: undefined };
    expect(decryptRecord(row, { strings: ['text'] }).text).toBeUndefined();
  });
});
