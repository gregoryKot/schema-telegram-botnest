// Знак записи клиента у терапевта по типу (APP_2026-11.md, b30/b31): тот же вид, что в ленте «Записи» клиента
// (sections/diary/feedLook.ts) — дневник схем `Layers` 28, дневник режимов `Cluster` 240 (группа режима в строке
// терапевта не показывается: тип различает знак), благодарность `Pebbles filled` 195, быстрая запись `Pebbles` 45.
// Оттенок и знак — из ENTITY_LOOK, а не на месте. Сигнатуру делят «Обзор» (b30) и вкладка «Записи клиента» (b31).
import { ENTITY_LOOK, type EntityId, type SignKey } from '../../../../shared/src/theme/entityLook';

export type NoteType = 'schema' | 'mode' | 'gratitude' | 'quick';

export interface NoteLook { hue: number; sign: SignKey; filled?: boolean }

const ENTITY: Record<NoteType, EntityId> = {
  schema: 'diary_schema',
  mode: 'diary_mode',
  gratitude: 'gratitude',
  quick: 'diary',
};

/** Вид строки записи по типу; благодарность — камешки закрашены (вариант мотива Pebbles). */
export function noteLook(type: NoteType): NoteLook {
  const { hue, sign } = ENTITY_LOOK[ENTITY[type]];
  return type === 'gratitude' ? { hue, sign, filled: true } : { hue, sign };
}
