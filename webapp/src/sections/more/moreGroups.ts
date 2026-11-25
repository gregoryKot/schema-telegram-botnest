/** Группы вкладки «Ещё»: порядок по смыслу — что складывается, что делать, терапевт, настройки и помощь. */
export interface MoreGroupDef { id: string; title: string; rowIds: readonly string[] }

export const MORE_GROUPS: readonly MoreGroupDef[] = [
  { id: 'grow', title: 'Что складывается', rowIds: ['selfmap', 'schemas', 'journey', 'test'] },
  { id: 'do', title: 'Делать', rowIds: ['practice', 'tasks'] },
  { id: 'therapist', title: 'Терапевт', rowIds: ['talk', 'cabinet'] },
  { id: 'help', title: 'Настройки и помощь', rowIds: ['settings', 'profile', 'why'] },
];

export interface MoreGroup<R> { id: string; title: string; rows: R[]; phoneOnly: boolean }

/** Раскладывает строки по группам в порядке MORE_GROUPS; пустые группы выпадают, строка вне групп — в последнюю.
 *  Группа только из телефонных строк помечена phoneOnly: на компьютере не остаётся заголовка без строк. */
export function groupMoreRows<R extends { id: string; phoneOnly?: boolean }>(rows: readonly R[]): MoreGroup<R>[] {
  const byId = new Map(rows.map(r => [r.id, r]));
  const known = new Set(MORE_GROUPS.flatMap(g => g.rowIds));
  const stray = rows.filter(r => !known.has(r.id));
  return MORE_GROUPS.map((g, i) => {
    const own = g.rowIds.flatMap(id => byId.get(id) ?? []);
    const groupRows = i === MORE_GROUPS.length - 1 ? [...own, ...stray] : own;
    return { id: g.id, title: g.title, rows: groupRows, phoneOnly: groupRows.every(r => !!r.phoneOnly) };
  }).filter(g => g.rows.length > 0);
}

/** Подпись строки «Задания»: без своего терапевта не обещает заданий «от терапевта». */
export const tasksRowSub = (connected: boolean) => connected ? 'От терапевта и свои цели' : 'Свои цели и шаги к ним';
