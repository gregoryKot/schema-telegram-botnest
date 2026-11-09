// Вид записи в ленте «Записей» (docs/design/APP_2026-11.md, b11-diary-feed): знак и бумага по типу
// записи берутся из ENTITY_LOOK — как строка задания и «Моего пути», а не выбираются на месте.
// Схема — Layers на глине, мысль — Pebbles на персике, разбор — Ribbon на шалфее, режим — знак и
// бумага своей группы (modeLook: Карающий Критик — Looming на сливе), благодарность — Pebbles
// filled на бирюзе: окрашено столько камешков, сколько записано «спасибо» (решение 2). Черновик —
// вид своего типа (таблица ENTITY_LOOK, строка «Черновик»), а не всегда бумага схем.
import { ENTITY_LOOK, type EntityId, type Look } from '../../../../shared/src/theme/entityLook';
import { modeLookById } from '../../components/diary/modeLookById';
import { pebblesLaid } from '../../components/art/paper';
import type { DiaryType } from '../../types';
import { modeEntryKind, schemaEntryKind, type EntryKind } from './entryKind';
import type { AnyEntry } from './diaryModel';

/** Вид строки ленты; `filled` — камешков благодарности (вариант мотива Pebbles с данными). */
export interface FeedLook extends Look { filled?: number }
/** Запись ленты без ключей сортировки — карточка знает только тип и саму запись. */
export type EntryRef = AnyEntry extends infer T ? (T extends AnyEntry ? Pick<T, '_type' | 'entry'> : never) : never;

const KIND_ENTITY: Record<Exclude<EntryKind, 'mode'>, EntityId> = {
  schema: 'diary_schema', thought: 'diary', case: 'case', gratitude: 'gratitude', tracker: 'tracker',
};


/** Вид типа записи; режим — по своей группе, без режима — общий знак режимов. */
export function kindLook(kind: EntryKind, modeId?: string): Look {
  if (kind === 'mode' && modeId) return modeLookById(modeId);
  const { hue, sign } = ENTITY_LOOK[kind === 'mode' ? 'diary_mode' : KIND_ENTITY[kind]];
  return { hue, sign };
}

/** Тип строки ленты — тот же ярлык, что на главной (entryKind.ts). */
export function entryKindOf(item: EntryRef): EntryKind {
  if (item._type === 'schema') return schemaEntryKind(item.entry);
  if (item._type === 'mode') return modeEntryKind(item.entry);
  return item._type;
}

/** Вид строки ленты по самой записи. */
export function entryLook(item: EntryRef): FeedLook {
  if (item._type === 'mode') return kindLook(entryKindOf(item), item.entry.modeId);
  if (item._type === 'gratitude') return { ...kindLook('gratitude'), filled: pebblesLaid(item.entry.items.length) };
  return kindLook(entryKindOf(item));
}

/** Вид черновика: бумага и знак своего типа; режим — группы выбранного режима, если он уже выбран. */
export function draftLook(type: DiaryType, data: unknown): FeedLook {
  const d = (data ?? {}) as Record<string, unknown>;
  if (type === 'mode') return kindLook('mode', typeof d.modeId === 'string' && d.modeId ? d.modeId : undefined);
  if (type === 'schema') return kindLook('schema');
  const items = Array.isArray(d.items) ? d.items.filter((i) => typeof i === 'string' && i.trim()) : [];
  return { ...kindLook('gratitude'), filled: pebblesLaid(items.length) };
}
