import {
  DIARY_QUICK_TAGS,
  HOME_TILES,
  NEXT_STEP_FROM,
  NEXT_STEP_TO,
} from '../analytics/home-events.constants';
import { THERAPY_NUDGE_EVENT } from '../analytics/therapy-nudge.constants';
import { sanitizeTherapyNudgeMeta } from './analytics-meta.sanitize-therapy-nudge';

const TILE_SET = new Set<string>(HOME_TILES);
const QUICK_TAG_SET = new Set<string>(DIARY_QUICK_TAGS);
const NEXT_FROM_SET = new Set<string>(NEXT_STEP_FROM);
const NEXT_TO_SET = new Set<string>(NEXT_STEP_TO);

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

// Санитизация meta для done_next_step: только пара { from, to } из allow-list'ов.
export function sanitizeDoneNextStepMeta(
  meta: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const { from, to } = meta;
  if (typeof from !== 'string' || !NEXT_FROM_SET.has(from)) return undefined;
  if (typeof to !== 'string' || !NEXT_TO_SET.has(to)) return undefined;
  return { from, to };
}

// События главной простого клиента (HOME_EVENTS). Остальные имена — undefined.
export function sanitizeHomeMeta(
  name: string,
  meta: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (name === 'home_tile') return sanitizeHomeTileMeta(meta);
  if (name === 'diary_quick_save') return sanitizeDiaryQuickMeta(meta);
  if (name === 'done_next_step') return sanitizeDoneNextStepMeta(meta);
  if (name === THERAPY_NUDGE_EVENT) return sanitizeTherapyNudgeMeta(meta);
  // tracker_skip без полей: что бы ни прислали, в базу уходит пустой объект.
  if (name === 'tracker_skip') return {};
  return undefined;
}
