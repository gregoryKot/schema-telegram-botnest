// «Проверка + запись» в одной транзакции уровня Serializable с ретраем по
// P2034 (Postgres SSI). Из двух конкурентных транзакций, читающих и пишущих
// одни и те же строки, ровно одна коммитится, вторая получает P2034 и
// повторяется с нуля — уже видя запись первой. READ COMMITTED здесь не
// годится: повторная проверка внутри транзакции не видит чужой
// незакоммиченной вставки, и обе стороны пишут.
import type { Prisma } from '@prisma/client';
import { realSleep, retryDelayMs, type RetryTiming } from './retry-backoff';

export const SERIALIZATION_RETRIES = 3;
interface MaybeConflict {
  code?: unknown;
  cause?: { kind?: unknown; originalCode?: unknown };
}

/**
 * Конфликт сериализации (SQLSTATE 40001) в любой из форм Prisma 7 с
 * `@prisma/adapter-pg`: на запросе внутри транзакции — `P2034`; на COMMIT —
 * голый `DriverAdapterError` с `cause.kind = 'TransactionWriteConflict'`,
 * `cause.originalCode = '40001'` (форма с живого Postgres,
 * test/notify-from-other.e2e-spec.ts).
 */
export function isSerializationFailure(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as MaybeConflict;
  return (
    e.code === 'P2034' ||
    e.code === '40001' ||
    e.cause?.kind === 'TransactionWriteConflict' ||
    e.cause?.originalCode === '40001'
  );
}

export interface SerializableClient {
  $transaction<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: { isolationLevel?: Prisma.TransactionIsolationLevel },
  ): Promise<T>;
}

/**
 * `fn` в Serializable-транзакции; на конфликте — повтор после паузы, всего до
 * `SERIALIZATION_RETRIES` попыток, затем `onExhausted()`. Прочее — сразу наружу.
 */
export async function inSerializableTx<T>(
  prisma: SerializableClient,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  onExhausted: () => Error,
  { sleep = realSleep, random = Math.random }: RetryTiming = {},
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await prisma.$transaction(fn, { isolationLevel: 'Serializable' });
    } catch (err) {
      if (!isSerializationFailure(err)) throw err;
      if (attempt >= SERIALIZATION_RETRIES) throw onExhausted();
      await sleep(retryDelayMs(attempt, random));
    }
  }
}
