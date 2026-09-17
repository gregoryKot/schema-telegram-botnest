// Одноразовая дошифровка исторических строк (аудит 2026-07-20, волна 2).
// Крипто-модуль читает ENCRYPTION_KEY на загрузке, поэтому сервис и crypto
// подгружаются через resetModules+require ПОСЛЕ установки ключа — иначе
// encrypt() в тестовом окружении был бы identity и тест ничего не проверял.
import type { Logger as LoggerType } from '@nestjs/common';
import type { EncryptionWave2Service } from './encryption-wave2.service';

type Row = Record<string, unknown>;
type Ctor = new (prisma: unknown) => EncryptionWave2Service;

let ServiceCtor: Ctor;
let decryptFn: (v: string | null | undefined) => string | null;
let encryptFn: (v: string | null | undefined) => string | null;
let LoggerCtor: typeof LoggerType;

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

  // Logger тоже должен быть той же копией модуля, что видит уже
  // зареквайренный (после resetModules) encryption-wave2.service — иначе
  // spyOn(Logger.prototype, …) бьёт мимо: сервис логирует через СВОЙ
  // экземпляр класса Logger из другого module-registry снапшота.
  const nestCommon =
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@nestjs/common') as typeof import('@nestjs/common');
  LoggerCtor = nestCommon.Logger;
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

  it('data/answers === null — encJsonIf возвращает null, update не вызывается', async () => {
    const db = makeDb({
      diaryDraft: [{ userId: 2n, type: 'mode', data: null }],
      ysqProgress: [{ userId: 2n, answers: null }],
      ysqResultHistory: [{ id: 9, answers: null }],
    });
    const total = await svc(db).run();

    expect(total).toBe(0);
    expect(db.diaryDraft.update).not.toHaveBeenCalled();
    expect(db.ysqProgress.update).not.toHaveBeenCalled();
    expect(db.ysqResultHistory.update).not.toHaveBeenCalled();
  });

  it('data/answers уже зашифрованная JSON-строка — не трогает (идемпотентность Json-полей)', async () => {
    const encBlob = encryptFn(JSON.stringify({ x: 1 }))!;
    const db = makeDb({
      diaryDraft: [{ userId: 3n, type: 'schema', data: encBlob }],
      ysqResult: [{ userId: 3n, answers: encBlob }],
    });
    const total = await svc(db).run();

    expect(total).toBe(0);
    expect(db.diaryDraft.update).not.toHaveBeenCalled();
    expect(db.ysqResult.update).not.toHaveBeenCalled();
  });

  it('ysqProgress/ysqResultHistory: plaintext-строки шифруются как и остальные таблицы', async () => {
    const db = makeDb({
      ysqProgress: [{ userId: 4n, answers: [0, 1, 2] }],
      ysqResultHistory: [{ id: 10, answers: [3, 4, 5] }],
    });
    const total = await svc(db).run();

    expect(total).toBe(2);
    const progressBlob = (
      db.ysqProgress.update.mock.calls[0][0] as Row & {
        data: { answers: string };
      }
    ).data.answers;
    expect(JSON.parse(decryptFn(progressBlob)!)).toEqual([0, 1, 2]);

    const historyBlob = (
      db.ysqResultHistory.update.mock.calls[0][0] as Row & {
        data: { answers: string };
      }
    ).data.answers;
    expect(JSON.parse(decryptFn(historyBlob)!)).toEqual([3, 4, 5]);
  });

  it('therapyRelation: уже зашифрованные alias не трогает (skip-ветка per-row)', async () => {
    const db = makeDb({
      therapyRelation: [
        {
          id: 8,
          clientAlias: encryptFn('Уже шифровано')!,
          virtualClientName: null,
        },
      ],
    });
    const total = await svc(db).run();

    expect(total).toBe(0);
    expect(db.therapyRelation.update).not.toHaveBeenCalled();
  });

  it('onApplicationBootstrap: успешный run() ставит флаг молча, без ошибки в логе', async () => {
    const errorSpy = jest
      .spyOn(LoggerCtor.prototype, 'error')
      .mockImplementation(() => undefined);
    const db = makeDb({ emailToken: [{ id: 't1', email: 'plain@b.com' }] });
    await svc(db).onApplicationBootstrap();

    expect(errorSpy.mock.calls).toEqual([]);
    const flagArgs = db.bookingSetting.upsert.mock.calls[0][0] as Row & {
      where: { key: string };
    };
    expect(flagArgs.where.key).toBe('encryption_wave2_done');
    errorSpy.mockRestore();
  });

  it('onApplicationBootstrap: run() падает Error-объектом — логируется, не пробрасывается', async () => {
    const errorSpy = jest
      .spyOn(LoggerCtor.prototype, 'error')
      .mockImplementation(() => undefined);
    const db = makeDb();
    db.bookingSetting.findUnique.mockRejectedValueOnce(new Error('DB down'));
    const instance = svc(db);

    await expect(instance.onApplicationBootstrap()).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('encryption wave2 failed: DB down'),
    );
    errorSpy.mockRestore();
  });

  it('onApplicationBootstrap: run() падает НЕ-Error значением — тоже логируется, не пробрасывается', async () => {
    const errorSpy = jest
      .spyOn(LoggerCtor.prototype, 'error')
      .mockImplementation(() => undefined);
    const db = makeDb();
    db.bookingSetting.findUnique.mockRejectedValueOnce('db-string-failure');
    const instance = svc(db);

    await expect(instance.onApplicationBootstrap()).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('encryption wave2 failed: db-string-failure'),
    );
    errorSpy.mockRestore();
  });
});
