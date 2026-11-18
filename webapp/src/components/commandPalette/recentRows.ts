// Группа «Недавнее» общего поиска: ключи последних открытых строк (paletteRecent.ts) → строки,
// доступные сейчас. Ключ не нашёлся (клиент ушёл, другой режим, справочник не загружен) — строки нет.
import type { CmdRow } from '../CommandPaletteList';

export const RECENT_GROUP = 'Недавнее';

/** `available` — все строки, которые можно открыть сейчас; порядок результата — порядок ключей. */
export function recentRows(recent: string[], available: CmdRow[]): CmdRow[] {
  if (recent.length === 0) return [];
  const byKey = new Map(available.map((row) => [row.key, row]));
  return recent.flatMap((key) => {
    const row = byKey.get(key);
    return row ? [{ ...row, group: RECENT_GROUP, after: undefined }] : [];
  });
}
