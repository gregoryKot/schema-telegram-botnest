import { Prisma } from '@prisma/client';
import { EncryptSchema, decryptRecord, encryptRecord } from '../utils/crypto';
import { FIELD_POLICY } from '../utils/encryption-policy';
import {
  MERGED_USER_FIELDS,
  USER_MERGE_RULES,
  mergedValue,
} from './merge-user-rules';

// Инцидент 2026-10 (аудит, backend#0): слияние читало `User.mySchemaIds` /
// `myModeIds` сырым значением. По FIELD_POLICY.User оба поля `enc`: в Json-
// колонке лежит base64-СТРОКА шифротекста, а правило `union` понимает только
// массивы. Две строки вместо двух массивов давали `[] ∪ [] → undefined`, список
// target не менялся, а список source исчезал вместе с удаляемой строкой —
// «Привязать Telegram» молча стирала выбранные схемы и режимы. Юнит был зелёным,
// потому что фикстуры были plaintext-массивами, которых в колонке не бывает.

/**
 * Схема шифрования для слияния — ВЫВОДИТСЯ из FIELD_POLICY.User, а не
 * перечисляется литералом: поле, которое реестр шифрования объявил `enc` и
 * которое слияние переносит (правило не `skip`), обязано проходить
 * расшифровку/зашифровку. Union — правило для массивов (jsonArrays), остальные
 * правила работают со скалярами (strings).
 */
export function mergeEncryptSchema(): EncryptSchema {
  const policy = FIELD_POLICY.User ?? {};
  const jsonArrays: string[] = [];
  const strings: string[] = [];
  for (const f of MERGED_USER_FIELDS) {
    if (!policy[f] || !('enc' in policy[f])) continue;
    (USER_MERGE_RULES[f].kind === 'union' ? jsonArrays : strings).push(f);
  }
  return { jsonArrays, strings };
}

/**
 * Поле осталось строкой после decryptRecord → прочитать его нечем (ключ не
 * подошёл). Писать поверх такого значения нельзя: union из «пусто + список
 * source» затёр бы нечитаемый, но живой список target.
 */
export function isUnreadable(
  schema: EncryptSchema,
  row: Record<string, unknown>,
  field: string,
): boolean {
  return (
    (schema.jsonArrays ?? []).includes(field) && typeof row[field] === 'string'
  );
}

export const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/**
 * Денормализованные списки профиля и их источник правды — карточки. Заполненная
 * карточка ⇒ id в списке (инвариант notes.service.ts, правило №4): после merge
 * карточки уже на target, и их id обязаны оказаться в списке, даже если список
 * source был нечитаем или пуст.
 */
export async function noteBackedLists(
  tx: Prisma.TransactionClient,
  userId: bigint,
): Promise<Record<string, string[]>> {
  const [schemaRows, modeRows] = await Promise.all([
    tx.userSchemaNote.findMany({
      where: { userId },
      select: { schemaId: true },
    }),
    tx.userModeNote.findMany({ where: { userId }, select: { modeId: true } }),
  ]);
  return {
    mySchemaIds: [...new Set(schemaRows.map((r) => r.schemaId))],
    myModeIds: [...new Set(modeRows.map((r) => r.modeId))],
  };
}

/**
 * Что записать в User target: правила слияния (USER_MERGE_RULES) поверх
 * РАСШИФРОВАННЫХ строк, результат — снова шифротекстом, как его пишет продукт.
 */
export async function mergedUserData(
  tx: Prisma.TransactionClient,
  targetId: bigint,
  src: Record<string, unknown>,
  tgt: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const schema = mergeEncryptSchema();
  const srcRow = decryptRecord(src, schema);
  const tgtRow = decryptRecord(tgt, schema);
  const fromNotes = await noteBackedLists(tx, targetId);

  const data: Record<string, unknown> = {};
  for (const f of MERGED_USER_FIELDS) {
    // Нечитаемый список target не трогаем: перезапись потеряла бы его целиком.
    if (isUnreadable(schema, tgtRow, f)) continue;
    let source = srcRow[f];
    // Карточки target (уже с перенесёнными карточками source) — источник
    // правды для списка: их id обязаны оказаться в нём.
    if (fromNotes[f]) source = [...asArray(source), ...fromNotes[f]];
    const next = mergedValue(USER_MERGE_RULES[f], source, tgtRow[f]);
    if (next !== undefined) data[f] = next;
  }
  return encryptRecord(data, schema);
}
