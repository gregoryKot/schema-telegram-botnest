import { Injectable, Logger } from '@nestjs/common';
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
  'AppActivity', 'UserTask', 'DiaryDraft',
  'Pair', 'TherapyRelation',
  'AuthProvider', 'WebSession',
] as const;

// Tables with a unique constraint that includes userId — for these we have
// to handle conflicts row by row (source row dropped when target already has
// the same key).
interface UniqueRule { table: string; cols: string[]; }
const UNIQUE_RULES: UniqueRule[] = [
  { table: 'Rating',                cols: ['userId', 'date', 'needId'] },
  { table: 'YsqProgress',           cols: ['userId'] }, // userId is PK
  { table: 'YsqResult',             cols: ['userId'] },
  { table: 'UserSchemaNote',        cols: ['userId', 'schemaId'] },
  { table: 'UserModeNote',          cols: ['userId', 'modeId'] },
  { table: 'UserSafePlace',         cols: ['userId'] },
  { table: 'ChildhoodRating',       cols: ['userId', 'needId'] },
  { table: 'DiaryDraft',            cols: ['userId', 'type'] },
];

@Injectable()
export class MergeService {
  private readonly logger = new Logger(MergeService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Returns a summary of how much data each side has — used by the UI to
  // present the user with an informed merge confirmation.
  async summarize(userId: bigint): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    for (const table of USER_OWNED_TABLES) {
      try {
        const rows = await this.prisma.$queryRawUnsafe<Array<{ c: bigint }>>(
          `SELECT COUNT(*)::bigint AS c FROM "${table}" WHERE "userId" = ${userId}`,
        );
        const n = Number(rows[0]?.c ?? 0n);
        if (n > 0) counts[table] = n;
      } catch (err) {
        this.logger.warn(`summarize ${table}: ${(err as Error).message}`);
      }
    }
    return counts;
  }

  // Move all user-owned data from `source` to `target`, then delete `source`.
  // Done in a single transaction. On unique-constraint conflicts the source
  // row is dropped (target wins, since that's the account the user is
  // actively logged into).
  async merge(sourceId: bigint, targetId: bigint): Promise<void> {
    if (sourceId === targetId) return;
    await this.prisma.$transaction(async (tx) => {
      // 1. Drop source rows that would collide on a (userId, …) unique key.
      for (const rule of UNIQUE_RULES) {
        const otherCols = rule.cols.filter(c => c !== 'userId');
        const joinCond = ['"src"."userId" = ' + sourceId, '"tgt"."userId" = ' + targetId,
          ...otherCols.map(c => `"src"."${c}" = "tgt"."${c}"`)].join(' AND ');
        await tx.$executeRawUnsafe(`
          DELETE FROM "${rule.table}" "src"
          WHERE "userId" = ${sourceId}
            AND EXISTS (
              SELECT 1 FROM "${rule.table}" "tgt"
              WHERE ${joinCond}
            )
        `);
      }
      // 2. Reassign remaining source rows to target.
      for (const table of USER_OWNED_TABLES) {
        await tx.$executeRawUnsafe(
          `UPDATE "${table}" SET "userId" = ${targetId} WHERE "userId" = ${sourceId}`,
        );
      }
      // 3. Pair table has two refs (user1Id / user2Id) — special-case.
      await tx.$executeRawUnsafe(
        `UPDATE "Pair" SET "userId1" = ${targetId} WHERE "userId1" = ${sourceId} AND "user2Id" <> ${targetId}`,
      );
      await tx.$executeRawUnsafe(
        `UPDATE "Pair" SET "user2Id" = ${targetId} WHERE "user2Id" = ${sourceId} AND "userId1" <> ${targetId}`,
      );
      await tx.$executeRawUnsafe(
        `DELETE FROM "Pair" WHERE "userId1" = ${sourceId} OR "user2Id" = ${sourceId}`,
      );
      // 4. TherapyRelation (therapistId / clientId).
      await tx.$executeRawUnsafe(
        `UPDATE "TherapyRelation" SET "therapistId" = ${targetId} WHERE "therapistId" = ${sourceId} AND "clientId" <> ${targetId}`,
      );
      await tx.$executeRawUnsafe(
        `UPDATE "TherapyRelation" SET "clientId" = ${targetId} WHERE "clientId" = ${sourceId} AND "therapistId" <> ${targetId}`,
      );
      await tx.$executeRawUnsafe(
        `DELETE FROM "TherapyRelation" WHERE "therapistId" = ${sourceId} OR "clientId" = ${sourceId}`,
      );
      // 5. Finally, delete the now-empty source User.
      await tx.$executeRawUnsafe(`DELETE FROM "User" WHERE id = ${sourceId}`);
    });
    this.logger.log(`Merged user ${sourceId} → ${targetId}`);
  }
}
