import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { encrypt, encryptJson } from './crypto';
import {
  classify,
  conceptJsonValues,
  countUnknownKeyJson,
  encryptArrayFields,
  safeUpdate,
  warnUnknownKey,
} from './encrypt-migration.rows';
import { describeClinicalProblems } from './encrypt-migration.report';

const logger = new Logger('EncryptMigration');

// Force-encrypt clinical labels that were stored before encryption was added
// to those fields. Idempotent — runs on every startup but only mutates rows
// that are still plaintext. Bails out cleanly if ENCRYPTION_KEY isn't set.
//
// Migrates:
//   Note.tags
//   User.mySchemaIds, User.myModeIds
//   SchemaDiaryEntry.schemaIds
//   ModeDiaryEntry.modeId
//   ClientConceptualization.schemaIds, modeIds, history[].schemaIds, modeIds
// JSON-поле со строкой под потерянным ключом не пишется, но идёт в unknownKey.
export interface ClinicalMigrationResult {
  /** Сколько строк зашифровано за этот прогон, по таблицам. */
  encrypted: Record<string, number>;
  /** Сколько строк не удалось записать. */
  failures: number;
  /** Строки, похожие на шифротекст, но не читаемые текущим ключом, по таблицам. */
  unknownKey: Record<string, number>;
}

export async function migrateClinicalLabels(
  prisma: PrismaService,
): Promise<ClinicalMigrationResult> {
  if (!process.env.ENCRYPTION_KEY) {
    logger.warn('ENCRYPTION_KEY not set — skipping clinical-label migration');
    return { encrypted: {}, failures: 0, unknownKey: {} };
  }
  const startedAt = Date.now();
  const totals = {
    Note: 0,
    User: 0,
    SchemaDiaryEntry: 0,
    ModeDiaryEntry: 0,
    ClientConceptualization: 0,
  };
  const failures = { count: 0 };
  const unknownKey: Record<string, number> = {};

  // ── Note.tags ──────────────────────────────────────────────────────────────
  // Stored as comma-separated string. Encrypt the whole thing as one blob.
  const notes = await prisma.note.findMany({
    where: { tags: { not: '' } },
    select: { id: true, tags: true },
  });
  for (const n of notes) {
    const status = classify(n.tags);
    if (status === 'unknown-key') {
      warnUnknownKey('Note', n.id, unknownKey);
      continue;
    }
    if (status !== 'plaintext') continue;
    const enc = encrypt(n.tags);
    if (!enc) continue;
    const ok = await safeUpdate(
      'Note',
      n.id,
      () => prisma.note.update({ where: { id: n.id }, data: { tags: enc } }),
      failures,
    );
    if (ok) totals.Note++;
  }

  // ── User.mySchemaIds / User.myModeIds ──────────────────────────────────────
  // JSON column. Legacy rows: array. New rows: encrypted string.
  const users = await prisma.user.findMany({
    select: { id: true, mySchemaIds: true, myModeIds: true },
  });
  for (const u of users) {
    countUnknownKeyJson('User', [u.mySchemaIds, u.myModeIds], unknownKey);
    const patch: Prisma.UserUpdateInput = encryptArrayFields(u, [
      'mySchemaIds',
      'myModeIds',
    ]);
    if (Object.keys(patch).length > 0) {
      const ok = await safeUpdate(
        'User',
        u.id,
        () => prisma.user.update({ where: { id: u.id }, data: patch }),
        failures,
      );
      if (ok) totals.User++;
    }
  }

  // ── SchemaDiaryEntry.schemaIds ────────────────────────────────────────────
  const schemaEntries = await prisma.schemaDiaryEntry.findMany({
    select: { id: true, schemaIds: true },
  });
  for (const e of schemaEntries) {
    if (!Array.isArray(e.schemaIds)) {
      // string → already encrypted (или под потерянным ключом → в остаток)
      countUnknownKeyJson('SchemaDiaryEntry', [e.schemaIds], unknownKey);
      continue;
    }
    const enc = encryptJson(e.schemaIds);
    if (!enc) continue;
    const ok = await safeUpdate(
      'SchemaDiaryEntry',
      e.id,
      () =>
        prisma.schemaDiaryEntry.update({
          where: { id: e.id },
          data: { schemaIds: enc },
        }),
      failures,
    );
    if (ok) totals.SchemaDiaryEntry++;
  }

  // ── ModeDiaryEntry.modeId (single string) ─────────────────────────────────
  const modeEntries = await prisma.modeDiaryEntry.findMany({
    select: { id: true, modeId: true },
  });
  for (const e of modeEntries) {
    const status = classify(e.modeId);
    if (status === 'unknown-key') {
      warnUnknownKey('ModeDiaryEntry', e.id, unknownKey);
      continue;
    }
    if (status !== 'plaintext') continue;
    const enc = encrypt(e.modeId);
    if (!enc) continue;
    const ok = await safeUpdate(
      'ModeDiaryEntry',
      e.id,
      () =>
        prisma.modeDiaryEntry.update({
          where: { id: e.id },
          data: { modeId: enc },
        }),
      failures,
    );
    if (ok) totals.ModeDiaryEntry++;
  }

  // ── ClientConceptualization.schemaIds / modeIds (+ history snapshots) ────
  const concepts = await prisma.clientConceptualization.findMany({
    select: { id: true, schemaIds: true, modeIds: true, history: true },
  });
  for (const c of concepts) {
    countUnknownKeyJson(
      'ClientConceptualization',
      conceptJsonValues(c),
      unknownKey,
    );
    const patch: Prisma.ClientConceptualizationUpdateInput = encryptArrayFields(
      c,
      ['schemaIds', 'modeIds'],
    );
    // History — array of snapshots, each with its own schemaIds/modeIds
    if (Array.isArray(c.history)) {
      const newHistory = c.history.map((snap) => {
        const s = { ...(snap as Record<string, unknown>) };
        return { ...s, ...encryptArrayFields(s, ['schemaIds', 'modeIds']) };
      });
      // Only patch history if something actually changed
      if (JSON.stringify(newHistory) !== JSON.stringify(c.history))
        patch.history = newHistory;
    }
    if (Object.keys(patch).length > 0) {
      const ok = await safeUpdate(
        'ClientConceptualization',
        c.id,
        () =>
          prisma.clientConceptualization.update({
            where: { id: c.id },
            data: patch,
          }),
        failures,
      );
      if (ok) totals.ClientConceptualization++;
    }
  }

  const total = Object.values(totals).reduce((a, b) => a + b, 0);
  const ms = Date.now() - startedAt;
  const problems = describeClinicalProblems({
    unknownKey,
    failures: failures.count,
  });
  if (problems.length > 0) {
    // Один error за старт — через AlertLogger уходит владельцу в DM. Только
    // счётчики и имена таблиц: метки клинические, содержимое в лог не идёт.
    logger.error(
      `Clinical-label migration finished with problems: ${problems.join('; ')} (${ms}ms)`,
    );
  }
  if (total > 0) {
    logger.log(
      `Encrypted clinical labels: ${JSON.stringify(totals)} (${ms}ms)`,
    );
  } else {
    logger.log(
      `No plaintext clinical labels found — migration is up-to-date (${ms}ms)`,
    );
  }
  return { encrypted: totals, failures: failures.count, unknownKey };
}
