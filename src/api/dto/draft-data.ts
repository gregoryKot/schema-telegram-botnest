import { applyDecorators } from '@nestjs/common';
import { IsObject, ValidateBy, buildMessage } from 'class-validator';
import { StringsWithin } from '../../therapy/dto/strings-within';
import { DIARY_FIELD_MAX } from '../../utils/text-limits';

// Схема поля `data` черновика дневника (POST /api/drafts/:type, SaveDraftDto).
// Раньше там стоял @Allow() — любой JSON до 256 КБ ложился в базу как есть
// (аудит 2026-11, S21). Форма черновика — снимок формы записи: у дневника схем
// поля SCHEMA_DIARY_FIELD_KEYS + emotions + schemaIds
// (shared/src/schema/useSchemaDiaryDraftState.ts), у режимов — поля
// ModeEntrySheet, у благодарности — { items }. Полей полтора десятка и они
// растут, поэтому вложенный DTO с whitelist молча срезал бы новые — проверяется
// не форма, а то, что раздувает тело: объект (не массив и не строка), ключей
// верхнего уровня не больше DRAFT_MAX_KEYS, любая строка и любой ключ на любой
// глубине — не длиннее поля записи дневника (тот же приём, что у карты
// режимов, src/therapy/dto/strings-within.ts).
export const DRAFT_MAX_KEYS = 50;

/** Объект, у которого не больше `max` собственных ключей. */
export function keysWithin(value: unknown, max: number): boolean {
  return (
    value !== null &&
    typeof value === 'object' &&
    Object.keys(value).length <= max
  );
}

const KeysWithin = (max: number): PropertyDecorator =>
  ValidateBy({
    name: 'keysWithin',
    constraints: [max],
    validator: {
      validate: (value) => keysWithin(value, max),
      defaultMessage: buildMessage(
        () => '$property: must have at most $constraint1 keys',
      ),
    },
  });

/** `data` черновика: объект, ≤ DRAFT_MAX_KEYS ключей, строки ≤ DIARY_FIELD_MAX. */
export const DraftData = (): PropertyDecorator =>
  applyDecorators(
    IsObject(),
    KeysWithin(DRAFT_MAX_KEYS),
    StringsWithin(DIARY_FIELD_MAX),
  );
