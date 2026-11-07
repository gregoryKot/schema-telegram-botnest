// Долгие легитимные пути под ПРОД-порогом statement_timeout на синтетике
// «горизонт роста» (test/perf/seed-profile.ts). Джоба perf, после замера
// планов: шаги удаляют данные. /stats под тем же порогом уже прошёл в
// run-plans.ts (сценарий stats-report бросает на упавшем блоке).
//
// Запрос сверх порога здесь — красная джоба, а не тихая строка в логе: оба
// пути глотают ошибку в warn/error (крон и fire-and-forget VACUUM), поэтому
// жалоба любого Nest-логгера роняет прогон.
import './../e2e-support/env.setup';
import './../setup-e2e';
import { Logger } from '@nestjs/common';
import { Client } from 'pg';
import { PrismaService } from '../../src/prisma/prisma.service';
import { DEFAULT_STATEMENT_TIMEOUT_MS } from '../../src/prisma/statement-timeout';
import { AnalyticsService } from '../../src/analytics/analytics.service';
import { EVENT_RETENTION_DAYS } from '../../src/analytics/analytics-retention';
import { deleteAllUserData } from '../../src/bot/account.delete';
import { resolveWorstCaseIds } from './scenarios';

const complaints: string[] = [];
const loggerProto = Logger.prototype as unknown as Record<
  'error' | 'warn',
  (...args: unknown[]) => void
>;
for (const level of ['error', 'warn'] as const) {
  const original = loggerProto[level];
  loggerProto[level] = function (this: Logger, ...args: unknown[]) {
    complaints.push(`${level}: ${String(args[0])}`);
    original.apply(this, args);
  };
}

async function timed<T>(title: string, fn: () => Promise<T>): Promise<T> {
  const started = Date.now();
  const out = await fn();
  console.log(`  ${title}: ${Date.now() - started} мс`);
  return out;
}

async function waitFor(check: () => Promise<boolean>, ms: number) {
  const deadline = Date.now() + ms;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error(`не дождались за ${ms} мс`);
    await new Promise((r) => setTimeout(r, 250));
  }
}

async function assertProdLimit(prisma: PrismaService): Promise<void> {
  const [row] = await prisma.$queryRaw<
    { statement_timeout: string }[]
  >`SHOW statement_timeout`;
  const expected = `${DEFAULT_STATEMENT_TIMEOUT_MS / 1000}s`;
  if (row.statement_timeout !== expected)
    throw new Error(
      `Порог сессии ${row.statement_timeout}, а прод — ${expected}: ` +
        'прогон не доказывает, что долгие пути под ним проходят',
    );
}

async function pruneEvents(prisma: PrismaService): Promise<void> {
  const cutoff = new Date(Date.now() - EVENT_RETENTION_DAYS * 86_400_000);
  const old = () =>
    prisma.analyticsEvent.count({ where: { createdAt: { lt: cutoff } } });
  const before = await old();
  if (before === 0)
    throw new Error(
      'в синтетике нет событий старше ретеншена — чистить нечего',
    );
  await timed(
    `ночная чистка AnalyticsEvent: ${before} событий одним DELETE`,
    () => new AnalyticsService(prisma).pruneOld(),
  );
  if ((await old()) !== 0) throw new Error('чистка оставила старые события');
}

async function deleteHeavyAccount(
  prisma: PrismaService,
  client: Client,
): Promise<void> {
  const { heavyUserId } = await resolveWorstCaseIds(client);
  const ratings = await prisma.rating.count({ where: { userId: heavyUserId } });
  const vacuums = async () =>
    Number(
      (
        await client.query<{ n: string }>(
          `SELECT vacuum_count::text AS n FROM pg_stat_user_tables WHERE relname = 'User'`,
        )
      ).rows[0].n,
    );
  const vacuumsBefore = await vacuums();
  await timed(
    `удаление аккаунта с самой длинной историей (${ratings} оценок)`,
    () => deleteAllUserData(prisma, new Logger('long-paths'), heavyUserId),
  );
  if (await prisma.user.findUnique({ where: { id: heavyUserId } }))
    throw new Error('аккаунт не удалён');
  // VACUUM уходит fire-and-forget — его конец виден по счётчику статистики.
  await timed('VACUUM ANALYZE "User" после удаления', () =>
    waitFor(
      async () => (await vacuums()) > vacuumsBefore,
      DEFAULT_STATEMENT_TIMEOUT_MS + 5_000,
    ),
  );
}

async function main(): Promise<void> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const prisma = new PrismaService();
  await prisma.$connect();
  try {
    await assertProdLimit(prisma);
    console.log(
      `Долгие пути под statement_timeout ${DEFAULT_STATEMENT_TIMEOUT_MS} мс:`,
    );
    await pruneEvents(prisma);
    await deleteHeavyAccount(prisma, client);
    if (complaints.length > 0)
      throw new Error(`логгер пожаловался:\n${complaints.join('\n')}`);
  } finally {
    await prisma.$disconnect();
    await client.end();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
