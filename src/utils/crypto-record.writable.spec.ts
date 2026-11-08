// Мутационная зона волны А (scripts/mutation-golden-auth-baseline.json):
// выжившие crypto-record.ts — текст ответа 409 и предупреждения в лог, их не
// проверял ни один спек; выжившие crypto.ts — граница «не наш формат» в
// tryDecrypt (buf.length < 29), ветка не-строки и `?? null` в decrypt().
// Остались два эквивалентных мутанта (не убиваются никаким входом):
// `{ authTagLength: 16 }` → `{}` у createDecipheriv (тег всегда 16 байт) и
// 'utf8' → '' у decipher.final (пустой буфер GCM в строке — '').
//
// Ключи читаются модулем один раз при загрузке, поэтому каждый сценарий берёт
// свежую копию через jest.isolateModules (как crypto.spec.ts); crypto,
// crypto-record и Nest — из одного реестра, иначе спай на Logger и instanceof
// смотрели бы на чужие классы.
import { createCipheriv, randomBytes } from 'crypto';

type CryptoModule = typeof import('./crypto');
type RecordModule = typeof import('./crypto-record');
type NestCommon = typeof import('@nestjs/common');

const KEY_A = 'aa'.repeat(32);
const KEY_B = 'bb'.repeat(32);
const ORIGINAL_ENV = { ...process.env };
const SCHEMA = { strings: ['text'], jsonArrays: ['items'] };

function load(key: string) {
  process.env.ENCRYPTION_KEY = key;
  process.env.ENCRYPTION_KEY_OLD = '';
  process.env.NODE_ENV = 'test';
  let mods: { c: CryptoModule; r: RecordModule; nest: NestCommon } | undefined;
  jest.isolateModules(() => {
    /* eslint-disable @typescript-eslint/no-require-imports */
    mods = {
      c: require('./crypto') as CryptoModule,
      r: require('./crypto-record') as RecordModule,
      nest: require('@nestjs/common') as NestCommon,
    };
    /* eslint-enable @typescript-eslint/no-require-imports */
  });
  return mods!;
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  jest.restoreAllMocks();
});

describe('assertWritable / guardOverwrite: запись поверх нечитаемого — 409 с точным текстом', () => {
  const MESSAGE =
    'Правка не сохранена: записанные данные сейчас не читаются, и новая ' +
    'запись стёрла бы их. Нужна помощь владельца проекта.';

  /** Строка, записанная ключом A, в процессе с ключом B, и спай на warn. */
  function setup() {
    const { c: a } = load(KEY_A);
    const stored = {
      id: 5,
      text: a.encrypt('секретная заметка')!,
      items: a.encryptJson(['abandonment']),
    };
    const b = load(KEY_B);
    jest
      .spyOn(b.nest.Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const warn = jest
      .spyOn(b.nest.Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    return { b, stored, warn };
  }

  function caught(fn: () => void): unknown {
    try {
      fn();
    } catch (e) {
      return e;
    }
    throw new Error('ожидалось исключение');
  }

  it('нечитаемое поле среди записываемых → 409 { message, reason }, warn с местом и полями', () => {
    const { b, stored, warn } = setup();
    const row = b.r.decryptRecord({ ...stored }, SCHEMA);
    const e = caught(() =>
      b.r.assertWritable(row, ['text', 'items'], 'Note.update'),
    );
    expect(e).toBeInstanceOf(b.nest.ConflictException);
    const conflict = e as InstanceType<NestCommon['ConflictException']>;
    expect(conflict.getStatus()).toBe(409);
    expect(conflict.getResponse()).toEqual({
      message: MESSAGE,
      reason: 'unreadable_data',
    });
    expect(b.r.UNWRITABLE_REASON).toBe('unreadable_data');
    expect(warn.mock.calls).toEqual([
      [
        '[crypto] запись отклонена (409): Note.update, не читаются: text, items; ' +
          'запись затёрла бы нечитаемый шифротекст',
      ],
    ]);
  });

  it('нечитаемое поле, которое запись не трогает, — не помеха: ни 409, ни warn', () => {
    const { b, stored, warn } = setup();
    const row = b.r.decryptRecord({ ...stored, title: 'открытое' }, SCHEMA);
    expect(() =>
      b.r.assertWritable(row, ['title'], 'Note.update'),
    ).not.toThrow();
    expect(warn).not.toHaveBeenCalled();
  });

  it('всё читается своим ключом — запись проходит без warn', () => {
    const b = load(KEY_A);
    const warn = jest
      .spyOn(b.nest.Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const stored = { id: 1, text: b.c.encrypt('заметка')! };
    expect(() =>
      b.r.guardOverwrite(stored, SCHEMA, { text: 'новое' }, 'Note.update'),
    ).not.toThrow();
    expect(warn).not.toHaveBeenCalled();
  });

  it('guardOverwrite берёт поля из ключей записи и сам расшифровывает строку', () => {
    const { b, stored, warn } = setup();
    const e = caught(() =>
      b.r.guardOverwrite(
        { ...stored },
        SCHEMA,
        { text: 'новое' },
        'Diary.save',
      ),
    );
    expect((e as { getStatus(): number }).getStatus()).toBe(409);
    expect(warn.mock.calls).toEqual([
      [
        '[crypto] запись отклонена (409): Diary.save, не читаются: text; ' +
          'запись затёрла бы нечитаемый шифротекст',
      ],
    ]);
  });
});

describe('tryDecrypt: граница формата iv(12) + тег(16) + ≥1 байт данных', () => {
  /** Настоящий GCM-блоб под KEY_A: пустой текст даёт ровно 28 байт. */
  function gcm(text: string): string {
    const iv = randomBytes(12);
    const c = createCipheriv('aes-256-gcm', Buffer.from(KEY_A, 'hex'), iv, {
      authTagLength: 16,
    });
    const enc = Buffer.concat([c.update(text, 'utf8'), c.final()]);
    return Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64');
  }

  it('28 байт с верным тегом (пустой текст) — «не наш формат», а не ok с пустой строкой', () => {
    const { c } = load(KEY_A);
    const blob = gcm('');
    expect(Buffer.from(blob, 'base64')).toHaveLength(28);
    expect(c.tryDecrypt(blob)).toEqual({ ok: false, looksCipher: false });
  });

  it('29 байт (один байт текста) — уже наш формат и расшифровывается', () => {
    const { c } = load(KEY_A);
    expect(c.tryDecrypt(gcm('x'))).toEqual({ ok: true, text: 'x' });
  });

  // decrypt(): контракт «пусто на входе — пусто на выходе», undefined → null
  // (а не undefined: так его ждут `?? null` у вызывающих и JSON-ответы).
  it('decrypt(undefined) — строго null, пустая строка — как есть, без расшифровки', () => {
    const { c } = load(KEY_A);
    expect(c.decrypt(undefined)).toBeNull();
    expect(c.decrypt(null)).toBeNull();
    expect(c.decrypt('')).toBe('');
  });

  it('не-строка (число из легаси-JSON) не роняет расшифровку', () => {
    const { c } = load(KEY_A);
    expect(c.tryDecrypt(12345 as unknown as string)).toEqual({
      ok: false,
      looksCipher: false,
    });
  });
});
