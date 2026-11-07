import { decryptRecord, unreadableFields } from '../utils/crypto';
import { MODE_DIARY_SCHEMA, SCHEMA_DIARY_SCHEMA } from './diary.service';

// Метки дневников для ленты «Мой путь»: режим записи дневника режимов и схемы
// записи дневника схем. Это идентификаторы, но клинические: при записи их
// шифрует diary.service.ts (реестр — src/utils/encryption-policy.ts). Лента
// читала поля сырыми — фронт получал шифротекст вместо id, `getModeById` не
// находил режим, а строка вместо массива давала `[]`, и у записей дневников
// пропадал подзаголовок. Расшифровка — той же схемой, что GET самого дневника:
// легаси-строки открытым текстом и Json-массивом читаются как есть.

const asIds = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : [];

/** id режима записи дневника режимов; не прочиталось — нет метки, а не шифротекст. */
export function modeDiaryLabel(row: { modeId: string }): string | undefined {
  const r = decryptRecord(row, MODE_DIARY_SCHEMA);
  return unreadableFields(r).includes('modeId') ? undefined : r.modeId;
}

/** id схем записи дневника схем; не прочиталось — пустой список. */
export function schemaDiaryLabels(row: { schemaIds: unknown }): string[] {
  return asIds(decryptRecord(row, SCHEMA_DIARY_SCHEMA).schemaIds);
}
