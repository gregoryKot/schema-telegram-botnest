/**
 * Санитизация meta события «Карты себя» (self_map_link): только перечислимое
 * `to` из allow-list, всё прочее отбрасывается (правило №7: свободного текста нет).
 */
import { SELF_MAP_LINK_TARGET_SET } from '../analytics/self-map-events.constants';

export function sanitizeSelfMapMeta(
  meta: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const to = meta.to;
  if (typeof to === 'string' && SELF_MAP_LINK_TARGET_SET.has(to)) {
    return { to };
  }
  return undefined;
}
