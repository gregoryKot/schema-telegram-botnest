// Общий переиспользуемый stateful in-memory фейк Prisma для юнит-тестов
// (TEST_IMPROVEMENT_PLAN.md, этап 2.4). До этого файла ~9 спеков рукописно
// реализовывали одну и ту же семантику where-матчинга (`matchesWhere`/
// `matchWhere`/`makeTable` в auth.service.spec.ts, notification.service.spec.ts,
// bot/pairs.service.spec.ts и др.) — правку (напр. добавить `in`-оператор)
// вносили в одну копию, остальные расходились (правило CLAUDE.md «одна
// механика — один компонент»). Эталон семантики — test/e2e-support/fake-prisma.ts
// (e2e-смоук); этот файл — юнит-версия тех же примитивов, оформленная как
// переиспользуемые строительные блоки (не фиксированный набор таблиц —
// юниты трогают разные модели).
//
// Расположение и имя — намеренные:
// - `src/test-support/` (не `src/*/*.spec.ts`) — импортируется из спеков
//   разных доменов (auth/, bot/, notification/) относительным путём.
// - `.spec-helper.ts`, не `.spec.ts` — jest testRegex `.*\.spec\.ts$`
//   (package.json) не матчит `-helper.ts` на конце, поэтому jest не пытается
//   исполнить файл как тест без единого `it()`.
// - Из прод-сборки исключён явно: tsconfig.build.json `exclude` содержит
//   `"src/test-support"` (паттерн `**/*spec.ts` этот файл НЕ ловит — он не
//   заканчивается на `spec.ts` дословно, поэтому нужна отдельная запись).
// - eslint: `src/test-support/**/*.ts` добавлен в тестовый файл-паттерн
//   (глушит `no-unsafe-*`/`no-explicit-any`, как для остальных спеков),
//   но код здесь всё равно написан на `unknown`, а не `any`, — это общий
//   примитив, а не одноразовый мок.

/** Строка «таблицы» — любые поля, значения не типизированы (как реальная
 * Prisma-строка после JSON/BigInt-парсинга). */
export type Row = Record<string, unknown>;

/** Prisma-подобный where-объект: значения — литералы, `null`, составной
 * unique-ключ (`{ userId, date }`) или операторный объект (`{ gte: ... }`). */
export type Where = Record<string, unknown>;

function isPlainCondition(cond: unknown): cond is Row {
  return (
    typeof cond === 'object' &&
    cond !== null &&
    !Array.isArray(cond) &&
    !(cond instanceof Date)
  );
}

/** Сравнение двух значений одного «сравнимого» типа (Date/number/string/bigint).
 * Для несравнимых/незнакомых типов — только равенство (orderBy/gte по таким
 * полям в проекте не встречается). */
function compareScalars(a: unknown, b: unknown): number {
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'bigint' && typeof b === 'bigint')
    return a < b ? -1 : a > b ? 1 : 0;
  if (typeof a === 'string' && typeof b === 'string')
    return a < b ? -1 : a > b ? 1 : 0;
  return a === b ? 0 : 1;
}

/**
 * Prisma-подобный where-матчер. Поддерживает: точное равенство; `null`
 * (матчит и явный null, и отсутствующее поле — как реальный Prisma и как
 * create(), не заполнивший колонку); составной unique-ключ вида
 * `{ userId_date: { userId, date } }` (реальные поля лежат внутри условия,
 * матчатся против самой строки); операторы `not/in/gte/lte/gt/lt/contains`;
 * верхнеуровневые `OR`/`AND`.
 */
export function matchesWhere(row: Row, where: Where = {}): boolean {
  const { OR, AND, ...rest } = where;
  if (Array.isArray(OR) && !OR.some((sub) => matchesWhere(row, sub as Where)))
    return false;
  if (
    Array.isArray(AND) &&
    !AND.every((sub) => matchesWhere(row, sub as Where))
  )
    return false;
  return Object.entries(rest).every(([key, cond]) => {
    const value = row[key];
    if (cond === null) return value === null || value === undefined;
    if (cond instanceof Date) return compareScalars(value, cond) === 0;
    if (isPlainCondition(cond)) {
      if ('not' in cond) return value !== cond.not;
      if ('in' in cond) {
        const list = cond.in;
        return Array.isArray(list) && list.includes(value);
      }
      if ('gte' in cond) return compareScalars(value, cond.gte) >= 0;
      if ('lte' in cond) return compareScalars(value, cond.lte) <= 0;
      if ('gt' in cond) return compareScalars(value, cond.gt) > 0;
      if ('lt' in cond) return compareScalars(value, cond.lt) < 0;
      if ('contains' in cond)
        return (
          typeof value === 'string' &&
          typeof cond.contains === 'string' &&
          value.includes(cond.contains)
        );
      return Object.entries(cond).every(([k, v]) => row[k] === v);
    }
    return value === cond;
  });
}

function applyOrderBy(rows: Row[], orderBy?: Where | Where[]): Row[] {
  if (!orderBy) return rows;
  const clauses = Array.isArray(orderBy) ? orderBy : [orderBy];
  return [...rows].sort((a, b) => {
    for (const clause of clauses) {
      for (const [key, dir] of Object.entries(clause)) {
        const cmp = compareScalars(a[key], b[key]);
        if (cmp !== 0) return dir === 'desc' ? -cmp : cmp;
      }
    }
    return 0;
  });
}

