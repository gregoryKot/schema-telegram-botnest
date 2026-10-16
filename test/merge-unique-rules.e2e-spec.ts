// Аудит 2026-10-11, «Долг с механизмом»: UNIQUE_RULES не сверялись со схемой.
// Статическая сверка с текстом schema.prisma — src/auth/unique-rules-registry.spec.ts.
// Здесь — то, чего текст схемы не покажет, на живом Postgres (правило №18):
//  (а) констрейнты, реально созданные миграциями (pg_index), равны UNIQUE_RULES —
//      в том числе unique-индекс, добавленный рукописным SQL мимо schema.prisma;
//  (б) настоящий merge с коллизией по КАЖДОЙ таблице из правил не падает 23505,
//      побеждает target, несвязанная строка source переезжает.
// Мок $executeRaw не доказывает ни того, ни другого. Гоняется только при
// E2E_REAL_DB=1 (джоба `migrations`).
import { INestApplication } from '@nestjs/common';
import { buildTestApp, TestApp } from './e2e-support/build-test-app';
import { cleanupOwnershipFixtures } from './e2e-support/cleanup-fixtures';
import { UNIQUE_FIXTURES } from './e2e-support/unique-rule-fixtures';
import {
  MergeService,
  UNIQUE_RULES,
  USER_OWNED_TABLES,
  SECURITY_SENSITIVE_TABLES,
} from '../src/auth/merge.service';

const REAL_DB = process.env.E2E_REAL_DB === '1';
const describeOnRealDb = REAL_DB ? describe : describe.skip;

type CatalogRow = { table: string; cols: string[]; special: boolean };

describeOnRealDb('e2e: UNIQUE_RULES против живого Postgres', () => {
  let app: INestApplication;
  let prisma: TestApp['prisma'];
  const SRC = 770_000_911n;
  const TGT = 1_000_000_000_000_911n;

  beforeAll(async () => {
    const built = await buildTestApp();
    app = built.app;
    prisma = built.prisma;
  });
  afterAll(async () => {
    await cleanupOwnershipFixtures(prisma, [SRC, TGT]);
    await app.close();
  });
  beforeEach(async () => {
    await cleanupOwnershipFixtures(prisma, [SRC, TGT]);
    await prisma.user.create({ data: { id: SRC } });
    await prisma.user.create({ data: { id: TGT } });
  });

  /** Уникальные индексы со userId среди ведущих колонок (INCLUDE не считается). */
  async function catalog(): Promise<CatalogRow[]> {
    return prisma.$queryRaw`
      SELECT c.relname::text AS "table",
             array_agg(a.attname::text ORDER BY k.ord) AS cols,
             bool_or(i.indpred IS NOT NULL OR i.indexprs IS NOT NULL) AS special
        FROM pg_index i
        JOIN pg_class c ON c.oid = i.indrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        CROSS JOIN LATERAL unnest(i.indkey::int2[]) WITH ORDINALITY AS k(attnum, ord)
        JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = k.attnum
       WHERE i.indisunique AND c.relkind = 'r'
         AND n.nspname = current_schema() AND k.ord <= i.indnkeyatts
       GROUP BY c.relname, i.indexrelid
      HAVING bool_or(a.attname = 'userId')`;
  }
  const key = (table: string, cols: string[]) =>
    `${table}[${cols
      .filter((c) => c !== 'userId')
      .sort()
      .join(',')}]`;

  it('констрейнты в базе (после migrate deploy) = UNIQUE_RULES', async () => {
    const rows = await catalog();
    // sanity: current_schema() не промахнулся, запрос что-то видит.
    expect(rows.length).toBeGreaterThanOrEqual(UNIQUE_RULES.length);

    const special = rows.filter((r) => r.special).map((r) => r.table);
    expect({
      'частичный/выражение-индекс со userId: для него нужно отдельное правило merge, а не строка в UNIQUE_RULES':
        special,
    }).toEqual({
      'частичный/выражение-индекс со userId: для него нужно отдельное правило merge, а не строка в UNIQUE_RULES':
        [],
    });

    const known = new Set<string>([
      ...USER_OWNED_TABLES,
      ...SECURITY_SENSITIVE_TABLES,
    ]);
    const sensitive = new Set<string>(SECURITY_SENSITIVE_TABLES);
    const ruled = rows.filter((r) => !sensitive.has(r.table));
    expect(rows.map((r) => r.table).filter((t) => !known.has(t))).toEqual([]);
    expect(ruled.map((r) => key(r.table, r.cols)).sort()).toEqual(
      UNIQUE_RULES.map((r) => key(r.table, r.cols)).sort(),
    );
  });

  it('фикстуры покрывают все правила', () => {
    expect(UNIQUE_FIXTURES.map((f) => f.table).sort()).toEqual(
      UNIQUE_RULES.map((r) => r.table).sort(),
    );
  });

  it.each(UNIQUE_FIXTURES)(
    '$table: коллизия по ключу — target побеждает, чужой ключ source переезжает, 23505 нет',
    async ({ table, delegate, data, markOf }) => {
      const cols = UNIQUE_RULES.find((r) => r.table === table)!.cols;
      const d = prisma[delegate];
      const tgtRow = await d.create({ data: data(TGT, 'a', '22') });
      await d.create({ data: data(SRC, 'a', '11') }); // коллизия
      let otherMark: string | undefined;
      if (cols.length > 0) {
        const other = await d.create({ data: data(SRC, 'b', '33') });
        otherMark = markOf(other);
      }

      await app.get(MergeService).merge(SRC, TGT); // не бросает 23505

      const rows = await d.findMany({ where: { userId: TGT } });
      const marks = rows.map(markOf).sort();
      const expected = [
        markOf(tgtRow),
        ...(otherMark ? [otherMark] : []),
      ].sort();
      expect(marks).toEqual(expected);
      expect(await d.count({ where: { userId: SRC } })).toBe(0);
      expect(await prisma.user.findUnique({ where: { id: SRC } })).toBeNull();
    },
  );
});
