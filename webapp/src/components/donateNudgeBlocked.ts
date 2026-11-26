/** Разделы, поверх которых просьбу о донате не показываем: человек пришёл за помощью (C-М6). */
export const DONATE_QUIET_SECTIONS: readonly string[] = ['practice'];

/** Просьбу не кладут поверх кризисного пути, экранов помощи и входной очереди. */
export function donateNudgeBlocked(p: { section?: string; anyOverlayOpen?: boolean; entryDone?: boolean }): boolean {
  return !!p.anyOverlayOpen || p.entryDone === false || (!!p.section && DONATE_QUIET_SECTIONS.includes(p.section));
}
