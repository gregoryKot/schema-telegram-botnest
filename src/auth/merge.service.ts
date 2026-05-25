import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Tables where a userId column points to User.id (BigInt).
// Discovered via grep on schema.prisma; if a new user-owned model is added,
// register its table name here. Order matters for FK dependencies on delete.
const USER_OWNED_TABLES = [
  'Rating', 'YsqProgress', 'YsqResult', 'YsqResultHistory',
  'Note', 'UserSchemaNote', 'UserModeNote', 'UserBeliefCheck', 'UserLetter',
  'UserSafePlace', 'UserFlashcard', 'UserPractice', 'PracticePlan',
  'ChildhoodRating', 'ScheduledNotification',
  'SchemaDiaryEntry', 'ModeDiaryEntry', 'GratitudeDiaryEntry',
  'AppActivity', 'UserTask', 'DiaryDraft', 'TherapistRequest',
  'AuthProvider',
] as const;
// Note: Pair / TherapyRelation / TherapistNote / ClientConceptualization
// handled separately below — multi-column refs (therapistId/clientId/userId1/userId2).

// Tables we DELETE rather than move during merge — moving them would carry
// over security-sensitive state (refresh tokens of the old account become
// valid for the new one). Source's rows are simply destroyed.
const SECURITY_SENSITIVE_TABLES = ['WebSession'] as const;

// Per-table allow-list of "other columns" in unique constraints that include
// userId. When source and target both have a row with the same (userId, …key)
// the source row is dropped first so the bulk UPDATE that follows can succeed
// without violating the constraint.
const UNIQUE_RULES: Array<{ table: string; cols: string[] }> = [
  { table: 'Rating',              cols: ['date', 'needId'] },
  { table: 'Note',                cols: ['date'] },
  { table: 'GratitudeDiaryEntry', cols: ['date'] },
  { table: 'AppActivity',         cols: ['date'] },
  { table: 'YsqProgress',         cols: [] }, // userId is PK
  { table: 'YsqResult',           cols: [] },
  { table: 'UserSchemaNote',      cols: ['schemaId'] },
  { table: 'UserModeNote',        cols: ['modeId'] },
  { table: 'UserSafePlace',       cols: [] },
  { table: 'ChildhoodRating',     cols: ['needId'] },
  { table: 'DiaryDraft',          cols: ['type'] },
  { table: 'TherapistRequest',    cols: [] }, // userId is @unique
];

// Whitelist of identifiers we'll embed directly in SQL. Anything outside this
// set is rejected — defence in depth even though sources are all constants in
// this file.
const KNOWN_TABLES = new Set<string>([
  ...USER_OWNED_TABLES,
  ...SECURITY_SENSITIVE_TABLES,
  'Pair', 'TherapyRelation', 'TherapistNote', 'ClientConceptualization', 'User',
]);
const KNOWN_COLS = new Set<string>([
  'userId', 'userId1', 'userId2', 'therapistId', 'clientId', 'id',
  'date', 'needId', 'schemaId', 'modeId', 'type',
]);
function ident(name: string, kind: 'table' | 'col'): string {
  const ok = (kind === 'table' ? KNOWN_TABLES : KNOWN_COLS).has(name);
  if (!ok) throw new Error(`Refusing to interpolate unknown SQL identifier: ${name}`);
  return `"${name}"`;
}

@Injectable()
export class MergeService {
  private readonly logger = new Logger(MergeService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Returns a row-count summary so the UI can present an informed merge
  // confirmation ("you'll move 87 ratings, 14 diary entries, …").
  async summarize(userId: bigint): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    const failed: string[] = [];
    for (const table of USER_OWNED_TABLES) {
      try {
        const rows = await this.prisma.$queryRaw<Array<{ c: bigint }>>(
          Prisma.sql`SELECT COUNT(*)::bigint AS c FROM ${Prisma.raw(ident(table, 'table'))} WHERE "userId" = ${userId}`,
        );
        const n = Number(rows[0]?.c ?? 0n);
        if (n > 0) counts[table] = n;
      } catch (err) {
        this.logger.warn(`summarize ${table}: ${(err as Error).message}`);
        failed.push(table);
      }
    }
    // If we couldn't count some tables, surface this — otherwise the merge
    // UI claims "you'll move 5 rows" when actually 5000 are moving.
    if (failed.length > 0) {
      this.logger.error(`summarize partial — failed tables: ${failed.join(', ')}`);
    }
    return counts;
  }

