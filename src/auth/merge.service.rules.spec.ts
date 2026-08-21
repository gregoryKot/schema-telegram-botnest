/**
 * MergeService — сверка с реестрами таблиц (докладная по docs/TEST_TRUST_PLAN.md,
 * п.2: mutation-замер 41.3%, худший файл в проекте).
 *
 * merge.service.spec.ts проверяет отдельные SQL-инварианты (IS DISTINCT FROM,
 * orphan cleanup, self-merge). Этот файл закрывает то, что мутационный прогон
 * назвал главной дырой: реестры (`USER_OWNED_TABLES`, `SECURITY_SENSITIVE_TABLES`,
 * `UNIQUE_RULES`) и цепочка терапевт↔клиент никогда не проверялись целиком —
 * подмена всего массива на `[]` или отдельного правила проходила тестами
 * незамеченной.
 *
 * Стратегия: для каждой генерируемой SQL-команды — точное совпадение
 * нормализованного текста и переданных значений (values), а не .includes()
 * по кускам (иначе мутант, стирающий часть условия, не ловится). Для
 * UNIQUE_RULES и Pair — дополнительно прогоняем РЕАЛЬНЫЙ захваченный SQL
 * (текст + values) через маленький интерпретатор тех же двух конструкций
 * (DELETE...EXISTS и Pair-UPDATE), чтобы убедиться, что конфликтующая по
 * ключу строка source реально дропается, несвязанная строка выживает, а
 * строка третьего пользователя не трогается вовсе — то, что чистое
 * сравнение текста SQL само по себе не гарантирует.
 */

import { Logger } from '@nestjs/common';
import {
  MergeService,
  USER_OWNED_TABLES,
  SECURITY_SENSITIVE_TABLES,
} from './merge.service';

type FakePrisma = ConstructorParameters<typeof MergeService>[0];

interface RawCall {
  sql: string;
  values: unknown[];
}

function normalize(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim();
}

function findExact(calls: RawCall[], sql: string): RawCall | undefined {
  return calls.find((c) => c.sql === sql);
}

// «Пустой» набор флагов/addressForm — как у только что созданного User.
// Одинаковый для source и target держит mergeUserScalarFields (см.
// merge-user-fields.ts) молчаливым здесь: его SQL-независимая логика
// (tx.user.findUnique/update) покрыта отдельно в merge-user-fields.spec.ts.
function defaultUserFlagsRow() {
  return {
    themePref: null,
    onboardingV1Done: false,
    onboardingV2Done: false,
    onboardingSkipped: [],
    childhoodWheelDone: false,
    ysqBannerDismissed: false,
    hintSheetCloseShown: false,
    hintHistoryDismissed: false,
    trackerOnboardingDone: false,
    lastCelebrationDate: null,
    lastYesterdayBannerDate: null,
    lastWeeklyQuestionWeek: null,
    schemaIntrosShown: [],
    modeIntrosShown: [],
    defaultSection: null,
    addressForm: null,
  };
}

// ── Фейк Prisma для merge(): захватывает и $executeRaw (в транзакции), и
// $queryRaw (SELECT recoveryEmail перед удалением source). ───────────────────
function makeMergePrisma(
  emailRow:
    { re: string | null; rev: Date | null } | Array<Record<string, unknown>>,
) {
  const execCalls: RawCall[] = [];
  const execSpy = jest.fn((query: { sql: string; values: unknown[] }) => {
    execCalls.push({ sql: normalize(query.sql), values: query.values });
    return Promise.resolve(0);
  });
  const queryCalls: RawCall[] = [];
  const rows = Array.isArray(emailRow) ? emailRow : [emailRow];
  const querySpy = jest.fn((query: { sql: string; values: unknown[] }) => {
    queryCalls.push({ sql: normalize(query.sql), values: query.values });
    return Promise.resolve(rows);
  });
  const userFindUnique = jest.fn().mockResolvedValue(defaultUserFlagsRow());
  const userUpdate = jest.fn();
  const prisma = {
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<void>) => {
      await fn({
        $executeRaw: execSpy,
        $queryRaw: querySpy,
        user: { findUnique: userFindUnique, update: userUpdate },
      });
    }),
    $executeRaw: execSpy,
  };
  return {
    prisma: prisma as unknown as FakePrisma,
    execCalls,
    queryCalls,
  };
}

