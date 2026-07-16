import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { encrypt, decrypt, encryptJson } from './crypto';

const logger = new Logger('EncryptMigration');

// Heuristic — a value is plaintext iff decrypt() returns it unchanged
// (and it's non-empty). Decrypt is no-op for non-base64 / wrong-tag input.
function looksPlaintext(v: string): boolean {
  if (!v) return false;
  return decrypt(v) === v;
}

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
export async function migrateClinicalLabels(
  prisma: PrismaService,
): Promise<void> {
  if (!process.env.ENCRYPTION_KEY) {
    logger.warn('ENCRYPTION_KEY not set — skipping clinical-label migration');
    return;
  }
  const startedAt = Date.now();
  const totals = {
    Note: 0,
    User: 0,
    SchemaDiaryEntry: 0,
    ModeDiaryEntry: 0,
    ClientConceptualization: 0,
  };

  // ── Note.tags ──────────────────────────────────────────────────────────────
  // Stored as comma-separated string. Encrypt the whole thing as one blob.
  const notes = await prisma.note.findMany({
    where: { tags: { not: '' } },
    select: { id: true, tags: true },
  });
  for (const n of notes) {
    if (!looksPlaintext(n.tags)) continue;
    const enc = encrypt(n.tags);
    if (!enc) continue;
    await prisma.note.update({ where: { id: n.id }, data: { tags: enc } });
    totals.Note++;
  }

  // ── User.mySchemaIds / User.myModeIds ──────────────────────────────────────
  // JSON column. Legacy rows: array. New rows: encrypted string.
  const users = await prisma.user.findMany({
    select: { id: true, mySchemaIds: true, myModeIds: true },
  });
  for (const u of users) {
    const patch: any = {};
    if (Array.isArray(u.mySchemaIds)) {
      const enc = encryptJson(u.mySchemaIds);
      if (enc) patch.mySchemaIds = enc;
    }
    if (Array.isArray(u.myModeIds)) {
      const enc = encryptJson(u.myModeIds);
      if (enc) patch.myModeIds = enc;
    }
    if (Object.keys(patch).length > 0) {
      await prisma.user.update({ where: { id: u.id }, data: patch });
      totals.User++;
    }
  }

  // ── SchemaDiaryEntry.schemaIds ────────────────────────────────────────────
  const schemaEntries = await prisma.schemaDiaryEntry.findMany({
    select: { id: true, schemaIds: true },
  });
  for (const e of schemaEntries) {
    if (!Array.isArray(e.schemaIds)) continue; // string → already encrypted
    const enc = encryptJson(e.schemaIds);
    if (!enc) continue;
    await prisma.schemaDiaryEntry.update({
      where: { id: e.id },
      data: { schemaIds: enc },
    });
    totals.SchemaDiaryEntry++;
  }

  // ── ModeDiaryEntry.modeId (single string) ─────────────────────────────────
  const modeEntries = await prisma.modeDiaryEntry.findMany({
    select: { id: true, modeId: true },
  });
  for (const e of modeEntries) {
    if (!looksPlaintext(e.modeId)) continue;
    const enc = encrypt(e.modeId);
    if (!enc) continue;
    await prisma.modeDiaryEntry.update({
      where: { id: e.id },
      data: { modeId: enc },
    });
    totals.ModeDiaryEntry++;
  }

  // ── ClientConceptualization.schemaIds / modeIds (+ history snapshots) ────
  const concepts = await prisma.clientConceptualization.findMany({
    select: { id: true, schemaIds: true, modeIds: true, history: true },
  });
  for (const c of concepts) {
    const patch: any = {};
    if (Array.isArray(c.schemaIds)) {
      const enc = encryptJson(c.schemaIds);
      if (enc) patch.schemaIds = enc;
    }
    if (Array.isArray(c.modeIds)) {
      const enc = encryptJson(c.modeIds);
      if (enc) patch.modeIds = enc;
    }
    // History — array of snapshots, each with its own schemaIds/modeIds
    if (Array.isArray(c.history)) {
      const newHistory = c.history.map((snap: any) => {
        const s: any = { ...snap };
        if (Array.isArray(s.schemaIds)) s.schemaIds = encryptJson(s.schemaIds);
        if (Array.isArray(s.modeIds)) s.modeIds = encryptJson(s.modeIds);
        return s;
      });
      // Only patch history if something actually changed
      if (JSON.stringify(newHistory) !== JSON.stringify(c.history))
        patch.history = newHistory;
    }
    if (Object.keys(patch).length > 0) {
      await prisma.clientConceptualization.update({
        where: { id: c.id },
        data: patch,
      });
      totals.ClientConceptualization++;
    }
  }

  const total = Object.values(totals).reduce((a, b) => a + b, 0);
  const ms = Date.now() - startedAt;
  if (total > 0) {
    logger.log(
      `Encrypted clinical labels: ${JSON.stringify(totals)} (${ms}ms)`,
    );
  } else {
    logger.log(
      `No plaintext clinical labels found — migration is up-to-date (${ms}ms)`,
    );
  }
}
