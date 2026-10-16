// Аудит 2026-10, D-8 (docs/AUDIT_2026-10_FINDINGS.md): при провале расшифровки
// jsonArrays-поле раньше превращалось в строку-блоб (`.includes('ab')` давал
// подстрочные совпадения, мерж и «Мои записи» принимали её за данные), а лог
// не говорил ни таблицы, ни колонки, ни масштаба. Теперь провал — явный исход:
// массив → `[]` плюс маркер, строка → сырое значение (решение владельца
// 2026-10-04, fail-open) плюс маркер, один троттлированный error без содержимого.
//
// Ключи читаются модулем один раз при загрузке, поэтому каждый сценарий берёт
// свежую копию через jest.isolateModules (как crypto.spec.ts).

type CryptoModule = typeof import('./crypto');
type NestLogger = typeof import('@nestjs/common').Logger;

const KEY_A = 'aa'.repeat(32);
const KEY_B = 'bb'.repeat(32);
const ORIGINAL_ENV = { ...process.env };
let isolatedLogger: NestLogger;

function load(key: string): CryptoModule {
  process.env.ENCRYPTION_KEY = key;
  process.env.ENCRYPTION_KEY_OLD = '';
  process.env.NODE_ENV = 'test';
  let mod: CryptoModule | undefined;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('./crypto') as CryptoModule;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nest = require('@nestjs/common') as typeof import('@nestjs/common');
    isolatedLogger = nest.Logger;
  });
  return mod!;
}

/** Две «базы»: данные, записанные ключом A, читает процесс с ключом B. */
function foreign() {
  const a = load(KEY_A);
  const stored = {
    id: 5,
    text: a.encrypt('секретная заметка')!,
    items: a.encryptJson(['abandonment', 'defectiveness']),
  };
  const b = load(KEY_B);
  const err = jest
    .spyOn(isolatedLogger.prototype, 'error')
    .mockImplementation(() => undefined);
  return { a, b, stored, err };
}

const SCHEMA = { strings: ['text'], jsonArrays: ['items'] };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  jest.restoreAllMocks();
});

describe('tryDecrypt: расшифровка без побочных эффектов', () => {
  it('свой ключ → ok с текстом', () => {
    const { encrypt, tryDecrypt } = load(KEY_A);
    expect(tryDecrypt(encrypt('привет'))).toEqual({ ok: true, text: 'привет' });
  });

  it('чужой ключ → не ok и looksCipher: true, в лог не пишет', () => {
    const { stored, b, err } = foreign();
    expect(b.tryDecrypt(stored.text)).toEqual({ ok: false, looksCipher: true });
    expect(err).not.toHaveBeenCalled();
  });

  it.each([
    [
      'легаси-текст с пробелами и кириллицей',
      'обычная заметка из старых времён',
    ],
    ['короткая строка', 'abc'],
    ['пусто', ''],
    ['null', null],
  ])('%s → не ok и looksCipher: false', (_n, value) => {
    const { tryDecrypt } = load(KEY_A);
    expect(tryDecrypt(value)).toEqual({ ok: false, looksCipher: false });
  });

  it('без ключей ничего не расшифровать, но и тревоги нет', () => {
    const blob = load(KEY_A).encrypt('текст')!;
    const { tryDecrypt } = load('');
    expect(tryDecrypt(blob)).toEqual({ ok: false, looksCipher: false });
  });

  it('decrypt() по-прежнему возвращает value при провале и логирует (контракт для encrypt-if-plain и ротации)', () => {
    const { stored, b, err } = foreign();
    expect(b.decrypt(stored.text)).toBe(stored.text);
    expect(err).toHaveBeenCalledTimes(1);
  });
});