// ── Реестр-зеркало UNIQUE_RULES (сама константа в merge.service.ts не
// экспортирована — прод-код не трогаем). Если ряд в источнике поменяется,
// findDedupeCall() перестанет находить SQL для строки реестра здесь и тест
// упадёт — это и есть сверка. ─────────────────────────────────────────────
const EXPECTED_UNIQUE_RULES: Array<{ table: string; cols: string[] }> = [
  { table: 'Rating', cols: ['date', 'needId'] },
  { table: 'Note', cols: ['date'] },
  { table: 'GratitudeDiaryEntry', cols: ['date'] },
  { table: 'AppActivity', cols: ['date'] },
  { table: 'YsqProgress', cols: [] },
  { table: 'YsqResult', cols: [] },
  { table: 'UserSchemaNote', cols: ['schemaId'] },
  { table: 'UserModeNote', cols: ['modeId'] },
  { table: 'UserSafePlace', cols: [] },
  { table: 'ChildhoodRating', cols: ['needId'] },
  { table: 'DiaryDraft', cols: ['type'] },
  { table: 'TherapistRequest', cols: [] },
];

function findDedupeCall(calls: RawCall[], table: string): RawCall | undefined {
  return calls.find(
    (c) =>
      c.sql.startsWith(`DELETE FROM "${table}"`) && c.sql.includes('EXISTS'),
  );
}

/** Колонки конфликта вынимаются из РЕАЛЬНОГО текста SQL (src."col" = tgt."col"),
 * а не задаются тестом заново — так мутация, теряющая colCond, меняет то,
 * что тест реально извлёк и проверил. */
function extractConflictCols(sql: string): string[] {
  return [...sql.matchAll(/src\."(\w+)" = tgt\."\1"/g)].map((m) => m[1]);
}

interface DedupeRow {
  id: number;
  userId: bigint;
  [k: string]: unknown;
}

/** Симулирует ОБЕ формы DELETE...EXISTS, которые реально генерирует
 * merge.service (с колонками-ключа и без) — по факту исполняя переданный
 * реальный SQL-текст и values над fixture-строками. */
function applyDedupe(
  rows: DedupeRow[],
  sql: string,
  values: unknown[],
): DedupeRow[] {
  const [source, target] = values as [bigint, bigint];
  const cols = extractConflictCols(sql);
  return rows.filter((r) => {
    if (r.userId !== source) return true;
    const conflict = rows.some(
      (t) => t.userId === target && cols.every((c) => t[c] === r[c]),
    );
    return !conflict;
  });
}

function buildDedupeFixture(
  cols: string[],
  source: bigint,
  target: bigint,
  third: bigint,
): DedupeRow[] {
  const withCols = (v: string) => Object.fromEntries(cols.map((c) => [c, v]));
  const rows: DedupeRow[] = [
    { id: 1, userId: source, ...withCols('X') }, // конфликтует с target по ключу — должна быть удалена
    { id: 2, userId: target, ...withCols('X') }, // владелец конфликта у target
    { id: 3, userId: third, ...withCols('X') }, // чужая строка с тем же ключом — не трогаем
  ];
  if (cols.length > 0) {
    rows.push({ id: 4, userId: source, ...withCols('Y') }); // другой ключ у source — дедуп-шаг её не трогает
  }
  return rows;
}

interface UserRow {
  id: number;
  userId: bigint;
}

/** Симулирует реальный UPDATE "T" SET "userId" = target WHERE "userId" = source
 * из цикла USER_OWNED_TABLES. */
function applyReassign(rows: UserRow[], values: unknown[]): UserRow[] {
  const [target, source] = values as [bigint, bigint];
  return rows.map((r) => (r.userId === source ? { ...r, userId: target } : r));
}

interface PairRow {
  id: number;
  userId1: bigint;
  userId2: bigint | null;
}