export interface FakeTableOptions {
  /** Поле id (по умолчанию 'id'). Таблицы, где id задаётся явно вызывающим
   * (напр. `User.id = telegramId`), auto-increment не трогает — только
   * подстраивает счётчик, чтобы не столкнуться с уже занятыми числовыми id. */
  idField?: string;
  /** Значения по умолчанию при create()/upsert(create) — то, что в схеме
   * задано через `@default(...)`, а generic create не знает (не парсит
   * schema.prisma). Функция — для вычисляемых дефолтов (напр. createdAt). */
  defaults?: Row | ((data: Row) => Row);
}

/** Стейтфулая in-memory таблица с Prisma-подобным API (findMany/findFirst/
 * findUnique/create/createMany/update/updateMany/upsert/delete/deleteMany/
 * count). `rows` — тот же массив, что передан или создан по умолчанию,
 * доступен как `._rows` и может напрямую мутироваться тестом (`rows.push`),
 * как в рукописных фейках, которые этот хелпер заменяет. */
export function createFakeTable(
  rows: Row[] = [],
  options: FakeTableOptions = {},
) {
  const idField = options.idField ?? 'id';
  let nextId =
    rows.reduce(
      (max, r) =>
        typeof r[idField] === 'number' ? Math.max(max, r[idField]) : max,
      0,
    ) + 1;

  const resolveDefaults = (data: Row): Row => {
    if (!options.defaults) return {};
    return typeof options.defaults === 'function'
      ? options.defaults(data)
      : options.defaults;
  };

  const insert = (data: Row): Row => {
    const row: Row = { ...resolveDefaults(data), ...data };
    if (row[idField] === undefined) row[idField] = nextId;
    const id = row[idField];
    if (typeof id === 'number' && id >= nextId) nextId = id + 1;
    rows.push(row);
    return row;
  };

  return {
    _rows: rows,
    findUnique: jest.fn(
      ({ where }: { where?: Where } = {}) =>
        rows.find((r) => matchesWhere(r, where)) ?? null,
    ),
    findFirst: jest.fn(
      ({ where, orderBy }: { where?: Where; orderBy?: Where | Where[] } = {}) =>
        applyOrderBy(
          rows.filter((r) => matchesWhere(r, where)),
          orderBy,
        )[0] ?? null,
    ),
    findMany: jest.fn(
      ({
        where,
        orderBy,
        take,
        select,
      }: {
        where?: Where;
        orderBy?: Where | Where[];
        take?: number;
        select?: Record<string, boolean>;
      } = {}) => {
        let result = applyOrderBy(
          rows.filter((r) => matchesWhere(r, where)),
          orderBy,
        );
        if (typeof take === 'number') result = result.slice(0, take);
        if (select) {
          const keys = Object.keys(select);
          return result.map((r) =>
            Object.fromEntries(keys.map((k) => [k, r[k] ?? null])),
          );
        }
        return result;
      },
    ),
    create: jest.fn(({ data }: { data: Row }) => insert(data)),
    createMany: jest.fn(({ data }: { data: Row | Row[] }) => {
      const arr = Array.isArray(data) ? data : [data];
      arr.forEach((d) => insert(d));
      return { count: arr.length };
    }),
    update: jest.fn(({ where, data }: { where: Where; data: Row }) => {
      const row = rows.find((r) => matchesWhere(r, where));
      if (!row) throw new Error('Record not found (fake prisma update)');
      Object.assign(row, data);
      return row;
    }),
    updateMany: jest.fn(
      ({ where, data }: { where?: Where; data: Row } = { data: {} }) => {
        const hit = rows.filter((r) => matchesWhere(r, where));
        hit.forEach((r) => Object.assign(r, data));
        return { count: hit.length };
      },
    ),
    upsert: jest.fn(
      ({
        where,
        create,
        update,
      }: {
        where: Where;
        create: Row;
        update: Row;
      }) => {
        const row = rows.find((r) => matchesWhere(r, where));
        if (row) {
          Object.assign(row, update);
          return row;
        }
        return insert(create);
      },
    ),
    delete: jest.fn(({ where }: { where: Where }) => {
      const idx = rows.findIndex((r) => matchesWhere(r, where));
      if (idx === -1) throw new Error('Record not found (fake prisma delete)');
      const [row] = rows.splice(idx, 1);
      return row;
    }),
    deleteMany: jest.fn(({ where }: { where?: Where } = {}) => {
      const hit = rows.filter((r) => matchesWhere(r, where));
      hit.forEach((r) => rows.splice(rows.indexOf(r), 1));
      return { count: hit.length };
    }),
    count: jest.fn(
      ({ where }: { where?: Where } = {}) =>
        rows.filter((r) => matchesWhere(r, where)).length,
    ),
  };
}

export type FakeTable = ReturnType<typeof createFakeTable>;

/** $transaction фейк: поддерживает и batch-форму Prisma (`$transaction([...])`
 * — массив уже выполненных значений/промисов, т.к. JS вычисляет аргументы до
 * вызова), и интерактивную (`$transaction(async (tx) => ...)` — колбэк
 * получает сам объект prisma). */
export function createFakeTransaction<T>(prisma: T) {
  return jest.fn((arg: unknown) =>
    Array.isArray(arg) ? Promise.all(arg) : (arg as (tx: T) => unknown)(prisma),
  );
}
