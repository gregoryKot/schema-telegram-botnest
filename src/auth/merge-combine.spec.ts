// R3 (аудит 2026-11): слияние аккаунтов молча удаляло запись источника, если у
// цели была запись с тем же ключом (заметка и благодарность за день, карточка
// схемы/режима, безопасное место, итог теста). Здесь — «сохранил в обоих →
// после слияния у цели оба» на настоящих шифротекстах: строки пишутся
// encrypt/encryptJson, как их пишет продукт, читаются decrypt — как читает.
// Живая база — test/merge-unique-rules.e2e-spec.ts.
//
// ENCRYPTION_KEY — до импорта crypto (ключ читается при загрузке модуля).
process.env.ENCRYPTION_KEY = 'ab'.repeat(32);

import { Logger } from '@nestjs/common';
import { decrypt, decryptJson, encrypt, encryptJson } from '../utils/crypto';
import {
  COMBINE_TABLES,
  combineConflicts,
  countCombinable,
  type CombineDb,
} from './merge-combine';
import { MergeService, UNIQUE_RULES, USER_OWNED_TABLES } from './merge.service';

const SRC = 111n;
const TGT = 222n;
const OTHER = 333n;
const D = '2026-03-01';
const T0 = new Date('2026-03-01T10:00:00Z');
const T1 = new Date('2026-03-02T10:00:00Z');
// Похоже на шифротекст (строгий base64, ≥29 байт), но ни один ключ не подходит.
const FOREIGN = Buffer.alloc(40, 7).toString('base64');

type Row = Record<string, unknown> & { userId: bigint };
type Where = Record<string, unknown> & { userId?: bigint | { in: bigint[] } };
const owns = (w: Where['userId'], id: bigint) =>
  w === undefined || (typeof w === 'bigint' ? w === id : w.in.includes(id));

type Range = { gte: Date; lte: Date };
const within = (d: Date, r: unknown) =>
  d >= (r as Range).gte && d <= (r as Range).lte;

/** Таблица в памяти с теми вызовами делегата, что делает merge-combine.ts. */
function table(rows: Row[], pk: 'id' | 'userId' = 'id') {
  const pick = (w: Where) =>
    rows.filter(
      (r) =>
        owns(w.userId, r.userId) &&
        (!w.completedAt || within(r.completedAt as Date, w.completedAt)),
    );
  return {
    rows,
    findMany: jest.fn(({ where }: { where: Where }) =>
      Promise.resolve(pick(where)),
    ),
    findFirst: jest.fn(({ where }: { where: Where }) =>
      Promise.resolve(pick(where)[0] ?? null),
    ),
    update: jest.fn(
      ({ where, data }: { where: Row; data: Record<string, unknown> }) => {
        const row = rows.find((r) => r[pk] === where[pk])!;
        return Promise.resolve(Object.assign(row, data));
      },
    ),
    create: jest.fn(({ data }: { data: Row }) => {
      rows.push(data);
      return Promise.resolve(data);
    }),
  };
}

function makeDb(seed: Partial<Record<string, Row[]>> = {}) {
  const db = {
    note: table(seed.note ?? []),
    gratitudeDiaryEntry: table(seed.gratitudeDiaryEntry ?? []),
    userSchemaNote: table(seed.userSchemaNote ?? []),
    userModeNote: table(seed.userModeNote ?? []),
    userSafePlace: table(seed.userSafePlace ?? [], 'userId'),
    ysqResult: table(seed.ysqResult ?? [], 'userId'),
    ysqResultHistory: table(seed.ysqResultHistory ?? []),
  };
  return { db, tx: db as unknown as CombineDb };
}

const note = (id: number, userId: bigint, text: string, tags = '') => ({
  id,
  userId,
  date: D,
  text: encrypt(text) ?? text,
  tags: encrypt(tags) ?? tags,
});