function applyPairUserId1(rows: PairRow[], values: unknown[]): PairRow[] {
  const [target, source, targetCheck] = values as [bigint, bigint, bigint];
  return rows.map((r) =>
    r.userId1 === source && (r.userId2 === null || r.userId2 !== targetCheck)
      ? { ...r, userId1: target }
      : r,
  );
}
function applyPairUserId2(rows: PairRow[], values: unknown[]): PairRow[] {
  const [target, source, targetCheck] = values as [bigint, bigint, bigint];
  return rows.map((r) =>
    r.userId2 === source && r.userId1 !== targetCheck
      ? { ...r, userId2: target }
      : r,
  );
}
function applyPairDeleteSelf(rows: PairRow[], values: unknown[]): PairRow[] {
  const [s1, s2] = values as [bigint, bigint];
  return rows.filter((r) => !(r.userId1 === s1 || r.userId2 === s2));
}

// ── Основной прогон merge(): один вызов на весь файл (кроме секций email/
// логирования — там нужны разные $queryRaw-ответы/моки Date.now). ──────────
describe('MergeService — реестры таблиц и SQL-инварианты merge()', () => {
  const SRC = BigInt(1001);
  const TGT = BigInt(2002);
  const THIRD = BigInt(3003);

  let execCalls: RawCall[];

  beforeAll(async () => {
    const { prisma, execCalls: calls } = makeMergePrisma({
      re: null,
      rev: null,
    });
    await new MergeService(prisma).merge(SRC, TGT);
    execCalls = calls;
  });

  describe('USER_OWNED_TABLES: каждая таблица реестра реально переносит строку source → target, чужая не трогается', () => {
    it.each(USER_OWNED_TABLES)('%s', (table) => {
      const call = findExact(
        execCalls,
        `UPDATE "${table}" SET "userId" = ? WHERE "userId" = ?`,
      );
      expect(call).toBeDefined();
      expect(call!.values).toEqual([TGT, SRC]);

      const rows: UserRow[] = [
        { id: 1, userId: SRC },
        { id: 2, userId: THIRD },
      ];
      const result = applyReassign(rows, call!.values);
      expect(result.find((r) => r.id === 1)).toEqual({ id: 1, userId: TGT });
      expect(result.find((r) => r.id === 2)).toEqual({ id: 2, userId: THIRD });
    });
  });

  describe('SECURITY_SENSITIVE_TABLES: строки source удаляются, target и чужие — нет', () => {
    it.each(SECURITY_SENSITIVE_TABLES)('%s', (table) => {
      const call = findExact(
        execCalls,
        `DELETE FROM "${table}" WHERE "userId" = ?`,
      );
      expect(call).toBeDefined();
      expect(call!.values).toEqual([SRC]);

      const rows: UserRow[] = [
        { id: 1, userId: SRC },
        { id: 2, userId: TGT },
        { id: 3, userId: THIRD },
      ];
      const [onlySource] = call!.values as [bigint];
      const survivors = rows.filter((r) => r.userId !== onlySource);
      expect(survivors.map((r) => r.id)).toEqual([2, 3]);
    });
  });

  describe('UNIQUE_RULES: конфликтующая по ключу строка дропается, несвязанная выживает, чужая не трогается', () => {
    it.each(EXPECTED_UNIQUE_RULES)('$table', ({ table, cols }) => {
      const call = findDedupeCall(execCalls, table);
      expect(call).toBeDefined();
      expect(extractConflictCols(call!.sql)).toEqual(cols);

      const rows = buildDedupeFixture(cols, SRC, TGT, THIRD);
      const result = applyDedupe(rows, call!.sql, call!.values);

      expect(result.find((r) => r.id === 1)).toBeUndefined(); // конфликт — удалена
      expect(result.find((r) => r.id === 2)).toEqual(rows[1]); // строка target — не трогаем
      expect(result.find((r) => r.id === 3)).toEqual(rows[2]); // чужая строка — не трогаем
      if (cols.length > 0) {
        expect(result.find((r) => r.id === 4)).toEqual(
          rows.find((r) => r.id === 4),
        ); // другой ключ — дедуп-шаг не трогает
      }
    });
  });

  describe('Pair: перенос владения по userId1 И userId2, self-pair не создаётся, чужие пары не трогаются', () => {
    it('owner1 / owner2 / self-collision / third-party обрабатываются по отдельности', () => {
      const c1 = findExact(
        execCalls,
        'UPDATE "Pair" SET "userId1" = ? WHERE "userId1" = ? AND ("userId2" IS NULL OR "userId2" <> ?)',
      );
      const c2 = findExact(
        execCalls,
        'UPDATE "Pair" SET "userId2" = ? WHERE "userId2" = ? AND "userId1" <> ?',
      );
      const c3 = findExact(
        execCalls,
        'DELETE FROM "Pair" WHERE "userId1" = ? OR "userId2" = ?',
      );
      expect(c1).toBeDefined();
      expect(c2).toBeDefined();
      expect(c3).toBeDefined();
      expect(c1!.values).toEqual([TGT, SRC, TGT]);
      expect(c2!.values).toEqual([TGT, SRC, TGT]);
      expect(c3!.values).toEqual([SRC, SRC]);

      const OTHER1 = BigInt(9001);
      const OTHER2 = BigInt(9002);
      const THIRD_A = BigInt(9003);
      const THIRD_B = BigInt(9004);
      let rows: PairRow[] = [
        { id: 1, userId1: SRC, userId2: OTHER1 }, // source — первый участник пары с посторонним
        { id: 2, userId1: OTHER2, userId2: SRC }, // source — второй участник пары с посторонним
        { id: 3, userId1: SRC, userId2: TGT }, // пара source+target уже существует под другим id — не задвоить, а убрать
        { id: 4, userId1: THIRD_A, userId2: THIRD_B }, // чужая пара — не трогаем
      ];
      rows = applyPairUserId1(rows, c1!.values);
      rows = applyPairUserId2(rows, c2!.values);
      rows = applyPairDeleteSelf(rows, c3!.values);

      expect(rows.find((r) => r.id === 1)).toEqual({
        id: 1,
        userId1: TGT,
        userId2: OTHER1,
      });
      expect(rows.find((r) => r.id === 2)).toEqual({
        id: 2,
        userId1: OTHER2,
        userId2: TGT,
      });
      expect(rows.find((r) => r.id === 3)).toBeUndefined();
      expect(rows.find((r) => r.id === 4)).toEqual({
        id: 4,
        userId1: THIRD_A,
        userId2: THIRD_B,
      });
    });
  });

  describe('Сеть терапевт↔клиент: TherapyRelation / TherapistNote / ClientConceptualization / ModeMap / TherapistCustomMode', () => {
    const cases: Array<{ label: string; sql: string; values: unknown[] }> = [
      {
        label: 'TherapyRelation: DELETE cleanup (self-loop guard)',
        sql: 'DELETE FROM "TherapyRelation" WHERE "therapistId" = ? OR "clientId" = ?',
        values: [SRC, SRC],
      },
      {
        label: 'TherapistNote: UPDATE clientId',
        sql: 'UPDATE "TherapistNote" SET "clientId" = ? WHERE "clientId" = ? AND "therapistId" <> ?',
        values: [TGT, SRC, TGT],
      },
      {
        label: 'TherapistNote: DELETE cleanup (self-loop guard)',
        sql: 'DELETE FROM "TherapistNote" WHERE "therapistId" = ? OR "clientId" = ?',
        values: [SRC, SRC],
      },
      {
        label:
          'ClientConceptualization: drop source(therapistId) row where target уже имеет тот же clientId',
        sql: 'DELETE FROM "ClientConceptualization" WHERE "therapistId" = ? AND "clientId" IN ( SELECT "clientId" FROM "ClientConceptualization" WHERE "therapistId" = ? )',
        values: [SRC, TGT],
      },
      {
        label:
          'ClientConceptualization: drop source(clientId) row where target уже имеет тот же therapistId',
        sql: 'DELETE FROM "ClientConceptualization" WHERE "clientId" = ? AND "therapistId" IN ( SELECT "therapistId" FROM "ClientConceptualization" WHERE "clientId" = ? )',
        values: [SRC, TGT],
      },
      {
        label: 'ClientConceptualization: UPDATE therapistId',
        sql: 'UPDATE "ClientConceptualization" SET "therapistId" = ? WHERE "therapistId" = ? AND "clientId" <> ?',
        values: [TGT, SRC, TGT],
      },
      {
        label: 'ClientConceptualization: UPDATE clientId',
        sql: 'UPDATE "ClientConceptualization" SET "clientId" = ? WHERE "clientId" = ? AND "therapistId" <> ?',
        values: [TGT, SRC, TGT],
      },
      {
        label: 'ClientConceptualization: DELETE cleanup (self-loop guard)',
        sql: 'DELETE FROM "ClientConceptualization" WHERE "therapistId" = ? OR "clientId" = ?',
        values: [SRC, SRC],
      },
      {
        label: 'ModeMap: UPDATE therapistId',
        sql: 'UPDATE "ModeMap" SET "therapistId" = ? WHERE "therapistId" = ? AND "clientId" <> ?',
        values: [TGT, SRC, TGT],
      },
      {
        label: 'ModeMap: UPDATE clientId',
        sql: 'UPDATE "ModeMap" SET "clientId" = ? WHERE "clientId" = ? AND "therapistId" <> ?',
        values: [TGT, SRC, TGT],
      },
      {
        label: 'ModeMap: DELETE cleanup (self-loop guard)',
        sql: 'DELETE FROM "ModeMap" WHERE "therapistId" = ? OR "clientId" = ?',
        values: [SRC, SRC],
      },
      {
        label:
          'TherapistCustomMode: UPDATE therapistId (без unique — просто remap)',
        sql: 'UPDATE "TherapistCustomMode" SET "therapistId" = ? WHERE "therapistId" = ?',
        values: [TGT, SRC],
      },
    ];

    it.each(cases)('$label', ({ sql, values }) => {
      const call = findExact(execCalls, sql);
      expect(call).toBeDefined();
      expect(call!.values).toEqual(values);
    });
  });

  describe('User: disclaimerAccepted / role / финальный DELETE', () => {
    it('disclaimerAccepted переносится через подзапрос по source', () => {
      const call = findExact(
        execCalls,
        'UPDATE "User" SET "disclaimerAccepted" = true WHERE id = ? AND (SELECT "disclaimerAccepted" FROM "User" WHERE id = ?)',
      );
      expect(call).toBeDefined();
      expect(call!.values).toEqual([TGT, SRC]);
    });

    it('role/therapistMode промоутятся у target, если у source была роль THERAPIST', () => {
      const call = findExact(
        execCalls,
        `UPDATE "User" SET "role" = 'THERAPIST', "therapistMode" = true WHERE id = ? AND (SELECT "role" FROM "User" WHERE id = ?) = 'THERAPIST'`,
      );
      expect(call).toBeDefined();
      expect(call!.values).toEqual([TGT, SRC]);
    });

    it('source-юзер удаляется последним', () => {
      const call = findExact(execCalls, 'DELETE FROM "User" WHERE id = ?');
      expect(call).toBeDefined();
      expect(call!.values).toEqual([SRC]);
    });
  });
});

