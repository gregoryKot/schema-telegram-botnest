import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
// Ре-экспорт: спеки и соседи берут реестр таблиц из merge.service.
export { USER_OWNED_TABLES } from './user-owned-tables';
import { USER_OWNED_TABLES } from './user-owned-tables';
import { mergeUserScalarFields } from './merge-user-fields';
import {
  reassignSubscriptions,
  conflictAlertText,
  type ReassignOutcome,
} from './merge-subscriptions';
import { SecurityLogService } from './security-log.service';
import { twoFactorWillBeLost } from './merge-two-factor';
import { remapAssignerRefs } from './merge-assigner-refs';
import { remapRelations } from './merge-relations';
import { combineConflicts, countCombinable } from './merge-combine';
import { countLost } from './merge-lost';
import type { MergeSummary } from './merge-summary.types';

// Tables we DELETE rather than move during merge — moving them would carry
// over security-sensitive state (refresh tokens of the old account become
// valid for the new one). Source's rows are simply destroyed. EmailToken:
// verification-токены старого аккаунта не должны подтверждать e-mail нового,
// а после DELETE User стали бы сиротами (FK у него нет) — spec-сверка реестров
// (аудит 2026-07, S-2). LoginTicket: код входа/привязки живёт минуты.
export const SECURITY_SENSITIVE_TABLES = [
  'WebSession',
  'EmailToken',
  'LoginTicket',
] as const;

// Unique-констрейнты с userId: «прочие колонки» ключа. Строка source, чей ключ
// уже есть у target, удаляется до общего UPDATE userId; в таблицах COMBINERS
// (merge-combine.ts) она перед этим вливается в строку target (R3).
export const UNIQUE_RULES: Array<{ table: string; cols: string[] }> = [
  { table: 'Rating', cols: ['date', 'needId'] },
  { table: 'Note', cols: ['date'] },
  { table: 'GratitudeDiaryEntry', cols: ['date'] },
  { table: 'AppActivity', cols: ['date'] },
  { table: 'YsqProgress', cols: [] }, // userId is PK
  { table: 'YsqResult', cols: [] },
  { table: 'UserSchemaNote', cols: ['schemaId'] },
  { table: 'UserModeNote', cols: ['modeId'] },
  { table: 'UserSafePlace', cols: [] },
  { table: 'ChildhoodRating', cols: ['needId'] },
  { table: 'DiaryDraft', cols: ['type'] },
  { table: 'TherapistRequest', cols: [] }, // userId is @unique
];

// Whitelist of identifiers we'll embed directly in SQL — defence in depth even
// though sources are all constants in this file.
export const KNOWN_TABLES = new Set<string>([
  ...USER_OWNED_TABLES,
  ...SECURITY_SENSITIVE_TABLES,
  'Pair',
  'TherapyRelation',
  'TherapistNote',
  'ClientConceptualization',
  'ModeMap',
  'TherapistCustomMode',
  'User',
]);
export const KNOWN_COLS = new Set<string>([
  'userId',
  'userId1',
  'userId2',
  'therapistId',
  'clientId',
  'id',
  'date',
  'needId',
  'schemaId',
  'modeId',
  'type',
]);
export function ident(name: string, kind: 'table' | 'col'): string {
  const ok = (kind === 'table' ? KNOWN_TABLES : KNOWN_COLS).has(name);
  if (!ok)
    throw new Error(`Refusing to interpolate unknown SQL identifier: ${name}`);
  return `"${name}"`;
}

@Injectable()
export class MergeService {
  private readonly logger = new Logger(MergeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly securityLog: SecurityLogService,
  ) {}

  // Сводка экрана подтверждения: что есть в source, что объединится с target,
  // что удалится без объединения (merge-lost.ts) и пропадёт ли второй фактор.
  async summarize(sourceId: bigint, targetId: bigint): Promise<MergeSummary> {
    const counts: Record<string, number> = {};
    const failed: string[] = [];
    for (const table of USER_OWNED_TABLES) {
      try {
        const rows = await this.prisma.$queryRaw<Array<{ c: bigint }>>(
          Prisma.sql`SELECT COUNT(*)::bigint AS c FROM ${Prisma.raw(ident(table, 'table'))} WHERE "userId" = ${sourceId}`,
        );
        const n = Number(rows[0]?.c ?? 0n);
        if (n > 0) counts[table] = n;
      } catch (err) {
        this.logger.warn(`summarize ${table}: ${(err as Error).message}`);
        failed.push(table);
      }
    }
    // Недосчёт молча занизил бы цифры экрана слияния — пишем в лог.
    if (failed.length > 0) {
      this.logger.error(
        `summarize partial — failed tables: ${failed.join(', ')}`,
      );
    }

    const combined = await countCombinable(this.prisma, sourceId, targetId);
    const lost = await countLost(this.prisma, sourceId, targetId);
    const twoFactorLost = await twoFactorWillBeLost(
      this.prisma,
      sourceId,
      targetId,
    );
    return { counts, combined, lost, twoFactorLost };
  }

