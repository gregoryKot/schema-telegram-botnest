// Замер планов: прогнать горячие пути на синтетике, записать SQL, снять
// EXPLAIN (ANALYZE, BUFFERS), сложить в JSON-отчёт. Сверку с бейслайном делает
// отдельный гейт (scripts/check-query-plans.mjs) — замер и суждение разделены
// намеренно: гейт тогда проверяется в песочнице на поддельном отчёте, без
// Postgres (src/test-support/gates/query-plans.spec.ts).
//
// Порядок шагов в CI (джоба `perf`): сидер → этот файл → гейт.
//
// Запуск локально:
//   DATABASE_URL=... npx ts-node --compiler-options '{"module":"commonjs"}' \
//     test/perf/seed.ts
//   DATABASE_URL=... npx ts-node --compiler-options '{"module":"commonjs"}' \
//     test/perf/run-plans.ts
import './../e2e-support/env.setup';
import './../setup-e2e';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { Client } from 'pg';
import { PrismaService } from '../../src/prisma/prisma.service';
import { explainStatement, tableRowCounts, StatementPlan } from './explain';
import { groupStatements, withSqlRecording } from './record-sql';
import { resolveWorstCaseIds, SCENARIOS } from './scenarios';

export const DEFAULT_REPORT_PATH = '.perf/plans.json';

interface ScenarioReport {
  name: string;
  title: string;
  /** Время реального прогона сценария, а не сумма EXPLAIN-ов. */
  ms: number;
  /** Страниц тронуто за сценарий: по всем запросам, с учётом повторов. */
  blocks: number;
  statements: StatementPlan[];
}

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function measure(
  prisma: PrismaService,
  client: Client,
  ids: { therapistId: bigint; heavyUserId: bigint },
): Promise<ScenarioReport[]> {
  const out: ScenarioReport[] = [];
  for (const scenario of SCENARIOS) {
    const { statements, ms } = await withSqlRecording(() =>
      scenario.run({ prisma, ...ids }),
    );
    const plans: StatementPlan[] = [];
    for (const stmt of groupStatements(statements)) {
      const plan = await explainStatement(client, stmt);
      if (plan) plans.push(plan);
    }
    out.push({
      name: scenario.name,
      title: scenario.title,
      ms,
      blocks: plans.reduce((sum, p) => sum + p.blocks * p.calls, 0),
      statements: plans.sort((a, b) => b.blocks * b.calls - a.blocks * a.calls),
    });
  }
  return out;
}

function printSummary(scenarios: ScenarioReport[]): void {
  for (const s of scenarios) {
    console.log(`\n▸ ${s.name} — ${s.title}`);
    console.log(
      `  ${s.ms} мс, ${s.blocks} страниц, ${s.statements.length} разных запросов`,
    );
    for (const st of s.statements.slice(0, 5)) {
      const seq = st.seqScans
        .filter((h) => h.removed > 0 || h.loops > 1)
        .map((h) => `${h.table}: -${h.removed} строк, ×${h.loops}`)
        .join('; ');
      console.log(
        `   · ${st.blocks} стр ×${st.calls}, ${st.ms.toFixed(1)} мс` +
          (seq ? ` | Seq Scan ${seq}` : ''),
      );
      console.log(`     ${st.sql.replace(/\s+/g, ' ').slice(0, 150)}`);
    }
  }
}

async function main(): Promise<void> {
  const reportPath = resolve(argValue('--out') ?? DEFAULT_REPORT_PATH);
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const prisma = new PrismaService();
  await prisma.$connect();
  try {
    const ids = await resolveWorstCaseIds(client);
    const tableRows = await tableRowCounts(client);
    const scenarios = await measure(prisma, client, ids);
    printSummary(scenarios);
    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(
      reportPath,
      JSON.stringify(
        { measuredAt: new Date().toISOString(), tableRows, scenarios },
        null,
        2,
      ) + '\n',
    );
    console.log(`\nОтчёт: ${reportPath}`);
  } finally {
    await prisma.$disconnect();
    await client.end();
  }
}

if (require.main === module) {
  main().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
}
