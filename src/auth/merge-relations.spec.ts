/**
 * remapRelations — порядок и текст SQL. Поведение (что остаётся после merge)
 * доказывает живой спек test/merge-relations.e2e-spec.ts: unique-индекс и
 * дедуп — свойства Postgres, мок их не исполняет. Здесь — то, что мок видит:
 * дедуп идёт ДО ремапа (иначе UPDATE упал бы 23505 на частичном индексе) и
 * сторона/идентификаторы не перепутаны.
 */
import { Prisma } from '@prisma/client';
import { remapRelations } from './merge-relations';

const SRC = 11n;
const TGT = 22n;
const norm = (sql: string) => sql.replace(/\s+/g, ' ').trim();

async function run() {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const tx = {
    $executeRaw: jest.fn((q: { sql: string; values: unknown[] }) => {
      calls.push({ sql: norm(q.sql), values: q.values });
      return Promise.resolve(0);
    }),
  };
  await remapRelations(tx as unknown as Prisma.TransactionClient, SRC, TGT);
  return calls;
}
const idx = (calls: Array<{ sql: string }>, start: string) =>
  calls.findIndex((c) => c.sql.startsWith(start));

describe('remapRelations', () => {
  it('Pair: дубль активной пары дропается раньше ремапа, партнёр считается в любой ориентации', async () => {
    const calls = await run();
    const dedupe = idx(calls, 'DELETE FROM "Pair" s');
    const remap1 = idx(calls, 'UPDATE "Pair" SET "userId1"');
    const remap2 = idx(calls, 'UPDATE "Pair" SET "userId2"');
    expect(dedupe).toBeGreaterThanOrEqual(0);
    expect(dedupe).toBeLessThan(remap1);
    expect(remap1).toBeLessThan(remap2);
    expect(calls[dedupe].sql).toBe(
      'DELETE FROM "Pair" s WHERE s."status" = \'active\' ' +
        'AND (s."userId1" = ? OR s."userId2" = ?) AND EXISTS ( ' +
        'SELECT 1 FROM "Pair" t WHERE t."status" = \'active\' ' +
        'AND (t."userId1" = ? OR t."userId2" = ?) ' +
        'AND CASE WHEN s."userId1" = ? THEN s."userId2" ELSE s."userId1" END ' +
        '= CASE WHEN t."userId1" = ? THEN t."userId2" ELSE t."userId1" END )',
    );
    expect(calls[dedupe].values).toEqual([SRC, SRC, TGT, TGT, SRC, TGT]);
  });

  it('TherapyRelation: обе стороны дедупятся (долив полей → дроп) раньше ремапа, source/target не перепутаны', async () => {
    const calls = await run();
    const firstRemap = idx(calls, 'UPDATE "TherapyRelation" SET "therapistId"');
    const merges = calls.filter((c) =>
      c.sql.startsWith('UPDATE "TherapyRelation" t'),
    );
    const drops = calls.filter((c) =>
      c.sql.startsWith('DELETE FROM "TherapyRelation" s'),
    );
    expect(merges).toHaveLength(2);
    expect(drops).toHaveLength(2);
    for (const c of [...merges, ...drops])
      expect(calls.indexOf(c)).toBeLessThan(firstRemap);

    const [clientSide, therapistSide] = merges;
    expect(clientSide.sql).toContain(
      's."clientId" = ? AND t."clientId" = ? AND s."therapistId" = t."therapistId"',
    );
    expect(therapistSide.sql).toContain(
      's."therapistId" = ? AND t."therapistId" = ? AND s."clientId" = t."clientId"',
    );
    for (const c of merges) {
      for (const f of ['clientAlias', 'therapyStartDate', 'nextSession'])
        expect(c.sql).toContain(`"${f}" = COALESCE(t."${f}", s."${f}")`);
      expect(c.sql).toContain(
        'WHERE s."status" = \'active\' AND t."status" = \'active\'',
      );
      expect(c.values).toEqual([SRC, TGT]);
    }
    expect(drops[0].sql).toBe(
      'DELETE FROM "TherapyRelation" s WHERE s."status" = \'active\' AND s."clientId" = ? ' +
        'AND EXISTS ( SELECT 1 FROM "TherapyRelation" t WHERE t."status" = \'active\' ' +
        'AND t."clientId" = ? AND t."therapistId" = s."therapistId" )',
    );
    expect(drops[1].sql).toContain('s."therapistId" = ?');
    expect(drops[1].sql).toContain('t."clientId" = s."clientId"');
    expect(drops.map((d) => d.values)).toEqual([
      [SRC, TGT],
      [SRC, TGT],
    ]);
  });

  it('ремап и зачистка self-loop сохранены (IS DISTINCT FROM для офлайн-клиентов)', async () => {
    const calls = await run();
    expect(calls.map((c) => c.sql)).toEqual(
      expect.arrayContaining([
        'UPDATE "TherapyRelation" SET "therapistId" = ? WHERE "therapistId" = ? AND "clientId" IS DISTINCT FROM ?',
        'UPDATE "TherapyRelation" SET "clientId" = ? WHERE "clientId" = ? AND "therapistId" <> ?',
        'DELETE FROM "TherapyRelation" WHERE "therapistId" = ? OR "clientId" = ?',
        'DELETE FROM "Pair" WHERE "userId1" = ? OR "userId2" = ?',
      ]),
    );
  });
});
