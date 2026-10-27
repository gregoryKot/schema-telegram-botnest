import {
  DIARY_QUICK_TAGS,
  HOME_TILES,
} from '../analytics/home-events.constants';

const TILE_SET = new Set<string>(HOME_TILES);
const QUICK_TAG_SET = new Set<string>(DIARY_QUICK_TAGS);

// Санитизация meta для home_tile: пропускаем ТОЛЬКО { tile } из allow-list
// (правило №7/№8). Вызывается из sanitizeMeta с уже проверенным именем.
export function sanitizeHomeTileMeta(
  meta: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const tile = meta.tile;
  if (typeof tile === 'string' && TILE_SET.has(tile)) return { tile };
  return undefined;
}

// Санитизация meta для diary_quick_save: только { tag } из allow-list и
// булев detailed. Текст записи сюда не попадает никогда (правило №7/№8).
export function sanitizeDiaryQuickMeta(
  meta: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const { tag, detailed } = meta;
  if (typeof tag !== 'string' || !QUICK_TAG_SET.has(tag)) return undefined;
  return { tag, detailed: detailed === true };
}

// События главной простого клиента (HOME_EVENTS). Остальные имена — undefined.
export function sanitizeHomeMeta(
  name: string,
  meta: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (name === 'home_tile') return sanitizeHomeTileMeta(meta);
  if (name === 'diary_quick_save') return sanitizeDiaryQuickMeta(meta);
  // tracker_skip без полей: что бы ни прислали, в базу уходит пустой объект.
  if (name === 'tracker_skip') return {};
  return undefined;
}