describe('реестр объединяемых таблиц (правило №4)', () => {
  it('каждая — таблица UNIQUE_RULES и USER_OWNED_TABLES', () => {
    const ruled = UNIQUE_RULES.map((r) => r.table);
    const owned: readonly string[] = USER_OWNED_TABLES;
    for (const t of COMBINE_TABLES) {
      expect(ruled).toContain(t);
      expect(owned).toContain(t);
    }
    expect([...COMBINE_TABLES].sort()).toEqual(
      [
        'GratitudeDiaryEntry',
        'Note',
        'UserModeNote',
        'UserSafePlace',
        'UserSchemaNote',
        'YsqResult',
      ].sort(),
    );
  });
});

describe('Note — заметка за один день', () => {
  it('у цели текст обоих (цель, пустая строка, источник), метки объединены', async () => {
    const { db, tx } = makeDb({
      note: [
        note(1, TGT, 'Устала', 'work'),
        note(2, SRC, 'Поспала днём', 'sleep,work'),
        { ...note(3, SRC, 'Другой день'), date: '2026-03-05' },
        note(4, OTHER, 'Чужая'),
      ],
    });
    const out = await combineConflicts(tx, SRC, TGT);
    expect(out).toEqual({ combined: 1, unreadable: 0 });
    const [t] = db.note.rows;
    expect(decrypt(t.text as string)).toBe('Устала\n\nПоспала днём');
    expect(decrypt(t.tags as string)).toBe('work,sleep');
    expect(t.text).not.toContain('Устала'); // в колонке — шифротекст
    expect(db.note.update).toHaveBeenCalledTimes(1);
  });

  it('пустая заметка цели — текст источника', async () => {
    const { db, tx } = makeDb({
      note: [note(1, TGT, ''), note(2, SRC, 'Поспала днём')],
    });
    await combineConflicts(tx, SRC, TGT);
    expect(decrypt(db.note.rows[0].text as string)).toBe('Поспала днём');
  });

  it('нечитаемый шифротекст (ключ не подошёл) — цель не трогаем, считаем', async () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { db, tx } = makeDb({
      note: [
        { ...note(1, TGT, 'x'), text: FOREIGN },
        note(2, SRC, 'Поспала днём'),
      ],
    });
    const out = await combineConflicts(tx, SRC, TGT);
    expect(out).toEqual({ combined: 0, unreadable: 1 });
    expect(db.note.update).not.toHaveBeenCalled();
    expect(db.note.rows[0].text).toBe(FOREIGN);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Note'));
    jest.restoreAllMocks();
  });
});

describe('GratitudeDiaryEntry — благодарности за один день', () => {
  it('пункты обоих, без повторов; легаси-массив без шифра тоже читается', async () => {
    const { db, tx } = makeDb({
      gratitudeDiaryEntry: [
        { id: 1, userId: TGT, date: D, items: encryptJson(['чай', 'солнце']) },
        { id: 2, userId: SRC, date: D, items: ['солнце', 'звонок'] },
      ],
    });
    expect(await combineConflicts(tx, SRC, TGT)).toEqual({
      combined: 1,
      unreadable: 0,
    });
    const items = db.gratitudeDiaryEntry.rows[0].items as string;
    expect(decryptJson<string[]>(items)).toEqual(['чай', 'солнце', 'звонок']);
  });
});