// ── recoveryEmail: перенос зависит от реальных данных source (не всегда
// исполняется) — три отдельных прогона с разными ответами $queryRaw. ───────
describe('MergeService — перенос recoveryEmail с source на target', () => {
  const SRC = BigInt(1001);
  const TGT = BigInt(2002);
  const SELECT_SQL =
    'SELECT "recoveryEmail" AS re, "recoveryEmailVerifiedAt" AS rev FROM "User" WHERE id = ?';
  const CLEAR_SQL =
    'UPDATE "User" SET "recoveryEmail" = NULL, "recoveryEmailVerifiedAt" = NULL WHERE id = ?';
  const SET_SQL =
    'UPDATE "User" SET "recoveryEmail" = ?, "recoveryEmailVerifiedAt" = ? WHERE id = ? AND "recoveryEmail" IS NULL';

  it('у source есть email → освобождается у source и переносится на target', async () => {
    const verifiedAt = new Date('2021-05-01T00:00:00.000Z');
    const { prisma, execCalls, queryCalls } = makeMergePrisma({
      re: 'a@b.com',
      rev: verifiedAt,
    });
    await new MergeService(prisma).merge(SRC, TGT);

    const select = findExact(queryCalls, SELECT_SQL);
    expect(select).toBeDefined();
    expect(select!.values).toEqual([SRC]);

    const clear = findExact(execCalls, CLEAR_SQL);
    expect(clear).toBeDefined();
    expect(clear!.values).toEqual([SRC]);

    const set = findExact(execCalls, SET_SQL);
    expect(set).toBeDefined();
    expect(set!.values).toEqual(['a@b.com', verifiedAt, TGT]);
  });

  it('у source нет email (null) → ни одна UPDATE recoveryEmail не отправляется', async () => {
    const { prisma, execCalls } = makeMergePrisma({ re: null, rev: null });
    await new MergeService(prisma).merge(SRC, TGT);
    const emailCalls = execCalls.filter((c) =>
      c.sql.includes('"recoveryEmail"'),
    );
    expect(emailCalls).toEqual([]);
  });

  it('$queryRaw вернул пустой массив (нет строки User) — merge не падает, email не переносится', async () => {
    const { prisma, execCalls } = makeMergePrisma([]);
    await expect(
      new MergeService(prisma).merge(SRC, TGT),
    ).resolves.toBeUndefined();
    const emailCalls = execCalls.filter((c) =>
      c.sql.includes('"recoveryEmail"'),
    );
    expect(emailCalls).toEqual([]);
  });
});

