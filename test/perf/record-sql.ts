// Запись SQL, который приложение РЕАЛЬНО отправляет в Postgres.
//
// Зачем не список запросов руками: план меряется у того запроса, который
// исполняет прод, а не у того, который автор замера переписал в файл. Своя
// копия запроса расходится с кодом молча — это тот же класс, что фикстура,
// сочинённая автором парсера (правило №23), и мок `$queryRaw`, который
// «отвечает что угодно» (правило №18). Поэтому ловим на уровне драйвера:
// Prisma 7 ходит через `@prisma/adapter-pg`, то есть через `pg.Client.query`.
// Один патч прототипа — и видно всё, что ушло в базу: и запросы, собранные
// Prisma из `findMany`, и сырые `$queryRaw`, и то, что внутри `$transaction`.
//
// Патч живёт только в замере (test/perf) и снимается в `stop()`: прод-код
// (src/prisma/prisma.service.ts) об этом ничего не знает и шва под тест не
// получает.
import { Client } from 'pg';

export interface RecordedStatement {
  sql: string;
  values: unknown[];
}

type QueryFn = (this: unknown, ...args: unknown[]) => unknown;

/** Форма первого аргумента `client.query({ text, values })`. */
interface QueryConfigLike {
  text?: unknown;
  values?: unknown;
}

function sqlOf(first: unknown): string | null {
  if (typeof first === 'string') return first;
  const text = (first as QueryConfigLike | null)?.text;
  return typeof text === 'string' ? text : null;
}

function valuesOf(first: unknown, second: unknown): unknown[] {
  if (Array.isArray(second)) return second;
  const values = (first as QueryConfigLike | null)?.values;
  return Array.isArray(values) ? values : [];
}

export interface SqlRecording {
  /** Снимает патч и отдаёт записанное в порядке отправки. */
  stop: () => RecordedStatement[];
}

/**
 * Включает запись до первого `stop()`. Вложенных записей не бывает: второй
 * вызов до `stop()` запишет те же строки дважды, поэтому сценарии замера
 * идут по одному (см. run-plans.ts).
 */
export function startSqlRecording(): SqlRecording {
  const recorded: RecordedStatement[] = [];
  const proto = Client.prototype as unknown as Record<'query', QueryFn>;
  const original = proto.query;

  proto.query = function patched(this: unknown, ...args: unknown[]) {
    const sql = sqlOf(args[0]);
    if (sql !== null) {
      recorded.push({ sql, values: valuesOf(args[0], args[1]) });
    }
    return original.apply(this, args);
  };

  return {
    stop: () => {
      proto.query = original;
      return recorded;
    },
  };
}

/**
 * Записать всё, что уйдёт в базу за один прогон `fn`, и снять патч — в том
 * числе если `fn` упал: иначе следующий сценарий записывал бы вдвое, а гейт
 * винил бы невиновного.
 */
export async function withSqlRecording(
  fn: () => Promise<unknown>,
): Promise<{ statements: RecordedStatement[]; ms: number }> {
  const recording = startSqlRecording();
  const startedAt = Date.now();
  try {
    await fn();
  } catch (err) {
    recording.stop();
    throw err;
  }
  return { statements: recording.stop(), ms: Date.now() - startedAt };
}

/**
 * Одинаковый запрос в одном сценарии встречается многократно (отчёт /stats
 * считает одно и то же окно десятком метрик). EXPLAIN по каждому повтору —
 * лишние секунды прогона, но число повторов само по себе сигнал: запрос,
 * исполненный 50 раз на один экран, — это N+1, даже если план у него
 * идеальный. Поэтому повторы не выбрасываются, а сворачиваются со счётчиком.
 */
export function groupStatements(
  statements: RecordedStatement[],
): Array<RecordedStatement & { calls: number }> {
  const byKey = new Map<string, RecordedStatement & { calls: number }>();
  for (const stmt of statements) {
    const key = stmt.sql;
    const seen = byKey.get(key);
    if (seen) seen.calls += 1;
    else byKey.set(key, { ...stmt, calls: 1 });
  }
  return [...byKey.values()];
}