describe('UserSchemaNote / UserModeNote — карточки', () => {
  it('схема: пустые поля цели заполнены источником, заполненные не тронуты', async () => {
    const { db, tx } = makeDb({
      userSchemaNote: [
        {
          id: 1,
          userId: TGT,
          schemaId: 'abandonment',
          triggers: encrypt('уходят'),
          feelings: '',
        },
        {
          id: 2,
          userId: SRC,
          schemaId: 'abandonment',
          triggers: encrypt('молчат'),
          feelings: encrypt('страх'),
        },
      ],
    });
    await combineConflicts(tx, SRC, TGT);
    const [t] = db.userSchemaNote.rows;
    expect(decrypt(t.triggers as string)).toBe('уходят');
    expect(decrypt(t.feelings as string)).toBe('страх');
    const { data } = db.userSchemaNote.update.mock.calls[0][0];
    expect(Object.keys(data)).toEqual(['feelings']);
  });

  it('режим: то же для полей режима (alias, fear)', async () => {
    const { db, tx } = makeDb({
      userModeNote: [
        {
          id: 1,
          userId: TGT,
          modeId: 'vulnerable-child',
          alias: '',
          fear: encrypt('один'),
        },
        {
          id: 2,
          userId: SRC,
          modeId: 'vulnerable-child',
          alias: encrypt('Малыш'),
          fear: encrypt('брошу'),
        },
      ],
    });
    await combineConflicts(tx, SRC, TGT);
    const [t] = db.userModeNote.rows;
    expect(decrypt(t.alias as string)).toBe('Малыш');
    expect(decrypt(t.fear as string)).toBe('один');
  });
});

describe('UserSafePlace — безопасное место', () => {
  const place = (userId: bigint, text: string, updatedAt: Date) => ({
    userId,
    description: encrypt(text) ?? text,
    updatedAt,
  });

  it.each([
    ['источник свежее', T0, T1, 'лес'],
    ['цель свежее', T1, T0, 'море'],
  ])('%s — остаётся более свежее описание', async (_, tAt, sAt, kept) => {
    const { db, tx } = makeDb({
      userSafePlace: [place(TGT, 'море', tAt), place(SRC, 'лес', sAt)],
    });
    await combineConflicts(tx, SRC, TGT);
    const t = db.userSafePlace.rows.find((r) => r.userId === TGT)!;
    expect(decrypt(t.description as string)).toBe(kept);
  });

  it('свежее пустое — дополняется старым', async () => {
    const { db, tx } = makeDb({
      userSafePlace: [place(TGT, 'море', T0), place(SRC, '', T1)],
    });
    await combineConflicts(tx, SRC, TGT);
    expect(decrypt(db.userSafePlace.rows[0].description as string)).toBe(
      'море',
    );
  });
});

describe('YsqResult — итог теста', () => {
  const result = (userId: bigint, n: number, completedAt: Date) => ({
    userId,
    answers: encryptJson([n]),
    completedAt,
  });

  it('источник свежее: итог цели — источника, прежний итог цели — в истории', async () => {
    const { db, tx } = makeDb({
      ysqResult: [result(TGT, 2, T0), result(SRC, 5, T1)],
    });
    await combineConflicts(tx, SRC, TGT);
    const t = db.ysqResult.rows.find((r) => r.userId === TGT)!;
    expect(decryptJson<number[]>(t.answers as string)).toEqual([5]);
    expect(t.completedAt).toEqual(T1);
    const h = db.ysqResultHistory.rows;
    expect(h).toHaveLength(1);
    expect(h[0].userId).toBe(TGT);
    expect(h[0].completedAt).toEqual(T0);
    expect(decryptJson<number[]>(h[0].answers as string)).toEqual([2]);
  });

  it('строка истории с completedAt на миллисекунды позже итога — та же, не дублируется', async () => {
    const off = new Date(T0.getTime() + 7);
    const { db, tx } = makeDb({
      ysqResult: [result(TGT, 2, T0), result(SRC, 5, T1)],
      ysqResultHistory: [{ id: 9, ...result(TGT, 2, off) }],
    });
    await combineConflicts(tx, SRC, TGT);
    expect(db.ysqResultHistory.create).not.toHaveBeenCalled();
    expect(db.ysqResultHistory.rows.map((r) => r.id)).toEqual([9]);
  });

  it('строка истории ДРУГОГО аккаунта в ту же минуту — не в счёт', async () => {
    const { db, tx } = makeDb({
      ysqResult: [result(TGT, 2, T0), result(SRC, 5, T1)],
      ysqResultHistory: [{ id: 9, ...result(SRC, 5, T0) }],
    });
    await combineConflicts(tx, SRC, TGT);
    expect(db.ysqResultHistory.create).toHaveBeenCalledTimes(1);
    const added = db.ysqResultHistory.rows.filter((r) => r.id !== 9);
    expect(added).toHaveLength(1);
    expect(added[0].userId).toBe(TGT);
    expect(added[0].completedAt).toEqual(T0);
  });

  it('цель свежее: итог цели не меняется; прежний уже в истории — не дублируется', async () => {
    const { db, tx } = makeDb({
      ysqResult: [result(TGT, 2, T1), result(SRC, 5, T0)],
      ysqResultHistory: [{ id: 9, ...result(SRC, 5, T0) }],
    });
    await combineConflicts(tx, SRC, TGT);
    expect(db.ysqResult.update).not.toHaveBeenCalled();
    expect(db.ysqResultHistory.create).not.toHaveBeenCalled();
    const t = db.ysqResult.rows.find((r) => r.userId === TGT)!;
    expect(t.completedAt).toEqual(T1);
    expect(db.ysqResultHistory.rows).toHaveLength(1);
  });
});