// ── Лог длительности: ms обязан быть (конец − начало), а не любая другая
// арифметика, и сообщение — не пустая строка. ───────────────────────────────
describe('MergeService — лог длительности merge', () => {
  afterEach(() => jest.restoreAllMocks());

  it('логирует реальную длительность (конец − начало), а не мусор', async () => {
    const logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    jest
      .spyOn(Date, 'now')
      .mockReturnValueOnce(5_000)
      .mockReturnValueOnce(5_732);
    const { prisma } = makeMergePrisma({ re: null, rev: null });
    await new MergeService(prisma).merge(BigInt(1001), BigInt(2002));
    expect(logSpy).toHaveBeenCalledWith('Merged user 1001 → 2002 (732ms)');
  });
});

// ── summarize(): полностью без покрытия в прежнем спеке (0 из 25 мутантов
// строк 95-126 хоть раз исполнялись тестом). ────────────────────────────────
type CountSpec = number | 'THROW' | 'EMPTY_ROWS';

function makeSummarizePrisma(counts: Record<string, CountSpec>) {
  const spy = jest.fn((query: { sql: string; values: unknown[] }) => {
    const sql = normalize(query.sql);
    const table = sql.match(/FROM "(\w+)" WHERE/)?.[1] ?? '';
    const spec = counts[table] ?? 0;
    if (spec === 'THROW') return Promise.reject(new Error(`boom: ${table}`));
    if (spec === 'EMPTY_ROWS') return Promise.resolve([]);
    return Promise.resolve([{ c: BigInt(spec) }]);
  });
  return { prisma: { $queryRaw: spy } as unknown as FakePrisma };
}

