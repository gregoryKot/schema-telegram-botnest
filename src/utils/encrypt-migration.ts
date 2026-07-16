import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { encrypt, decrypt, encryptJson, looksLikeCiphertext } from './crypto';

const logger = new Logger('EncryptMigration');

// Heuristic — a value is plaintext iff decrypt() returns it unchanged
// (and it's non-empty). Decrypt is no-op for non-base64 / wrong-tag input.
//
// БАГ (найден аудитом, см. encrypt-migration.spec.ts): если ключ, которым
// строка была зашифрована, больше не сконфигурирован (ENCRYPTION_KEY_OLD
// убрали раньше времени), decrypt(v) === v тоже — не потому что v плейнтекст,
// а потому что decrypt() тихо возвращает вход как есть, не подобрав ключ.
// Раньше это трактовалось как «плейнтекст» и шифровалось ЕЩЁ РАЗ — оригинал
// становился нечитаемым без старого ключа.
//
// Фикс: если строка decrypt-инвариантна, но ПОХОЖА на наш формат шифротекста
// (looksLikeCiphertext — строгий base64 + длина ≥29 байт), это не плейнтекст,
// а неизвестный/утерянный ключ — строку нельзя трогать. Тред-офф: настоящий
// плейнтекст, случайно являющийся валидным base64 ≥29 байт (редко, но
// возможно), тоже будет пропущен и останется незашифрованным — миграция
// идемпотентна и дошифрует его позже, после починки ключей. Это дешевле, чем
// необратимая потеря данных от двойного шифрования.
type PlaintextCheck = 'plaintext' | 'encrypted' | 'unknown-key';

function classify(v: string): PlaintextCheck {
  if (!v) return 'encrypted'; // пусто — трогать нечего
  if (decrypt(v) !== v) return 'encrypted';
  if (looksLikeCiphertext(v)) return 'unknown-key';
  return 'plaintext';
}

function warnUnknownKey(table: string, id: unknown): void {
  console.warn(
    `[encrypt-migration] ${table}#${String(id)}: возможна неполная ротация ` +
      'ENCRYPTION_KEY — строка похожа на шифротекст, пропущена',
  );
}

// Обёртка над prisma.update — одна упавшая строка не должна обрывать всю
// миграцию (раньше падение for-цикла на первой же ошибке БД оставляло
// необработанными все остальные строки и таблицы, см. spec).
async function safeUpdate(
  table: string,
  id: unknown,
  run: () => Promise<unknown>,
  failures: { count: number },
): Promise<boolean> {
  try {
    await run();
    return true;
  } catch (e) {
    failures.count++;
    logger.warn(
      `${table}#${String(id)}: update failed, skipping — ${(e as Error).message}`,
    );
    return false;
  }
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
  const failures = { count: 0 };

  // ── Note.tags ──────────────────────────────────────────────────────────────
  // Stored as comma-separated string. Encrypt the whole thing as one blob.
  const notes = await prisma.note.findMany({
    where: { tags: { not: '' } },
    select: { id: true, tags: true },
  });
  for (const n of notes) {
    const status = classify(n.tags);
    if (status === 'unknown-key') {
      warnUnknownKey('Note', n.id);
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
    if (!Array.isArray(e.schemaIds)) continue; // string → already encrypted
    const enc = encryptJson(e.schemaIds);
    if (!enc) continue;
    const ok = await safeUpdate(
      'SchemaDiaryEntry',
      e.id,
      () =>
        prisma.schemaDiaryEntry.update({
          where: { id: e.id },
          data: { schemaIds: enc as any },
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
      warnUnknownKey('ModeDiaryEntry', e.id);
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
  const concepts = await (prisma as any).clientConceptualization.findMany({
    select: { id: true, schemaIds: true, modeIds: true, history: true },
  });
  for (const c of concepts) {
    const cid = c.id as number; // единственный доступ к c.id — переиспользуем ниже
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
      const ok = await safeUpdate(
        'ClientConceptualization',
        cid,
        () =>
          (prisma as any).clientConceptualization.update({
            where: { id: cid },
            data: patch,
          }),
        failures,
      );
      if (ok) totals.ClientConceptualization++;
    }
  }

  const total = Object.values(totals).reduce((a, b) => a + b, 0);
  const ms = Date.now() - startedAt;
  if (failures.count > 0) {
    logger.warn(
      `Clinical-label migration finished with ${failures.count} row failure(s) ` +
        `— see warnings above for affected ids (${ms}ms)`,
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
}