describe('countCombinable — число для экрана слияния', () => {
  it('равно числу пар, которые потом объединятся', async () => {
    const seed = {
      note: [note(1, TGT, 'а'), note(2, SRC, 'б')],
      userSafePlace: [
        { userId: TGT, description: 'море', updatedAt: T0 },
        { userId: SRC, description: 'лес', updatedAt: T1 },
      ],
      ysqResult: [{ userId: SRC, answers: '[]', completedAt: T0 }],
    };
    expect(await countCombinable(makeDb(seed).tx, SRC, TGT)).toBe(2);
    const out = await combineConflicts(makeDb(seed).tx, SRC, TGT);
    expect(out.combined + out.unreadable).toBe(2);
  });

  it('summarize отдаёт число рядом со счётчиками', async () => {
    const { db } = makeDb({ note: [note(1, TGT, 'а'), note(2, SRC, 'б')] });
    const none = table([]); // таблицы потерь (merge-lost.ts) — пустые
    const prisma = {
      ...db,
      rating: none,
      childhoodRating: none,
      ysqProgress: none,
      therapistRequest: none,
      $queryRaw: jest.fn().mockResolvedValue([{ c: 1n }]),
      user: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const s = await new MergeService(prisma as never, {} as never).summarize(
      SRC,
      TGT,
    );
    expect(s.combined).toBe(1);
    expect(s.counts.Note).toBe(1);
  });
});

// Шов: merge() зовёт объединение в своей транзакции ДО DELETE…EXISTS. На коде
// до R3 строка цели оставалась прежней, а строку источника стирал DELETE.
describe('MergeService.merge — объединение в транзакции слияния', () => {
  it('сохранил заметку за день в обоих → после merge у цели текст обоих', async () => {
    const { db } = makeDb({
      note: [note(1, TGT, 'Устала'), note(2, SRC, 'Поспала днём')],
    });
    const order: string[] = [];
    db.note.update.mockImplementation(({ data }) => {
      order.push('combine');
      Object.assign(db.note.rows[0], data);
      return Promise.resolve(db.note.rows[0]);
    });
    const tx = {
      ...db,
      $executeRaw: jest.fn((q: { sql: string }) => {
        if (/DELETE FROM "Note" src/.test(q.sql)) order.push('delete');
        return Promise.resolve(0);
      }),
      $queryRaw: jest.fn().mockResolvedValue([]),
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
    };
    const prisma = {
      $transaction: (fn: (t: unknown) => Promise<void>) => fn(tx),
    };
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    await new MergeService(prisma as never, { log: jest.fn() } as never).merge(
      SRC,
      TGT,
    );
    expect(decrypt(db.note.rows[0].text as string)).toBe(
      'Устала\n\nПоспала днём',
    );
    expect(order).toEqual(['combine', 'delete']);
    jest.restoreAllMocks();
  });
});