describe('decryptRecord: провал расшифровки — явный исход, а не строка вместо массива', () => {
  it('jsonArrays под чужим ключом → [] и маркер, а не base64-блоб', () => {
    const { stored, b } = foreign();
    const row = b.decryptRecord(stored, SCHEMA);
    expect(row.items).toEqual([]);
    expect(Array.isArray(row.items)).toBe(true);
    expect(b.unreadableFields(row)).toEqual(['text', 'items']);
  });

  it('строковое поле под чужим ключом: прежнее сырое значение (fail-open), но в маркере', () => {
    const { stored, b } = foreign();
    const row = b.decryptRecord(stored, { strings: ['text'] });
    expect(row.text).toBe(stored.text);
    expect(b.unreadableFields(row)).toEqual(['text']);
  });

  it('свой ключ: всё читается, маркера нет, тревоги нет', () => {
    const a = load(KEY_A);
    const err = jest
      .spyOn(isolatedLogger.prototype, 'error')
      .mockImplementation(() => undefined);
    const data = { id: 1, text: 'заметка', items: ['a', 'b'] };
    const row = a.decryptRecord(a.encryptRecord(data, SCHEMA), SCHEMA);
    expect(row).toEqual(data);
    expect(a.unreadableFields(row)).toEqual([]);
    expect(err).not.toHaveBeenCalled();
  });

  it('контроль: легаси-plaintext (текст, JSON-строка, готовый массив) — не провал', () => {
    const a = load(KEY_A);
    const err = jest
      .spyOn(isolatedLogger.prototype, 'error')
      .mockImplementation(() => undefined);
    const rows = [
      { text: 'старая заметка с пробелами', items: '["x","y"]' },
      { text: 'ещё одна', items: ['уже', 'массив'] },
      { text: null, items: null },
      { text: '', items: 7 },
    ];
    for (const r of rows) {
      expect(a.unreadableFields(a.decryptRecord(r, SCHEMA))).toEqual([]);
    }
    expect(a.decryptRecord(rows[0], SCHEMA).items).toEqual(['x', 'y']);
    expect(err).not.toHaveBeenCalled();
  });

  it.each([
    ['строка не JSON и не шифротекст', 'просто слова'],
    ['JSON null в строке', 'null'],
  ])(
    'jsonArrays: %s → [] и маркер (строка в роли списка недопустима)',
    (_n, v) => {
      const a = load(KEY_A);
      jest
        .spyOn(isolatedLogger.prototype, 'error')
        .mockImplementation(() => undefined);
      const row = a.decryptRecord({ items: v }, { jsonArrays: ['items'] });
      expect(row.items).toEqual([]);
      expect(a.unreadableFields(row)).toEqual(['items']);
    },
  );

  it.each(['не json', 'null'])(
    'jsonArrays: расшифровалось, но внутри %s → [] и маркер',
    (inner) => {
      const a = load(KEY_A);
      jest
        .spyOn(isolatedLogger.prototype, 'error')
        .mockImplementation(() => undefined);
      const row = a.decryptRecord(
        { items: a.encrypt(inner) },
        { jsonArrays: ['items'] },
      );
      expect(row.items).toEqual([]);
      expect(a.unreadableFields(row)).toEqual(['items']);
    },
  );

  it('маркер переживает {...row}, не виден в ключах и в JSON', () => {
    const { stored, b } = foreign();
    const row = b.decryptRecord(stored, SCHEMA);
    expect(b.unreadableFields({ ...row })).toEqual(['text', 'items']);
    expect(Object.keys(row)).toEqual(['id', 'text', 'items']);
    expect(JSON.parse(JSON.stringify(row))).toEqual({
      id: 5,
      text: stored.text,
      items: [],
    });
  });

  it('повторное чтение уже помеченной строки дописывает, а не теряет маркер', () => {
    const { stored, b } = foreign();
    const once = b.decryptRecord(stored, { strings: ['text'] });
    const twice = b.decryptRecord(once, { jsonArrays: ['items'] });
    expect(b.unreadableFields(twice)).toEqual(['text', 'items']);
  });

  it('маркер узнаётся между копиями модуля (Symbol.for, не Symbol)', () => {
    const { stored, b } = foreign();
    const row = b.decryptRecord(stored, SCHEMA);
    const other = load(KEY_B);
    expect(other.unreadableFields(row)).toEqual(['text', 'items']);
  });

  it('ключ маркера — Symbol.for с фиксированным именем (контракт между копиями модуля)', () => {
    const { stored, b } = foreign();
    const row = b.decryptRecord(stored, SCHEMA);
    const key = Symbol.for('schema-botnest.unreadableFields');
    expect((row as Record<symbol, unknown>)[key]).toEqual(['text', 'items']);
  });

  it('шифротекстоподобная строка в jsonArrays не читается как JSON, даже если по виду это число', () => {
    // 48 цифр — строгий base64 длиной ≥29 байт, то есть «похоже на шифротекст»,
    // и при этом валидный JSON. Принять её за легаси-значение нельзя.
    const a = load(KEY_A);
    jest
      .spyOn(isolatedLogger.prototype, 'error')
      .mockImplementation(() => undefined);
    const row = a.decryptRecord({ items: '1'.repeat(48) }, SCHEMA);
    expect(row.items).toEqual([]);
    expect(a.unreadableFields(row)).toEqual(['items']);
  });

  it('поля вне схемы не расшифровываются, даже если в них лежит шифротекст', () => {
    const a = load(KEY_A);
    const blob = a.encrypt('секрет')!;
    const json = a.encryptJson(['x'])!;
    const row = { 'Stryker was here': blob, other: json };
    expect(a.decryptRecord(row, {})).toEqual(row);
    expect(a.decryptRecord(row, { strings: ['text'] })).toEqual(row);
    expect(a.decryptRecord(row, { jsonArrays: ['items'] })).toEqual(row);
  });

  it('unreadableFields у обычного объекта — пустой список', () => {
    expect(load(KEY_A).unreadableFields({ a: 1 })).toEqual([]);
  });
});

