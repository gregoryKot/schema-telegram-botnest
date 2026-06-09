// Ключи читаются на уровне модуля в loadKeys() при импорте, поэтому каждый
// сценарий грузит crypto заново через resetModules() с нужным env.
type CryptoModule = typeof import('./crypto');

const KEY_A = 'a'.repeat(64); // 32 байта валидного hex
const KEY_B = 'b'.repeat(64);

function loadCrypto(env: { current?: string; old?: string; nodeEnv?: string }): CryptoModule {
  jest.resetModules();
  if (env.current === undefined) delete process.env.ENCRYPTION_KEY;
  else process.env.ENCRYPTION_KEY = env.current;
  if (env.old === undefined) delete process.env.ENCRYPTION_KEY_OLD;
  else process.env.ENCRYPTION_KEY_OLD = env.old;
  if (env.nodeEnv !== undefined) process.env.NODE_ENV = env.nodeEnv;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('./crypto');
}

describe('crypto', () => {
  const ORIG = { ...process.env };

  afterEach(() => {
    process.env.NODE_ENV = ORIG.NODE_ENV;
    process.env.ENCRYPTION_KEY = ORIG.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY_OLD = ORIG.ENCRYPTION_KEY_OLD;
  });

  describe('encrypt / decrypt round-trip', () => {
    it('расшифровка возвращает исходный текст', () => {
      const c = loadCrypto({ current: KEY_A });
      const enc = c.encrypt('секретная заметка');
      expect(enc).not.toBe('секретная заметка');
      expect(c.decrypt(enc)).toBe('секретная заметка');
    });

    it('каждое шифрование даёт разный ciphertext (случайный IV), но та же расшифровка', () => {
      const c = loadCrypto({ current: KEY_A });
      const a = c.encrypt('одно и то же');
      const b = c.encrypt('одно и то же');
      expect(a).not.toBe(b);
      expect(c.decrypt(a)).toBe('одно и то же');
      expect(c.decrypt(b)).toBe('одно и то же');
    });

    it('корректно обрабатывает юникод и эмодзи', () => {
      const c = loadCrypto({ current: KEY_A });
      const text = 'Привет 👋 \n многострочный\tтекст';
      expect(c.decrypt(c.encrypt(text))).toBe(text);
    });
  });

  describe('encrypt — граничные значения', () => {
    it('null / undefined возвращают null, пустая строка остаётся пустой', () => {
      const c = loadCrypto({ current: KEY_A });
      expect(c.encrypt(null)).toBeNull();
      expect(c.encrypt(undefined)).toBeNull();
      expect(c.encrypt('')).toBe(''); // falsy → возвращается как есть (?? ловит лишь null/undefined)
    });

    it('без ключа в НЕ-production возвращает плейнтекст как есть', () => {
      const c = loadCrypto({ current: undefined, nodeEnv: 'test' });
      expect(c.encrypt('текст')).toBe('текст');
    });

    it('без ключа в production — кидает (отказ хранить плейнтекст)', () => {
      // В production отсутствие ключа роняет уже на загрузке модуля.
      expect(() => loadCrypto({ current: undefined, nodeEnv: 'production' })).toThrow(/ENCRYPTION_KEY/);
    });

    it('кидает при шифровании, если ключ пропал, а NODE_ENV стал production после загрузки', () => {
      const c = loadCrypto({ current: undefined, nodeEnv: 'test' });
      process.env.NODE_ENV = 'production';
      expect(() => c.encrypt('текст')).toThrow(/refusing to store plaintext/);
    });
  });

  describe('decrypt — устойчивость', () => {
    it('без сконфигурированных ключей возвращает значение как есть', () => {
      const c = loadCrypto({ current: undefined, nodeEnv: 'test' });
      expect(c.decrypt('что угодно')).toBe('что угодно');
    });

    it('плейнтекст (не наш формат) возвращается без изменений', () => {
      const c = loadCrypto({ current: KEY_A });
      expect(c.decrypt('просто строка')).toBe('просто строка');
    });

    it('null / undefined возвращаются как null', () => {
      const c = loadCrypto({ current: KEY_A });
      expect(c.decrypt(null)).toBeNull();
      expect(c.decrypt(undefined)).toBeNull();
    });

    it('подделанный ciphertext (флип байта) НЕ расшифровывается — возвращается как есть', () => {
      const c = loadCrypto({ current: KEY_A });
      const enc = c.encrypt('конфиденциально')!;
      const buf = Buffer.from(enc, 'base64');
      buf[buf.length - 1] ^= 0x01; // портим последний байт данных
      const tampered = buf.toString('base64');
      expect(c.decrypt(tampered)).toBe(tampered); // auth-тег не сошёлся → не отдаём мусор
    });

    it('ciphertext с чужим ключом не расшифровывается — возвращается как есть', () => {
      const enc = loadCrypto({ current: KEY_A }).encrypt('секрет')!;
      const other = loadCrypto({ current: KEY_B });
      expect(other.decrypt(enc)).toBe(enc);
    });
  });

  describe('ротация ключей (ENCRYPTION_KEY_OLD fallback)', () => {
    it('данные, зашифрованные старым ключом, читаются после ротации', () => {
      const enc = loadCrypto({ current: KEY_A }).encrypt('старое сообщение')!;
      // Ротация: новый ключ B текущий, A — в OLD
      const rotated = loadCrypto({ current: KEY_B, old: KEY_A });
      expect(rotated.decrypt(enc)).toBe('старое сообщение');
    });

    it('reencrypt перешифровывает старый блоб под текущий ключ', () => {
      const encOld = loadCrypto({ current: KEY_A }).encrypt('перешифруй меня')!;
      const rotated = loadCrypto({ current: KEY_B, old: KEY_A });
      const encNew = rotated.reencrypt(encOld)!;
      expect(encNew).not.toBe(encOld);
      // Новый блоб читается уже только по ключу B (без OLD)
      const onlyNew = loadCrypto({ current: KEY_B });
      expect(onlyNew.decrypt(encNew)).toBe('перешифруй меня');
    });

    it('reencrypt возвращает плейнтекст без изменений', () => {
      const c = loadCrypto({ current: KEY_A });
      expect(c.reencrypt('обычная строка')).toBe('обычная строка');
    });

    it('reencrypt: null / без текущего ключа → возвращает как есть', () => {
      expect(loadCrypto({ current: KEY_A }).reencrypt(null)).toBeNull();
      expect(loadCrypto({ current: undefined, nodeEnv: 'test' }).reencrypt('x')).toBe('x');
    });
  });

  describe('encryptJson / decryptJson', () => {
    it('round-trip объекта', () => {
      const c = loadCrypto({ current: KEY_A });
      const obj = { a: 1, b: ['x', 'y'], c: null };
      expect(c.decryptJson(c.encryptJson(obj))).toEqual(obj);
    });

    it('encryptJson(null) → null', () => {
      const c = loadCrypto({ current: KEY_A });
      expect(c.encryptJson(null)).toBeNull();
      expect(c.encryptJson(undefined)).toBeNull();
    });

    it('decryptJson невалидного JSON → null', () => {
      const c = loadCrypto({ current: KEY_A });
      const enc = c.encrypt('{не json');
      expect(c.decryptJson(enc)).toBeNull();
    });

    it('decryptJson(null) → null', () => {
      const c = loadCrypto({ current: KEY_A });
      expect(c.decryptJson(null)).toBeNull();
    });
  });

  describe('encryptRecord / decryptRecord', () => {
    const schema = { strings: ['text', 'note'], jsonArrays: ['items'] };

    it('шифрует объявленные поля, round-trip восстанавливает исходник', () => {
      const c = loadCrypto({ current: KEY_A });
      const data = { id: 5, text: 'тело', note: 'примечание', items: ['a', 'b'] };
      const enc = c.encryptRecord(data, schema);
      expect(enc.text).not.toBe('тело');
      expect(typeof enc.items).toBe('string');
      expect(enc.id).toBe(5); // незатронутые поля как есть
      expect(c.decryptRecord(enc, schema)).toEqual(data);
    });

    it('null-поля не трогаются', () => {
      const c = loadCrypto({ current: KEY_A });
      const enc = c.encryptRecord({ text: null, note: 'есть', items: null }, schema);
      expect(enc.text).toBeNull();
      expect(enc.items).toBeNull();
    });

    it('decryptRecord forward-compat: jsonArray уже массив (legacy) — возвращается как есть', () => {
      const c = loadCrypto({ current: KEY_A });
      const row = { text: c.encrypt('t'), items: ['уже', 'массив'] };
      const dec = c.decryptRecord(row, schema);
      expect(dec.items).toEqual(['уже', 'массив']);
      expect(dec.text).toBe('t');
    });
  });
});
