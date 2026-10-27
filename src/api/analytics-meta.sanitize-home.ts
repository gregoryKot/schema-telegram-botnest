import { HOME_TILES } from '../analytics/home-events.constants';

const TILE_SET = new Set<string>(HOME_TILES);

// Санитизация meta для home_tile: пропускаем ТОЛЬКО { tile } из allow-list
// (правило №7/№8). Вызывается из sanitizeMeta с уже проверенным именем.
export function sanitizeHomeTileMeta(
  meta: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const tile = meta.tile;
  if (typeof tile === 'string' && TILE_SET.has(tile)) return { tile };
  return undefined;
}