describe('decryptRecord: один троттлированный error с таблицей, колонкой и счётом', () => {
  const T0 = 1_700_000_000_000;

  it('в сообщении: таблица.поле, счёт, ни шифротекста, ни содержимого; ровно один error (без двойного DM от decrypt)', () => {
    const { stored, b, err } = foreign();
    jest.spyOn(Date, 'now').mockReturnValue(T0);
    b.decryptRecord(stored, { ...SCHEMA, model: 'note' });
    expect(err).toHaveBeenCalledTimes(1);
    const msg = String(err.mock.calls[0][0]);
    expect(msg).toContain('не прочиталось значений: 2');
    expect(msg).toContain('(note.text, note.items)');
    expect(msg).toContain('неполная ротация ENCRYPTION_KEY');
    expect(msg).toContain('encryptionReadable');
    expect(msg).not.toContain(stored.text);
    expect(msg).not.toContain(stored.items!);
    expect(msg).not.toContain('секретная');
    const logger = err.mock.contexts[0] as unknown as { context: string };
    expect(logger.context).toBe('Crypto');
  });

  it('без model в сообщении только имя поля, без выдуманной таблицы', () => {
    const { stored, b, err } = foreign();
    jest.spyOn(Date, 'now').mockReturnValue(T0);
    b.decryptRecord(stored, { strings: ['text'] });
    expect(String(err.mock.calls[0][0])).toContain('значений: 1 (text)');
  });

  it('за минуту — одно сообщение; следующее копит и называет счёт за окно', () => {
    const { stored, b, err } = foreign();
    const now = jest.spyOn(Date, 'now').mockReturnValue(T0);
    const schema = { strings: ['text'], model: 'note' };
    b.decryptRecord(stored, schema);
    b.decryptRecord(stored, schema);
    b.decryptRecord(stored, { jsonArrays: ['items'], model: 'user' });
    expect(err).toHaveBeenCalledTimes(1);

    now.mockReturnValue(T0 + 59_999);
    b.decryptRecord(stored, schema);
    expect(err).toHaveBeenCalledTimes(1);

    now.mockReturnValue(T0 + 60_000); // ровно минута — уже можно
    b.decryptRecord(stored, schema);
    expect(err).toHaveBeenCalledTimes(2);
    const msg = String(err.mock.calls[1][0]);
    // первый вызов ушёл сразу; накоплено: второй + третий + 59 999 мс + этот = 4
    expect(msg).toContain('не прочиталось значений: 4');
    expect(msg).toContain('note.text');
    expect(msg).toContain('user.items');

    // счётчик обнулился: следующее окно считает с нуля
    now.mockReturnValue(T0 + 130_000);
    b.decryptRecord(stored, schema);
    expect(String(err.mock.calls[2][0])).toContain(
      'не прочиталось значений: 1',
    );
    expect(String(err.mock.calls[2][0])).not.toContain('user.items');
  });

  it('список колонок в сообщении ограничен десятью', () => {
    const { stored, b, err } = foreign();
    jest.spyOn(Date, 'now').mockReturnValue(T0);
    const row: Record<string, unknown> = {};
    const fields = Array.from({ length: 12 }, (_, i) => `f${i}`);
    for (const f of fields) row[f] = stored.text;
    b.decryptRecord(row, { strings: fields, model: 'm' });
    const msg = String(err.mock.calls[0][0]);
    expect(msg).toContain('значений: 12');
    expect(msg).toContain('m.f9');
    expect(msg).not.toContain('m.f10');
  });
});
