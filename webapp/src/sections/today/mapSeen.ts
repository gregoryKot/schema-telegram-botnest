import { readLocal, writeLocal } from '../../../../shared/src/utils/safeLocalStorage';

// Когда «Карту себя» открывали в последний раз (ISO). Удобство устройства, не данные:
// на другом телефоне точка-отметка просто покажется один лишний раз.
export const MAP_SEEN_KEY = 'selfmap_seen_v1';

export function readMapSeen(): string | null {
  return readLocal(MAP_SEEN_KEY);
}

export function markMapSeen(now: Date = new Date()): void {
  writeLocal(MAP_SEEN_KEY, now.toISOString());
}

/** Метка на карте — запись дневника режимов (из неё карту строит useSelfMapData). Новая — позже последнего открытия. */
export function hasNewOnMap(entries: ReadonlyArray<{ createdAt: string }>, seenAt: string | null): boolean {
  const seen = seenAt === null ? NaN : Date.parse(seenAt);
  if (Number.isNaN(seen)) return entries.length > 0;
  return entries.some(e => Date.parse(e.createdAt) > seen);
}