  // Move all user-owned data from `source` to `target`, then delete `source`.
  // Done in a single transaction. On unique-constraint conflicts the source
  // row is dropped (target wins, since that's the account the user is
  // actively logged into).
  async merge(sourceId: bigint, targetId: bigint): Promise<void> {
    if (sourceId === targetId) return;
    const startedAt = Date.now();
    await this.prisma.$transaction(async (tx) => {
      // 0. Drop security-sensitive rows of source (refresh tokens, etc).
      for (const table of SECURITY_SENSITIVE_TABLES) {
        await tx.$executeRaw(
          Prisma.sql`DELETE FROM ${Prisma.raw(ident(table, 'table'))} WHERE "userId" = ${sourceId}`,
        );
      }

      // 1. Drop source rows that would collide on a (userId, …key) unique.
      for (const rule of UNIQUE_RULES) {
        const tbl = Prisma.raw(ident(rule.table, 'table'));
        if (rule.cols.length === 0) {
          // Unique on (userId) alone — if target already has a row for this
          // table, drop source's row.
          await tx.$executeRaw(Prisma.sql`
            DELETE FROM ${tbl} WHERE "userId" = ${sourceId}
              AND EXISTS (SELECT 1 FROM ${tbl} WHERE "userId" = ${targetId})
          `);
        } else {
          // Unique on (userId, col1, col2, …) — drop source rows where target
          // already has the same key tuple.
          const colCond = Prisma.join(
            rule.cols.map(c => {
              const col = Prisma.raw(ident(c, 'col'));
              return Prisma.sql`src.${col} = tgt.${col}`;
            }),
            ' AND ',
          );
          await tx.$executeRaw(Prisma.sql`
            DELETE FROM ${tbl} src
            WHERE src."userId" = ${sourceId}
              AND EXISTS (
                SELECT 1 FROM ${tbl} tgt
                WHERE tgt."userId" = ${targetId} AND ${colCond}
              )
          `);
        }
      }

      // 2. Reassign remaining source rows to target.
      for (const table of USER_OWNED_TABLES) {
        await tx.$executeRaw(Prisma.sql`
          UPDATE ${Prisma.raw(ident(table, 'table'))}
          SET "userId" = ${targetId}
          WHERE "userId" = ${sourceId}
        `);
      }

      // 3. Pair table has two refs — both can point at source.
      await tx.$executeRaw(Prisma.sql`
        UPDATE "Pair" SET "userId1" = ${targetId}
        WHERE "userId1" = ${sourceId} AND ("userId2" IS NULL OR "userId2" <> ${targetId})
      `);
      await tx.$executeRaw(Prisma.sql`
        UPDATE "Pair" SET "userId2" = ${targetId}
        WHERE "userId2" = ${sourceId} AND "userId1" <> ${targetId}
      `);
      // Anything left points at source on either side AND the other side is
      // already target → would create a self-pair; just drop.
      await tx.$executeRaw(Prisma.sql`
        DELETE FROM "Pair" WHERE "userId1" = ${sourceId} OR "userId2" = ${sourceId}
      `);

      // 4. TherapyRelation (therapistId / clientId).
      await tx.$executeRaw(Prisma.sql`
        UPDATE "TherapyRelation" SET "therapistId" = ${targetId}
        WHERE "therapistId" = ${sourceId} AND "clientId" <> ${targetId}
      `);
      await tx.$executeRaw(Prisma.sql`
        UPDATE "TherapyRelation" SET "clientId" = ${targetId}
        WHERE "clientId" = ${sourceId} AND "therapistId" <> ${targetId}
      `);
      await tx.$executeRaw(Prisma.sql`
        DELETE FROM "TherapyRelation" WHERE "therapistId" = ${sourceId} OR "clientId" = ${sourceId}
      `);

      // 4b. TherapistNote (therapistId, clientId — no FK, no unique).
      await tx.$executeRaw(Prisma.sql`
        UPDATE "TherapistNote" SET "therapistId" = ${targetId}
        WHERE "therapistId" = ${sourceId} AND "clientId" <> ${targetId}
      `);
      await tx.$executeRaw(Prisma.sql`
        UPDATE "TherapistNote" SET "clientId" = ${targetId}
        WHERE "clientId" = ${sourceId} AND "therapistId" <> ${targetId}
      `);
      // Drop self-loops (would point at same user on both sides).
      await tx.$executeRaw(Prisma.sql`
        DELETE FROM "TherapistNote" WHERE "therapistId" = ${sourceId} OR "clientId" = ${sourceId}
      `);

      // 4c. ClientConceptualization (unique on therapistId+clientId).
      //     Strategy: prefer target's existing concept row over source's.
      //     If target already has a row with the same (therapistId/clientId)
      //     pair (after our remap), drop source's row entirely first.
      //
      // Step A: drop source rows where target already has the mapped pair.
      //   source(therapistId=src) + clientId X → would become (target, X)
      //   if target already has (target, X) — drop source row
      await tx.$executeRaw(Prisma.sql`
        DELETE FROM "ClientConceptualization"
        WHERE "therapistId" = ${sourceId}
          AND "clientId" IN (
            SELECT "clientId" FROM "ClientConceptualization" WHERE "therapistId" = ${targetId}
          )
      `);
      //   source(clientId=src) + therapistId Y → would become (Y, target)
      //   if target already has (Y, target) — drop source row
      await tx.$executeRaw(Prisma.sql`
        DELETE FROM "ClientConceptualization"
        WHERE "clientId" = ${sourceId}
          AND "therapistId" IN (
            SELECT "therapistId" FROM "ClientConceptualization" WHERE "clientId" = ${targetId}
          )
      `);
      // Step B: remap remaining source rows.
      await tx.$executeRaw(Prisma.sql`
        UPDATE "ClientConceptualization" SET "therapistId" = ${targetId}
        WHERE "therapistId" = ${sourceId} AND "clientId" <> ${targetId}
      `);
      await tx.$executeRaw(Prisma.sql`
        UPDATE "ClientConceptualization" SET "clientId" = ${targetId}
        WHERE "clientId" = ${sourceId} AND "therapistId" <> ${targetId}
      `);
      // Step C: anything still pointing at source on either side would create
      // a self-loop (therapist === client) — drop.
      await tx.$executeRaw(Prisma.sql`
        DELETE FROM "ClientConceptualization" WHERE "therapistId" = ${sourceId} OR "clientId" = ${sourceId}
      `);

      // 5. Finally, delete the now-empty source User.
      await tx.$executeRaw(Prisma.sql`DELETE FROM "User" WHERE id = ${sourceId}`);
    });
    const ms = Date.now() - startedAt;
    this.logger.log(`Merged user ${sourceId} → ${targetId} (${ms}ms)`);
  }
}