  // Move all user-owned data from `source` to `target`, then delete `source`,
  // in one transaction. Unique-конфликт: объединяемые таблицы вливают source
  // в target (merge-combine.ts), в остальных побеждает target.
  async merge(sourceId: bigint, targetId: bigint): Promise<void> {
    if (sourceId === targetId) return;
    const startedAt = Date.now();
    // Обёртка: результат забирается изнутри колбэка — возврату значения из
    // $transaction не верим (тестовые дублёры Prisma ничего не возвращают).
    const state: { subs: ReassignOutcome; combined: number } = {
      subs: { kind: 'none' },
      combined: 0,
    };
    await this.prisma.$transaction(async (tx) => {
      // 0. Drop security-sensitive rows of source (refresh tokens, etc).
      for (const table of SECURITY_SENSITIVE_TABLES) {
        await tx.$executeRaw(
          Prisma.sql`DELETE FROM ${Prisma.raw(ident(table, 'table'))} WHERE "userId" = ${sourceId}`,
        );
      }

      // 1. R3: пары с тем же ключом — влить source в target (merge-combine.ts),
      //    затем удалить строки source, которые столкнулись бы по unique.
      const combined = await combineConflicts(tx, sourceId, targetId);
      state.combined = combined.combined;
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
            rule.cols.map((c) => {
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

      // 3-4. Pair и TherapyRelation: дедуп активных связей и ремап (см. merge-relations.ts).
      await remapRelations(tx, sourceId, targetId);

      // 4b. TherapistNote (therapistId, clientId — no FK, no unique). IS DISTINCT
      // FROM — для NULL clientId (виртуальные клиенты и просто NULL-строки).
      await tx.$executeRaw(Prisma.sql`
        UPDATE "TherapistNote" SET "therapistId" = ${targetId}
        WHERE "therapistId" = ${sourceId}
          AND "clientId" IS DISTINCT FROM ${targetId}
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
      //     Target wins: строка source с той же парой после ремапа дропается.
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

      // 4d. ModeMap (therapistId / clientId, без unique) — до аудита 2026-07
      // карты режимов при merge не переносились вовсе и терялись для
      // терапевта. Паттерн как у TherapistNote; clientId может быть
      // отрицательным (виртуальный клиент) — обычный remap это покрывает.
      await tx.$executeRaw(Prisma.sql`
        UPDATE "ModeMap" SET "therapistId" = ${targetId}
        WHERE "therapistId" = ${sourceId} AND "clientId" <> ${targetId}
      `);
      await tx.$executeRaw(Prisma.sql`
        UPDATE "ModeMap" SET "clientId" = ${targetId}
        WHERE "clientId" = ${sourceId} AND "therapistId" <> ${targetId}
      `);
      await tx.$executeRaw(Prisma.sql`
        DELETE FROM "ModeMap" WHERE "therapistId" = ${sourceId} OR "clientId" = ${sourceId}
      `);

      // 4e. TherapistCustomMode (только therapistId, без unique) — просто remap.
      await tx.$executeRaw(Prisma.sql`
        UPDATE "TherapistCustomMode" SET "therapistId" = ${targetId}
        WHERE "therapistId" = ${sourceId}
      `);

      // Step D: orphaned virtual-client conceptualizations (negative clientId =
      // -TherapyRelation.id, relation already gone after a buggy merge) would
      // pollute a new virtual client with the same id — delete them.
      await tx.$executeRaw(Prisma.sql`
        DELETE FROM "ClientConceptualization" cc
        WHERE cc."therapistId" = ${targetId}
          AND cc."clientId" < 0
          AND NOT EXISTS (
            SELECT 1 FROM "TherapyRelation" tr
            WHERE tr.id = -cc."clientId"
              AND tr."therapistId" = ${targetId}
              AND tr.status = 'active'
          )
      `);

      // 5. Скалярные поля User source → target (до DELETE source); вынесено в
      //    merge-user-fields.ts (правило №10).
      await mergeUserScalarFields(tx, sourceId, targetId);

      // 5b. Подписка привязана к telegramId, а не userId — цикл по
      //     USER_OWNED_TABLES её не видит и она осталась бы на удаляемом аккаунте.
      state.subs = await reassignSubscriptions(tx, sourceId, targetId);

      await remapAssignerRefs(tx, sourceId, targetId); // 5c (D-6)

      // 6. Finally, delete the now-empty source User.
      await tx.$executeRaw(
        Prisma.sql`DELETE FROM "User" WHERE id = ${sourceId}`,
      );
    });
    const ms = Date.now() - startedAt;
    this.logger.log(
      `Merged user ${sourceId} → ${targetId} (${ms}ms), подписок перенесено: ` +
        (state.subs.kind === 'moved' ? state.subs.count : 0) +
        `, записей объединено: ${state.combined}`,
    );
    // Живые подписки с обеих сторон — редчайший случай про деньги, который
    // нельзя решить кодом (какую отменить — не наше решение). Идёт через
    // SecurityLogService, а не прямым notifyAdminWithFallback: там уже есть
    // бюджет DM (правило №14 — сигнализация без троттлинга мьютит чат ровно
    // во время аварии). Сообщается ПОСЛЕ транзакции: сеть внутри неё держала
    // бы блокировки, а недоставка не должна откатывать слияние.
    if (state.subs.kind === 'conflict') {
      this.securityLog.log('merge_subscription_conflict', {
        sourceId: String(sourceId),
        targetId: String(targetId),
        sourceLive: state.subs.sourceLive,
        targetLive: state.subs.targetLive,
        detail: conflictAlertText(sourceId, targetId, state.subs),
      });
    }
  }
}
