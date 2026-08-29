import { Prisma } from '@prisma/client';
import {
  MERGED_USER_FIELDS,
  USER_MERGE_RULES,
  mergedValue,
} from './merge-user-rules';

// Диагностика 2026-08-21: после слияния Google-аккаунта с Telegram-аккаунтом
// пользователь снова проходил онбординг и заново выбирал форму обращения —
// merge.service переносил только recoveryEmail/disclaimerAccepted/role, про
// остальные скалярные поля User (флаги первого входа, addressForm) забыли.
// Перенесено сюда целиком из merge.service.ts (правило №10 — тот файл уже
// на потолке размера в baseline, дробим, а не пухнем дальше).
//
// Разбор 2026-08-29: прежний список строился как `[...FLAG_FIELDS,
// 'addressForm']` — «UI-флаги плюс одно поле», — и всё остальное молча
// пропадало вместе с удаляемой строкой source: «мои схемы» и «мои режимы»,
// настройки уведомлений, кастомизация мини-аппа, имя. Теперь решение принято
// для КАЖДОГО скалярного поля User (merge-user-rules.ts), а сверка со
// schema.prisma держится тестом — забыть поле больше нельзя (правило №4).

type MergeableUser = Record<string, unknown>;

/**
 * Переносит скалярные поля User source → target внутри уже открытой
 * транзакции merge.
 *
 * 1) recoveryEmail — @unique, требует особого шага очистки source перед
 *    записью в target;
 * 2) disclaimerAccepted / role+therapistMode — «true»/роль источника
 *    побеждают, merge не должен молча понижать доступ;
 * 3) остальные скаляры — по правилу из USER_MERGE_RULES (merge-user-rules.ts):
 *    флаг «уже видел», объединение массивов, заполнение пустого, приватность
 *    (побеждает более закрытое) и настройка со схемным дефолтом. Правило у
 *    каждого поля своё и записано явно — тип значения его не заменяет:
 *    `therapistShareCards` и `onboardingV1Done` оба boolean, но у первого
 *    слияние обязано выбрать false, а у второго true.
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

  // Собираем select одним объектом: пофайловое присваивание по ключу разводит
  // union типов Prisma до «too complex to represent».
  const select = Object.fromEntries(
    MERGED_USER_FIELDS.map((f) => [f, true]),
  ) as Prisma.UserSelect;
  const [src, tgt] = await Promise.all([
    tx.user.findUnique({ where: { id: sourceId }, select }),
    tx.user.findUnique({ where: { id: targetId }, select }),
  ]);
  if (!src || !tgt) return;
  const srcRow = src as MergeableUser;
  const tgtRow = tgt as MergeableUser;

  const data: Record<string, unknown> = {};
  for (const f of MERGED_USER_FIELDS) {
    const next = mergedValue(USER_MERGE_RULES[f], srcRow[f], tgtRow[f]);
    if (next !== undefined) data[f] = next;
  }
  if (Object.keys(data).length > 0) {
    await tx.user.update({ where: { id: targetId }, data });
  }
}
