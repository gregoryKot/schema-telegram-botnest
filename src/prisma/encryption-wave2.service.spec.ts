// Одноразовая дошифровка исторических строк (аудит 2026-07-20, волна 2).
// Крипто-модуль читает ENCRYPTION_KEY на загрузке, поэтому сервис и crypto
// подгружаются через resetModules+require ПОСЛЕ установки ключа — иначе
// encrypt() в тестовом окружении был бы identity и тест ничего не проверял.
import type { EncryptionWave2Service } from './encryption-wave2.service';

type Row = Record<string, unknown>;
type Ctor = new (prisma: unknown) => EncryptionWave2Service;

let ServiceCtor: Ctor;
let decryptFn: (v: string | null | undefined) => string | null;
let encryptFn: (v: string | null | undefined) => string | null;

beforeAll(() => {
  process.env.ENCRYPTION_KEY = 'ab'.repeat(32);
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const svcMod = require('./encryption-wave2.service') as {
    EncryptionWave2Service: Ctor;
  };
  ServiceCtor = svcMod.EncryptionWave2Service;

  const cryptoMod =
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('../utils/crypto') as typeof import('../utils/crypto');
  decryptFn = cryptoMod.decrypt;
  encryptFn = cryptoMod.encrypt;
});

function makeDb(seed: Partial<Record<string, Row[]>> = {}) {
  const delegate = (name: string) => ({
    findMany: jest.fn(() => Promise.resolve(seed[name] ?? [])),
    update: jest.fn((args: Row) => Promise.resolve(args)),
  });
  return {
    diaryDraft: delegate('diaryDraft'),
    ysqProgress: delegate('ysqProgress'),
    ysqResult: delegate('ysqResult'),
    ysqResultHistory: delegate('ysqResultHistory'),
    therapistRequest: delegate('therapistRequest'),
    therapyRelation: delegate('therapyRelation'),
    emailToken: delegate('emailToken'),
    bookingSetting: {
      findUnique: jest.fn(() => Promise.resolve(null as Row | null)),
      upsert: jest.fn((args: Row) => Promise.resolve(args)),
    },
  };
}

const svc = (db: ReturnType<typeof makeDb>) => new ServiceCtor(db);

describe('EncryptionWave2Service — дошифровка исторических plaintext-строк', () => {
  it('plaintext-строки шифруются (round-trip через decrypt), флаг ставится', async () => {
    const db = makeDb({
      diaryDraft: [
        { userId: 1n, type: 'schema', data: { trigger: 'поссорился' } },
      ],
      ysqResult: [{ userId: 1n, answers: [1, 2, 3] }],
      therapistRequest: [
        {
          id: 5,
          fullName: 'Анна Иванова',
          qualification:
            'КПТ, схема-терапия — длинный латинский текст ABCDEFGH',
          contacts: '@anna',
          message: null,
        },
      ],
      therapyRelation: [
        { id: 7, clientAlias: 'Оля (перенос)', virtualClientName: null },
      ],
      emailToken: [{ id: 't1', email: 'someone@example.com' }],
    });
    const total = await svc(db).run();

    expect(total).toBe(5);

    const draftBlob = (
      db.diaryDraft.update.mock.calls[0][0] as Row & {
        data: { data: string };
      }
    ).data.data;
    expect(typeof draftBlob).toBe('string');
    expect(JSON.parse(decryptFn(draftBlob)!)).toEqual({
      trigger: 'поссорился',
    });

    const ysqBlob = (
      db.ysqResult.update.mock.calls[0][0] as Row & {
        data: { answers: string };
      }
    ).data.answers;
    expect(JSON.parse(decryptFn(ysqBlob)!)).toEqual([1, 2, 3]);

    const reqData = (
      db.therapistRequest.update.mock.calls[0][0] as Row & {
        data: Record<string, string>;
      }
    ).data;
    expect(decryptFn(reqData.fullName)).toBe('Анна Иванова');
    expect(reqData.fullName).not.toBe('Анна Иванова');

    const relData = (
      db.therapyRelation.update.mock.calls[0][0] as Row & {
        data: Record<string, string>;
      }
    ).data;
    expect(decryptFn(relData.clientAlias)).toBe('Оля (перенос)');

    const tokData = (
      db.emailToken.update.mock.calls[0][0] as Row & {
        data: { email: string };
      }
    ).data;
    expect(decryptFn(tokData.email)).toBe('someone@example.com');

    expect(db.bookingSetting.upsert).toHaveBeenCalledTimes(1);
  });

  it('уже зашифрованные строки не трогает (идемпотентность)', async () => {
    const db = makeDb({
      therapistRequest: [
        {
          id: 1,
          fullName: encryptFn('Анна')!,
          qualification: encryptFn('КПТ')!,
          contacts: encryptFn('@a')!,
          message: null,
        },
      ],
      emailToken: [{ id: 't1', email: encryptFn('a@b.com')! }],
    });
    const total = await svc(db).run();

    expect(total).toBe(0);
    expect(db.therapistRequest.update).not.toHaveBeenCalled();
    expect(db.emailToken.update).not.toHaveBeenCalled();
    // Флаг всё равно ставится — повторный старт не сканирует таблицы заново.
    expect(db.bookingSetting.upsert).toHaveBeenCalledTimes(1);
  });

  it('флаг уже стоит → таблицы не сканируются вообще', async () => {
    const db = makeDb({ emailToken: [{ id: 't1', email: 'plain@b.com' }] });
    db.bookingSetting.findUnique.mockResolvedValueOnce({
      key: 'encryption_wave2_done',
      value: '2026-07-20',
    });
    const total = await svc(db).run();

    expect(total).toBe(0);
    expect(db.emailToken.findMany).not.toHaveBeenCalled();
    expect(db.bookingSetting.upsert).not.toHaveBeenCalled();
  });

  it('без ENCRYPTION_KEY — полный no-op (dev/CI)', async () => {
    const saved = process.env.ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY;
    try {
      const db = makeDb({ emailToken: [{ id: 't1', email: 'plain@b.com' }] });
      const total = await svc(db).run();
      expect(total).toBe(0);
      expect(db.bookingSetting.findUnique).not.toHaveBeenCalled();
    } finally {
      process.env.ENCRYPTION_KEY = saved;
    }
  });
});
