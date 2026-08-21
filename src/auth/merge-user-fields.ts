import { Prisma } from '@prisma/client';
import { FLAG_FIELDS } from '../api/flag-fields';

// Диагностика 2026-08-21: после слияния Google-аккаунта с Telegram-аккаунтом
// пользователь снова проходил онбординг и заново выбирал форму обращения —
// merge.service переносил только recoveryEmail/disclaimerAccepted/role, про
// остальные скалярные поля User (флаги первого входа, addressForm) забыли.
// Перенесено сюда целиком из merge.service.ts (правило №10 — тот файл уже
// на потолке размера в baseline, дробим, а не пухнем дальше).
//
// FIELDS_TO_MERGE переиспользует FLAG_FIELDS — единственный реестр «какие
// typed UI-флаги есть у User» (src/api/flag-fields.ts, читает/пишет
// api.controller.ts) — вместо копии списка (правило №4: денормализация и
// дублированные реестры только с тестом-сверкой; тут вместо теста — сам факт
// одного файла-источника). addressForm сюда не входит (это выбор формы
// обращения, не UI-флаг), добавляем отдельно — семантика такая же: перенос,
// только если у target пусто.
const FIELDS_TO_MERGE = [...FLAG_FIELDS, 'addressForm'] as const;

type MergeableUser = Record<(typeof FIELDS_TO_MERGE)[number], unknown>;

/**
 * Переносит скалярные поля User source → target внутри уже открытой
 * транзакции merge.
 *
 * 1) recoveryEmail — @unique, требует особого шага очистки source перед
 *    записью в target;
 * 2) disclaimerAccepted / role+therapistMode — «true»/роль источника
 *    побеждают, merge не должен молча понижать доступ;
 * 3) FIELDS_TO_MERGE (флаги первого входа + addressForm) — семантика по типу
 *    поля, определяемому не отдельным хардкод-списком (который снова мог бы
 *    разойтись с FLAG_FIELDS), а рантайм-проверкой значения, прочитанного из
 *    БД (typeof/Array.isArray):
 *      - boolean: true побеждает false — юзер это уже проходил/подтвердил
 *        в одном из аккаунтов, показывать заново незачем;
 *      - JSON-массив (onboardingSkipped/schemaIntrosShown/modeIntrosShown):
 *        объединение без дублей — интро могли начать смотреть в одном
 *        аккаунте, а закончить в другом;
 *      - остальное (nullable string — themePref/addressForm/lastCelebration
 *        Date/…): переносим, только если у target пусто (null), не затираем
 *        уже сделанный пользователем выбор.
 */
export async function mergeUserScalarFields(
  tx: Prisma.TransactionClient,
  sourceId: bigint,
  targetId: bigint,
): Promise<void> {
  const srcEmailRows = await tx.$queryRaw<
    Array<{ re: string | null; rev: Date | null }>
  >(Prisma.sql`
    SELECT "recoveryEmail" AS re, "recoveryEmailVerifiedAt" AS rev
    FROM "User" WHERE id = ${sourceId}
  `);
  const srcEmail = srcEmailRows[0]?.re ?? null;
  const srcEmailVerified = srcEmailRows[0]?.rev ?? null;
  if (srcEmail) {
    // Free the unique slot on source first
    await tx.$executeRaw(Prisma.sql`
      UPDATE "User" SET "recoveryEmail" = NULL, "recoveryEmailVerifiedAt" = NULL
      WHERE id = ${sourceId}
    `);
    // Apply to target only if target has no email yet
    await tx.$executeRaw(Prisma.sql`
      UPDATE "User" SET "recoveryEmail" = ${srcEmail}, "recoveryEmailVerifiedAt" = ${srcEmailVerified}
      WHERE id = ${targetId} AND "recoveryEmail" IS NULL
    `);
  }

  await tx.$executeRaw(Prisma.sql`
    UPDATE "User" SET "disclaimerAccepted" = true
    WHERE id = ${targetId}
      AND (SELECT "disclaimerAccepted" FROM "User" WHERE id = ${sourceId})
  `);
  // Promote target to THERAPIST if source had that role — merge must not
  // silently downgrade a user's access level. Also carry therapistMode flag
  // (account.service.setRole sets them together; merge should mirror that).
  await tx.$executeRaw(Prisma.sql`
    UPDATE "User" SET "role" = 'THERAPIST', "therapistMode" = true
    WHERE id = ${targetId}
      AND (SELECT "role" FROM "User" WHERE id = ${sourceId}) = 'THERAPIST'
  `);

  const select: Prisma.UserSelect = {};
  for (const f of FIELDS_TO_MERGE) select[f] = true;
  const [src, tgt] = await Promise.all([
    tx.user.findUnique({ where: { id: sourceId }, select }),
    tx.user.findUnique({ where: { id: targetId }, select }),
  ]);
  if (!src || !tgt) return;
  const srcRow = src as MergeableUser;
  const tgtRow = tgt as MergeableUser;

  const data: Record<string, unknown> = {};
  for (const f of FIELDS_TO_MERGE) {
    const s = srcRow[f];
    const t = tgtRow[f];
    if (typeof t === 'boolean') {
      if (s === true && t === false) data[f] = true;
    } else if (Array.isArray(t)) {
      const tArr = t as unknown[];
      const sArr = Array.isArray(s) ? (s as unknown[]) : [];
      const merged = Array.from(new Set([...tArr, ...sArr]));
      if (merged.length !== tArr.length) data[f] = merged;
    } else if (t == null && s != null) {
      // nullable string: themePref, addressForm, lastCelebrationDate, …
      data[f] = s;
    }
  }
  if (Object.keys(data).length > 0) {
    await tx.user.update({ where: { id: targetId }, data });
  }
}