describe('MergeService.summarize()', () => {
  afterEach(() => jest.restoreAllMocks());

  it('считает только таблицы с ненулевым количеством строк у юзера', async () => {
    const { prisma } = makeSummarizePrisma({ Rating: 5, Note: 3 });
    const result = await new MergeService(prisma).summarize(BigInt(1001));
    expect(result).toEqual({ Rating: 5, Note: 3 });
  });

  it('на чистом аккаунте (все счётчики — 0) отчёт пустой, без 0/NaN по каждой таблице', async () => {
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const { prisma } = makeSummarizePrisma({});
    const result = await new MergeService(prisma).summarize(BigInt(1001));
    expect(result).toEqual({});
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('пустой rows[] по одной таблице читается как 0, а не падение (rows[0]?.c ?? 0n)', async () => {
    const warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const { prisma } = makeSummarizePrisma({ Rating: 5, Note: 'EMPTY_ROWS' });
    const result = await new MergeService(prisma).summarize(BigInt(1001));
    expect(result).toEqual({ Rating: 5 });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('падение одной таблицы не прерывает подсчёт остальных и попадает в лог как частичный результат', async () => {
    const warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const { prisma } = makeSummarizePrisma({ Rating: 5, Note: 'THROW' });
    const result = await new MergeService(prisma).summarize(BigInt(1001));
    expect(result).toEqual({ Rating: 5 });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Note'));
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Note'));
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('failed tables'),
    );
  });
});
