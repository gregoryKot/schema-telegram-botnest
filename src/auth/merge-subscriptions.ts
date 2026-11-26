import { Prisma } from '@prisma/client';

// Перенос подписки при слиянии аккаунтов — отдельным модулем, потому что
// Subscription выпадает из общего механизма merge: у неё НЕТ колонки
// `userId`. Она привязана к `telegramId` (подписку оформляют из Telegram,
// когда веб-аккаунта может не быть вовсе), а цикл по USER_OWNED_TABLES
// перевешивает строки запросом `WHERE "userId" = source`. Поэтому до этого
// модуля подписка при слиянии оставалась на осиротевшем telegramId: строка
// User источника удалялась, списания шли дальше, а объединённый аккаунт
// подписки не видел и не мог её отменить.
//
// Удаление аккаунта тот же перекос уже учитывало вручную (account.delete.ts
// ищет подписку сразу по двум идентификаторам) — merge не учитывал, и связать
// эти два места было нечем: ручная обработка не оставляет следа, который
// проверяется. Теперь след есть — этот модуль и запись в table-registry.spec.

/** Статусы, при которых подписка живая: по ней ещё могут списать деньги. */
const LIVE_STATUSES = ['pending', 'active', 'past_due'] as const;

export type ReassignOutcome =
  | { kind: 'none' }
  | { kind: 'moved'; count: number }
  | { kind: 'conflict'; sourceLive: number; targetLive: number };

type Tx = Pick<Prisma.TransactionClient, '$queryRaw' | '$executeRaw'>;

async function countLive(
  tx: Tx,
  telegramId: bigint,
): Promise<{ live: number; total: number }> {
  const rows = await tx.$queryRaw<Array<{ live: bigint; total: bigint }>>(
    Prisma.sql`
      SELECT
        count(*) FILTER (WHERE "status"::text = ANY(${LIVE_STATUSES}))::bigint AS live,
        count(*)::bigint AS total
      FROM "Subscription" WHERE "telegramId" = ${telegramId}
    `,
  );
  return {
    live: Number(rows[0]?.live ?? 0),
    total: Number(rows[0]?.total ?? 0),
  };
}

/**
 * Перевешивает подписки источника на целевой аккаунт внутри той же
 * транзакции, что и остальной merge.
 *
 * Коллизия обрабатывается явно: если живые подписки есть с ОБЕИХ сторон,
 * слепое перевешивание дало бы два активных списания на одном аккаунте —
 * то есть удвоенный счёт человеку. Молча выбрать одну из них нельзя (какую
 * отменять — решение про деньги, а не про данные), поэтому перенос не
 * делается, а наверх возвращается `conflict`: вызывающая сторона зовёт
 * человека. Тихо «съесть» этот случай хуже, чем разбудить админа.
 */
export async function reassignSubscriptions(
  tx: Tx,
  sourceId: bigint,
  targetId: bigint,
): Promise<ReassignOutcome> {
  const source = await countLive(tx, sourceId);
  if (source.total === 0) return { kind: 'none' };

  const target = await countLive(tx, targetId);
  if (source.live > 0 && target.live > 0) {
    return {
      kind: 'conflict',
      sourceLive: source.live,
      targetLive: target.live,
    };
  }

  await tx.$executeRaw(Prisma.sql`
    UPDATE "Subscription" SET "telegramId" = ${targetId}
    WHERE "telegramId" = ${sourceId}
  `);
  return { kind: 'moved', count: source.total };
}

/** Текст алерта админу — называет оба номера, чтобы разобрать руками. */
export function conflictAlertText(
  sourceId: bigint,
  targetId: bigint,
  outcome: Extract<ReassignOutcome, { kind: 'conflict' }>,
): string {
  return (
    `⚠️ Слияние аккаунтов: подписка НЕ перенесена\n\n` +
    `Источник ${sourceId} — живых подписок: ${outcome.sourceLive}\n` +
    `Цель ${targetId} — живых подписок: ${outcome.targetLive}\n\n` +
    `Перенос отменён: две живые подписки на одном аккаунте — это двойное ` +
    `списание. Нужно вручную решить, какую оставить, и отменить вторую.`
  );
}
