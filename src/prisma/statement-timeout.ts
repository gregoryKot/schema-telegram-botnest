// Предел времени одного запроса к БД (statement_timeout). Аудит 2026-10,
// «Нет таймаута запроса к БД»; порог 30 с согласован владельцем 2026-10-22.
//
// Лимит — стартовый параметр сессии пула (buildPrismaAdapter), а не часть
// DATABASE_URL: `prisma migrate deploy` ходит своим подключением по URL и
// лимита не получает, миграции не прерываются. Лимит считается на КАЖДЫЙ
// запрос, а не на команду: /stats из ~90 запросов в него не упирается.
// Ожидание блокировки (замок слота брони) входит в лимит.
//
// Замер 2026-10-22 на синтетике «горизонт роста» (test/perf/seed-profile.ts):
// самый долгий одиночный запрос /stats — 0,47 с, ночная чистка AnalyticsEvent
// в худшем случае (1,5 млн строк из 2 млн одним DELETE) — 1,1 с. Запас ×60.
// Что лимит не ломает долгие пути, держат живые спеки на прод-пороге:
// test/statement-timeout.e2e-spec.ts и джоба perf (/stats на синтетике).
import type { Prisma, PrismaClient } from '@prisma/client';

export const DEFAULT_STATEMENT_TIMEOUT_MS = 30_000;

/**
 * Ротация ключа (src/cli/rotate-encryption-key.ts) читает каждую таблицу
 * целиком одним запросом; её запускает человек и видит ход, а оборванная на
 * середине ротация требует повторного прогона при двух активных ключах.
 */
export const CLI_STATEMENT_TIMEOUT_MS = 600_000;

// SQLSTATE query_canceled: statement_timeout (или ручной pg_cancel_backend —
// у нас его никто не зовёт). Сверяем код, а не текст: текст зависит от
// lc_messages сервера.
const QUERY_CANCELED = '57014';

/**
 * Потолок типа Postgres. Больше сервер отвергает FATAL на КАЖДОМ соединении
 * (проверено на живой базе): лишний ноль в рубильнике дал бы полный простой,
 * а не выключение предела.
 */
export const MAX_STATEMENT_TIMEOUT_MS = 2_147_483_647;

/** Значение, которое Postgres примет: целое мс от 0 до потолка. Его же проверяет реестр env. */
export function isValidStatementTimeout(value: string): boolean {
  return /^\d+$/.test(value) && Number(value) <= MAX_STATEMENT_TIMEOUT_MS;
}

/**
 * Порог пула приложения: DB_STATEMENT_TIMEOUT_MS — рубильник без выкладки
 * (0 — без лимита), иначе 30 с. Неверное значение — дефолт; о нём на старте
 * сообщает env-check (реестр env, правило №22).
 */
export function statementTimeoutMs(
  raw: string | undefined = process.env.DB_STATEMENT_TIMEOUT_MS,
): number {
  const value = raw?.trim() ?? '';
  return isValidStatementTimeout(value)
    ? Number(value)
    : DEFAULT_STATEMENT_TIMEOUT_MS;
}

interface AdapterErrorMeta {
  driverAdapterError?: { cause?: { originalCode?: string } };
}

/**
 * Запрос прерван лимитом. Формы ошибки сняты с живого Postgres: модельный
 * запрос — P2039, сырой — P2010, у обоих код в
 * `meta.driverAdapterError.cause.originalCode`; ошибка голого `pg` — `code`.
 */
export function isStatementTimeout(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const e = err as Error & { code?: unknown; meta?: AdapterErrorMeta };
  return (
    e.meta?.driverAdapterError?.cause?.originalCode === QUERY_CANCELED ||
    e.code === QUERY_CANCELED
  );
}

const formatLimit = (ms: number): string =>
  ms % 1000 === 0 ? `${ms / 1000} с` : `${ms} мс`;

/**
 * Строка лога для события `error` Prisma, если это таймаут, иначе null.
 * Первый аргумент logger.error уходит владельцу в DM (AlertLogger), поэтому в
 * строке только вызов и место в коде — без аргументов запроса.
 */
export function statementTimeoutLogLine(
  message: string,
  limitMs: number,
): string | null {
  if (!message.includes(`Code: \`${QUERY_CANCELED}\``)) return null;
  const call = /Invalid `([^`]+)` invocation(?: in\s+(\S+))?/.exec(message);
  const where = call?.[2]?.replace(/^.*?\/(dist|src)\//, '$1/');
  const site = call ? ` — ${call[1]}${where ? ` (${where})` : ''}` : '';
  return `Запрос к БД прерван: дольше statement_timeout ${formatLimit(limitMs)}${site}`;
}

/**
 * Исключение из лимита для одного долгого пути: запросы `fn` идут одной
 * транзакцией с `SET LOCAL statement_timeout` — значение живёт до конца
 * транзакции и на соединение пула не протекает (живой спек). VACUUM так не
 * обернуть: в транзакции он запрещён. `limitMs` > 0.
 */
export function withStatementTimeout<T>(
  prisma: PrismaClient,
  limitMs: number,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  if (!isValidStatementTimeout(String(limitMs)) || limitMs === 0)
    throw new Error(`withStatementTimeout: limitMs > 0, получено ${limitMs}`);
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT set_config('statement_timeout', ${String(limitMs)}, true)`;
      return fn(tx);
    },
    // Своя граница интерактивной транзакции Prisma (по умолчанию 5 с)
    // оборвала бы путь раньше лимита.
    // Потолок — тот же: setTimeout Node больше 2^31-1 мс срабатывает сразу.
    {
      timeout: Math.min(limitMs + 5_000, MAX_STATEMENT_TIMEOUT_MS),
      maxWait: 10_000,
    },
  );
}
