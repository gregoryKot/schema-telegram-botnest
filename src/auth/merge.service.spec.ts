/**
 * MergeService regression tests.
 *
 * These tests use a mock Prisma that captures every raw SQL call so we can
 * assert the *correct SQL* is sent without needing a real database.
 *
 * Key invariant: merge must NOT use plain `<>` comparisons against nullable
 * columns (clientId can be NULL for virtual/offline therapy clients).
 * In SQL,  NULL <> anything  →  NULL  (falsy), so those rows silently skip
 * the UPDATE and are then caught by the cleanup DELETE — permanently lost.
 * The fix is `IS DISTINCT FROM` which treats NULL correctly.
 */

import { MergeService } from './merge.service';

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Collects every SQL fragment passed to $executeRaw. */
function captureRawSql() {
  const calls: string[] = [];
  return {
    calls,
    spy: jest.fn(
      async (query: { strings?: TemplateStringsArray; values?: unknown[] }) => {
        // Prisma.sql tagged templates expose .strings; join them for inspection.
        const sql = (query?.strings ?? [])
          .join('?')
          .replace(/\s+/g, ' ')
          .trim();
        calls.push(sql);
        return 0;
      },
    ),
  };
}

function makePrisma() {
  const raw = captureRawSql();
  const prisma = {
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        $executeRaw: raw.spy,
        $queryRaw: jest.fn().mockResolvedValue([{ re: null, rev: null }]),
      };
      await fn(tx);
    }),
    // Not used in merge() but required by the constructor type
    $executeRaw: raw.spy,
  } as any;
  return { prisma, rawCalls: raw.calls };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('MergeService — SQL safety', () => {
  const SRC = BigInt(1001);
  const TGT = BigInt(2002);

  async function runMerge() {
    const { prisma, rawCalls } = makePrisma();
    const svc = new MergeService(prisma);
    await svc.merge(SRC, TGT);
    return rawCalls;
  }

  // ── TherapyRelation ─────────────────────────────────────────────────────────

  it('TherapyRelation SET therapistId UPDATE uses IS DISTINCT FROM, not plain <>', async () => {
    const sqls = await runMerge();
    // Only the UPDATE that reassigns therapistId — identified by SET "therapistId"
    const sql = sqls.find(
      (s) => s.includes('TherapyRelation') && s.includes('SET "therapistId"'),
    );
    expect(sql).toBeDefined();
    expect(sql).toContain('IS DISTINCT FROM');
    // Regression guard: plain <> on nullable clientId breaks for virtual clients
    expect(sql).not.toMatch(/"clientId"\s*<>/);
  });

  it('TherapyRelation SET clientId UPDATE still uses plain <> (clientId=source is never NULL here)', async () => {
    const sqls = await runMerge();
    const sql = sqls.find(
      (s) => s.includes('TherapyRelation') && s.includes('SET "clientId"'),
    );
    expect(sql).toBeDefined();
  });

  // ── TherapistNote ───────────────────────────────────────────────────────────

  it('TherapistNote SET therapistId UPDATE uses IS DISTINCT FROM, not plain <>', async () => {
    const sqls = await runMerge();
    const sql = sqls.find(
      (s) => s.includes('TherapistNote') && s.includes('SET "therapistId"'),
    );
    expect(sql).toBeDefined();
    expect(sql).toContain('IS DISTINCT FROM');
    expect(sql).not.toMatch(/"clientId"\s*<>/);
  });

  // ── Orphan cleanup ──────────────────────────────────────────────────────────

  it('includes a DELETE that removes orphaned virtual-client conceptualizations', async () => {
    const sqls = await runMerge();
    const orphanCleanup = sqls.find(
      (s) =>
        s.includes('ClientConceptualization') &&
        s.includes('clientId') &&
        s.includes('< 0') &&
        s.includes('TherapyRelation') &&
        s.includes('NOT EXISTS'),
    );
    expect(orphanCleanup).toBeDefined();
  });

  // ── Self-merge guard ────────────────────────────────────────────────────────

  it('is a no-op when sourceId === targetId', async () => {
    const { prisma } = makePrisma();
    const svc = new MergeService(prisma);
    await svc.merge(SRC, SRC);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
